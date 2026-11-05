#!/usr/bin/env bash
# One-time setup after cloning or adding new keys. Copies values from your local .env.local
# (never committed) to the places that need them:
#   - Vercel (production): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  -> phone notifications
#   - GitHub repo secret:  CRON_SECRET                          -> background sync job
# Needs the Vercel CLI (npx vercel) and GitHub CLI (gh), both signed in.
# Run from the project folder (Git Bash):  bash scripts/push-secrets.sh
set -euo pipefail
cd "$(dirname "$0")/.."

get() { grep "^$1=" .env.local | head -1 | cut -d= -f2- | tr -d '\r"'; }

# #27: a separate key for encrypting refresh tokens. Created in .env.local the first time.
if [ -z "$(get TOKEN_ENCRYPTION_KEY)" ]; then
  echo "TOKEN_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")" >> .env.local
  echo "Created TOKEN_ENCRYPTION_KEY in .env.local. Back it up: losing it signs every student out."
fi

for k in VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY TOKEN_ENCRYPTION_KEY; do
  v="$(get "$k")"
  if [ -z "$v" ]; then echo "$k is missing in .env.local (npx web-push generate-vapid-keys)"; exit 1; fi
  echo "Vercel: setting $k ..."
  printf '%s' "$v" | npx vercel env add "$k" production --force --sensitive
done

c="$(get CRON_SECRET)"
if [ -z "$c" ]; then echo "CRON_SECRET is missing in .env.local"; exit 1; fi
printf '%s' "$c" | gh secret set CRON_SECRET
echo "GitHub: CRON_SECRET set"

echo
echo "Checking Vercel:"
if npx vercel env ls production 2>/dev/null | grep -q VAPID_PRIVATE_KEY; then
  echo "  VAPID keys are on Vercel."
else
  echo "  VAPID keys did NOT reach Vercel. Is this folder linked? Try: npx vercel link"
  exit 1
fi
echo "Done. Redeploy so the site picks up the keys: npx vercel deploy --prod"
