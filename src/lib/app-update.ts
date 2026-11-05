// Keeping the Android app up to date. The website updates itself, but the app around it (icon,
// splash, notification permission) only changes when a new APK is installed.
// The app opens https://…/?app=<build>; the newest build is on the "app-latest" GitHub release.
// If the installed build is older (or the app is so old it doesn't say), DELT offers the update.
// Pure parts are tested in tests/app-update.test.ts.

export const RELEASE_API = "https://api.github.com/repos/pranavvehmid/delt/releases/tags/app-latest";
export const APK_URL = "https://github.com/pranavvehmid/delt/releases/download/app-latest/DELT.apk";
const CHECK_EVERY_MS = 12 * 3600_000;
const SNOOZE_MS = 3 * 86400_000;

/** "DELT for Android (build 6)" -> 6. */
export function buildFromReleaseName(name: string | null | undefined): number | null {
  const m = (name ?? "").match(/build\s+(\d+)/i);
  return m ? Number(m[1]) : null;
}

/** The build the app reported in ?app=, or 0 for an app too old to report one. */
export function installedBuild(search: string, referrer: string, saved: string | null): number | null {
  const fromUrl = new URLSearchParams(search).get("app");
  if (fromUrl && /^\d+$/.test(fromUrl)) return Number(fromUrl);
  if (saved && /^\d+$/.test(saved)) return Number(saved);
  if (referrer.startsWith("android-app://in.delt.mail")) return 0;
  return null; // a browser, not the app
}

export const shouldOffer = (installed: number | null, latest: number | null, snoozedUntil: number, now: number) =>
  installed !== null && latest !== null && latest > installed && now >= snoozedUntil;

// ---------- browser side ----------
const KEY_BUILD = "delt-app-build", KEY_LATEST = "delt-app-latest", KEY_SNOOZE = "delt-app-snooze";

export async function checkAppUpdate(now = Date.now()): Promise<{ installed: number; latest: number } | null> {
  try {
    const installed = installedBuild(location.search, document.referrer, localStorage.getItem(KEY_BUILD));
    if (installed === null) return null;
    localStorage.setItem(KEY_BUILD, String(installed));
    let cached = JSON.parse(localStorage.getItem(KEY_LATEST) || "null") as { at: number; build: number } | null;
    if (!cached || now - cached.at > CHECK_EVERY_MS) {
      const r = await fetch(RELEASE_API, { headers: { Accept: "application/vnd.github+json" } });
      const build = r.ok ? buildFromReleaseName((await r.json()).name) : null;
      if (build !== null) localStorage.setItem(KEY_LATEST, JSON.stringify((cached = { at: now, build })));
    }
    const snoozed = Number(localStorage.getItem(KEY_SNOOZE) || 0);
    return cached && shouldOffer(installed, cached.build, snoozed, now) ? { installed, latest: cached.build } : null;
  } catch {
    return null;
  }
}
export function snoozeAppUpdate(now = Date.now()) {
  try {
    localStorage.setItem(KEY_SNOOZE, String(now + SNOOZE_MS));
  } catch {}
}
