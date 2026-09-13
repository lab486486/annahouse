# -*- coding: utf-8 -*-
"""
config.py
사주 자동 포스팅 시스템 설정 파일

※ 이 파일에 실제 API 키와 접속 정보를 입력하세요.
※ 보안을 위해 .gitignore에 config.py를 추가하는 것을 강력히 권장합니다.
   대신 config.example.py를 버전 관리에 포함하세요.
"""

import os
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

# ─────────────────────────────────────────────
# 워드프레스 설정
# ─────────────────────────────────────────────

# 워드프레스 사이트 URL (끝에 슬래시 없이)
WP_SITE_URL = os.environ.get("WP_SITE_URL")

# 워드프레스 관리자 사용자 이름
WP_USERNAME = os.environ.get("WP_USERNAME")

# 워드프레스 앱 비밀번호
# 생성 방법: 워드프레스 관리자 → 사용자 → 프로필 → 애플리케이션 비밀번호
# 형식 예시: "xxxx xxxx xxxx xxxx xxxx xxxx" (공백 포함 가능)
WP_APP_PASSWORD = os.environ.get("WP_APP_PASSWORD")

# ─────────────────────────────────────────────
# DeepSeek API 설정
# ─────────────────────────────────────────────

# 발급: https://platform.deepseek.com
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY")

# deepseek-v4-pro (고품질, 기본) / deepseek-v4-flash (가성비)
DEEPSEEK_MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-v4-pro")
DEEPSEEK_BASE_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

# Thinking 모드: true면 품질↑ / 비용·지연↑. 일반 포스팅은 false 권장
DEEPSEEK_THINKING = os.environ.get("DEEPSEEK_THINKING", "false").strip().lower() in (
    "1", "true", "yes", "on",
)
DEEPSEEK_MAX_TOKENS = int(os.environ.get("DEEPSEEK_MAX_TOKENS", "24000"))
DEEPSEEK_TIMEOUT = int(os.environ.get("DEEPSEEK_TIMEOUT", "240"))

# ─────────────────────────────────────────────
# DeepSeek 피크타임 회피 (peak-valley pricing)
# ─────────────────────────────────────────────
# UTC 피크: 01:00–04:00, 06:00–10:00
# KST(Asia/Seoul): 10:00–13:00, 15:00–19:00
# 규칙: 피크면 피크 종료 시(hour)로 스냅, 분·초 유지

PEAK_AVOIDANCE_ENABLED = os.environ.get("PEAK_AVOIDANCE_ENABLED", "true").strip().lower() in (
    "1", "true", "yes", "on",
)
PEAK_AVOIDANCE_TZ = os.environ.get("PEAK_AVOIDANCE_TZ", "Asia/Seoul")

# 피크일 때 동작: skip(이번 실행 건너뜀) | wait(밸리까지 대기)
PEAK_AVOIDANCE_MODE = os.environ.get("PEAK_AVOIDANCE_MODE", "skip").strip().lower()
PEAK_AVOIDANCE_MAX_WAIT_SECONDS = int(os.environ.get("PEAK_AVOIDANCE_MAX_WAIT_SECONDS", "0"))

# 발행 예약 시각이 피크면 자동으로 밸리로 조정
PEAK_SCHEDULE_ADJUST = os.environ.get("PEAK_SCHEDULE_ADJUST", "true").strip().lower() in (
    "1", "true", "yes", "on",
)

# ─────────────────────────────────────────────
# 카테고리 / 태그 설정
# ─────────────────────────────────────────────

# 지시 카테고리 이름 (처리할 글이 올라오는 카테고리)
INSTRUCTION_CATEGORY = "지시"

# 발행 카테고리 이름 (사주 분석 글이 발행될 카테고리)
CELEBRITY_CATEGORY = "연예인"

# 처리 완료 태그 이름
DONE_TAG = "처리완료"

# ─────────────────────────────────────────────
# 처리 방식 설정
# ─────────────────────────────────────────────

# 원본 '지시' 글 처리 방식
# "tag"    : '처리완료' 태그만 추가 (글 유지)
# "trash"  : 휴지통으로 이동
# "delete" : 영구 삭제 (주의!)
INSTRUCTION_POST_ACTION = "tag"

# 발행 상태
# "publish" : 즉시 공개 발행
# "draft"   : 임시 저장 (검토 후 수동 발행)
PUBLISH_STATUS = "publish"

# 한 번에 처리할 최대 글 수 (과부하 방지)
MAX_POSTS_PER_RUN = 5

# API 호출 간격 (초) - 과도한 요청 방지
API_CALL_DELAY = 3.0

# ─────────────────────────────────────────────
# 로깅 설정
# ─────────────────────────────────────────────

# 로그 레벨: "DEBUG", "INFO", "WARNING", "ERROR"
LOG_LEVEL = "INFO"

# 로그 파일 경로 (None이면 콘솔 출력만)
LOG_FILE = "saju_auto_post.log"
