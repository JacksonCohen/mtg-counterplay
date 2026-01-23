import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const rateLimit = new Map<string, { count: number; resetTime: number }>();

// Clean up old entries periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimit.entries()) {
    if (now > value.resetTime) {
      rateLimit.delete(key);
    }
  }
}, 60000); // Clean up every minute

export function proxy(request: NextRequest) {
  // Skip rate limiting for static assets
  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/api') ||
    request.nextUrl.pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|gif)$/)
  ) {
    return NextResponse.next();
  }

  // Get IP address from headers (works with Vercel, Netlify, Cloudflare, etc.)
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';
  const now = Date.now();

  // Rate limit configuration
  const limit = 200; // requests
  const window = 60000; // per minute (in milliseconds)

  const record = rateLimit.get(ip);

  if (!record || now > record.resetTime) {
    // First request or window expired, create new record
    rateLimit.set(ip, { count: 1, resetTime: now + window });
    return NextResponse.next();
  } else if (record.count >= limit) {
    // Rate limit exceeded
    return new NextResponse('Too Many Requests - Please slow down', {
      status: 429,
      headers: {
        'Retry-After': Math.ceil((record.resetTime - now) / 1000).toString(),
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': record.resetTime.toString(),
      }
    });
  } else {
    // Increment counter
    record.count++;

    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', limit.toString());
    response.headers.set('X-RateLimit-Remaining', (limit - record.count).toString());
    response.headers.set('X-RateLimit-Reset', record.resetTime.toString());

    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
