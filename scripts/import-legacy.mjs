#!/usr/bin/env node
/**
 * 티스토리 숫자 퍼머링크 글을 제목 슬러그로 가져오고, 301 맵을 만듭니다.
 *
 *   node scripts/import-legacy.mjs [export.xml]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const xmlPath =
  process.argv[2] ||
  "/Users/myhome/Downloads/워드프레스 내보내기 2026-09-13.xml";
const blogDir = path.join(root, "src/content/blog");

function decodeURIComponentSafe(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function extractTag(block, tag) {
  const re = new RegExp(
    `<${tag}(?:\\s[^>]*)?>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))</${tag}>`,
    "i",
  );
  const m = block.match(re);
  if (!m) return "";
  return (m[1] ?? m[2] ?? "").trim();
}

function extractMeta(block, key) {
  const re =
    /<wp:postmeta>\s*<wp:meta_key><!\[CDATA\[(.*?)\]\]><\/wp:meta_key>\s*<wp:meta_value><!\[CDATA\[([\s\S]*?)\]\]><\/wp:meta_value>\s*<\/wp:postmeta>/g;
  let m;
  while ((m = re.exec(block))) {
    if (m[1] === key) return m[2];
  }
  return "";
}

function categories(block) {
  const out = [];
  const re =
    /<category domain="([^"]+)" nicename="([^"]*)"><!\[CDATA\[(.*?)\]\]><\/category>/g;
  let m;
  while ((m = re.exec(block))) {
    out.push({
      domain: m[1],
      nicename: decodeURIComponentSafe(m[2]),
      name: m[3],
    });
  }
  return out;
}

function slugFromPost(block) {
  const postName = extractTag(block, "wp:post_name");
  if (postName) return decodeURIComponentSafe(postName);
  const link = extractTag(block, "link");
  try {
    const parts = new URL(link).pathname.split("/").filter(Boolean);
    return decodeURIComponentSafe(parts[parts.length - 1] || "");
  } catch {
    return "";
  }
}

function numericIdFromLink(link) {
  try {
    const segs = new URL(link).pathname.split("/").filter(Boolean);
    if (segs.length === 1 && /^\d+$/.test(segs[0])) return segs[0];
  } catch {
    /* ignore */
  }
  return "";
}

function isSajuPost(title, slug, cats) {
  if (cats.some((c) => c.name === "연예인")) return true;
  return title.includes("사주") || slug.includes("사주");
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function yamlQuote(s) {
  return JSON.stringify(s ?? "");
}

function rewriteBody(html) {
  return html
    .replace(/https?:\/\/(?:www\.)?annahouse\.co\.kr\/wp-content\/uploads\//g, "/wp-content/uploads/")
    .replace(
      /https?:\/\/(?:www\.)?annahouse\.co\.kr\/(?!wp-content\/|wp-admin\/|wp-json\/|xmlrpc\.php)([^"'\s>]+)/g,
      (_, p) => {
        const decoded = decodeURIComponentSafe(p.replace(/\/$/, ""));
        if (/^\d+$/.test(decoded)) return `/${decoded}/`;
        return `/${decoded}/`;
      },
    );
}

function safeFileName(slug) {
  return `${slug.replace(/[\/\\?%*:|"<>]/g, "-")}.md`;
}

function frontmatter(data) {
  const lines = [
    "---",
    `title: ${yamlQuote(data.title)}`,
    `slug: ${yamlQuote(data.slug)}`,
    `date: ${data.date.slice(0, 10)}`,
    `description: ${yamlQuote(data.description)}`,
    "legacy: true",
    "tags:",
    ...data.tags.map((t) => `  - ${yamlQuote(t)}`),
  ];
  if (data.cover) lines.push(`cover_image: ${yamlQuote(data.cover)}`);
  lines.push("---", "");
  return lines.join("\n");
}

function publicPathFromUrl(remoteUrl) {
  try {
    const u = new URL(remoteUrl);
    if (!u.pathname.includes("/wp-content/uploads/")) return null;
    return decodeURIComponentSafe(u.pathname);
  } catch {
    return null;
  }
}

function main() {
  if (!fs.existsSync(xmlPath)) {
    console.error("XML not found:", xmlPath);
    process.exit(1);
  }

  const xml = fs.readFileSync(xmlPath, "utf8");
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  fs.mkdirSync(blogDir, { recursive: true });

  const existing = new Set(
    fs.readdirSync(blogDir).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, "")),
  );

  const redirects = {};
  const categoryMap = new Map();
  let written = 0;
  let skipped = 0;

  for (const it of items) {
    if (extractTag(it, "wp:post_type") !== "post") continue;
    if (extractTag(it, "wp:status") !== "publish") continue;

    const title = extractTag(it, "title");
    const slug = slugFromPost(it);
    const cats = categories(it);
    const postCats = cats.filter((c) => c.domain === "category");
    if (isSajuPost(title, slug, postCats)) continue;
    if (!slug) continue;

    const link = extractTag(it, "link");
    const numericId = numericIdFromLink(link);
    if (numericId) redirects[numericId] = slug;

    for (const cat of postCats) {
      categoryMap.set(cat.nicename, cat.name);
    }

    if (existing.has(slug)) {
      skipped += 1;
      continue;
    }

    const date = extractTag(it, "wp:post_date") || extractTag(it, "pubDate");
    const content = extractTag(it, "content:encoded");
    const excerpt = extractTag(it, "excerpt:encoded");
    const fifu = extractMeta(it, "fifu_image_url");
    const tags = [
      ...new Set(
        [...postCats.map((c) => c.name), ...cats.filter((c) => c.domain === "post_tag").map((c) => c.name)]
          .map((n) => n.trim())
          .filter(Boolean),
      ),
    ];

    let cover = "";
    for (const url of [fifu]) {
      const local = url && publicPathFromUrl(url);
      if (local) {
        cover = local;
        break;
      }
    }
    if (!cover) {
      const m = content.match(/src=["']([^"']*\/wp-content\/uploads\/[^"']+)["']/i);
      if (m) cover = publicPathFromUrl(m[1]) || "";
    }

    fs.writeFileSync(
      path.join(blogDir, safeFileName(slug)),
      frontmatter({
        title,
        slug,
        date,
        description: (excerpt || stripHtml(content).slice(0, 140) || title).slice(0, 200),
        tags,
        cover,
      }) + rewriteBody(content),
      "utf8",
    );
    existing.add(slug);
    written += 1;
  }

  const categoriesOut = [...categoryMap.entries()]
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => a.slug.localeCompare(b.slug, "ko"));

  const data = { ids: redirects, categories: categoriesOut };
  fs.writeFileSync(
    path.join(root, "src/data/legacy-redirects.json"),
    JSON.stringify(data, null, 2) + "\n",
  );

  const lines = [
    "# Tistory numeric permalinks → title slugs",
    ...Object.entries(redirects)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .flatMap(([id, slug]) => {
        const dest = encodeURI(`/${slug}/`);
        return [`/${id}/ ${dest} 301`, `/${id} ${dest} 301`];
      }),
  ];
  fs.writeFileSync(path.join(root, "public/_redirects"), `${lines.join("\n")}\n`);

  console.log(
    JSON.stringify(
      {
        written,
        skipped,
        redirects: Object.keys(redirects).length,
        categories: categoriesOut.length,
      },
      null,
      2,
    ),
  );
}

main();
