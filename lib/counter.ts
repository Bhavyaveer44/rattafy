// Plan counter backed by Upstash Redis (free tier) over REST.
// If the env vars aren't set, everything silently no-ops — the app never breaks.

const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmd: string[]): Promise<unknown> {
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/${cmd.map(encodeURIComponent).join("/")}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result;
  } catch {
    return null;
  }
}

/** Fire-and-forget increment — never blocks or fails the caller. */
export function bump(key: "plans" | "predictions" | "answers") {
  void redis(["INCR", key]);
}

export async function getCounts(): Promise<{ plans: number; predictions: number }> {
  const result = (await redis(["MGET", "plans", "predictions"])) as
    | (string | null)[]
    | null;
  return {
    plans: Number(result?.[0] ?? 0),
    predictions: Number(result?.[1] ?? 0),
  };
}
