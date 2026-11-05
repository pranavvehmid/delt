import "server-only";
import webpush from "web-push";
import { db } from "./supabase";
import { planNotifications, type NotifyMail } from "./notify-plan";

// Sends phone notifications with the browser's own push service (free, no Firebase project needed).
// Keys: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (generate once with `npx web-push generate-vapid-keys`).

export const pushEnabled = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let configured = false;
function setup() {
  if (configured) return;
  webpush.setVapidDetails("https://github.com/pranavvehmid/delt", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
}

type Sub = { endpoint: string; p256dh: string; auth: string };

/** Sends one message to every device the student turned notifications on for. Drops dead subscriptions. */
export async function sendToStudent(email: string, payload: object): Promise<number> {
  if (!pushEnabled()) return 0;
  setup();
  const { data: subs } = await db.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_email", email);
  let sent = 0;
  for (const s of (subs ?? []) as Sub[]) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 6 * 3600 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint).eq("user_email", email);
    }
  }
  return sent;
}

/** Urgent mail and close deadlines for one student; marks what was sent so it's sent once. */
export async function notifyStudent(email: string, now = Date.now()): Promise<number> {
  if (!pushEnabled()) return 0;
  const { count } = await db.from("push_subscriptions").select("endpoint", { count: "exact", head: true }).eq("user_email", email);
  if (!count) return 0;
  const { data } = await db
    .from("emails")
    .select("id, subject, from_name, summary, priority, received_at, deadline, unread, is_done, notified, reminded")
    .eq("user_email", email)
    .or(`and(priority.eq.very_important,notified.eq.false),and(reminded.eq.false,deadline.gte.${new Date(now).toISOString()},deadline.lte.${new Date(now + 86400_000).toISOString()})`)
    .limit(50);
  const plan = planNotifications((data ?? []) as NotifyMail[], now);
  let sent = 0;
  for (const p of plan) {
    // #35: claim first, send second. Only the run whose update flips the flag sends, so two
    // overlapping runs (background sync, reminders, the daily cron) can't both send it.
    const flag = p.kind === "urgent" ? "notified" : "reminded";
    const { data: claimed } = await db
      .from("emails")
      .update({ [flag]: true })
      .eq("id", p.id)
      .eq("user_email", email)
      .eq(flag, false)
      .select("id");
    if (!claimed?.length) continue;
    sent += await sendToStudent(email, p);
  }
  return sent;
}

/** The student is looking at the app, so new mail doesn't need a ping. */
export async function markSeen(email: string) {
  await db.from("emails").update({ notified: true }).eq("user_email", email).eq("notified", false);
}
