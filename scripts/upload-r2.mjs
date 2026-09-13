#!/usr/bin/env node
/**
 * public/wp-content/uploads → R2 (경로 그대로)
 *
 *   node scripts/upload-r2.mjs
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const bucket = process.env.BUCKET || "annahouse-media";
const manifestPath = path.join(root, "scripts/.wxr-images.json");

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".webp") return "image/webp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function putObject(key, file) {
  return new Promise((resolve, reject) => {
    const args = [
      "r2",
      "object",
      "put",
      `${bucket}/${key}`,
      "--file",
      file,
      "--remote",
      "--content-type",
      contentType(file),
      "--cache-control",
      "public, max-age=31536000, immutable",
    ];
    const child = spawn("wrangler", args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    child.stderr.on("data", (chunk) => {
      err += chunk;
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(err.trim() || `wrangler exit ${code}`));
    });
  });
}

async function mapPool(items, limit, worker) {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

async function main() {
  if (!fs.existsSync(manifestPath)) {
    console.error("Run import-wxr.mjs first:", manifestPath);
    process.exit(1);
  }
  const items = JSON.parse(fs.readFileSync(manifestPath, "utf8")).filter((item) =>
    fs.existsSync(item.file),
  );
  console.log(`Uploading ${items.length} files to ${bucket}`);
  let ok = 0;
  let fail = 0;
  await mapPool(items, 4, async (item) => {
    try {
      await putObject(item.key, item.file);
      ok += 1;
      process.stdout.write(`ok ${item.key}\n`);
    } catch (err) {
      fail += 1;
      console.warn("fail", item.key, err.message.split("\n")[0]);
    }
  });
  console.log(JSON.stringify({ ok, fail, bucket }, null, 2));
  if (fail) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
