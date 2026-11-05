import "server-only";
import type { Priority } from "./supabase";
import { parseUnsubscribe } from "./insights";
import { openToken } from "./secret";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

/** The student removed DELT's access in their Google account (or the token expired for good). */
export class AccessRevoked extends Error {
  constructor() {
    super("Google access was removed. Sign in again to keep DELT working.");
    this.name = "AccessRevoked";
  }
}
/** Google's answer to a refresh token that no longer works. */
export const isRevokedAnswer = (status: number, body: string) => (status === 400 || status === 401) && /invalid_grant|unauthorized_client/.test(body);

/** Takes the refresh token as stored in the database (encrypted, #27) and returns a short-lived access token. */
export async function getAccessToken(stored: string, attempt = 0): Promise<string> {
  const refreshToken = openToken(stored);
  if (!refreshToken) throw new AccessRevoked(); // key lost or row tampered with: ask the student to sign in again
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    // Google sometimes answers 5xx or 429 for a moment: wait and try again.
    if ((res.status >= 500 || res.status === 429) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
      return getAccessToken(stored, attempt + 1);
    }
    const body = await res.text();
    if (isRevokedAnswer(res.status, body)) throw new AccessRevoked();
    throw new Error(`Google token refresh failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return (await res.json()).access_token;
}

async function gmail<T>(token: string, path: string, init?: RequestInit, attempt = 0): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    // Gmail answers 429, or 403 "rateLimitExceeded", when asked too fast: wait and retry.
    const rateLimited = res.status === 429 || (res.status === 403 && /rate ?limit/i.test(text));
    if (rateLimited && attempt < 4) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt + Math.random() * 500));
      return gmail<T>(token, path, init, attempt + 1);
    }
    throw new Error(`Gmail ${path} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export async function listMessageIds(token: string, query: string, max = 100): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ q: query, maxResults: String(Math.min(max - ids.length, 500)) });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await gmail<{ messages?: { id: string }[]; nextPageToken?: string }>(
      token,
      `/messages?${params}`,
    );
    ids.push(...(data.messages ?? []).map((m) => m.id));
    pageToken = data.nextPageToken;
  } while (pageToken && ids.length < max);
  return ids;
}

export type Part = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: Part[];
  headers?: { name: string; value: string }[];
};

export type ParsedMessage = {
  id: string;
  threadId: string;
  fromName: string;
  fromAddress: string;
  subject: string;
  snippet: string;
  receivedAt: Date;
  body: string;
  unread: boolean;
};

/** "Name <a@b.c>" -> the name and the lowercased address. */
export function parseFrom(from: string) {
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
  return { name: m?.[1]?.trim() || from.trim(), address: (m?.[2] ?? from).trim().toLowerCase() };
}

