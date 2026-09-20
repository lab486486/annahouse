import { handleAuth, handleCallback } from "../_github-oauth.js";

export async function onRequest(context) {
  const { request, env } = context;
  const path = new URL(request.url).pathname.replace(/^\/api\/oauth\/?/, "");

  if (path === "auth" || path === "auth/") {
    return handleAuth(request, env, "/api/oauth/callback");
  }
  if (path === "callback" || path === "callback/") {
    return handleCallback(request, env, "/api/oauth/callback");
  }
  return new Response("Decap CMS OAuth", { status: 200 });
}
