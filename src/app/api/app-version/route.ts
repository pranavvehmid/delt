import { NextResponse } from "next/server";
import { RELEASE_API, buildFromReleaseName } from "@/lib/app-update";

// GET /api/app-version: the newest Android build, so phones don't each ask GitHub (#98).
// GitHub allows 60 unsigned requests per hour per IP, and students on campus Wi-Fi share one IP.
// DELT asks once an hour (cached by Vercel) and answers everyone from that. Public, no student data.
export const revalidate = 3600;

export async function GET() {
  try {
    const r = await fetch(RELEASE_API, {
      headers: { Accept: "application/vnd.github+json", ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10_000),
    });
    const build = r.ok ? buildFromReleaseName((await r.json()).name) : null;
    return NextResponse.json({ build }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch {
    return NextResponse.json({ build: null }, { status: 502 });
  }
}
