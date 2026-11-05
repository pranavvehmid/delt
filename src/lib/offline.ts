// The last inbox, kept on this device so DELT opens without a connection (issue #14).
// Only the newest mails are kept, only on the student's own phone, and it's wiped on
// sign out and on "Delete my data".

export const OFFLINE_MAX = 200;
const VERSION = 1;
const MAX_AGE_MS = 7 * 86400_000; // #38
const PREFIX = "delt-inbox:";
export const cacheKey = (email: string) => PREFIX + email.toLowerCase();

export type Cached<T> = { at: number; mails: T[]; due: T[] };

export function packCache<T>(mails: T[], due: T[], now: number): string {
  return JSON.stringify({ v: VERSION, at: now, mails: mails.slice(0, OFFLINE_MAX), due: due.slice(0, OFFLINE_MAX) });
}

/** The saved inbox, or null if there is none, it's from an older version, broken, or a month old. */
export function unpackCache<T>(raw: string | null, now: number): Cached<T> | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (d?.v !== VERSION || typeof d.at !== "number" || !Array.isArray(d.mails) || !Array.isArray(d.due)) return null;
    if (now - d.at > MAX_AGE_MS) return null;
    return { at: d.at, mails: d.mails, due: d.due };
  } catch {
    return null;
  }
}

/** #38: keep a copy only in the installed app (Home Screen or the Android app), never in a
 *  plain browser tab, which may be a shared lab computer. */
export const isInstalledApp = () => {
  try {
    return (
      window.matchMedia?.("(display-mode: standalone)").matches ||
      document.referrer.startsWith("android-app://") ||
      !!localStorage.getItem("delt-app-build") ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
};

/** Removes every saved inbox and the cached app pages from this device. */
export async function clearOffline() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k);
  } catch {}
  try {
    if (typeof caches !== "undefined") for (const k of await caches.keys()) await caches.delete(k);
  } catch {}
}
