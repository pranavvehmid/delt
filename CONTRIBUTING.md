# Contributing to DELT

Thanks for helping. DELT is a free app for VIT students, and every part of it must stay free to run: no paid APIs, no paid hosting.

## Find something to work on

Open issues are at [github.com/pranavvehmid/delt/issues](https://github.com/pranavvehmid/delt/issues).

- **good first issue**: small and self-contained
- **help wanted**: bigger, or needs people with something specific (another batch, an iPhone)
- **sorting**: which pile a mail goes to
- **testing**: trying DELT for real and reporting what breaks

Comment on an issue before you start so two people don't do the same work.

## Set up

You need Node 20+, and free accounts on Google Cloud, Supabase and (optionally) Google AI Studio.

```bash
git clone https://github.com/<you>/delt && cd delt
npm install
cp .env.example .env.local
```

1. **Google sign-in:** in Google Cloud, enable the Gmail API, create an OAuth client (Web application) and add `http://localhost:3000/api/auth/callback/google` as a redirect URI. Put the ID and secret in `.env.local`.
2. **Database:** create a Supabase project, run `supabase/schema.sql` in its SQL editor, and copy the project URL and service role key.
3. **AI (optional):** a free Gemini key from aistudio.google.com. Without it, DELT sorts with rules only.
4. `npx auth secret` fills in `AUTH_SECRET`.
5. `npm run dev` and open http://localhost:3000.

## Where things are

| Path | What it does |
|---|---|
| `src/lib/rules.ts` | the free sorting rules |
| `src/lib/classify.ts` | the Gemini fallback |
| `src/lib/sync.ts` | fetches new mail and saves it |
| `src/lib/inbox.ts` | filters, day groups and deadline buckets for the screens |
| `src/app/inbox-app.tsx` | the Inbox and Deadlines screens |
| `src/app/mail-view.tsx` | one mail, full screen |
| `src/app/app.css` | layout, the Minimal and Glyph looks, themes |
| `tests/` | `npm test` |
| `android/` | the Android app (a Trusted Web Activity) |
| `tools/make_art.mjs` | the pictures in the README |

`docs/DESIGN.md` explains how sorting works and why the app looks the way it does.

## Before you open a pull request

- `npm test` passes, and new behaviour has a test.
- `npx tsc --noEmit` and `npx next lint` are clean.
- Every database query on `emails` is filtered by the signed-in student's email. `tests/safety.test.ts` checks this.
- No real names, register numbers or mail content in code or tests. Use made-up ones like `A STUDENT 26BCE0001`.
- Keep the text in the app short and plain.

## Reporting a mail in the wrong pile

Use the "Mail in the wrong pile" issue template. Give the subject line, the pile it went to, the pile it should be in, and your batch year. Don't paste the body of private mail.
