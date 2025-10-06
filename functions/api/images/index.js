export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'DELETE') {
    return handleDelete(context);
  }

  return handleGet(context);
}

async function handleGet(context) {
  const { request, env } = context;

  const baseUrl = resolveWorkerBase(env);
  const url = new URL(request.url);
  const endpoint = new URL(`/images${url.search}`, baseUrl);

  const response = await fetch(endpoint.toString(), {
    headers: {
      Authorization: buildBasicAuthHeader(env.ADMIN_BASIC_AUTH_USER, env.ADMIN_BASIC_AUTH_PASS),
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

async function handleDelete(context) {
  const { request, env } = context;

  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return new Response(JSON.stringify({ error: 'InvalidJSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const imageIds = Array.isArray(payload?.imageIds) ? payload.imageIds : [];
  if (imageIds.length === 0) {
    return new Response(JSON.stringify({ error: 'imageIds is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const baseUrl = resolveWorkerBase(env);
  const endpoint = new URL('/images/batch', baseUrl);

  const response = await fetch(endpoint.toString(), {
    method: 'DELETE',
    headers: {
      Authorization: buildBasicAuthHeader(env.ADMIN_BASIC_AUTH_USER, env.ADMIN_BASIC_AUTH_PASS),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ imageIds }),
  });

  const text = await response.text();

  if (!response.ok) {
    return new Response(
      JSON.stringify({
        error: 'UpstreamError',
        status: response.status,
        body: text,
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(text || JSON.stringify({ deleted: 0 }), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function resolveWorkerBase(env) {
  return new URL(env.IMGBASE_UPLOAD_URL);
}

function buildBasicAuthHeader(user, password) {
  const token = btoa(`${user}:${password}`);
  return `Basic ${token}`;
}
