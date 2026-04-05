export async function onRequest(context) {
  const { request, env, next } = context;

  const user = env.ADMIN_BASIC_AUTH_USER;
  const pass = env.ADMIN_BASIC_AUTH_PASS;

  // 環境変数未設定時はスルー（ローカル開発用）
  if (!user || !pass) {
    return next();
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded);
      const colonIdx = decoded.indexOf(":");
      const reqUser = decoded.slice(0, colonIdx);
      const reqPass = decoded.slice(colonIdx + 1);
      if (reqUser === user && reqPass === pass) {
        return next();
      }
    }
  }

  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="imgbase admin"',
    },
  });
}
