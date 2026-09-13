#!/usr/bin/env node
/**
 * Achive/{id}/img → public/wp-content/uploads/tistory/{id}/
 * 숫자 퍼머링크와 맞는 옛 글에 백업 사진을 문장 사이에 1~2장씩 끼워 넣습니다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const archiveRoot = path.join(root, "Achive");
const destRoot = path.join(root, "public/wp-content/uploads/tistory");
const blogRoot = path.join(root, "src/content/blog");
const redirects = JSON.parse(fs.readFileSync(path.join(root, "src/data/legacy-redirects.json"), "utf8"));
const manifestPath = path.join(root, "scripts/.tistory-images.json");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"]);
const DEAD_VIDEO = /play-tv\.kakao|tv\.kakao|kakaotv|tv\.naver|naver\.tv|kakao\.com\/v\//i;
const SLOT = "<!--PHOTO_SLOT-->";

function naturalImageSort(a, b) {
  const score = (name) => {
    const base = path.basename(name, path.extname(name));
    const match = /(\d+)$/.exec(base.replace(/^img_?/, "img"));
    if (base === "img") return [0, 0];
    if (match) return [1, Number(match[1])];
    return [2, 0];
  };
  const [as, an] = score(a);
  const [bs, bn] = score(b);
  return as - bs || an - bn || a.localeCompare(b);
}

function listImages(dir) {
  if (!fs.existsSync(dir)) return [];
  const rank = { ".webp": 0, ".jpg": 1, ".jpeg": 1, ".png": 2, ".gif": 3, ".bmp": 4 };
  const byBase = new Map();
  for (const name of fs.readdirSync(dir)) {
    const ext = path.extname(name).toLowerCase();
    if (!IMAGE_EXT.has(ext)) continue;
    const base = path.basename(name, path.extname(name));
    const prev = byBase.get(base);
    if (!prev || rank[ext] < rank[path.extname(prev).toLowerCase()]) {
      byBase.set(base, name);
    }
  }
  return [...byBase.values()].sort(naturalImageSort);
}

function youtubeId(url) {
  return /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/.exec(url || "")?.[1];
}

function isYoutube(html) {
  return /youtube\.com|youtu\.be/i.test(html);
}

function youtubeFrame(url) {
  const id = youtubeId(url);
  if (!id) return "";
  return `<div class="video-wrap"><iframe title="youtube" src="https://www.youtube.com/embed/${id}" width="860" height="484" frameborder="0" allowfullscreen></iframe></div>`;
}

function figureReplacement(block) {
  if (isYoutube(block)) {
    const iframe = block.match(/<iframe\b[\s\S]*?<\/iframe>/i)?.[0];
    if (iframe) return `<div class="video-wrap">${iframe}</div>`;
    const url =
      /data-video-url="([^"]+)"/i.exec(block)?.[1] ||
      /\[embed\](https?:\/\/[^[]+)\[\/embed\]/i.exec(block)?.[1];
    return youtubeFrame(url) || "";
  }
  if (DEAD_VIDEO.test(block) || /data-ke-type="video"/i.test(block)) return SLOT;
  if (/kakaocdn|daumcdn|tistory2/i.test(block)) return "";
  return block;
}

function stripBrokenMedia(html) {
  let next = html;
  next = next.replace(/<(?:div class="photo-grid"|p class="photo-single")[\s\S]*?<\/(?:div|p)>/g, "");
  next = next.replace(/<div class="video-wrap">[\s\S]*?<\/div>/gi, (block) => {
    if (isYoutube(block)) return block;
    return SLOT;
  });
  next = next.replace(/<figure\b[\s\S]*?<\/figure>/gi, figureReplacement);
  next = next.replace(/<iframe\b[^>]*src="[^"]*(?:kakao|naver\.tv|tv\.naver)[^"]*"[\s\S]*?<\/iframe>/gi, SLOT);
  next = next.replace(/<span\b[^>]*data-url="[^"]*(?:kakaocdn|daumcdn)[^"]*"[\s\S]*?<\/span>/gi, "");
  next = next.replace(/<img\b[^>]*(?:kakaocdn|daumcdn|tistory2)[^>]*>/gi, "");
  next = next.replace(/<figure class="imagegridblock">[\s\S]*?<\/figure>/gi, "");
  next = next.replace(/<div class="image-container">\s*<\/div>/gi, "");
  next = next.replace(/<figure\b[^>]*>\s*<\/figure>/gi, "");
  next = next.replace(/<p\b[^>]*>\s*(?:&nbsp;|\s)*<\/p>/gi, "");
  next = next.replace(/(?:&nbsp;\s*){2,}/g, "");
  next = next.replace(/\n{3,}/g, "\n\n");
  return next;
}

function photoMarkup(urls) {
  if (!urls.length) return "";
  if (urls.length === 1) {
    return `<p class="photo-single"><img src="${urls[0]}" alt="" /></p>\n`;
  }
  const items = urls.map((src) => `  <img src="${src}" alt="" />`).join("\n");
  return `<div class="photo-grid">\n${items}\n</div>\n`;
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyToken(html) {
  const trimmed = html.trim();
  if (!trimmed) return "empty";
  if (trimmed === SLOT) return "slot";
  if (/^<h[1-6]\b/i.test(trimmed)) return "heading";
  if (/^<div class="video-wrap">/i.test(trimmed)) return "video";
  if (/class="photo-(?:grid|single)"/i.test(trimmed)) return "photo";
  if (visibleText(trimmed).length >= 8) return "text";
  return "other";
}

function splitLoose(html) {
  const type = classifyToken(html);
  if (type !== "text") return [{ type, html }];
  const parts = html
    .split(/(?:\r?\n)[ \t]*(?:\r?\n)+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => ({ type: classifyToken(part), html: part }));
  return parts.length ? parts : [{ type, html }];
}

function tokenize(html) {
  const re =
    /(<h[1-6]\b[\s\S]*?<\/h[1-6]>|<div class="video-wrap">[\s\S]*?<\/div>|<!--PHOTO_SLOT-->|<p\b[\s\S]*?<\/p>)/gi;
  const tokens = [];
  let last = 0;
  let match;
  while ((match = re.exec(html))) {
    const before = html.slice(last, match.index);
    if (before.trim()) tokens.push(...splitLoose(before));
    tokens.push({ type: classifyToken(match[0]), html: match[0] });
    last = match.index + match[0].length;
  }
  const tail = html.slice(last);
  if (tail.trim()) tokens.push(...splitLoose(tail));
  return tokens.filter((token) => token.type !== "empty");
}

function takePhotos(queue) {
  if (!queue.length) return "";
  const count = queue.length >= 2 ? 2 : 1;
  return photoMarkup(queue.splice(0, count));
}

function lastType(tokens) {
  return tokens.at(-1)?.type;
}

function insertPhotos(html, urls) {
  const queue = [...urls];
  const tokens = tokenize(html.replace(/\r\n/g, "\n").replaceAll(SLOT, `${SLOT}`));
  const textTotal = tokens.filter((token) => token.type === "text").length;
  const out = [];
  let textSeen = 0;

  for (const token of tokens) {
    if (token.type === "slot") {
      if (textSeen && textSeen < textTotal && queue.length && lastType(out) !== "photo") {
        out.push({ type: "photo", html: takePhotos(queue) });
      }
      continue;
    }
    out.push(token);
    if (token.type !== "text") continue;
    textSeen += 1;
    if (textSeen < textTotal && queue.length && lastType(out) !== "photo") {
      out.push({ type: "photo", html: takePhotos(queue) });
    }
  }

  if (queue.length && textTotal <= 1) {
    const lastText = [...out].reverse().find((token) => token.type === "text");
    if (lastText && lastType(out) !== "photo") {
      out.push({ type: "photo", html: takePhotos(queue) });
    }
  }

  return out.map((token) => token.html).join("\n");
}

function updateCover(front, firstUrl) {
  if (!firstUrl) return front;
  if (/^cover_image:/m.test(front)) {
    return front.replace(/^cover_image:.*$/m, `cover_image: "${firstUrl}"`);
  }
  return `${front.trimEnd()}\ncover_image: "${firstUrl}"\n`;
}

function copyImages(id, files) {
  const srcDir = path.join(archiveRoot, id, "img");
  const destDir = path.join(destRoot, id);
  fs.mkdirSync(destDir, { recursive: true });
  const uploaded = [];
  for (const name of files) {
    const from = path.join(srcDir, name);
    const to = path.join(destDir, name);
    fs.copyFileSync(from, to);
    uploaded.push({
      file: to,
      key: `wp-content/uploads/tistory/${id}/${name}`,
    });
  }
  return uploaded;
}

function restorePost(id, slug) {
  const mdPath = path.join(blogRoot, `${slug}.md`);
  if (!fs.existsSync(mdPath)) return { skipped: "missing-md" };
  const files = listImages(path.join(archiveRoot, id, "img"));
  if (!files.length) return { skipped: "no-images" };

  const copied = copyImages(id, files);
  const urls = copied.map((item) => `/${item.key}`);
  const raw = fs.readFileSync(mdPath, "utf8");
  const parts = raw.split(/^---$/m);
  if (parts.length < 3) return { skipped: "frontmatter" };
  const front = updateCover(parts[1], urls[0]);
  const body = insertPhotos(stripBrokenMedia(parts.slice(2).join("---")), urls)
    .replaceAll(SLOT, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimStart();
  fs.writeFileSync(mdPath, `---${front}---\n${body}\n`);
  return { images: copied.length, items: copied };
}

function main() {
  const manifest = [];
  let posts = 0;
  let images = 0;
  const skipped = [];

  for (const [id, slug] of Object.entries(redirects.ids)) {
    const result = restorePost(id, slug);
    if (result.skipped) {
      skipped.push(`${id} ${result.skipped}`);
      continue;
    }
    posts += 1;
    images += result.images;
    manifest.push(...result.items);
  }

  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`restored ${posts} posts, ${images} images`);
  if (skipped.length) console.log(`skipped ${skipped.length}\n${skipped.join("\n")}`);
}

main();
