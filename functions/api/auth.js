export async function onRequest({ env, request }) {
  const clientId = env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) {
    return new Response("GitHub OAuth 앱이 아직 연결되지 않았습니다.", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const origin = new URL(request.url).origin;
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("scope", "repo user");
  authorize.searchParams.set("redirect_uri", `${origin}/api/callback`);
  return Response.redirect(authorize.toString(), 302);
}
