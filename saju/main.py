# -*- coding: utf-8 -*-
"""
main.py
워드프레스 연예인 사주 자동 포스팅 시스템 - 메인 실행 스크립트

실행 방법:
    python main.py                    # 기본 실행 (config.py 설정 사용)
    python main.py --dry-run          # 실제 발행 없이 테스트
    python main.py --max-posts 3      # 최대 3개 글만 처리
    python main.py --status draft     # 임시 저장으로 발행
    python main.py --action delete    # 원본 글 삭제 처리

케미클라우드(Python 환경) 또는 로컬 환경에서 직접 실행하거나
cron 등으로 주기적 실행이 가능합니다.
"""

import argparse
import logging
import sys
import time
from datetime import datetime
from typing import Optional
from dotenv import load_dotenv

try:
    from zoneinfo import ZoneInfo
except ImportError:  # Python < 3.9
    from backports.zoneinfo import ZoneInfo  # type: ignore

# .env 파일 로드 (config 임포트 전)
load_dotenv()

import config
from saju_calculator import calculate_saju, format_saju_for_prompt
from wordpress_client import WordPressClient
from deepseek_generator import DeepSeekContentGenerator
from peak_scheduler import (
    adjust_away_from_peak,
    describe_peaks,
    format_wp_datetime,
    wait_or_skip_if_peak,
)


# ─────────────────────────────────────────────
# 로깅 설정
# ─────────────────────────────────────────────

def setup_logging(log_level: str = "INFO", log_file: str = None) -> None:
    """로깅 핸들러를 설정합니다."""
    level = getattr(logging, log_level.upper(), logging.INFO)
    handlers = [logging.StreamHandler(sys.stdout)]
    if log_file:
        handlers.append(logging.FileHandler(log_file, encoding="utf-8"))

    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=handlers,
    )


logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# 단일 포스트 처리 함수
# ─────────────────────────────────────────────

