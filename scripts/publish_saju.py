#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Decap 지시(queue) → DeepSeek HTML → src/content/blog 마크다운."""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import date, datetime
from pathlib import Path

from dotenv import load_dotenv

REPO = Path(__file__).resolve().parents[1]
SAJU_DIR = REPO / "saju"
QUEUE_DIR = REPO / "src" / "content" / "queue"
BLOG_DIR = REPO / "src" / "content" / "blog"

load_dotenv(REPO / ".env")
load_dotenv(SAJU_DIR / ".env")

sys.path.insert(0, str(SAJU_DIR))

import config  # noqa: E402
from deepseek_generator import DeepSeekContentGenerator  # noqa: E402
from peak_scheduler import describe_peaks, wait_or_skip_if_peak  # noqa: E402
from saju_calculator import calculate_saju, format_saju_for_prompt  # noqa: E402

logger = logging.getLogger("publish_saju")


def setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[logging.StreamHandler(sys.stdout)],
    )


def yaml_scalar(value: object) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return ""
    text = str(value)
    if text == "":
        return '""'
    if any(ch in text for ch in ":#{}[]&*!|>'\"%@`\n"):
        escaped = text.replace("\\", "\\\\").replace('"', '\\"')
        return f'"{escaped}"'
    return text


def dump_frontmatter(data: dict, body: str = "") -> str:
    lines = ["---"]
    for key, value in data.items():
        if value is None:
            lines.append(f"{key}:")
            continue
        if isinstance(value, list):
            lines.append(f"{key}:")
            for item in value:
                lines.append(f"  - {yaml_scalar(item)}")
            continue
        lines.append(f"{key}: {yaml_scalar(value)}")
    lines.append("---")
    if body:
        lines.append("")
        lines.append(body.rstrip() + "\n")
    else:
        lines.append("")
    return "\n".join(lines)


def parse_frontmatter(text: str) -> tuple[dict, str]:
    stripped = text.lstrip("\ufeff")
    if not stripped.startswith("---"):
        return {}, stripped
    parts = stripped.split("---", 2)
    if len(parts) < 3:
        return {}, stripped
    raw, body = parts[1], parts[2].lstrip("\n")
    data: dict = {}
    current_list: str | None = None
    for line in raw.splitlines():
        if not line.strip():
            continue
        if current_list and line.startswith("  - "):
            if not isinstance(data.get(current_list), list):
                data[current_list] = []
            data[current_list].append(line[4:].strip().strip('"').strip("'"))
            continue
        current_list = None
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()
        if value == "":
            data[key] = ""
            current_list = key
            continue
        data[key] = value.strip('"').strip("'")
    return data, body


