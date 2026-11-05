// Issue #27: refresh tokens and Gemini keys are never stored in plain text, and keys can be rotated.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { isSealed, needsReseal, open, openToken, seal } from "../src/lib/secret";

const TOKEN = "1//0gExampleRefreshToken-abcdefghijklmnopqrstuvwxyz0123456789";
const k1 = randomBytes(32).toString("base64");
const k2 = randomBytes(32).toString("base64");
beforeEach(() => {
  process.env.AUTH_SECRET = "test-auth-secret";
  process.env.TOKEN_ENCRYPTION_KEY = k1;
  delete process.env.TOKEN_ENCRYPTION_KEY_OLD;
});

test("a sealed token round-trips and never contains the token", () => {
  const s = seal(TOKEN);
  assert.ok(isSealed(s));
  assert.ok(!s.includes(TOKEN) && !s.includes(TOKEN.slice(4, 20)));
  assert.equal(open(s), TOKEN);
  assert.equal(openToken(s), TOKEN);
  assert.notEqual(seal(TOKEN), s, "a fresh IV every time");
});

test("tampering or a wrong key gives null, never garbage", () => {
  const s = seal(TOKEN);
  const parts = s.split(".");
  parts[4] = parts[4].slice(0, -2) + (parts[4].endsWith("A") ? "BB" : "AA");
  assert.equal(open(parts.join(".")), null);
  process.env.TOKEN_ENCRYPTION_KEY = k2;
  assert.equal(open(s), null, "a different key can't read it");
});

test("rotation: the old key still reads, new values use the new key, and old ones are flagged", () => {
  const old = seal(TOKEN);
  process.env.TOKEN_ENCRYPTION_KEY = k2;
  process.env.TOKEN_ENCRYPTION_KEY_OLD = k1;
  assert.equal(open(old), TOKEN);
  assert.ok(needsReseal(old));
  assert.ok(!needsReseal(seal(TOKEN)));
});

test("without TOKEN_ENCRYPTION_KEY it still encrypts (v1, from AUTH_SECRET) and reads both", () => {
  const v2 = seal(TOKEN);
  delete process.env.TOKEN_ENCRYPTION_KEY;
  const v1 = seal(TOKEN);
  assert.ok(v1.startsWith("v1.") && !v1.includes(TOKEN));
  assert.equal(open(v1), TOKEN);
  process.env.TOKEN_ENCRYPTION_KEY = k1;
  assert.equal(open(v1), TOKEN, "v1 rows keep working after the key is added");
  assert.ok(needsReseal(v1));
  assert.equal(open(v2), TOKEN);
});

test("rows from before #27 (plain text) still work until the script re-encrypts them", () => {
  assert.equal(openToken(TOKEN), TOKEN);
  assert.ok(needsReseal(TOKEN));
  assert.equal(openToken(""), null);
});

test("a bad key setting fails loudly instead of encrypting with a weak key", () => {
  process.env.TOKEN_ENCRYPTION_KEY = "too-short";
  assert.throws(() => seal(TOKEN), /32 bytes/);
});

test("sign-in stores the token sealed, and every Google call opens it first", async () => {
  const { readFileSync } = await import("node:fs");
  assert.match(readFileSync("src/auth.ts", "utf8"), /refresh_token: seal\(account\.refresh_token\)/);
  const gmail = readFileSync("src/lib/gmail.ts", "utf8");
  assert.match(gmail, /getAccessToken\(stored: string[^)]*\)[^{]*\{\s*const refreshToken = openToken\(stored\)/);
  assert.match(gmail, /revokeGoogleToken\(stored: string\)[^{]*\{\s*const token = openToken\(stored\)/);
});
