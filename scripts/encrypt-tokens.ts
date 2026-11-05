// One-time (and after every key rotation): encrypts any refresh token or Gemini key still stored
// in plain text or with an old key. Safe to run more than once. Issue #27.
//   npx tsx --conditions=react-server --env-file=.env.local scripts/encrypt-tokens.ts [--apply]
import { db } from "../src/lib/supabase";
import { needsReseal, open, openToken, seal } from "../src/lib/secret";

async function main() {
  const apply = process.argv.includes("--apply");
  const { data: users, error } = await db.from("users").select("email, refresh_token, gemini_key_enc");
  if (error) throw error;
  let tokens = 0, keys = 0, lost = 0;
  for (const u of users ?? []) {
    const update: Record<string, string> = {};
    if (u.refresh_token && needsReseal(u.refresh_token)) {
      const plain = openToken(u.refresh_token);
      if (plain) (update.refresh_token = seal(plain)), tokens++;
      else lost++;
    }
    if (u.gemini_key_enc && needsReseal(u.gemini_key_enc)) {
      const plain = open(u.gemini_key_enc);
      if (plain) (update.gemini_key_enc = seal(plain)), keys++;
    }
    if (apply && Object.keys(update).length) {
      const { error: e } = await db.from("users").update(update).eq("email", u.email);
      if (e) throw e;
    }
  }
  console.log(`${users?.length ?? 0} students: ${tokens} tokens and ${keys} Gemini keys ${apply ? "re-encrypted" : "would be re-encrypted"}; ${lost} unreadable (those students sign in again).`);
}
main();
