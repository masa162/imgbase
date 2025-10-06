import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="imgbase admin"',
      },
    });
  }

  const [scheme, encoded] = authHeader.split(' ');

  if (scheme !== 'Basic') {
    return new NextResponse('Invalid authentication scheme', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="imgbase admin"',
      },
    });
  }

  const decoded = atob(encoded);
  const [username, password] = decoded.split(':');

  const validUsername = process.env.BASIC_AUTH_USERNAME;
  const validPassword = process.env.BASIC_AUTH_PASSWORD;

  if (username === validUsername && password === validPassword) {
    return NextResponse.json({ authenticated: true });
  }

  return new NextResponse('Invalid credentials', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="imgbase admin"',
    },
  });
}
