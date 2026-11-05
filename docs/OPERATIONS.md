# Running DELT

Everything someone needs to keep DELT running, rotate its secrets, or take it over. Written for issue [#37](https://github.com/pranavvehmid/delt/issues/37): DELT must not depend on one student's accounts.

**If you are taking over DELT, read the whole page once.** It takes about ten minutes.

## What runs where

| Piece | Service | Free plan | What it does |
|---|---|---|---|
| Website and API | Vercel, project `delt`, functions in `dub1` (Dublin) | Hobby | Next.js app, `/api/*` routes |
| Database | Supabase, project `vit-mail-organizer`, `eu-west-1` (Ireland) | Free | Students, mail previews, rules, push subscriptions |
| Background sync | GitHub Actions, `.github/workflows/sync.yml` | Free for public repos | Every 15 minutes, calls `GET /api/sync` |
| Daily fallback sync | Vercel cron, `vercel.json` | Hobby (1 a day) | Same endpoint once a day |
| Tests | GitHub Actions, `.github/workflows/test.yml` | Free | Unit and browser tests on every push |
| Android app | GitHub Actions, `.github/workflows/android.yml` | Free | Builds the APK into the `app-latest` release |
| Sign-in and Gmail | Google Cloud project with an OAuth client | Free | "Internal" app in the VIT student Google organisation |
| AI (optional) | Google AI Studio (Gemini free tier) | Free | Only for students who said yes |

## Accounts that must have more than one owner

| Account | Where to add someone |
|---|---|
| GitHub repo `pranavvehmid/delt` | Settings → Collaborators. Give a co-maintainer **Admin** (needed for secrets). |
| Vercel project | Project → Settings → Members (Hobby allows one member; move the project to a free Team if you need two). |
| Supabase project | Organization → Team → Invite (free plan allows several members). |
| Google Cloud project (OAuth client) | IAM → Grant access → Owner. **The OAuth client lives in the student organisation; whoever owns it must still have a VIT student account.** |
| Google AI Studio key | Tied to one Google account. Easy to replace: create a new key and update `GEMINI_API_KEY`. |

Keep the secrets below in a shared password manager (Bitwarden's free plan works) that at least two maintainers can open.

## Secrets

All live in `.env.local` for local runs (never committed) and in Vercel → Project → Settings → Environment Variables for production. `.env.example` lists them with notes.

| Secret | Used for | If it leaks | If it's lost |
|---|---|---|---|
| `AUTH_SECRET` | Signs sessions; fallback key for encrypting tokens (`v1`) | Rotate: everyone is signed out | Everyone signs in again |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google sign-in and Gmail | Reset the client secret in Google Cloud | Make a new secret in Google Cloud |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Full database access | **Rotate at once** (Supabase → Settings → API), then follow "If tokens may have leaked" | Copy again from Supabase |
| `TOKEN_ENCRYPTION_KEY` | Encrypts each student's Google refresh token (`v2`, issue #27) | Rotate (below) | **Every student must sign in again.** Back it up. |
| `CRON_SECRET` | Lets GitHub Actions call `GET /api/sync` | Make a new one; update Vercel and the GitHub secret | Same |
| `GEMINI_API_KEY` | Shared free AI | Delete it in AI Studio, make a new one | Make a new one |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Phone notifications | Make new keys; students turn notifications off and on again | Same |
| Android `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD` (GitHub secrets) | Signs the APK | Users must reinstall from a new key | **The app can never be updated in place.** Back it up. |

`bash scripts/push-secrets.sh` copies the notification keys and `TOKEN_ENCRYPTION_KEY` to Vercel and `CRON_SECRET` to GitHub (it needs the Vercel and GitHub CLIs, signed in).

### Rotating the token key

1. Put the current key in `TOKEN_ENCRYPTION_KEY_OLD` and a new one in `TOKEN_ENCRYPTION_KEY` (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`), in Vercel and `.env.local`. Redeploy.
2. Tokens are re-encrypted with the new key the next time each student syncs (within a day). Or run `npx tsx --conditions=react-server --env-file=.env.local scripts/encrypt-tokens.ts --apply`.
3. A day later, remove `TOKEN_ENCRYPTION_KEY_OLD`.

### If tokens may have leaked

1. Rotate `SUPABASE_SERVICE_ROLE_KEY` and `TOKEN_ENCRYPTION_KEY` (above).
2. In Google Cloud, reset the OAuth client secret. Every refresh token is then useless; students sign in again.
3. Tell students (a banner, or a post in the class groups) and link them to myaccount.google.com/permissions to check.

## Database changes

`supabase/schema.sql` is the whole schema; `supabase/migrations/` has each change with a date. To apply one: Supabase → SQL Editor → New query → paste the file → Run. Every migration is safe to run twice. Apply the migration **before** deploying code that needs it.

## Deploying

`main` is production. Push, then `npx vercel deploy --prod` (or connect the GitHub repo in Vercel for automatic deploys). Check `https://delt-mu.vercel.app` and the **Tests** workflow.

## Things that break quietly

- **GitHub disables scheduled workflows after 60 days without commits.** `sync.yml` re-enables itself on the 1st of each month. If background sync seems stopped, open Actions → Sync mail and press "Enable workflow".
- **Supabase pauses free projects after a week with no requests.** Background sync keeps it awake; if it was paused, restore it from the Supabase dashboard.
- **The OAuth app is Internal to the student organisation.** If its owner's VIT account is closed, sign-in stops for everyone. Move ownership before that happens (below).
- **VIT's Google admins can block third-party apps with Gmail access.** If sign-in shows "Access blocked", that's an admin policy; talk to VIT IT.

## Handing over

1. Add the new maintainer to every account above, and give them the shared password vault.
2. In Google Cloud, add them as Owner on the project. Before the old owner graduates, the new owner should create a **new OAuth client** under their own student account (or a club or department account), update `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`, redeploy, and check that sign-in works. Students sign in again once.
3. Transfer the GitHub repository (Settings → Danger zone → Transfer) or keep it and add the new owner as Admin.
4. Move the Vercel and Supabase projects to the new owner (both support project transfer), or keep them shared.
5. Update the README's maintainer line and this page.

## The longer-term fix

A student-held app with access to every student's mailbox should ideally live under a VIT club or department, with VIT IT aware of it. Start that conversation early, before anything is blocked.
