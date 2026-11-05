import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/supabase";
import { seal } from "@/lib/secret";

// gmail.modify = read mail, change labels, read/unread, move to Trash. It can't delete permanently.
// DELT itself only reads, labels and marks read/unread (see /privacy).
const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.modify",
].join(" ");

// Email domains allowed to sign in. Every VIT student and staff account by default.
const allowedDomains = (process.env.ALLOWED_DOMAINS ?? "vitstudent.ac.in,vit.ac.in")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          scope: SCOPES,
          access_type: "offline", // gives a refresh token for background sync
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    signIn({ user }) {
      const domain = (user.email ?? "").toLowerCase().split("@")[1] ?? "";
      return allowedDomains.includes(domain);
    },
    async jwt({ token, account }) {
      // Runs right after Google sign-in: keep the refresh token in the database.
      if (account?.refresh_token && token.email) {
        const { error } = await db.from("users").upsert({
          email: token.email.toLowerCase(),
          refresh_token: seal(account.refresh_token), // encrypted at rest (#27)
          // VIT names carry the register number (e.g. "26BCE0001"), used to know year and branch.
          name: token.name ?? null,
        });
        if (error) console.error("Saving refresh token failed:", error.message);
        // Signed in again after removing access (issue #10): background sync can use the new token.
        else await db.from("users").update({ access_revoked: false }).eq("email", token.email.toLowerCase());
      }
      return token;
    },
  },
});
