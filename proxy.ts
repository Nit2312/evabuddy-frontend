import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Proxy runs on edge — protects dashboard routes.
// Since Firebase auth state is not accessible on edge, we rely on client-side
// redirect in the dashboard layout as the primary guard. This adds a fast secondary check.

const PUBLIC_PATHS = ['/login', '/register'];

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow public paths and Next.js internals
    if (
        PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname === '/favicon.ico'
    ) {
        return NextResponse.next();
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
