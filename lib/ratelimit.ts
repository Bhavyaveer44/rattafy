import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

type RateLimitResult = "allowed" | "limited" | "unavailable";

async function redis(command: (string | number)[]): Promise<unknown | null> {
  if (!url || !token) return null;
  try {
    const response = await fetch(
      `${url}/${command.map((part) => encodeURIComponent(String(part))).join("/")}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!response.ok) return null;
    const result: unknown = (await response.json()).result;
    return result ?? null;
  } catch {
    return null;
  }
}

function clientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip");
  const ip = forwardedFor?.split(",")[0]?.trim();
  return ip || null;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function incrementWithinLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  // Keep increment and expiry atomic so concurrent requests cannot create a permanent counter.
  const script = "local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return count";
  const result = await redis(["EVAL", script, 1, key, windowSeconds]);
  if (result === null) return "unavailable";
  const count = Number(result);
  if (!Number.isSafeInteger(count) || count < 1) return "unavailable";
  return count > limit ? "limited" : "allowed";
}

/** Enforce the same fixed-window quota for both the trusted client IP and signed-in user. */
export async function allow(
  request: Request,
  route: string,
  userId: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  if (!url || !token) {
    // Keep local development usable; production requests fail closed without the limiter.
    return process.env.NODE_ENV === "production" ? "unavailable" : "allowed";
  }

  const ip = clientIp(request);
  if (ip) {
    const ipResult = await incrementWithinLimit(
      `rl:${route}:ip:${hash(ip)}`,
      limit,
      windowSeconds
    );
    if (ipResult !== "allowed") return ipResult;
  }

  return incrementWithinLimit(
    `rl:${route}:user:${hash(userId)}`,
    limit,
    windowSeconds
  );
}

export function rateLimitResponse(result: Exclude<RateLimitResult, "allowed">) {
  if (result === "limited") {
    return NextResponse.json(
      { error: "Whoa, slow down topper - you've hit the hourly limit. Take a chai break and come back. ☕" },
      { status: 429 }
    );
  }
  return NextResponse.json(
    { error: "Requests are temporarily unavailable. Please try again shortly." },
    { status: 503, headers: { "Retry-After": "30" } }
  );
}
