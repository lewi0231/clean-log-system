import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Next.js Middleware
 * Handles:
 * - Authentication for dashboard routes
 * - Security headers
 * - Route protection
 */

export async function middleware(request: NextRequest) {
    // Create Supabase client for middleware
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(
                    cookiesToSet: Array<
                        {
                            name: string;
                            value: string;
                            options?: Partial<{
                                httpOnly?: boolean;
                                secure?: boolean;
                                sameSite?: "strict" | "lax" | "none" | boolean;
                                maxAge?: number;
                                path?: string;
                                domain?: string;
                            }>;
                        }
                    >,
                ) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        request.cookies.set({
                            name,
                            value,
                            ...options,
                        });
                    });
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set({
                            name,
                            value,
                            ...options,
                        });
                    });
                },
            },
        },
    );

    // Check authentication for dashboard routes
    const pathname = request.nextUrl.pathname;

    // Public routes that don't require authentication
    // Note: "/" is handled separately as exact match only
    const publicRoutePrefixes = [
        "/login",
        "/signup",
        "/verify-email",
        "/review",
        "/invoice",
        "/worker/accept-invite",
    ];

    // Check if route is public
    // Root route "/" is public only as exact match
    // Other routes use prefix matching
    const isPublicRoute = pathname === "/" ||
        publicRoutePrefixes.some((route) => pathname.startsWith(route));

    // Get session to check authentication status
    const {
        data: { session },
    } = await supabase.auth.getSession();

    // #region agent log - Debug middleware auth
    console.log("[MIDDLEWARE DEBUG]", {
        pathname,
        hasSession: !!session,
        sessionUserId: session?.user?.id,
        sessionUserEmail: session?.user?.email,
        isPublicRoute,
        cookies: request.cookies.getAll().map((c) => c.name),
        hypothesisId: "MIDDLEWARE",
    });
    // #endregion

    // If user is authenticated and trying to access login/signup, redirect to dashboard
    if (session && (pathname === "/login" || pathname === "/signup")) {
        console.log(
            "[MIDDLEWARE DEBUG] Redirecting authenticated user from login/signup to dashboard",
        );
        const redirectUrl = new URL("/dashboard", request.url);
        return NextResponse.redirect(redirectUrl);
    }

    // If it's a dashboard route, require authentication
    if (pathname.startsWith("/dashboard") && !isPublicRoute) {
        if (!session) {
            console.log(
                "[MIDDLEWARE DEBUG] No session for dashboard route, redirecting to login",
            );
            // Redirect to login with return URL
            const redirectUrl = new URL("/login", request.url);
            redirectUrl.searchParams.set("redirect", pathname);
            return NextResponse.redirect(redirectUrl);
        }

        // Check email verification status for authenticated users
        // Allow access but the dashboard will show restrictions for unverified users
        if (session.user && !session.user.email_confirmed_at) {
            console.log(
                "[MIDDLEWARE DEBUG] User email not verified",
                {
                    userId: session.user.id,
                    email: session.user.email,
                },
            );
            // Don't redirect - allow access but dashboard will show verification banner
            // This follows the "hybrid approach" - allow access but restrict features
        }
    }

    // Add security headers
    const securityHeaders = {
        "X-DNS-Prefetch-Control": "on",
        "Strict-Transport-Security":
            "max-age=63072000; includeSubDomains; preload",
        "X-Frame-Options": "SAMEORIGIN",
        "X-Content-Type-Options": "nosniff",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy":
            "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    };

    // Apply security headers
    Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
    });

    // Content Security Policy
    // Dynamically include Supabase URL origin in CSP
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    let supabaseOrigin = "";
    if (supabaseUrl) {
        try {
            const url = new URL(supabaseUrl);
            supabaseOrigin = `${url.protocol}//${url.host}`;
        } catch {
            // If URL parsing fails, fall back to defaults
        }
    }

    const isDevelopment = process.env.NODE_ENV === "development";
    // Build connect-src directive
    // Include Supabase origin, common localhost patterns for dev, and production patterns
    const connectSrcParts = ["'self'"];

    // Add Supabase origin if available
    if (supabaseOrigin) {
        connectSrcParts.push(supabaseOrigin);
    }

    // Add common localhost patterns for development
    if (isDevelopment) {
        connectSrcParts.push(
            "http://localhost:54321",
            "http://127.0.0.1:54321",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "ws://localhost:*",
            "ws://127.0.0.1:*",
        );
    }

    // Add production patterns
    connectSrcParts.push(
        "https://*.supabase.co",
        "https://*.stripe.com",
        "wss://*.supabase.co",
    );

    const connectSrc = connectSrcParts.join(" ");

    const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // 'unsafe-eval' needed for Next.js
        "style-src 'self' 'unsafe-inline'", // 'unsafe-inline' needed for Tailwind
        "img-src 'self' data: https: blob:",
        "font-src 'self' data:",
        `connect-src ${connectSrc}`,
        "frame-src 'self' https://*.stripe.com",
        "frame-ancestors 'self'",
    ].join("; ");

    response.headers.set("Content-Security-Policy", csp);

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (public folder)
         */
        "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
