// Per-student request limits for the API routes (issue #30). A fixed window per minute, kept in the
// memory of each server instance. Not exact across instances, but enough to stop one student (or a
// script with their cookie) from using up the free Vercel, Gmail and Gemini allowances for everyone.
// Sync has a stronger, database-backed limit: claim_sync() in supabase/schema.sql.

type Bucket = { n: number; reset: number };
const buckets = new Map<string, Bucket>();

/** Requests allowed per student per minute, by route. */
export const LIMITS = {
  emails: 120,
  patch: 120,
  bulk: 20,
  mail: 60,
  rules: 30,
  push: 20,
  ai: 10,
  settings: 30,
  account: 5,
} as const;

export function allow(key: string, limit: number, windowMs = 60_000, now = Date.now()): { ok: boolean; retryAfter: number } {
  let b = buckets.get(key);
  if (!b || now >= b.reset) {
    b = { n: 0, reset: now + windowMs };
    buckets.set(key, b);
    if (buckets.size > 10_000) for (const [k, v] of buckets) if (now >= v.reset) buckets.delete(k);
  }
  b.n++;
  return { ok: b.n <= limit, retryAfter: Math.ceil((b.reset - now) / 1000) };
}

/** null when allowed; otherwise a 429 answer for the route to return. */
export function limited(email: string, route: keyof typeof LIMITS): Response | null {
  const r = allow(`${route}:${email}`, LIMITS[route]);
  if (r.ok) return null;
  return new Response(JSON.stringify({ error: "Too many requests. Try again in a moment.", retryAfter: r.retryAfter }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": String(r.retryAfter) },
  });
}

/** For tests. */
export const resetLimits = () => buckets.clear();
