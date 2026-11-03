import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { response, claims } = await updateSession(request);
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return response;
  if (request.nextUrl.pathname.startsWith("/api/")) return response;

  const hasUser = Boolean(claims?.sub);
  const isSignInRoute = request.nextUrl.pathname === "/signin" || request.nextUrl.pathname.startsWith("/auth/");
  if (!hasUser && !isSignInRoute) {
    const signInUrl = new URL("/signin", request.url);
    const redirect = NextResponse.redirect(signInUrl);
    response.cookies.getAll().forEach(({ name, value, ...options }) => redirect.cookies.set(name, value, options));
    return redirect;
  }

  if (hasUser && request.nextUrl.pathname === "/signin") {
    const redirect = NextResponse.redirect(new URL("/", request.url));
    response.cookies.getAll().forEach(({ name, value, ...options }) => redirect.cookies.set(name, value, options));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
