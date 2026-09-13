# -*- coding: utf-8 -*-
"""
deepseek_generator.py
DeepSeek V4 API 연동 모듈 (OpenAI Chat Completions 호환)

사주 프롬프트는 saju_prompt.SajuPrompt를 사용합니다.
"""

from __future__ import annotations

import logging
import re
import time

from openai import OpenAI

from saju_prompt import SajuPrompt

logger = logging.getLogger(__name__)


class DeepSeekContentGenerator:
    """
    DeepSeek V4 API를 활용한 사주 분석 콘텐츠 생성기.

    Parameters
    ----------
    api_key     : DeepSeek API 키 (https://platform.deepseek.com)
    model_name  : 모델 ID (기본: deepseek-v4-flash)
    base_url    : API base URL
    thinking    : Thinking 모드 사용 여부 (가성비 테스트는 False 권장)
    timeout     : 요청 타임아웃(초)
    max_tokens  : 최대 출력 토큰
    """

    AVAILABLE_MODELS = [
        "deepseek-v4-pro",
        "deepseek-v4-flash",
    ]

    def __init__(
        self,
        api_key: str,
        model_name: str = "deepseek-v4-pro",
        base_url: str = "https://api.deepseek.com",
        thinking: bool = False,
        timeout: int = 240,
        max_tokens: int = 24000,
    ):
        if not api_key or api_key in ("YOUR_DEEPSEEK_API_KEY_HERE", ""):
            raise ValueError(
                "유효한 DeepSeek API 키를 입력해 주세요. "
                "config.py / .env 의 DEEPSEEK_API_KEY 를 설정하세요."
            )

        self.api_key = api_key
        self.model_name = model_name.strip() or "deepseek-v4-pro"
        self.base_url = base_url.rstrip("/")
        self.thinking = thinking
        self.timeout = timeout
        self.max_tokens = max_tokens
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=self.timeout,
        )
        logger.info(
            "DeepSeek 모델 초기화 완료: %s (thinking=%s, base_url=%s)",
            self.model_name,
            self.thinking,
            self.base_url,
        )

    build_saju_prompt = staticmethod(SajuPrompt.build_saju_prompt)

    @staticmethod
    def clean_html_content(html_content: str) -> str:
        """워드프레스 업로드 전 HTML 정제."""
        text = (html_content or "").strip()

        # 코드펜스 제거 (전체/부분)
        if text.startswith("```"):
            text = re.sub(r"^```(?:html|HTML)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
        text = re.sub(r"```(?:html|HTML)?\s*", "", text)
        text = text.replace("```", "")

        # 마크다운 볼드 → HTML strong
        text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)

        # 흔한 AI 서문/후문 제거
        text = re.sub(
            r"^(?:물론입니다|알겠습니다|아래에|다음과 같이).{0,40}\n+",
            "",
            text,
            flags=re.IGNORECASE,
        )

        return text.strip()

    @staticmethod
    def validate_html_content(html_content: str, min_chars: int = 1500) -> None:
        """업로드 전 최소 품질 검증. 실패 시 ValueError."""
        text = (html_content or "").strip()
        if not text:
            raise ValueError("HTML 본문이 비어 있습니다.")
        if len(re.sub(r"\s+", "", text)) < min_chars:
            raise ValueError(f"HTML 본문이 너무 짧습니다 ({len(text)}자).")
        if "<div" not in text.lower():
            raise ValueError("HTML 본문에 레이아웃용 <div>가 없습니다.")
        open_divs = len(re.findall(r"<div\b", text, flags=re.I))
        close_divs = len(re.findall(r"</div>", text, flags=re.I))
        if open_divs != close_divs:
            raise ValueError(
                f"div 태그 불균형: open={open_divs}, close={close_divs}"
            )
        if text.startswith("```") or "```html" in text[:80].lower():
            raise ValueError("코드펜스가 남아 있습니다.")

    def _chat(self, prompt: str, temperature: float = 0.7) -> str:
        """OpenAI 호환 chat.completions 호출."""
        kwargs: dict = {
            "model": self.model_name,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "당신은 HTML 사주 분석 글을 작성하는 전문 에디터입니다. "
                        "요청한 구조·인라인 스타일·SVG 규칙을 엄격히 따르고, "
                        "마크다운·코드펜스 없이 순수 HTML만 출력하세요."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "max_tokens": self.max_tokens,
            "extra_body": {
                "thinking": {"type": "enabled" if self.thinking else "disabled"},
            },
        }
        # Thinking 모드에서는 temperature 등이 무시됨
        if not self.thinking:
            kwargs["temperature"] = temperature
            kwargs["top_p"] = 0.9

        response = self.client.chat.completions.create(**kwargs)
        content = response.choices[0].message.content
        if not content or not str(content).strip():
            raise ValueError("DeepSeek 응답이 비어 있습니다.")
        return str(content).strip()

    def generate_saju_content(
        self,
        celebrity_name: str,
        saju_text: str,
        birth_year: str = "",
        max_retries: int = 3,
        retry_delay: float = 5.0,
    ) -> tuple[str, str, str]:
        """
        DeepSeek API를 호출하여 사주 분석 HTML 콘텐츠를 생성합니다.

        Returns
        -------
        tuple[str, str, str]: (HTML 본문 내용, 메타 디스크립션, 포스팅 제목)
        """
        prompt = self.build_saju_prompt(celebrity_name, saju_text, birth_year)

        for attempt in range(1, max_retries + 1):
            try:
                logger.info(
                    "DeepSeek API 호출 중... (시도 %s/%s) 모델: %s",
                    attempt,
                    max_retries,
                    self.model_name,
                )
                full_response = self._chat(prompt, temperature=0.7)

                lines = [line.strip() for line in full_response.split("\n") if line.strip()]
                if not lines:
                    raise ValueError("DeepSeek 응답이 비어 있습니다.")

                post_title = lines[0].replace("#", "").strip()
                post_title = re.sub(r"<[^>]*>", "", post_title)

                html_content = self.clean_html_content("\n".join(lines[1:]))

                meta_match = re.search(
                    r"<!--\s*META_DESCRIPTION:\s*(.*?)\s*-->",
                    html_content,
                    re.DOTALL,
                )
                meta_description = ""
                if meta_match:
                    meta_description = meta_match.group(1).strip()
                    html_content = html_content.replace(meta_match.group(0), "").strip()

                if not meta_description:
                    meta_description = f"{celebrity_name}의 사주 명리학 분석 글."

                self.validate_html_content(html_content)

                logger.info(
                    "콘텐츠 생성 완료: 제목='%s', 본문=%s자",
                    post_title,
                    len(html_content),
                )
                return html_content, meta_description, post_title

            except Exception as exc:
                logger.warning("DeepSeek API 호출 실패 (시도 %s): %s", attempt, exc)
                if attempt < max_retries:
                    logger.info("%s초 후 재시도합니다...", retry_delay)
                    time.sleep(retry_delay)
                else:
                    logger.error("최대 재시도 횟수 초과. 콘텐츠 생성 실패.")
                    raise

    def generate_post_title(
        self,
        celebrity_name: str,
        ilju: str,
        birth_year: int,
    ) -> str:
        """SEO 최적화된 포스트 제목을 생성합니다."""
        prompt = f"""다음 조건에 맞는 워드프레스 블로그 포스트 제목을 5개 생성해 주세요.

조건:
- 연예인 이름: {celebrity_name}
- 일주: {ilju}
- 출생 연도: {birth_year}년생
- SEO 키워드: '{celebrity_name} 사주', '{celebrity_name} 운세'를 자연스럽게 포함
- 클릭을 유도하는 흥미로운 제목
- 한국어, 50자 이내

제목만 번호와 함께 출력하세요. 설명 없이."""

        try:
            text = self._chat(prompt, temperature=0.8)
            titles = text.split("\n")
            first_title = titles[0] if titles else f"{celebrity_name} 사주 완전 분석"
            first_title = re.sub(r"^\d+[\.\)]\s*", "", first_title).strip()
            return first_title
        except Exception as exc:
            logger.warning("제목 생성 실패, 기본 제목 사용: %s", exc)
            return f"{celebrity_name} 사주 분석 | {ilju} {birth_year}년생 운세 완전 정복"

    def generate_seo_tags(self, celebrity_name: str, saju_data: dict) -> list[str]:
        """포스트에 사용할 SEO 태그 목록을 생성합니다. (API 호출 없음)"""
        return SajuPrompt.generate_seo_tags(celebrity_name, saju_data)
