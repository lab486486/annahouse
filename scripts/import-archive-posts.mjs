#!/usr/bin/env node
/**
 * Achive 숫자 폴더에서 아직 사이트에 없는 실제 글을 한글 슬러그로 가져오고
 * /264/ → /조하빈프로-.../ 리다이렉트를 연결합니다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const archiveRoot = path.join(root, "Achive");
const blogDir = path.join(root, "src/content/blog");
const redirectsPath = path.join(root, "src/data/legacy-redirects.json");
const redirectsFile = path.join(root, "public/_redirects");

const SKIP_TITLE =
  /본문[- ]?타이틀|본문[- ]?네모|본문[- ]?글상자|본문\s*디스플레이|본문\s*콘텐츠|링크\s*버튼|질문\s*답변|포스트잇|일치하는\s*광고|^-+$/;

function nfc(value) {
  return (value || "").normalize("NFC").trim();
}

function yamlQuote(value) {
  return JSON.stringify(value ?? "");
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractBetween(html, open) {
  const start = html.indexOf(open);
  if (start < 0) return "";
  let pos = start + open.length;
  let depth = 1;
  while (pos < html.length && depth > 0) {
    const nextOpen = html.indexOf("<div", pos);
    const nextClose = html.indexOf("</div>", pos);
    if (nextClose < 0) return html.slice(start + open.length);
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      pos = nextOpen + 4;
    } else {
      depth -= 1;
      if (depth === 0) return html.slice(start + open.length, nextClose);
      pos = nextClose + 6;
    }
  }
  return html.slice(start + open.length);
}

function cleanBody(html) {
  let next = html;
  next = next.replace(/<script[\s\S]*?<\/script>/gi, "");
  next = next.replace(/<ins\b[\s\S]*?<\/ins>/gi, "");
  next = next.replace(/<!--[\s\S]*?-->/g, "");
  next = next.replace(/<figure\b[\s\S]*?<\/figure>/gi, "");
  next = next.replace(/<img\b[^>]*>/gi, "");
  next = next.replace(/src="\.\/img\/[^"]+"/gi, "");
  next = next.replace(/<p\b[^>]*>\s*(?:&nbsp;|\s)*<\/p>/gi, "");
  next = next.replace(/(?:&nbsp;\s*){2,}/g, "");
  next = next.replace(/\n{3,}/g, "\n\n");
  return next.trim();
}

function parsePost(html) {
  const title =
    nfc(html.match(/class="title-article">([^<]+)</)?.[1]) ||
    nfc(html.match(/<title>([^<]+)<\/title>/i)?.[1]);
  const category = nfc(html.match(/<p class="category">([^<]*)<\/p>/)?.[1]);
  const rawDate = nfc(html.match(/<p class="date">([^<]*)<\/p>/)?.[1]);
  const date = rawDate.slice(0, 10) || "2020-01-01";
  const body = cleanBody(extractBetween(html, '<div class="contents_style">'));
  return { title, category, date, body };
}

function slugify(title) {
  const slug = nfc(title)
    .toLowerCase()
    .replace(/feat\.?/gi, "feat")
    .replace(/[()[\]{}]/g, "")
    .replace(/[/\\?%*:|"<>]/g, "")
    .replace(/[,.!·]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "");
  return slug.slice(0, 60).replace(/-$/, "") || "post";
}

function categorySlug(name) {
  if (name === "IT 정보") return "it-정보";
  if (name === "Uncategorized") return "uncategorized";
  return name.trim().replace(/\s+/g, "-").toLowerCase();
}

function uniqueSlug(base, used) {
  if (!used.has(base)) return base;
  let i = 2;
  while (used.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

function writeRedirects(ids) {
  const lines = [
    "# Feeds",
    "/rss.xml /rss 301",
    "/rss.xml/ /rss 301",
    "/rss/ /rss 301",
    "",
    "# Tistory numeric permalinks → title slugs",
    ...Object.entries(ids)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .flatMap(([id, slug]) => {
        const dest = encodeURI(`/${slug}/`);
        return [`/${id}/ ${dest} 301`, `/${id} ${dest} 301`];
      }),
  ];
  fs.writeFileSync(redirectsFile, `${lines.join("\n")}\n`);
}

function frontmatter(data) {
  const lines = [
    "---",
    `title: ${yamlQuote(data.title)}`,
    `slug: ${yamlQuote(data.slug)}`,
    `date: ${data.date}`,
    `description: ${yamlQuote(data.description)}`,
    "legacy: true",
    "tags:",
    ...data.tags.map((tag) => `  - ${yamlQuote(tag)}`),
    "---",
    "",
  ];
  return lines.join("\n");
}

function main() {
  const data = JSON.parse(fs.readFileSync(redirectsPath, "utf8"));
  const used = new Set([
    ...Object.values(data.ids),
    ...fs.readdirSync(blogDir).filter((name) => name.endsWith(".md")).map((name) => name.replace(/\.md$/, "")),
  ]);
  const categoryMap = new Map(data.categories.map((item) => [item.slug, item.name]));
  const imported = [];
  const skipped = [];

  for (const name of fs.readdirSync(archiveRoot).sort((a, b) => Number(a) - Number(b))) {
    if (!/^\d+$/.test(name)) continue;
    if (data.ids[name]) {
      skipped.push(`${name} already-mapped`);
      continue;
    }
    const dir = path.join(archiveRoot, name);
    const htmlName = fs.readdirSync(dir).find((file) => file.endsWith(".html"));
    if (!htmlName) {
      skipped.push(`${name} no-html`);
      continue;
    }
    const parsed = parsePost(fs.readFileSync(path.join(dir, htmlName), "utf8"));
    if (!parsed.title || SKIP_TITLE.test(parsed.title)) {
      skipped.push(`${name} template ${parsed.title || htmlName}`);
      continue;
    }

    const slug = uniqueSlug(slugify(parsed.title), used);
    used.add(slug);
    const tags = parsed.category ? [parsed.category] : [];
    if (parsed.category) categoryMap.set(categorySlug(parsed.category), parsed.category);
    const description = (stripHtml(parsed.body) || parsed.title).slice(0, 160);
    fs.writeFileSync(
      path.join(blogDir, `${slug.replace(/[/\\?%*:|"<>]/g, "-")}.md`),
      frontmatter({
        title: parsed.title,
        slug,
        date: parsed.date,
        description,
        tags,
      }) + (parsed.body || `<p>${parsed.title}</p>`),
      "utf8",
    );
    data.ids[name] = slug;
    imported.push({ id: name, slug, title: parsed.title, date: parsed.date });
  }

  data.categories = [...categoryMap.entries()]
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => a.slug.localeCompare(b.slug, "ko"));
  fs.writeFileSync(redirectsPath, `${JSON.stringify(data, null, 2)}\n`);
  writeRedirects(data.ids);
  console.log(`imported ${imported.length} posts, skipped ${skipped.length}`);
  for (const row of imported) console.log(`${row.id} -> /${row.slug}/`);
  const templates = skipped.filter((line) => line.includes("template"));
  if (templates.length) console.log(`templates ${templates.length}\n${templates.join("\n")}`);
}

main();
