# -*- coding: utf-8 -*-
"""
wordpress_client.py
워드프레스 REST API 연동 모듈

'지시' 카테고리의 글 조회, '연예인' 카테고리로 발행,
원본 글에 '처리완료' 태그 추가 또는 삭제 기능을 제공합니다.
"""

import re
import logging
from typing import Optional
import requests
from requests.auth import HTTPBasicAuth

logger = logging.getLogger(__name__)


class WordPressClient:
    """
    워드프레스 REST API 클라이언트.

    Parameters
    ----------
    site_url   : 워드프레스 사이트 URL (예: https://example.com)
    username   : 워드프레스 사용자 이름
    app_password: 워드프레스 앱 비밀번호 (공백 포함 가능)
    """

    def __init__(self, site_url: str, username: str, app_password: str):
        self.base_url = site_url.rstrip("/")
        self.api_url = f"{self.base_url}/wp-json/wp/v2"
        self.auth = HTTPBasicAuth(username, app_password.replace(" ", ""))
        self.session = requests.Session()
        self.session.auth = self.auth
        self.session.headers.update({
            "Accept": "application/json",
        })

    # ─────────────────────────────────────────
    # 카테고리 / 태그 ID 조회
    # ─────────────────────────────────────────

    def get_category_id(self, category_name: str) -> Optional[int]:
        """카테고리 이름으로 ID를 조회합니다. 없으면 생성합니다."""
        resp = self.session.get(
            f"{self.api_url}/categories",
            params={"search": category_name, "per_page": 10}
        )
        resp.raise_for_status()
        categories = resp.json()
        for cat in categories:
            if cat["name"] == category_name:
                logger.info(f"카테고리 '{category_name}' ID: {cat['id']}")
                return cat["id"]

        # 카테고리가 없으면 새로 생성
        logger.info(f"카테고리 '{category_name}'가 없어 새로 생성합니다.")
        create_resp = self.session.post(
            f"{self.api_url}/categories",
            json={"name": category_name}
        )
        create_resp.raise_for_status()
        new_cat = create_resp.json()
        logger.info(f"카테고리 '{category_name}' 생성 완료, ID: {new_cat['id']}")
        return new_cat["id"]

    def get_tag_id(self, tag_name: str) -> Optional[int]:
        """태그 이름으로 ID를 조회합니다. 없으면 생성합니다."""
        resp = self.session.get(
            f"{self.api_url}/tags",
            params={"search": tag_name, "per_page": 10}
        )
        resp.raise_for_status()
        tags = resp.json()
        for tag in tags:
            if tag["name"] == tag_name:
                logger.info(f"태그 '{tag_name}' ID: {tag['id']}")
                return tag["id"]

        # 태그가 없으면 새로 생성
        logger.info(f"태그 '{tag_name}'가 없어 새로 생성합니다.")
        create_resp = self.session.post(
            f"{self.api_url}/tags",
            json={"name": tag_name}
        )
        create_resp.raise_for_status()
        new_tag = create_resp.json()
        logger.info(f"태그 '{tag_name}' 생성 완료, ID: {new_tag['id']}")
        return new_tag["id"]

    # ─────────────────────────────────────────
    # '지시' 카테고리 글 조회
    # ─────────────────────────────────────────

    def get_instruction_posts(
        self,
        category_name: str = "지시",
        exclude_tag: str = "처리완료",
        per_page: int = 5
    ) -> list[dict]:
        """
        '지시' 카테고리에서 '처리완료' 태그가 없는 최신 글을 가져옵니다.

        Returns
        -------
        list[dict]: 워드프레스 포스트 객체 리스트
        """
        cat_id = self.get_category_id(category_name)
        if not cat_id:
            logger.warning(f"카테고리 '{category_name}'를 찾을 수 없습니다.")
            return []

        # 처리완료 태그 ID 조회 (존재하지 않으면 None)
        exclude_tag_id = None
        try:
            resp = self.session.get(
                f"{self.api_url}/tags",
                params={"search": exclude_tag, "per_page": 5}
            )
            resp.raise_for_status()
            tags = resp.json()
            for tag in tags:
                if tag["name"] == exclude_tag:
                    exclude_tag_id = tag["id"]
                    break
        except Exception as e:
            logger.warning(f"처리완료 태그 조회 실패: {e}")

        params = {
            "categories": cat_id,
            "per_page": per_page,
            "orderby": "date",
            "order": "asc",   # 오래된 것부터 처리
            "status": "publish,draft",
        }
        if exclude_tag_id:
            params["tags_exclude"] = exclude_tag_id

        resp = self.session.get(f"{self.api_url}/posts", params=params)
        resp.raise_for_status()
        posts = resp.json()
        logger.info(f"'{category_name}' 카테고리에서 {len(posts)}개 글을 가져왔습니다.")
        return posts

    # ─────────────────────────────────────────
    # 포스트 파싱 (이름 / 생년월일 / 성별 추출)
    # ─────────────────────────────────────────

    @staticmethod
    def parse_instruction_post(post: dict) -> dict:
        """
        '지시' 카테고리 글에서 연예인 이름, 생년월일, 성별, 출생 시각, 이미지 URL을 추출합니다.

        글 형식 예시:
          제목: 아이유 사주 분석 요청
          본문: 생년월일: 1993년 5월 16일 / 성별: 여 / 출생시각: 08시
          (이미지 포함 시 이미지 URL 추출)

        Returns
        -------
        dict: {name, birth_year, birth_month, birth_day, birth_hour, gender, image_url, post_id, post_title}
        """
        title_raw = post.get("title", {}).get("rendered", "")
        content_raw = post.get("content", {}).get("rendered", "")

        # 이미지 URL 추출 (img 태그의 src 속성)
        image_url = None
        img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', content_raw)
        if img_match:
            image_url = img_match.group(1)

        # HTML 태그 제거 (br 태그는 줄바꿈으로 변환 후 제거)
        title = re.sub(r"<[^>]+>", "", title_raw).strip()
        # <br>, <br/>, <br /> → 줄바꿈으로 변환
        content_raw_for_text = re.sub(r"<br\s*/?>", "\n", content_raw, flags=re.IGNORECASE)
        # <p>, </p>, <div>, </div> → 줄바꿈으로 변환
        content_raw_for_text = re.sub(r"</?(p|div|li|tr)[^>]*>", "\n", content_raw_for_text, flags=re.IGNORECASE)
        content = re.sub(r"<[^>]+>", "", content_raw_for_text).strip()

        # 이름 추출: 제목에서 첫 번째 한글 단어 (또는 "이름:" 패턴)
        name = None
        # "이름: 홍길동" 형식 - 줄바꿈, 숫자, 특수문자 이전까지만 추출 (+ 기호 및 괄호 허용)
        name_match = re.search(r"이름[:\s]*([가-힣a-zA-Z\+\(\)]+)", content)
        if name_match:
            name = name_match.group(1).strip()
        if not name:
            # 제목에서 추출 시도 (첫 번째 한글 이름 패턴, + 기호, 괄호 및 글자수 여유 허용)
            title_name_match = re.search(r"([가-힣\+\(\)]{2,15})\s*(사주|운세|명리)", title)
            if title_name_match:
                name = title_name_match.group(1)
            else:
                name = title.split()[0] if title else "미상"

        # 생년월일 추출 (다양한 형식 지원)
        birth_year = birth_month = birth_day = None

        # 패턴 1: "1993년 5월 16일" 또는 "1993.05.16" 또는 "1993-05-16"
        date_patterns = [
            r"(\d{4})[년\.\-/]?\s*(\d{1,2})[월\.\-/]?\s*(\d{1,2})[일]?",
            r"생년월일[:\s]*(\d{4})[년\.\-/]?\s*(\d{1,2})[월\.\-/]?\s*(\d{1,2})",
        ]
        for pattern in date_patterns:
            m = re.search(pattern, content)
            if m:
                birth_year = int(m.group(1))
                birth_month = int(m.group(2))
                birth_day = int(m.group(3))
                break

        # 성별 추출
        gender = "남"
        gender_match = re.search(r"성별[:\s]*([남여])", content)
        if gender_match:
            gender = gender_match.group(1)
        elif re.search(r"\b여자\b|\b여성\b", content):
            gender = "여"
        elif re.search(r"\b남자\b|\b남성\b", content):
            gender = "남"

        # 출생 시각 추출 (없으면 기본값 12시)
        birth_hour = 12
        hour_match = re.search(r"출생시각[:\s]*(\d{1,2})[시]?", content)
        if not hour_match:
            hour_match = re.search(r"시각[:\s]*(\d{1,2})[시]?", content)
        if not hour_match:
            hour_match = re.search(r"(\d{1,2})시\s*생", content)
        if hour_match:
            birth_hour = int(hour_match.group(1))

        return {
            "name": name,
            "birth_year": birth_year,
            "birth_month": birth_month,
            "birth_day": birth_day,
            "birth_hour": birth_hour,
            "gender": gender,
            "image_url": image_url,
            "post_id": post.get("id"),
            "post_title": title,
        }

    # ─────────────────────────────────────────
    # '연예인' 카테고리에 글 발행
    # ─────────────────────────────────────────

    def publish_celebrity_post(
        self,
        title: str,
        html_content: str,
        celebrity_category: str = "연예인",
        tags: list[str] = None,
        status: str = "publish",
        featured_media_id: int = None,
        excerpt: str = "",
        slug: str = None,
        date: str = None,
    ) -> dict:
        """
        '연예인' 카테고리에 사주 분석 글을 발행합니다.

        Parameters
        ----------
        title             : 포스트 제목
        html_content      : HTML 형식의 본문 내용
        celebrity_category: 발행 카테고리 이름 (기본: '연예인')
        tags              : 태그 이름 리스트
        status            : 'publish', 'draft', 'future'
        featured_media_id : 대표 이미지 미디어 ID (선택)
        excerpt           : 요약문 (SEO용)
        slug              : 퍼머링크 슬러그
        date              : 예약 발행 시각 (사이트 로컬, YYYY-MM-DDTHH:MM:SS)
                            future 상태일 때 필수에 가깝게 사용

        Returns
        -------
        dict: 생성된 워드프레스 포스트 객체
        """
        cat_id = self.get_category_id(celebrity_category)

        tag_ids = []
        if tags:
            for tag_name in tags:
                tag_id = self.get_tag_id(tag_name)
                if tag_id:
                    tag_ids.append(tag_id)

        # 예약 시각이 있으면 워드프레스 future 상태로 발행
        if date and status == "publish":
            status = "future"

        payload = {
            "title": title,
            "content": html_content,
            "status": status,
            "categories": [cat_id],
            "tags": tag_ids,
            "excerpt": excerpt,
            "slug": slug,
            "comment_status": "open",
            "ping_status": "open",
        }
        if featured_media_id:
            payload["featured_media"] = featured_media_id
        if date:
            payload["date"] = date

        # HTML 콘텐츠가 깨지지 않도록 json 파라미터 대신 명시적인 처리를 시도할 수 있습니다.
        # 하지만 대부분의 경우 기본 json 전달이 맞으며, 
        # 워드프레스 테마나 플러그인에서 HTML을 필터링하는 경우가 많습니다.
        # 여기서는 좀 더 표준적인 방식으로 요청을 보냅니다.
        resp = self.session.post(f"{self.api_url}/posts", json=payload)
        resp.raise_for_status()
        new_post = resp.json()
        logger.info(
            f"새 포스트 발행 완료: '{title}' (ID: {new_post['id']}, "
            f"status={new_post.get('status')}, "
            f"date={new_post.get('date')}, "
            f"URL: {new_post.get('link', 'N/A')})"
        )
        return new_post

    # ─────────────────────────────────────────
    # 원본 '지시' 글 처리 (태그 추가 또는 삭제)
    # ─────────────────────────────────────────

    def mark_instruction_post_done(
        self,
        post_id: int,
        action: str = "tag",
        done_tag: str = "처리완료",
        change_status: Optional[str] = None
    ) -> None:
        """
        처리된 '지시' 카테고리 글에 '처리완료' 태그를 추가하거나 글을 삭제/상태 변경합니다.

        Parameters
        ----------
        post_id      : 처리할 포스트 ID
        action       : "tag" (태그 추가) 또는 "delete" (글 삭제) 또는 "trash" (휴지통)
        done_tag     : 처리완료 태그 이름
        change_status: 글 상태 변경 (예: "draft")
        """
        if action == "delete":
            resp = self.session.delete(
                f"{self.api_url}/posts/{post_id}",
                params={"force": True}
            )
            resp.raise_for_status()
            logger.info(f"포스트 {post_id} 영구 삭제 완료.")

        elif action == "trash":
            resp = self.session.delete(f"{self.api_url}/posts/{post_id}")
            resp.raise_for_status()
            logger.info(f"포스트 {post_id} 휴지통 이동 완료.")

        else:
            # 기존 데이터 조회
            get_resp = self.session.get(f"{self.api_url}/posts/{post_id}")
            get_resp.raise_for_status()
            post_data = get_resp.json()
            
            update_payload = {}
            
            # 태그 업데이트
            existing_tags = post_data.get("tags", [])
            done_tag_id = self.get_tag_id(done_tag)
            if done_tag_id not in existing_tags:
                existing_tags.append(done_tag_id)
                update_payload["tags"] = existing_tags

            # 상태 업데이트 (예: draft로 변경)
            if change_status:
                update_payload["status"] = change_status

            if update_payload:
                update_resp = self.session.post(
                    f"{self.api_url}/posts/{post_id}",
                    json=update_payload
                )
                update_resp.raise_for_status()
                msg = f"포스트 {post_id} 업데이트 완료: "
                if "tags" in update_payload: msg += f"태그 '{done_tag}' 추가 "
                if "status" in update_payload: msg += f"상태 '{change_status}'로 변경"
                logger.info(msg)

    # ─────────────────────────────────────────
    # 미디어 ID 조회 (이미지 URL로 ID 찾기)
    # ─────────────────────────────────────────

    def get_media_id_by_url(self, image_url: str) -> Optional[int]:
        """이미지 URL을 통해 워드프레스 미디어 ID를 조회합니다."""
        if not image_url:
            return None
            
        # 파일명만 추출 (예: https://example.com/wp-content/uploads/2024/01/image.jpg -> image)
        file_name = image_url.split("/")[-1].split(".")[0]
        
        try:
            resp = self.session.get(
                f"{self.api_url}/media",
                params={"search": file_name, "per_page": 10}
            )
            resp.raise_for_status()
            media_list = resp.json()
            
            # 정확한 URL 매칭 확인
            for media in media_list:
                if media.get("source_url") == image_url or image_url in media.get("source_url", ""):
                    logger.info(f"이미지 URL에 대한 미디어 ID 발견: {media['id']}")
                    return media["id"]
            
            # 찾지 못했다면 첫 번째 검색 결과라도 반환
            if media_list:
                return media_list[0]["id"]
                
        except Exception as e:
            logger.warning(f"미디어 ID 조회 실패: {e}")
            
        return None

    # ─────────────────────────────────────────
    # 연결 테스트
    # ─────────────────────────────────────────

    def test_connection(self) -> bool:
        """워드프레스 API 연결 및 인증 상태를 확인합니다."""
        try:
            resp = self.session.get(f"{self.api_url}/users/me")
            resp.raise_for_status()
            user = resp.json()
            logger.info(f"워드프레스 연결 성공: {user.get('name', 'Unknown')} "
                        f"(역할: {user.get('roles', [])})")
            return True
        except requests.exceptions.HTTPError as e:
            logger.error(f"워드프레스 인증 실패: {e}")
            return False
        except requests.exceptions.ConnectionError as e:
            logger.error(f"워드프레스 연결 오류: {e}")
            return False
