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

  const bodyText = await response.text();
  const contentType = response.headers.get('content-type') || 'application/json';

  if (!response.ok) {
    return new Response(bodyText, {
      status: response.status,
      headers: { 'Content-Type': contentType },
    });
  }

  const payload = bodyText || JSON.stringify({ items: [], nextCursor: null });
  return new Response(payload, {
    headers: { 'Content-Type': contentType },
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

  const bodyText = await response.text();
  const contentType = response.headers.get('content-type') || 'application/json';

  if (!response.ok) {
    return new Response(bodyText, {
      status: response.status,
      headers: { 'Content-Type': contentType },
    });
  }

  const responseBody = bodyText || JSON.stringify({ deleted: 0, failed: [] });
  return new Response(responseBody, {
    status: response.status,
    headers: { 'Content-Type': contentType },
  });
}

function resolveWorkerBase(env) {
  return new URL(env.IMGBASE_UPLOAD_URL);
}

function buildBasicAuthHeader(user, password) {
  const token = btoa(`${user}:${password}`);
  return `Basic ${token}`;
}
