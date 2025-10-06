interface Env {
  IMGBASE_UPLOAD_URL: string;
  ADMIN_BASIC_AUTH_USER: string;
  ADMIN_BASIC_AUTH_PASS: string;
}

export async function onRequest(context: { request: Request; env: Env }) {
  const { request, env } = context;

  const baseUrl = new URL(env.IMGBASE_UPLOAD_URL);
  const url = new URL(request.url);
  const endpoint = new URL(`/images${url.search}`, baseUrl);

  const authHeader = buildBasicAuthHeader(
    env.ADMIN_BASIC_AUTH_USER,
    env.ADMIN_BASIC_AUTH_PASS
  );

  const response = await fetch(endpoint.toString(), {
    headers: {
      Authorization: authHeader,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    return new Response(
      JSON.stringify({
        error: 'UpstreamError',
        status: response.status,
        body,
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const json = await response.json();
  return new Response(JSON.stringify(json), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function buildBasicAuthHeader(user: string, password: string): string {
  const token = btoa(`${user}:${password}`);
  return `Basic ${token}`;
}
