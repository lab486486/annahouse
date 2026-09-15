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

function viewBoxSize(attrs: string): { w: number; h: number } | null {
  const match = /viewBox=["']\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)/i.exec(attrs);
  if (!match) return null;
  return { w: Number(match[1]), h: Number(match[2]) };
}

function diagramKind(w: number, h: number): string {
  if (w === 500 && h === 400) return "network";
  if (w === 400 && h === 400) return "radar";
  if (w === 400 && h === 820) return "timeline";
  if (w === 500 && h === 300) return "palette";
  return "chart";
}

function withStyleFill(tag: string, color: string): string {
  if (/style="/i.test(tag)) {
    return tag.replace(/style="([^"]*)"/i, (_all, style: string) => {
      const cleaned = String(style)
        .replace(/fill:\s*[^;"]+;?/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      return `style="${cleaned}${cleaned ? " " : ""}fill:${color};"`;
    });
  }
  return `${tag} style="fill:${color};"`;
}

function fixNetworkDiagram(inner: string): string {
  let out = inner
    .replace(/stroke="#e0e0e0"/g, 'stroke="#d0d5dd"')
    .replace(/stroke:\s*#e0e0e0/gi, "stroke:#d0d5dd")
    .replace(/<circle\b[^>]*\br="48"[^>]*\/?>/g, "")
    .replace(
      /<circle\b[^>]*\br="50"[^>]*\/?>/g,
      '<circle cx="250" cy="210" r="50" fill="#3366ff" stroke="#3366ff" stroke-width="2" fill-opacity="1" />',
    )
    .replace(/dominant-baseline="central"/g, 'dominant-baseline="middle"');

  out = out.replace(/<text\b[^>]*x="250"[^>]*y="210"[^>]*>/g, (tag) => {
    const withoutFill = tag.replace(/\sfill="[^"]*"/gi, "");
    return `${withStyleFill(withoutFill.slice(0, -1), "#ffffff")} fill="#ffffff">`;
  });
  out = out.replace(/<text\b[^>]*y="210"[^>]*x="250"[^>]*>/g, (tag) => {
    const withoutFill = tag.replace(/\sfill="[^"]*"/gi, "");
    return `${withStyleFill(withoutFill.slice(0, -1), "#ffffff")} fill="#ffffff">`;
  });
  return out;
}

function layoutSajuDiagrams(html: string): string {
  return html.replace(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/gi, (_match, rawAttrs: string, inner: string) => {
    const size = viewBoxSize(rawAttrs);
    const w = size?.w || 500;
    const h = size?.h || 400;
    const kind = size ? diagramKind(w, h) : "chart";
    let attrs = rawAttrs
      .replace(/\s(width|height)="[^"]*"/gi, "")
      .replace(/style="([^"]*)"/i, (_all, style: string) => {
        const next = String(style)
          .replace(/height:\s*auto;?/gi, "")
          .replace(/width:\s*100%;?/gi, "")
          .replace(/max-width:\s*[^;]+;?/gi, "")
          .replace(/margin:\s*[^;]+;?/gi, "")
          .replace(/display:\s*block;?/gi, "")
          .replace(/background:\s*#ffffff;?/gi, "")
          .replace(/background:\s*#fff;?/gi, "")
          .replace(/\s+/g, " ")
          .trim();
        return next ? `style="${next}"` : "";
      })
      .replace(/\s+/g, " ")
      .trim();
    if (!/viewBox=/i.test(attrs) && size) attrs += ` viewBox="0 0 ${w} ${h}"`;
    if (!/preserveAspectRatio=/i.test(attrs)) attrs += ` preserveAspectRatio="xMidYMid meet"`;
    attrs += ` width="${w}" height="${h}"`;
    const body = kind === "network" ? fixNetworkDiagram(inner) : inner.replace(/dominant-baseline="central"/g, 'dominant-baseline="middle"');
    return `<div class="saju-diagram" data-kind="${kind}" style="aspect-ratio:${w} / ${h}"><svg ${attrs}>${body}</svg></div>`;
  });
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
  return injectBeforeCore(layoutLead(layoutSajuDiagrams(withMedia)));
}
