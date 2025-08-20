const REDIS_URL = process.env.REDIS_URL;
const REDIS_TOKEN = process.env.REDIS_TOKEN;
const MAX_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN || 600);
/**
 * Simple per-key per-minute rate limiter using Upstash REST.
 */
export async function enforceRateLimit(key) {
    const minute = Math.floor(Date.now() / 60000);
    const k = `rl:${key}:${minute}`;
    // Upstash REST pipeline: INCR + EXPIRE 60s
    const res = await fetch(`${REDIS_URL}/pipeline`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${REDIS_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify([
            ["INCR", k],
            ["EXPIRE", k, "60"]
        ]),
    });
    if (!res.ok) {
        const txt = await res.text();
        const err = new Error(`Rate limit backend error: ${res.status} ${txt}`);
        err.statusCode = 502;
        throw err;
    }
    const out = await res.json();
    const count = Number(out?.[0]?.result ?? 0);
    if (count > MAX_PER_MIN) {
        const err = new Error("Rate limit exceeded");
        err.statusCode = 429;
        throw err;
    }
}
