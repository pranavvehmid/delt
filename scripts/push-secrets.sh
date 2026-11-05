#!/usr/bin/env bash
# One-time setup after cloning or adding new keys. Copies values from your local .env.local
# (never committed) to the places that need them:
#   - Vercel (production): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  -> phone notifications
#   - GitHub repo secret:  CRON_SECRET                          -> background sync job
# Needs the Vercel CLI (npx vercel) and GitHub CLI (gh), both signed in.
# Run from the project folder:  bash scripts/push-secrets.sh
set -euo pipefail

get() { grep "^$1=" .env.local | head -1 | cut -d= -f2- | tr -d '\r"'; }

for k in VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY; do
  v="$(get "$k")"
  if [ -z "$v" ]; then echo "$k is missing in .env.local (npx web-push generate-vapid-keys)"; exit 1; fi
  npx vercel env rm "$k" production --yes >/dev/null 2>&1 || true
  printf '%s' "$v" | npx vercel env add "$k" production >/dev/null
  echo "Vercel: $k set"
done

c="$(get CRON_SECRET)"
if [ -z "$c" ]; then echo "CRON_SECRET is missing in .env.local"; exit 1; fi
printf '%s' "$c" | gh secret set CRON_SECRET
echo "GitHub: CRON_SECRET set"

echo "Done. Redeploy the site (npx vercel deploy --prod) so it picks up the new keys."
