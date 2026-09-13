import { marked } from "marked";
import { site } from "../site.config";

marked.setOptions({
  gfm: true,
  breaks: false,
});

const BODY_AD = `<aside class="ad-slot ad-slot-body" aria-label="광고"><ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-7643658138527330" data-ad-slot="5648998563" data-ad-format="auto" data-full-width-responsive="true"></ins></aside>`;

const LEAD_RE =
  /<div style="text-align:\s*center;\s*margin:\s*20px 0 30px 0;\s*width:\s*100%;">\s*<img\s+([^>]+)>\s*<\/div>\s*<p style="[^"]*background-color:\s*#f8f9fa[^"]*">([\s\S]*?)<\/p>/i;

function attr(source: string, name: string): string {
  return new RegExp(`${name}="([^"]*)"`, "i").exec(source)?.[1] ?? "";
}

function layoutLead(html: string): string {
  return html.replace(LEAD_RE, (_match, imgAttrs: string, text: string) => {
    const src = attr(imgAttrs, "src");
    const alt = attr(imgAttrs, "alt");
    return `<div class="post-lead"><div class="post-lead-thumb"><img src="${src}" alt="${alt}"></div><div class="post-lead-text"><p>${text}</p></div></div>`;
  });
}

function injectBeforeCore(html: string): string {
  if (html.includes("ad-slot-body")) return html;
  const afterLead = html.replace(
    /(<div class="post-lead">[\s\S]*?<\/div>\s*<\/div>)/,
    `$1${BODY_AD}`,
  );
  if (afterLead !== html) return afterLead;
  return html.replace(/(<h3[^>]*>[^<]*사주\s*핵심)/i, `${BODY_AD}$1`);
}

/** DeepSeek 사주 글은 HTML+SVG. 마크다운 글만 marked를 탄다. */
export function renderPostHtml(body: string): string {
  const trimmed = (body || "").trim();
  if (!trimmed) return "";
  const html = trimmed.startsWith("<")
    ? trimmed
    : (marked.parse(trimmed, { async: false }) as string);
  const base = site.mediaBaseUrl.replace(/\/$/, "");
  const withMedia = base ? html.replaceAll("/wp-content/uploads/", `${base}/wp-content/uploads/`) : html;
  return injectBeforeCore(layoutLead(withMedia));
}
