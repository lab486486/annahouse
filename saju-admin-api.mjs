import { Buffer } from "node:buffer";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const QUEUE_DIR = path.join(ROOT, "src", "content", "queue");
const UPLOAD_DIR = path.join(ROOT, "public", "uploads");

const IMAGE_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function yamlScalar(value) {
  if (value == null || value === "") return '""';
  const text = String(value);
  if (/[:#{}[\]&*!|>'"%@`\n]/.test(text)) {
    return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return text;
}

function dumpFrontmatter(data) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(data)) {
    lines.push(`${key}: ${yamlScalar(value ?? "")}`);
  }
  lines.push("---", "");
  return `${lines.join("\n")}`;
}

function parseFrontmatter(text) {
  const stripped = text.replace(/^\uFEFF/, "");
  if (!stripped.startsWith("---")) return {};
  const parts = stripped.split("---", 3);
  if (parts.length < 3) return {};
  const data = {};
  for (const line of parts[1].split("\n")) {
    if (!line.trim() || !line.includes(":")) continue;
    const idx = line.indexOf(":");
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key) data[key] = value;
  }
  return data;
}

function safeName(name) {
  const cleaned = String(name || "").trim().replace(/[\\/]/g, "");
  if (!cleaned || cleaned.includes("..")) {
    throw new Error("이름을 확인해 주세요.");
  }
  return cleaned;
}

async function listQueue() {
  let names = [];
  try {
    names = await readdir(QUEUE_DIR);
  } catch {
    return [];
  }
  const items = [];
  for (const file of names.sort()) {
    if (!file.endsWith(".md") || file.startsWith("_") || file.toLowerCase() === "readme.md") {
      continue;
    }
    const raw = await readFile(path.join(QUEUE_DIR, file), "utf8");
    const meta = parseFrontmatter(raw);
    items.push({
      file,
      name: meta.name || file.replace(/\.md$/, ""),
      birth_date: meta.birth_date || "",
      gender: meta.gender || "",
      birth_hour: meta.birth_hour || "",
      cover_image: meta.cover_image || "",
      status: meta.status || "",
      note: meta.note || "",
    });
  }
  return items;
}

function normalizeApiPath(url = "") {
  return url.split("?")[0].replace(/\/$/, "") || "/";
}

export function sajuAdminApi() {
  return {
    name: "saju-admin-api",
    hooks: {
      "astro:server:setup"({ server }) {
        server.middlewares.stack.unshift({
          route: "",
          handle: async (req, res, next) => {
        const url = normalizeApiPath(req.url || "");
        if (!url.startsWith("/api/saju-")) return next();

        try {
          if (url === "/api/saju-queue" && req.method === "GET") {
            return send(res, 200, { items: await listQueue() });
          }

          if (url === "/api/saju-queue" && req.method === "POST") {
            const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
            const name = safeName(body.name);
            const birthDate = String(body.birth_date || "").trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
              return send(res, 400, { error: "생년월일을 선택해 주세요." });
            }
            const gender = body.gender === "여" ? "여" : "남";
            const hour = Number(body.birth_hour);
            if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
              return send(res, 400, { error: "출생 시각은 0–23시여야 합니다." });
            }
            const cover = String(body.cover_image || "").trim();
            await mkdir(QUEUE_DIR, { recursive: true });
            const dest = path.join(QUEUE_DIR, `${name}.md`);
            const markdown = dumpFrontmatter({
              name,
              birth_date: birthDate,
              gender,
              birth_hour: hour,
              cover_image: cover,
              status: "pending",
              note: String(body.note || "").trim(),
            });
            await writeFile(dest, markdown, "utf8");
            return send(res, 200, { ok: true, file: `${name}.md` });
          }

          if (url === "/api/saju-upload" && req.method === "POST") {
            const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
            const mime = String(body.mime || "");
            const ext = IMAGE_EXT[mime];
            if (!ext) {
              return send(res, 400, { error: "jpg, png, webp, gif만 올릴 수 있습니다." });
            }
            const data = String(body.data || "").replace(/^data:[^;]+;base64,/, "");
            const buffer = Buffer.from(data, "base64");
            if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
              return send(res, 400, { error: "이미지 크기는 5MB 이하만 됩니다." });
            }
            const rawName = String(body.filename || `saju.${ext}`).replace(/[\\/]/g, "");
            const stem = rawName.replace(/\.[^.]+$/, "").replace(/[^\w가-힣.-]+/g, "-") || "saju";
            const filename = `${stem}-${Date.now()}.${ext}`;
            await mkdir(UPLOAD_DIR, { recursive: true });
            await writeFile(path.join(UPLOAD_DIR, filename), buffer);
            return send(res, 200, { url: `/uploads/${filename}` });
          }

          return send(res, 404, { error: "없는 API입니다." });
        } catch (error) {
          return send(res, 500, { error: error instanceof Error ? error.message : "저장에 실패했습니다." });
        }
          },
        });
      },
    },
  };
}
