// Encrypts secrets before they go in the database: each student's Google refresh token (#27)
// and their own Gemini key. AES-256-GCM.
//
// Keys:
// - TOKEN_ENCRYPTION_KEY: 32 random bytes, base64. Separate from AUTH_SECRET, so rotating one
//   doesn't break the other. Generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// - TOKEN_ENCRYPTION_KEY_OLD: the previous key while rotating (read only). See docs/OPERATIONS.md.
// - Without TOKEN_ENCRYPTION_KEY, a key derived from AUTH_SECRET is used ("v1"), so nothing is
//   ever stored in plain text.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

type Key = { id: string; bytes: Buffer };

function legacyKey(): Buffer {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return createHash("sha256").update(`delt-secret:${s}`).digest();
}
function tokenKey(raw: string | undefined): Key | null {
  if (!raw) return null;
  const bytes = Buffer.from(raw.trim(), "base64");
  if (bytes.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes, base64");
  return { id: createHash("sha256").update(bytes).digest("hex").slice(0, 8), bytes };
}
const current = () => tokenKey(process.env.TOKEN_ENCRYPTION_KEY);
const previous = () => tokenKey(process.env.TOKEN_ENCRYPTION_KEY_OLD);

function encrypt(key: Buffer, plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv.toString("base64url"), c.getAuthTag().toString("base64url"), data.toString("base64url")];
}
function decrypt(key: Buffer, iv: string, tag: string, data: string): string | null {
  try {
    const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** "v2.<keyId>.<iv>.<tag>.<data>" with TOKEN_ENCRYPTION_KEY, else "v1.<iv>.<tag>.<data>". */
export function seal(plain: string): string {
  const k = current();
  return k ? ["v2", k.id, ...encrypt(k.bytes, plain)].join(".") : ["v1", ...encrypt(legacyKey(), plain)].join(".");
}

/** The secret, or null if it wasn't sealed by a key we still have (or was tampered with). */
export function open(sealed: string | null | undefined): string | null {
  if (!sealed) return null;
  const parts = sealed.split(".");
  if (parts[0] === "v1" && parts.length === 4) return decrypt(legacyKey(), parts[1], parts[2], parts[3]);
  if (parts[0] === "v2" && parts.length === 5) {
    const k = [current(), previous()].find((x) => x?.id === parts[1]);
    return k ? decrypt(k.bytes, parts[2], parts[3], parts[4]) : null;
  }
  return null;
}

export const isSealed = (s: string | null | undefined) => !!s && /^v[12]\./.test(s);
/** True when a sealed value should be re-sealed with the current key (after a rotation). */
export const needsReseal = (s: string) => {
  const k = current();
  return !isSealed(s) || (k ? !s.startsWith(`v2.${k.id}.`) : false);
};

/** A refresh token as stored: sealed, or plain text in rows from before #27 (until scripts/encrypt-tokens.ts runs). */
export const openToken = (stored: string): string | null => (isSealed(stored) ? open(stored) : stored || null);

/** A Gemini API key looks like "AIza…" or "AQ.…" with no spaces. */
export const looksLikeGeminiKey = (k: string) => /^[A-Za-z0-9_.\-]{30,120}$/.test(k.trim());
