export async function onRequestPost(context) {
  const { request, env } = context;

  // Get headers from client request
  const contentType = request.headers.get('content-type');
  const fileName = request.headers.get('x-filename');

  if (!contentType || !fileName) {
    return new Response(
      JSON.stringify({ error: 'Missing content-type or x-filename header' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Get file data as ArrayBuffer
  const fileData = await request.arrayBuffer();

  const authHeader = buildBasicAuthHeader(
    env.ADMIN_BASIC_AUTH_USER,
    env.ADMIN_BASIC_AUTH_PASS
  );

  // Forward to Worker API with proper headers
  const response = await fetch(env.IMGBASE_UPLOAD_PROXY_URL, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': contentType,
      'X-Filename': fileName,
    },
    body: fileData,
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

function buildBasicAuthHeader(user, password) {
  const token = btoa(`${user}:${password}`);
  return `Basic ${token}`;
}
