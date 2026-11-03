import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function requireUser() {
  const supabase = await createClient();
  if (!supabase) return { user: null, configured: false };

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { user: null, configured: true };
  return { user: data.user, configured: true };
}

export async function unauthorizedResponse() {
  const { configured } = await requireUser();
  return NextResponse.json(
    { error: configured ? "Sign in to use Rattafy." : "Authentication is not configured." },
    { status: configured ? 401 : 503 }
  );
}
