#!/usr/bin/env node
/**
 * Achive/{id}/img → public/wp-content/uploads/tistory/{id}/
 * 숫자 퍼머링크와 맞는 옛 글의 깨진 카카오 이미지를 백업 사진으로 바꿉니다.
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
  return /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/.exec(url)?.[1];
}

function videosFromFigure(block) {
  const keep = [
    ...(block.match(/<iframe\b[\s\S]*?<\/iframe>/gi) || []),
    ...(block.match(/<video\b[\s\S]*?<\/video>/gi) || []),
  ];
  if (keep.length) return keep;
  const url =
    /data-video-url="([^"]+)"/i.exec(block)?.[1] ||
    /\[embed\](https?:\/\/[^[]+)\[\/embed\]/i.exec(block)?.[1];
  if (!url) return [];
  const id = youtubeId(url);
  if (id) {
    return [
      `<iframe title="youtube" src="https://www.youtube.com/embed/${id}" width="860" height="484" frameborder="0" allowfullscreen></iframe>`,
    ];
  }
  return [];
}

function stripBrokenMedia(html) {
  let next = html;
  next = next.replace(/<figure\b[\s\S]*?<\/figure>/gi, (block) => {
    if (!/kakaocdn|daumcdn|tistory2/i.test(block)) return block;
    const keep = videosFromFigure(block);
    return keep.length ? `<div class="video-wrap">${keep.join("\n")}</div>` : "";
  });
  next = next.replace(/<span\b[^>]*data-url="[^"]*(?:kakaocdn|daumcdn)[^"]*"[\s\S]*?<\/span>/gi, "");
  next = next.replace(/<img\b[^>]*(?:kakaocdn|daumcdn|tistory2)[^>]*>/gi, "");
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

function insertPhotos(html, markup) {
  if (!markup) return html;
  if (html.includes('class="photo-grid"') || html.includes('class="photo-single"')) {
    return html.replace(/<(?:div class="photo-grid"|p class="photo-single")[\s\S]*?<\/(?:div|p)>/, markup.trim());
  }
  const afterHeading = html.replace(/<\/h2>/i, `</h2>\n${markup}`);
  if (afterHeading !== html) return afterHeading;
  return markup + html;
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
  const body = insertPhotos(stripBrokenMedia(parts.slice(2).join("---")), photoMarkup(urls));
  fs.writeFileSync(mdPath, `---${front}---\n${body.trimStart()}`);
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
