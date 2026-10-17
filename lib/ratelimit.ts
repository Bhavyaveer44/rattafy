// Per-IP rate limiting backed by Upstash Redis (free tier) over REST.
// Fails open: if the env vars are missing or Redis is unreachable, requests pass.

const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmd: (string | number)[]): Promise<unknown> {
  if (!url || !token) return null;
  try {
    const res = await fetch(
      `${url}/${cmd.map((c) => encodeURIComponent(String(c))).join("/")}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.result;
  } catch {
    return null;
  }
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Fixed-window limiter: at most `limit` requests per `windowSeconds` per IP.
 * Returns true if this request is allowed.
 */
export async function allow(
  req: Request,
  route: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const key = `rl:${route}:${clientIp(req)}`;
  const count = await redis(["INCR", key]);
  if (count === null) return true; // Redis unavailable - fail open
  if (Number(count) === 1) void redis(["EXPIRE", key, windowSeconds]);
  return Number(count) <= limit;
}

export const LIMIT_MESSAGE =
  "Whoa, slow down topper - you've hit the hourly limit. Take a chai break and come back. ☕";
