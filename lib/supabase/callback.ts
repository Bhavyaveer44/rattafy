import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function completeEmailCallback(
  request: NextRequest,
  successPath: "/" | "/reset-password",
  failureCode: "confirmation_link_failed" | "reset_link_failed"
) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    const target = new URL("/signin", request.url);
    target.searchParams.set("auth_error", failureCode);
    return NextResponse.redirect(target);
  }

  const supabase = await createClient();
  if (!supabase) {
    const target = new URL("/signin", request.url);
    target.searchParams.set("auth_error", "auth_not_configured");
    return NextResponse.redirect(target);
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) {
    const target = new URL("/signin", request.url);
    target.searchParams.set("auth_error", failureCode);
    return NextResponse.redirect(target);
  }

  return NextResponse.redirect(new URL(successPath, request.url));
}
