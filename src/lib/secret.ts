// Encrypts small secrets (a student's own Gemini key) before they go in the database.
// AES-256-GCM with a key derived from AUTH_SECRET, so a database leak alone doesn't expose them.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return createHash("sha256").update(`delt-secret:${s}`).digest();
}

/** "v1.<iv>.<tag>.<data>", all base64url. */
export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

/** Returns null for anything that wasn't sealed with the current secret. */
export function open(sealed: string | null | undefined): string | null {
  if (!sealed) return null;
  const [v, iv, tag, data] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !data) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** A Gemini API key looks like "AIza…" or "AQ.…" with no spaces. */
export const looksLikeGeminiKey = (k: string) => /^[A-Za-z0-9_.\-]{30,120}$/.test(k.trim());
