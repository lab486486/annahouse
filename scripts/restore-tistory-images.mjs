#!/usr/bin/env node
/**
 * Achive/{id}/img → public/wp-content/uploads/tistory/{id}/
 * 숫자 퍼머링크와 맞는 옛 글에 백업 사진을 서론/소제목/결론 단위로 나눠 넣습니다.
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

function pairsOf(urls) {
  const pairs = [];
  for (let i = 0; i < urls.length; i += 2) pairs.push(urls.slice(i, i + 2));
  return pairs;
}

function renderPairs(pairs) {
  return pairs.map(photoMarkup).join("");
}

function splitBlocks(html) {
  const parts = html.split(/(?=<p\b|<div\b|<h[1-6]\b|<ul\b|<ol\b|<blockquote\b|<figure\b)|(?:\n{2,})/i);
  return parts.filter((part) => part.trim() && !/^<figure\b[^>]*>\s*<\/figure>$/i.test(part.trim()));
}

function sprinkle(body, pairs) {
  if (!pairs.length) return body;
  const blocks = splitBlocks(body);
  if (blocks.length < 2) {
    return `${renderPairs(pairs.slice(0, 1))}${body}${renderPairs(pairs.slice(1))}`;
  }
  const extra = pairs.slice(1);
  const step = extra.length ? Math.max(1, Math.ceil((blocks.length - 1) / extra.length)) : blocks.length;
  let out = `${renderPairs(pairs.slice(0, 1))}${blocks[0]}`;
  let extraIdx = 0;
  for (let i = 1; i < blocks.length; i++) {
    out += blocks[i];
    if (extraIdx < extra.length && i % step === 0) {
      out += renderPairs([extra[extraIdx++]]);
    }
  }
  if (extraIdx < extra.length) out += renderPairs(extra.slice(extraIdx));
  return out;
}

function parseParts(html) {
  const matches = [...html.matchAll(/<h([23])\b[^>]*>[\s\S]*?<\/h[23]>/gi)];
  if (!matches.length) {
    return { title: "", intro: html, sections: [] };
  }

  let title = "";
  let restStart = 0;
  let sectionMatches = matches;
  const first = matches[0];
  if (first[1] === "2") {
    title = html.slice(0, first.index + first[0].length);
    restStart = first.index + first[0].length;
    sectionMatches = matches.slice(1);
  }

  if (!sectionMatches.length) {
    return { title, intro: html.slice(restStart), sections: [] };
  }

  const intro = html.slice(restStart, sectionMatches[0].index);
  const sections = sectionMatches.map((match, index) => {
    const end = sectionMatches[index + 1] ? sectionMatches[index + 1].index : html.length;
    return {
      heading: match[0],
      body: html.slice(match.index + match[0].length, end),
    };
  });
  return { title, intro, sections };
}

function takePairs(queue, count) {
  return queue.splice(0, count);
}

function fillSlots(html, queue) {
  return html.replaceAll(SLOT, () => {
    if (!queue.length) return "";
    return photoMarkup(queue.shift());
  });
}

function splitThirds(html) {
  const blocks = splitBlocks(html);
  if (blocks.length < 3) {
    return [html, "", ""];
  }
  const first = Math.ceil(blocks.length / 3);
  const second = Math.ceil((blocks.length - first) / 2);
  return [
    blocks.slice(0, first).join(""),
    blocks.slice(first, first + second).join(""),
    blocks.slice(first + second).join(""),
  ];
}

function insertPhotos(html, urls) {
  const queue = pairsOf(urls);
  const parts = parseParts(html);
  parts.intro = fillSlots(parts.intro, queue);
  for (const section of parts.sections) {
    section.body = fillSlots(section.body, queue);
  }

  const assigned = { intro: [], mid: [], end: [], sections: parts.sections.map(() => []) };

  if (parts.sections.length) {
    const last = parts.sections.length - 1;
    const middle = parts.sections.map((_, index) => index).filter((index) => index !== last);
    const slots = ["intro", last, ...middle];
    const filled = {
      intro: /class="photo-(?:grid|single)"/.test(parts.intro),
      sections: parts.sections.map((section) => /class="photo-(?:grid|single)"/.test(section.body)),
    };
    const firstPass = slots.filter((slot) =>
      slot === "intro" ? !filled.intro : !filled.sections[slot],
    );
    for (const slot of firstPass) {
      if (!queue.length) break;
      if (slot === "intro") assigned.intro.push(queue.shift());
      else assigned.sections[slot].push(queue.shift());
    }
    const extras = parts.sections.length ? parts.sections.map((_, index) => index) : ["intro"];
    let extraIdx = 0;
    while (queue.length) {
      const target = extras[extraIdx % extras.length];
      assigned.sections[target].push(queue.shift());
      extraIdx += 1;
    }
    const introOut = assigned.intro.length ? `${parts.intro.trimEnd()}\n${renderPairs(assigned.intro)}` : parts.intro;
    const sectionOut = parts.sections
      .map((section, index) => `${section.heading}\n${sprinkle(section.body, assigned.sections[index])}`)
      .join("\n");
    return `${parts.title}\n${introOut}\n${sectionOut}`;
  }

  const thirds = splitThirds(parts.intro);
  const labels = ["intro", "mid", "end"];
  for (const label of labels) {
    if (!queue.length) break;
    assigned[label].push(queue.shift());
  }
  let extraIdx = 0;
  const extraTargets = ["mid", "end", "intro"];
  while (queue.length) {
    assigned[extraTargets[extraIdx % extraTargets.length]].push(queue.shift());
    extraIdx += 1;
  }
  return `${parts.title}\n${sprinkle(thirds[0], assigned.intro)}${sprinkle(thirds[1], assigned.mid)}${sprinkle(thirds[2], assigned.end)}`;
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
