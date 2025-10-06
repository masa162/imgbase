interface Env {
  IMGBASE_UPLOAD_URL: string;
  ADMIN_BASIC_AUTH_USER: string;
  ADMIN_BASIC_AUTH_PASS: string;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'InvalidJSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const authHeader = buildBasicAuthHeader(
    env.ADMIN_BASIC_AUTH_USER,
    env.ADMIN_BASIC_AUTH_PASS
  );

  const response = await fetch(env.IMGBASE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify(payload),
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

  const signed = await response.json();
  return new Response(JSON.stringify(signed), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function buildBasicAuthHeader(user: string, password: string): string {
  const token = btoa(`${user}:${password}`);
  return `Basic ${token}`;
}
