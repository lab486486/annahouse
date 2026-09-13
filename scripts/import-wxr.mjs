#!/usr/bin/env node
/**
 * WordPress WXR → src/content/blog markdown
 * 연예인 사주 발행글만 가져오고, /wp-content/uploads/ 경로는 그대로 둡니다.
 *
 * Usage:
 *   node scripts/import-wxr.mjs [export.xml]
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
const imgRoot = path.join(root, "public");
const downloadImages = process.env.DOWNLOAD_IMAGES !== "0";

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

function isSajuPost(title, slug, cats) {
  if (cats.some((c) => c.name === "연예인")) return true;
  return title.includes("사주") || slug.includes("사주");
}

function celebrityName(title, slug) {
  const fromTitle = title.split(/\s*사주/)[0].replace(/[–—-].*$/, "").trim();
  if (fromTitle && fromTitle.length <= 24) return fromTitle;
  return slug.replace(/-사주-운세(?:-\d+)?$/, "").replace(/-/g, " ").trim();
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

function collectUrls(html) {
  const urls = new Set();
  for (const m of html.matchAll(/src=["'](https?:\/\/[^"']+)["']/g)) urls.add(m[1]);
  for (const m of html.matchAll(/href=["'](https?:\/\/[^"']+\.(?:webp|jpg|jpeg|png|gif))["']/gi)) {
    urls.add(m[1]);
  }
  return [...urls];
}

function originalVariant(url) {
  try {
    const u = new URL(url);
    const next = u.pathname.replace(/-\d+x\d+(\.[a-z0-9]+)$/i, "$1");
    if (next === u.pathname) return "";
    return `${u.origin}${next}`;
  } catch {
    return "";
  }
}

function publicPathFromUrl(remoteUrl) {
  try {
    const u = new URL(remoteUrl);
    if (!u.pathname.includes("/wp-content/uploads/")) return null;
    const pathname = decodeURIComponentSafe(u.pathname);
    return {
      abs: path.join(imgRoot, pathname.replace(/^\//, "")),
      publicPath: pathname,
      key: pathname.replace(/^\//, ""),
    };
  } catch {
    return null;
  }
}

function rewriteBody(html) {
  return html
    .replace(/https?:\/\/(?:www\.)?annahouse\.co\.kr\/wp-content\/uploads\//g, "/wp-content/uploads/")
    .replace(/https?:\/\/(?:www\.)?annahouse\.co\.kr\/(?!wp-content\/|wp-admin\/|wp-json\/|xmlrpc\.php)([^"'\\s>]+)/g, (_, p) => {
      const decoded = decodeURIComponentSafe(p.replace(/\/$/, ""));
      return `/${decoded}/`;
    });
}

function frontmatter(data) {
  const lines = [
    "---",
    `title: ${yamlQuote(data.title)}`,
    `slug: ${yamlQuote(data.slug)}`,
    `date: ${data.date.slice(0, 10)}`,
    `description: ${yamlQuote(data.description)}`,
    `name: ${yamlQuote(data.name)}`,
    "tags:",
    ...data.tags.map((t) => `  - ${yamlQuote(t)}`),
  ];
  if (data.cover) lines.push(`cover_image: ${yamlQuote(data.cover)}`);
  lines.push("---", "");
  return lines.join("\n");
}

async function download(url, dest) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
      Referer: "https://annahouse.co.kr/",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
}

async function main() {
  if (!fs.existsSync(xmlPath)) {
    console.error("XML not found:", xmlPath);
    process.exit(1);
  }

  const xml = fs.readFileSync(xmlPath, "utf8");
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);

  fs.mkdirSync(blogDir, { recursive: true });
  for (const f of fs.readdirSync(blogDir)) {
    if (f.endsWith(".md")) fs.unlinkSync(path.join(blogDir, f));
  }

  const imageJobs = new Map();
  let postCount = 0;

  for (const it of items) {
    if (extractTag(it, "wp:post_type") !== "post") continue;
    if (extractTag(it, "wp:status") !== "publish") continue;

    const title = extractTag(it, "title");
    const slug = slugFromPost(it);
    const cats = categories(it).filter((c) => c.domain === "category");
    if (!isSajuPost(title, slug, cats)) continue;

    const date = extractTag(it, "wp:post_date") || extractTag(it, "pubDate");
    const content = extractTag(it, "content:encoded");
    const excerpt = extractTag(it, "excerpt:encoded");
    const fifu = extractMeta(it, "fifu_image_url");
    const tags = [
      ...new Set(
        ["사주", "연예인", ...cats.map((c) => c.name), ...categories(it).filter((c) => c.domain === "post_tag").map((c) => c.name)]
          .map((n) => n.trim())
          .filter(Boolean),
      ),
    ];

    const description =
      excerpt ||
      stripHtml(content).slice(0, 140) ||
      title;

    const urls = collectUrls(content);
    if (fifu) urls.push(fifu);
    for (const url of [...urls]) {
      const original = originalVariant(url);
      if (original) urls.push(original);
    }

    let cover = "";
    for (const url of urls) {
      if (!url.includes("/wp-content/uploads/")) continue;
      const local = publicPathFromUrl(url.split("?")[0]);
      if (!local) continue;
      imageJobs.set(url.split("?")[0], local);
    }
    const coverCandidates = [originalVariant(fifu), fifu].filter(Boolean);
    for (const url of coverCandidates) {
      const local = publicPathFromUrl(url);
      if (local) {
        cover = local.publicPath;
        break;
      }
    }

    const body = rewriteBody(content);
    const file = path.join(blogDir, `${slug.replace(/[\/\\?%*:|"<>]/g, "-")}.md`);
    fs.writeFileSync(
      file,
      frontmatter({
        title,
        slug,
        date,
        description: description.slice(0, 200),
        name: celebrityName(title, slug),
        tags,
        cover,
      }) + body,
      "utf8",
    );
    postCount += 1;
  }

  let imgOk = 0;
  let imgFail = 0;
  let imgSkip = 0;
  const manifest = [];

  for (const [url, local] of imageJobs) {
    manifest.push({ url, key: local.key, publicPath: local.publicPath, file: local.abs });
    if (!downloadImages) continue;
    if (fs.existsSync(local.abs) && fs.statSync(local.abs).size > 0) {
      imgSkip += 1;
      continue;
    }
    try {
      await download(url, local.abs);
      imgOk += 1;
      process.stdout.write(`img ok ${local.publicPath}\n`);
    } catch (err) {
      imgFail += 1;
      console.warn("img fail", url, err.message);
    }
  }

  const manifestPath = path.join(root, "scripts/.wxr-images.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(
    JSON.stringify(
      {
        posts: postCount,
        images: imageJobs.size,
        downloaded: imgOk,
        reused: imgSkip,
        failed: imgFail,
        manifest: manifestPath,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
