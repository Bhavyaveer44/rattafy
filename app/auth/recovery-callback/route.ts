import type { NextRequest } from "next/server";
import { completeEmailCallback } from "@/lib/supabase/callback";

export async function GET(request: NextRequest) {
  return completeEmailCallback(request, "/reset-password", "reset_link_failed");
}