def process_single_post(
    post: dict,
    wp_client: WordPressClient,
    llm,
    dry_run: bool = False,
    publish_status: str = "publish",
    instruction_action: str = "tag",
    scheduled_at: Optional[datetime] = None,
) -> bool:
    """
    '지시' 카테고리의 단일 포스트를 처리하여 사주 분석 글을 발행합니다.

    Parameters
    ----------
    post               : 워드프레스 포스트 객체
    wp_client          : WordPressClient 인스턴스
    llm                : DeepSeek 콘텐츠 생성기
    dry_run            : True이면 실제 발행 없이 로그만 출력
    publish_status     : 발행 상태 ("publish" / "draft" / "future")
    instruction_action : 원본 글 처리 방식 ("tag" / "trash" / "delete")
    scheduled_at       : 예약 발행 시각 (피크면 자동 조정)

    Returns
    -------
    bool: 처리 성공 여부
    """
    post_id = post.get("id")
    logger.info(f"━━━ 포스트 처리 시작 (ID: {post_id}) ━━━")

    # ── Step 1: 포스트 파싱 ──
    parsed = WordPressClient.parse_instruction_post(post)
    logger.info(
        f"파싱 결과: 이름={parsed.get('name')}, "
        f"생년월일={parsed.get('birth_year')}년 {parsed.get('birth_month')}월 {parsed.get('birth_day')}일, "
        f"성별={parsed.get('gender')}, 출생시각={parsed.get('birth_hour')}시, "
        f"이미지={parsed.get('image_url', '없음')}"
    )

    # 필수 데이터 검증
    if not all([parsed["birth_year"], parsed["birth_month"], parsed["birth_day"]]):
        logger.error(
            f"포스트 {post_id}: 생년월일 파싱 실패. "
            f"본문 형식을 확인하세요. 건너뜁니다."
        )
        return False

    # ── Step 2: 사주 계산 ──
    logger.info(f"사주 계산 중: {parsed['name']} ({parsed['birth_year']}년생)")
    try:
        saju_data = calculate_saju(
            birth_year=parsed["birth_year"],
            birth_month=parsed["birth_month"],
            birth_day=parsed["birth_day"],
            birth_hour=parsed["birth_hour"],
            gender=parsed["gender"],
        )
    except Exception as e:
        logger.error(f"사주 계산 오류: {e}")
        return False

    saju_text = format_saju_for_prompt(saju_data, parsed["name"])
    logger.info(f"사주 계산 완료: {saju_data['일주_요약']} / {saju_data['일주_강약']}")
    logger.debug(f"사주 데이터:\n{saju_text}")

    # ── Step 3: LLM으로 콘텐츠 생성 ──
    logger.info(f"LLM API로 콘텐츠 생성 중: {parsed['name']}")
    try:
        # v12: 제목 형식을 [연예인 이름] 사주 [출생연도]년생 운세 - [후킹 멘트]로 통일
        html_content, meta_description, post_title = llm.generate_saju_content(
            celebrity_name=parsed["name"],
            saju_text=saju_text,
            birth_year=str(parsed["birth_year"]),
        )
        seo_tags = llm.generate_seo_tags(parsed["name"], saju_data)
    except Exception as e:
        logger.error(f"LLM 콘텐츠 생성 오류: {e}")
        return False

    logger.info(f"콘텐츠 생성 완료: 제목='{post_title}', 태그={seo_tags}")

    # ── Step 4: 이미지 처리 (본문 삽입 및 미디어 ID 조회) ──
    featured_media_id = None
    if parsed.get("image_url"):
        # 이미지 HTML 생성 (모바일 최적화 및 고정 비율 스타일)
        img_html = (
            f'<div style="text-align: center; margin: 20px 0 30px 0; width: 100%;">'
            f'<img src="{parsed["image_url"]}" alt="{parsed["name"]} 사주" '
            f'style="width: 100%; max-width: 600px; height: auto; border-radius: 15px; '
            f'box-shadow: 0 4px 15px rgba(0,0,0,0.1); display: inline-block;">'
            f'</div>'
        )
        
        # H2 대제목(</h2>) 바로 뒤에 이미지 삽입
        if "</h2>" in html_content:
            parts = html_content.split("</h2>", 1)
            html_content = parts[0] + "</h2>" + img_html + parts[1]
        else:
            # H2가 없으면 최상단에 삽입
            html_content = img_html + html_content
        
        # 대표 이미지(썸네일) 설정을 위한 미디어 ID 조회
        featured_media_id = wp_client.get_media_id_by_url(parsed["image_url"])

    # ── 예약 시각 피크 회피 조정 ──
    wp_date = None
    final_status = publish_status
    if scheduled_at is not None:
        target = scheduled_at
        if config.PEAK_SCHEDULE_ADJUST:
            adj = adjust_away_from_peak(target, config.PEAK_AVOIDANCE_TZ)
            if adj.changed:
                logger.info(
                    "피크 예약 자동 조정: %s → %s (%s)",
                    adj.original.strftime("%Y-%m-%d %H:%M"),
                    adj.adjusted.strftime("%Y-%m-%d %H:%M"),
                    adj.peak_label,
                )
            target = adj.adjusted
        wp_date = format_wp_datetime(target, config.PEAK_AVOIDANCE_TZ)
        if final_status == "publish":
            final_status = "future"
        logger.info("예약 발행 시각: %s (status=%s)", wp_date, final_status)

    # ── Step 5: 워드프레스에 발행 ──
    if dry_run:
        logger.info(
            f"[DRY-RUN] 발행 건너뜀. 제목: '{post_title}', "
            f"본문 길이: {len(html_content)}자"
        )
        logger.info(f"[DRY-RUN] 메타 디스크립션: {meta_description}")
        if wp_date:
            logger.info(f"[DRY-RUN] 예약 발행: {wp_date}")
        logger.info(f"[DRY-RUN] 원본 포스트 {post_id} 처리 방식: {instruction_action}")
        return True

    # ── Step 6: 퍼머링크(슬러그) 생성 ──
    # [연예인 이름]-사주-운세 형식으로 간결하게 생성
    post_slug = f"{parsed['name']}-사주-운세"

    try:
        new_post = wp_client.publish_celebrity_post(
            title=post_title,
            html_content=html_content,
            celebrity_category=config.CELEBRITY_CATEGORY,
            tags=seo_tags,
            status=final_status,
            featured_media_id=featured_media_id,
            excerpt=meta_description,
            slug=post_slug,
            date=wp_date,
        )
        logger.info(
            f"발행 성공: '{post_title}' → {new_post.get('link', 'URL 없음')}"
        )
    except Exception as e:
        logger.error(f"워드프레스 발행 오류: {e}")
        return False

    # ── Step 5: 원본 '지시' 글 처리 ──
    try:
        # v18: 작업 완료 후 원본 글을 '임시글(draft)'로 변경하여 검색 색인 방지
        wp_client.mark_instruction_post_done(
            post_id=post_id,
            action=instruction_action,
            done_tag=config.DONE_TAG,
            change_status="draft"  # 검색 색인 방지를 위해 임시글로 변경
        )
    except Exception as e:
        logger.warning(
            f"원본 포스트 {post_id} 처리 중 오류 (발행은 완료됨): {e}"
        )

    logger.info(f"━━━ 포스트 처리 완료 (ID: {post_id}) ━━━\n")
    return True


