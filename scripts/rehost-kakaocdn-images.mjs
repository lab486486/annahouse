#!/usr/bin/env node
/**
 * 만료된 kakaocdn/daumcdn 핫링크 → dotry.tistory 원본에서 받아
 * public/wp-content/uploads/tistory/{id}/ 로 재호스팅하고 MD src를 교체.
 *
 *   node scripts/rehost-kakaocdn-images.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const blogRoot = path.join(root, "src/content/blog");
const destRoot = path.join(root, "public/wp-content/uploads/tistory");
const manifestPath = path.join(root, "scripts/.rehost-kakaocdn-images.json");

function decodeHtml(s) {
  return String(s)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** local markdown filename → original dotry.tistory.com post id */
const POSTS = [
  {
    file: "생성-ai-이미지-prompt-팁-인물-포즈자세를-정하는-프롬프.md",
    id: "438",
  },
  {
    file: "생성-ai-이미지-prompt-팁-apparel-silhouette-드레스-형태를-정하는-프롬프.md",
    id: "440",
  },
  {
    file: "생성-ai-이미지-prompt-팁-neck-style네크라인을-정하는-프롬프트.md",
    id: "444",
  },
  {
    file: "ai-이미지-생성-프롬프트드레스-길이와-종류.md",
    id: "442",
  },
  {
    file: "로지텍-키보드-한영전환-안될-때-조치방법-2.md",
    id: "425",
  },
];

function pathKey(url) {
  try {
    const u = new URL(url);
    return u.pathname.replace(/\/+$/, "");
  } catch {
    return url.split("?")[0];
  }
}

function extFromUrl(url) {
  const base = pathKey(url).split("/").pop() || "img.png";
  const ext = path.extname(base).toLowerCase();
  return ext || ".png";
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}

async function download(url, dest) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: "https://dotry.tistory.com/",
    },
  });
  if (!res.ok) throw new Error(`IMG ${url} → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) throw new Error(`IMG too small: ${url} (${buf.length})`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return buf.length;
}

function extractFreshUrls(html) {
  const map = new Map(); // pathKey → full signed url
  const re = /https:\/\/blog\.kakaocdn\.net\/[^"'\s<>]+/gi;
  let m;
  while ((m = re.exec(html))) {
    const raw = decodeHtml(m[0].replace(/&amp;/g, "&"));
    const key = pathKey(raw);
    if (!map.has(key)) map.set(key, raw.split("&quot;")[0]);
  }
  return map;
}

function collectLocalKeys(md) {
  const keys = [];
  const seen = new Set();
  const re = /https:\/\/blog\.kakaocdn\.net\/[^"'\s<>]+/gi;
  let m;
  while ((m = re.exec(md))) {
    const raw = decodeHtml(m[0].replace(/&amp;/g, "&"));
    const key = pathKey(raw);
    if (seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

function rewriteMd(md, id, keyToLocal) {
  let next = md;

  // Replace whole figure blocks that contain kakaocdn with a simple local image
  next = next.replace(/<figure\b[\s\S]*?<\/figure>/gi, (block) => {
    if (!/kakaocdn|daumcdn|tistory2/i.test(block)) return block;
    const m =
      /https:\/\/blog\.kakaocdn\.net\/[^"'\s<>]+/i.exec(block) ||
      /fname=(https?[^"'\s<>]+)/i.exec(block);
    if (!m) return "";
    let url = decodeHtml(m[1] || m[0]).replace(/&amp;/g, "&");
    if (url.includes("%")) {
      try {
        url = decodeURIComponent(url);
      } catch {
        /* keep */
      }
    }
    // fname= may still be encoded kakaocdn url
    const kakao = /https:\/\/blog\.kakaocdn\.net\/[^"'\s<>]+/i.exec(url);
    const key = pathKey(kakao ? kakao[0] : url);
    const local = keyToLocal.get(key);
    if (!local) return block;
    return `<p class="photo-single"><img src="${local}" alt="" /></p>`;
  });

  // Any remaining hotlinks (data-url, srcset leftovers, bare img)
  for (const [key, local] of keyToLocal) {
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    next = next.replace(
      new RegExp(`https://blog\\.kakaocdn\\.net${esc}(?:\\?[^"'\\s<>]*)?`, "gi"),
      local,
    );
    // also daumcdn thumb wrappers that embed this path
    next = next.replace(
      new RegExp(
        `https://img\\d*\\.daumcdn\\.net/thumb/[^"'\\s<>]*${esc.replace(/\//g, "%2F")}[^"'\\s<>]*`,
        "gi",
      ),
      local,
    );
  }

  // Strip leftover daumcdn thumbs if any
  next = next.replace(/\s*srcset="[^"]*daumcdn[^"]*"/gi, "");
  next = next.replace(/\s*data-url="[^"]*(?:kakaocdn|daumcdn)[^"]*"/gi, "");
  next = next.replace(/\s*data-phocus="[^"]*(?:kakaocdn|daumcdn)[^"]*"/gi, "");

  // Set cover_image from first local image if missing
  const firstImg = /src="(\/wp-content\/uploads\/tistory\/[^"]+)"/.exec(next)?.[1];
  if (firstImg) {
    if (/^cover_image:/m.test(next)) {
      next = next.replace(/^cover_image:.*$/m, `cover_image: "${firstImg}"`);
    } else {
      next = next.replace(/^(---\n(?:.*\n)*?tags:\n(?:  - .*\n)*)/m, `$1cover_image: "${firstImg}"\n`);
    }
  }

  return next;
}

