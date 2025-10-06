/**
 * Image delivery proxy - Forward image variant requests to Worker API
 * Route: /i/:uid/:size
 * Example: /i/44983f30-7eea-4a58-b6c3-c13920180447/800x600.jpg
 */
export async function onRequestGet(context) {
  const { params, env } = context;
  const { uid, size } = params;

  if (!uid || !size) {
    return new Response('Bad Request: Missing uid or size', { status: 400 });
  }

  // Validate size format: {width}x{height}.{format}
  if (!/^\d+x\d+\.(jpg|jpeg|webp)$/i.test(size)) {
    return new Response('Bad Request: Invalid size format. Expected: {width}x{height}.{format}', {
      status: 400
    });
  }

  // Forward to Worker API
  const workerUrl = `${env.IMGBASE_WORKER_URL}/i/${uid}/${size}`;

  try {
    const response = await fetch(workerUrl, {
      method: 'GET',
      headers: {
        // Pass through cache control headers if needed
        'Cache-Control': context.request.headers.get('Cache-Control') || 'public, max-age=31536000',
      },
    });

    if (!response.ok) {
      // Return error from Worker API as-is
      return response;
    }

    // Return image with proper headers
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': response.headers.get('ETag') || '',
      },
    });
  } catch (error) {
    console.error('Image delivery error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