def parse_birth_date(value: str) -> date:
    text = (value or "").strip()
    if "T" in text:
        text = text.split("T", 1)[0]
    try:
        return datetime.strptime(text, "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError(f"생년월일 형식을 읽을 수 없습니다: {value!r}") from exc


def parse_birth_hour(value: object) -> int:
    if value in (None, ""):
        return 12
    try:
        hour = int(str(value).strip())
    except ValueError as exc:
        raise ValueError(f"출생 시각이 숫자가 아닙니다: {value!r}") from exc
    if hour < 0 or hour > 23:
        raise ValueError(f"출생 시각은 0–23시여야 합니다: {hour}")
    return hour


def insert_cover(html: str, image_url: str, name: str) -> str:
    img_html = (
        f'<div style="text-align: center; margin: 20px 0 30px 0; width: 100%;">'
        f'<img src="{image_url}" alt="{name} 사주" '
        f'style="width: 100%; max-width: 600px; height: auto; border-radius: 15px; '
        f'box-shadow: 0 4px 15px rgba(0,0,0,0.1); display: inline-block;">'
        f"</div>"
    )
    if "</h2>" in html:
        before, after = html.split("</h2>", 1)
        return before + "</h2>" + img_html + after
    return img_html + html


def write_markdown(path: Path, data: dict, body: str = "") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(dump_frontmatter(data, body), encoding="utf-8")


def iter_queue_files() -> list[Path]:
    if not QUEUE_DIR.exists():
        return []
    files = []
    for path in sorted(QUEUE_DIR.glob("*.md")):
        if path.name.startswith("_") or path.name.lower() == "readme.md":
            continue
        files.append(path)
    return files


def process_item(path: Path, llm: DeepSeekContentGenerator, dry_run: bool) -> bool:
    raw = path.read_text(encoding="utf-8")
    meta, _body = parse_frontmatter(raw)
    status = str(meta.get("status") or "").strip().lower()
    if status != "pending":
        logger.info("건너뜀 (%s): status=%s", path.name, status or "없음")
        return False

    name = str(meta.get("name") or "").strip()
    if not name:
        raise ValueError("이름이 없습니다.")

    birth = parse_birth_date(str(meta.get("birth_date") or ""))
    gender = str(meta.get("gender") or "남").strip() or "남"
    birth_hour = parse_birth_hour(meta.get("birth_hour"))
    cover_raw = meta.get("cover_image")
    if isinstance(cover_raw, list):
        cover_raw = cover_raw[0] if cover_raw else ""
    cover = str(cover_raw or "").strip()
    slug = f"{name}-사주-운세"
    dest = BLOG_DIR / f"{slug}.md"

    if dest.exists():
        raise FileExistsError(f"이미 발행된 글이 있습니다: {dest.name}")

    logger.info("사주 계산: %s (%s, %s, %s시)", name, birth.isoformat(), gender, birth_hour)
    saju_data = calculate_saju(
        birth_year=birth.year,
        birth_month=birth.month,
        birth_day=birth.day,
        birth_hour=birth_hour,
        gender=gender,
    )
    saju_text = format_saju_for_prompt(saju_data, name)

    html, description, title = llm.generate_saju_content(
        celebrity_name=name,
        saju_text=saju_text,
        birth_year=str(birth.year),
    )
    tags = llm.generate_seo_tags(name, saju_data)
    if cover:
        html = insert_cover(html, cover, name)

    post_meta = {
        "title": title,
        "slug": slug,
        "date": date.today().isoformat(),
        "description": description,
        "cover_image": cover or None,
        "tags": tags,
        "name": name,
    }

    if dry_run:
        logger.info("[DRY-RUN] 발행 건너뜀: %s (%s자)", title, len(html))
        return True

    write_markdown(dest, post_meta, html)
    meta["status"] = "done"
    meta["note"] = f"발행됨: /{slug}/"
    write_markdown(path, meta, "")
    logger.info("발행 완료: %s → %s", title, dest.relative_to(REPO))
    return True


def mark_error(path: Path, message: str, dry_run: bool) -> None:
    if dry_run:
        logger.error("[DRY-RUN] %s 오류: %s", path.name, message)
        return
    raw = path.read_text(encoding="utf-8")
    meta, body = parse_frontmatter(raw)
    meta["status"] = "error"
    meta["note"] = message
    write_markdown(path, meta, body)
    logger.error("%s 오류로 표시: %s", path.name, message)


def main() -> int:
    parser = argparse.ArgumentParser(description="사주 지시 큐를 마크다운 글로 발행합니다.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--max-posts", type=int, default=1)
    parser.add_argument("--force-peak", action="store_true")
    parser.add_argument("--model", type=str, default=None)
    args = parser.parse_args()

    setup_logging()
    logger.info("사주 Git 발행기 시작")
    logger.info(describe_peaks(config.PEAK_AVOIDANCE_TZ))

    pending = []
    for path in iter_queue_files():
        meta, _ = parse_frontmatter(path.read_text(encoding="utf-8"))
        if str(meta.get("status") or "").strip().lower() == "pending":
            pending.append(path)

    if not pending:
        logger.info("대기 중인 지시가 없습니다.")
        return 0

    if config.PEAK_AVOIDANCE_ENABLED and not args.force_peak:
        can_run = wait_or_skip_if_peak(
            tz_name=config.PEAK_AVOIDANCE_TZ,
            mode=config.PEAK_AVOIDANCE_MODE,
            max_wait_seconds=config.PEAK_AVOIDANCE_MAX_WAIT_SECONDS,
            logger=logger,
        )
        if not can_run:
            logger.info("피크타임이라 종료합니다.")
            return 0

    try:
        llm = DeepSeekContentGenerator(
            api_key=config.DEEPSEEK_API_KEY,
            model_name=args.model or config.DEEPSEEK_MODEL,
            base_url=config.DEEPSEEK_BASE_URL,
            thinking=config.DEEPSEEK_THINKING,
            timeout=config.DEEPSEEK_TIMEOUT,
            max_tokens=config.DEEPSEEK_MAX_TOKENS,
        )
    except ValueError as exc:
        logger.error("DeepSeek 초기화 실패: %s", exc)
        return 1

    selected = pending[: max(1, args.max_posts)]
    logger.info("대기 %s건 중 %s건 처리", len(pending), len(selected))

    ok = 0
    fail = 0
    for path in selected:
        try:
            if process_item(path, llm, dry_run=args.dry_run):
                ok += 1
        except Exception as exc:
            fail += 1
            logger.exception("처리 실패: %s", path.name)
            mark_error(path, str(exc), dry_run=args.dry_run)

    logger.info("완료: 성공 %s / 실패 %s", ok, fail)
    return 1 if fail and not ok else 0


if __name__ == "__main__":
    sys.exit(main())
