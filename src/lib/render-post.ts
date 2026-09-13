import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: false,
});

/** DeepSeek 사주 글은 HTML+SVG. 마크다운 글만 marked를 탄다. */
export function renderPostHtml(body: string): string {
  const trimmed = (body || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("<")) return trimmed;
  return marked.parse(trimmed, { async: false }) as string;
}
