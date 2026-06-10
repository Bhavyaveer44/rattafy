import { NextResponse } from "next/server";
import { getCounts } from "@/lib/counter";

export async function GET() {
  const counts = await getCounts();
  return NextResponse.json(counts, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