export function decode(data: string) {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

export function findPart(part: Part, mime: string): string | null {
  if (part.mimeType === mime && part.body?.data) return decode(part.body.data);
  for (const p of part.parts ?? []) {
    const found = findPart(p, mime);
    if (found) return found;
  }
  return null;
}

export function htmlToText(html: string) {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/tr>/gi, "\n")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

export async function getMessage(token: string, id: string): Promise<ParsedMessage> {
  const msg = await gmail<{
    id: string;
    threadId: string;
    snippet: string;
    internalDate: string;
    labelIds?: string[];
    payload: Part;
  }>(token, `/messages/${id}?format=full`);

  const header = (name: string) =>
    msg.payload.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? "";

  const { name: fromName, address: fromAddress } = parseFrom(header("from"));

  const plain = findPart(msg.payload, "text/plain");
  const html = plain ? null : findPart(msg.payload, "text/html");

  return {
    id: msg.id,
    threadId: msg.threadId,
    fromName,
    fromAddress,
    subject: header("subject"),
    snippet: msg.snippet,
    receivedAt: new Date(Number(msg.internalDate)),
    body: plain ?? (html ? htmlToText(html) : msg.snippet),
    unread: (msg.labelIds ?? []).includes("UNREAD"),
  };
}

// ---- Gmail labels -------------------------------------------------------

export const LABEL_NAMES: Record<Priority, string> = {
  very_important: "MailSort/1 Very Important",
  priority: "MailSort/2 Priority",
  later: "MailSort/3 Later",
  noise: "MailSort/4 Noise",
};

const LABEL_COLORS: Record<Priority, { backgroundColor: string; textColor: string }> = {
  very_important: { backgroundColor: "#cc3a21", textColor: "#ffffff" },
  priority: { backgroundColor: "#eaa041", textColor: "#ffffff" },
  later: { backgroundColor: "#16a766", textColor: "#ffffff" },
  noise: { backgroundColor: "#999999", textColor: "#ffffff" },
};

/** Returns a map of priority -> Gmail label id, creating any labels that are missing. */
export async function ensureLabels(token: string): Promise<Record<Priority, string>> {
  const { labels = [] } = await gmail<{ labels?: { id: string; name: string }[] }>(token, "/labels");
  const out = {} as Record<Priority, string>;
  for (const p of Object.keys(LABEL_NAMES) as Priority[]) {
    const existing = labels.find((l) => l.name === LABEL_NAMES[p]);
    if (existing) {
      out[p] = existing.id;
      continue;
    }
    const created = await gmail<{ id: string }>(token, "/labels", {
      method: "POST",
      body: JSON.stringify({
        name: LABEL_NAMES[p],
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
        color: LABEL_COLORS[p],
      }),
    });
    out[p] = created.id;
  }
  return out;
}

/** Puts exactly one MailSort label on a message (removes the other three). */
export async function setPriorityLabel(
  token: string,
  messageId: string,
  priority: Priority,
  labelIds: Record<Priority, string>,
) {
  await gmail(token, `/messages/${messageId}/modify`, {
    method: "POST",
    body: JSON.stringify({
      addLabelIds: [labelIds[priority]],
      removeLabelIds: (Object.keys(labelIds) as Priority[])
        .filter((p) => p !== priority)
        .map((p) => labelIds[p]),
    }),
  });
}

/** Removes Gmail's UNREAD label, so the mail shows as read in Gmail too. */
export async function markRead(token: string, messageId: string) {
  await gmail(token, `/messages/${messageId}/modify`, {
    method: "POST",
    body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
  });
}

export type FullMessage = {
  subject: string;
  from: string;
  to: string;
  cc: string;
  date: string;
  html: string | null;
  text: string | null;
  attachments: { name: string; size: number }[];
  unsubscribe: string | null;
};

/** The whole mail for the in-app reader. Read live, never stored. */
export async function getFullMessage(token: string, id: string): Promise<FullMessage> {
  const msg = await gmail<{ payload: Part; internalDate: string }>(token, `/messages/${id}?format=full`);
  const header = (name: string) => msg.payload.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? "";
  const attachments: FullMessage["attachments"] = [];
  const walk = (p: Part) => {
    if (p.filename && p.body?.attachmentId) attachments.push({ name: p.filename, size: p.body.size ?? 0 });
    p.parts?.forEach(walk);
  };
  walk(msg.payload);
  return {
    subject: header("subject"),
    from: header("from"),
    to: header("to"),
    cc: header("cc"),
    date: new Date(Number(msg.internalDate)).toISOString(),
    html: findPart(msg.payload, "text/html"),
    text: findPart(msg.payload, "text/plain"),
    attachments,
    unsubscribe: parseUnsubscribe(header("list-unsubscribe")),
  };
}

/** Puts Gmail's UNREAD label back. */
export async function markUnread(token: string, messageId: string) {
  await gmail(token, `/messages/${messageId}/modify`, {
    method: "POST",
    body: JSON.stringify({ addLabelIds: ["UNREAD"] }),
  });
}

/** Changes many messages in one call (Gmail allows up to 1000 ids per request). */
export async function batchModify(token: string, ids: string[], addLabelIds: string[], removeLabelIds: string[]) {
  for (let i = 0; i < ids.length; i += 1000) {
    await gmail(token, "/messages/batchModify", {
      method: "POST",
      body: JSON.stringify({ ids: ids.slice(i, i + 1000), addLabelIds, removeLabelIds }),
    });
  }
}

/** Removes DELT's MailSort labels from the student's Gmail. Their mail stays where it is. */
export async function removeDeltLabels(token: string): Promise<number> {
  const { labels = [] } = await gmail<{ labels?: { id: string; name: string }[] }>(token, "/labels");
  let n = 0;
  for (const l of labels.filter((l) => l.name === "MailSort" || l.name.startsWith("MailSort/"))) {
    const res = await fetch(`${API}/labels/${l.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (res.ok || res.status === 404) n++;
  }
  return n;
}

/** Tells Google to cancel DELT's access for this student. */
export async function revokeGoogleToken(stored: string): Promise<boolean> {
  const token = openToken(stored);
  if (!token) return false;
  const res = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  });
  return res.ok || res.status === 400; // 400 = already revoked
}
