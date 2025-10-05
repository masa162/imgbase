import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Basic認証のチェック
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
    return NextResponse.next();
  }

  return new NextResponse('Invalid credentials', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="imgbase admin"',
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (handled by edge functions)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