async function processPost({ file, id }) {
  const mdPath = path.join(blogRoot, file);
  if (!fs.existsSync(mdPath)) throw new Error(`missing ${file}`);
  const md = fs.readFileSync(mdPath, "utf8");
  const localKeys = collectLocalKeys(md);
  if (!localKeys.length) {
    console.log(`skip ${file}: no kakaocdn urls`);
    return [];
  }

  console.log(`\n== ${file} (dotry/${id}) — ${localKeys.length} images`);
  const html = await fetchText(`https://dotry.tistory.com/${id}`);
  const fresh = extractFreshUrls(html);
  console.log(`   fresh urls on source: ${fresh.size}`);

  const outDir = path.join(destRoot, id);
  fs.mkdirSync(outDir, { recursive: true });

  const keyToLocal = new Map();
  const manifest = [];
  let i = 0;

  for (const key of localKeys) {
    const signed = fresh.get(key);
    if (!signed) {
      console.warn(`   MISSING on source: ${key}`);
      continue;
    }
    const ext = extFromUrl(key);
    const name = i === 0 ? `img${ext}` : `img_${i}${ext}`;
    i += 1;
    const dest = path.join(outDir, name);
    const localPath = `/wp-content/uploads/tistory/${id}/${name}`;
    const bytes = await download(signed, dest);
    console.log(`   ✓ ${name} (${bytes} bytes)`);
    keyToLocal.set(key, localPath);
    manifest.push({
      file: dest,
      key: `wp-content/uploads/tistory/${id}/${name}`,
    });
  }

  const rewritten = rewriteMd(md, id, keyToLocal);
  fs.writeFileSync(mdPath, rewritten);
  const left = collectLocalKeys(rewritten).length;
  console.log(`   wrote ${file} — remaining kakaocdn: ${left}`);
  return manifest;
}

async function main() {
  // html-entities may not be installed — fall back
  const all = [];
  for (const post of POSTS) {
    all.push(...(await processPost(post)));
  }
  fs.writeFileSync(manifestPath, JSON.stringify(all, null, 2));
  console.log(`\nDone. ${all.length} files → ${manifestPath}`);
  console.log(`Upload: node scripts/upload-r2.mjs ${manifestPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
