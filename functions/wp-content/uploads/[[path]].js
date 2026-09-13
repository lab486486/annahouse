function keyFromParams(params) {
  const raw = params.path;
  const rest = Array.isArray(raw) ? raw.join("/") : raw || "";
  let decoded = rest;
  try {
    decoded = decodeURIComponent(rest);
  } catch {
    decoded = rest;
  }
  return `wp-content/uploads/${decoded}`;
}

function headersFor(obj) {
  const headers = new Headers();
  const type = obj.httpMetadata?.contentType || "application/octet-stream";
  headers.set("Content-Type", type);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  if (obj.size != null) headers.set("Content-Length", String(obj.size));
  return headers;
}

export async function onRequest(context) {
  const method = context.request.method;
  if (method !== "GET" && method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }

  const bucket = context.env.MEDIA_BUCKET;
  if (!bucket) return new Response("Media bucket is not bound", { status: 500 });

  const key = keyFromParams(context.params);
  const obj =
    method === "HEAD" ? await bucket.head(key) : await bucket.get(key);
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = headersFor(obj);
  if (method === "HEAD") return new Response(null, { headers });
  return new Response(obj.body, { headers });
}
