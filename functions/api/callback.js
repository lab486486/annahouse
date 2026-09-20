function htmlPage(script) {
  return `<!doctype html>
<html lang="ko">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body>
    <p>GitHub 로그인을 마무리하는 중입니다.</p>
    <script>${script}</script>
  </body>
</html>`;
}

function postMessageScript(payload) {
  const message = JSON.stringify(payload);
  return `
    function receive(event) {
      if (event.data === "authorizing:github" && window.opener) {
        window.opener.postMessage(${message}, event.origin);
      }
    }
    window.addEventListener("message", receive, false);
    if (window.opener) window.opener.postMessage("authorizing:github", "*");
  `;
}

async function canWrite(token, login) {
  const res = await fetch(`https://api.github.com/repos/lab486486/annahouse/collaborators/${encodeURIComponent(login)}/permission`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "annahouse-decap",
    },
  });
  if (!res.ok) return false;
  const data = await res.json();
  return ["admin", "maintain", "write"].includes(String(data.permission || ""));
}

export async function onRequest({ env, request }) {
  const clientId = env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = env.GITHUB_OAUTH_CLIENT_SECRET;
  const code = new URL(request.url).searchParams.get("code");
  if (!clientId || !clientSecret || !code) {
    return new Response("GitHub 로그인 정보가 없습니다.", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;
  if (!token) {
    const message = `authorization:github:error:${JSON.stringify({ message: tokenData.error_description || "로그인에 실패했습니다." })}`;
    return new Response(htmlPage(postMessageScript(message)), { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "annahouse-decap",
    },
  });
  const user = await userRes.json();
  if (!(await canWrite(token, user.login || ""))) {
    const message = `authorization:github:error:${JSON.stringify({ message: "이 저장소에 글을 넣을 권한이 없습니다." })}`;
    return new Response(htmlPage(postMessageScript(message)), { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  const success = `authorization:github:success:${JSON.stringify({ token, provider: "github" })}`;
  return new Response(htmlPage(postMessageScript(success)), { headers: { "content-type": "text/html; charset=utf-8" } });
}