# ─────────────────────────────────────────────
# 메인 실행 함수
# ─────────────────────────────────────────────

def main(args: argparse.Namespace) -> None:
    """전체 자동화 파이프라인을 실행합니다."""

    setup_logging(
        log_level=args.log_level or config.LOG_LEVEL,
        log_file=None if args.no_log_file else config.LOG_FILE,
    )

    logger.info("=" * 60)
    logger.info("사주 자동 포스팅 시스템 시작")
    logger.info(f"실행 시각: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    if args.dry_run:
        logger.info("※ DRY-RUN 모드: 실제 발행 없이 테스트합니다.")
    logger.info("=" * 60)

    # ── DeepSeek 피크타임 가드 (API 요금 2배 구간 회피) ──
    scheduled_at = None
    if args.schedule:
        try:
            scheduled_at = datetime.strptime(args.schedule, "%Y-%m-%d %H:%M").replace(
                tzinfo=ZoneInfo(config.PEAK_AVOIDANCE_TZ)
            )
        except ValueError:
            logger.error(
                "--schedule 형식 오류. 예: --schedule '2026-07-14 10:30'"
            )
            sys.exit(1)

    peak_relevant = config.PEAK_AVOIDANCE_ENABLED
    if peak_relevant:
        logger.info("\n%s", describe_peaks(config.PEAK_AVOIDANCE_TZ))
        if not args.force_peak:
            can_run = wait_or_skip_if_peak(
                tz_name=config.PEAK_AVOIDANCE_TZ,
                mode=config.PEAK_AVOIDANCE_MODE,
                max_wait_seconds=config.PEAK_AVOIDANCE_MAX_WAIT_SECONDS,
                logger=logger,
            )
            if not can_run:
                logger.info("피크타임이라 종료합니다. 밸리 시간에 cron이 다시 돌면 처리됩니다.")
                return
        else:
            logger.warning("※ --force-peak: 피크타임이어도 API 호출을 강제 진행합니다.")

    # ── 클라이언트 초기화 ──
    logger.info("워드프레스 클라이언트 초기화 중...")
    wp_client = WordPressClient(
        site_url=config.WP_SITE_URL,
        username=config.WP_USERNAME,
        app_password=config.WP_APP_PASSWORD,
    )

    # 연결 테스트
    if not args.skip_connection_test:
        if not wp_client.test_connection():
            logger.error(
                "워드프레스 연결 실패. config.py의 WP_SITE_URL, "
                "WP_USERNAME, WP_APP_PASSWORD를 확인하세요."
            )
            sys.exit(1)

    logger.info("DeepSeek API 초기화 중...")
    try:
        llm = DeepSeekContentGenerator(
            api_key=config.DEEPSEEK_API_KEY,
            model_name=args.model or config.DEEPSEEK_MODEL,
            base_url=config.DEEPSEEK_BASE_URL,
            thinking=config.DEEPSEEK_THINKING,
            timeout=config.DEEPSEEK_TIMEOUT,
            max_tokens=config.DEEPSEEK_MAX_TOKENS,
        )
    except ValueError as e:
        logger.error(f"LLM 초기화 실패: {e}")
        sys.exit(1)

    # ── '지시' 카테고리 글 조회 ──
    max_posts = args.max_posts or config.MAX_POSTS_PER_RUN
    logger.info(
        f"'{config.INSTRUCTION_CATEGORY}' 카테고리에서 "
        f"최대 {max_posts}개 글 조회 중..."
    )

    try:
        posts = wp_client.get_instruction_posts(
            category_name=config.INSTRUCTION_CATEGORY,
            exclude_tag=config.DONE_TAG,
            per_page=max_posts,
        )
    except Exception as e:
        logger.error(f"글 조회 실패: {e}")
        sys.exit(1)

    if not posts:
        logger.info(
            f"처리할 글이 없습니다. "
            f"'{config.INSTRUCTION_CATEGORY}' 카테고리를 확인하세요."
        )
        return

    logger.info(f"총 {len(posts)}개 글을 처리합니다.")

    # ── 각 포스트 처리 ──
    success_count = 0
    fail_count = 0

    for i, post in enumerate(posts, 1):
        logger.info(f"\n[{i}/{len(posts)}] 처리 중...")

        success = process_single_post(
            post=post,
            wp_client=wp_client,
            llm=llm,
            dry_run=args.dry_run,
            publish_status=args.status or config.PUBLISH_STATUS,
            instruction_action=args.action or config.INSTRUCTION_POST_ACTION,
            scheduled_at=scheduled_at,
        )

        if success:
            success_count += 1
        else:
            fail_count += 1

        # 다음 포스트 처리 전 대기 (API 과부하 방지)
        if i < len(posts):
            delay = config.API_CALL_DELAY
            logger.info(f"{delay}초 대기 후 다음 포스트 처리...")
            time.sleep(delay)

    # ── 최종 결과 요약 ──
    logger.info("\n" + "=" * 60)
    logger.info("처리 완료 요약")
    logger.info(f"  총 처리: {len(posts)}개")
    logger.info(f"  성공:    {success_count}개")
    logger.info(f"  실패:    {fail_count}개")
    logger.info(f"  완료 시각: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 60)


# ─────────────────────────────────────────────
# CLI 인자 파서
# ─────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="워드프레스 연예인 사주 자동 포스팅 시스템",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
예시:
  python main.py                          기본 실행
  python main.py --dry-run                테스트 실행 (발행 안 함)
  python main.py --max-posts 3            최대 3개만 처리
  python main.py --status draft           임시 저장으로 발행
  python main.py --action trash           원본 글 휴지통 이동
  python main.py --model deepseek-v4-flash   DeepSeek Flash 사용
  python main.py --schedule '2026-07-14 10:30'  예약(피크면 13:30으로 자동조정)
  python main.py --force-peak             피크여도 API 강제 호출
        """
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="실제 발행 없이 테스트만 수행"
    )
    parser.add_argument(
        "--max-posts", type=int, default=None,
        help=f"한 번에 처리할 최대 글 수 (기본: {config.MAX_POSTS_PER_RUN})"
    )
    parser.add_argument(
        "--status", choices=["publish", "draft", "future"], default=None,
        help="발행 상태 (publish: 즉시 공개, draft: 임시 저장, future: 예약)"
    )
    parser.add_argument(
        "--schedule", type=str, default=None,
        help="예약 발행 시각 'YYYY-MM-DD HH:MM' (피크면 자동으로 밸리로 조정)"
    )
    parser.add_argument(
        "--force-peak", action="store_true",
        help="DeepSeek 피크타임이어도 API 호출을 강제 진행"
    )
    parser.add_argument(
        "--action", choices=["tag", "trash", "delete"], default=None,
        help="원본 '지시' 글 처리 방식 (tag: 태그 추가, trash: 휴지통, delete: 삭제)"
    )
    parser.add_argument(
        "--model", type=str, default=None,
        help="사용할 모델 (예: deepseek-v4-flash, deepseek-v4-pro)"
    )
    parser.add_argument(
        "--log-level", choices=["DEBUG", "INFO", "WARNING", "ERROR"], default=None,
        help="로그 레벨"
    )
    parser.add_argument(
        "--no-log-file", action="store_true",
        help="로그 파일 저장 비활성화 (콘솔 출력만)"
    )
    parser.add_argument(
        "--skip-connection-test", action="store_true",
        help="워드프레스 연결 테스트 건너뜀"
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    main(args)
