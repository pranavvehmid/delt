import "server-only";
import type { Priority } from "./supabase";
import { parseUnsubscribe } from "./insights";
import { openToken } from "./secret";
import { createHash } from "node:crypto";
import { MAX_ATTACHMENT, SHOWN_TYPES, type Attachment } from "./attachments";
export type { Attachment };

// #19: an access token lasts about an hour, so keep it (per server instance) instead of asking Google
// before every action. Keyed by a hash of the refresh token; dropped 5 minutes before it expires,
// or as soon as Gmail says it no longer works.
const tokens = new Map<string, { access: string; until: number }>();
const labelCache = new Map<string, Record<Priority, string>>();
const keyOf = (refresh: string) => createHash("sha256").update(refresh).digest("hex");
function forgetAccess(access: string) {
  for (const [k, v] of tokens) if (v.access === access) tokens.delete(k);
  labelCache.delete(access);
}
/** For tests. */
export const resetTokenCache = () => (tokens.clear(), labelCache.clear());

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
  const key = keyOf(refreshToken);
  const hit = tokens.get(key);
  if (hit && hit.until > Date.now()) return hit.access;
  const res = await fetchWithin("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  }, TIMEOUT_MS.token, "Google sign-in");
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
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  tokens.set(key, { access: data.access_token, until: Date.now() + Math.max(0, (data.expires_in ?? 3600) - 300) * 1000 });
  if (tokens.size > 5000) tokens.delete(tokens.keys().next().value!);
  return data.access_token;
}

/** #84: how long DELT waits for Google before giving up (a hung call would eat the whole sync). */
export const TIMEOUT_MS = { token: 10_000, gmail: 15_000 } as const;

/** fetch with a time limit; a timeout becomes a plain, readable error. */
export async function fetchWithin(url: string, init: RequestInit, ms: number, what: string): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(ms) });
  } catch (e) {
    const name = (e as Error).name;
    if (name === "TimeoutError" || name === "AbortError") throw new Error(`${what} didn't answer within ${ms / 1000}s`);
    throw e;
  }
}

async function gmail<T>(token: string, path: string, init?: RequestInit, attempt = 0): Promise<T> {
  const res = await fetchWithin(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  }, TIMEOUT_MS.gmail, "Gmail");
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) forgetAccess(token); // revoked or expired early: get a fresh one next time
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
  partId?: string;
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

// #117: the named entities college mail actually uses; numeric ones (&#8217; &#x20B9;) are decoded generally
const NAMED: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  ndash: "–", mdash: "—", hellip: "…", bull: "•", middot: "·", copy: "©", reg: "®", trade: "™", euro: "€", pound: "£",
  rarr: "→", larr: "←", times: "×", deg: "°", ensp: " ", emsp: " ", thinsp: " ", zwnj: "", zwj: "",
};
export function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

export function htmlToText(html: string) {
  const text = html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/tr>/gi, "\n")
    .replace(/<a [^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text)
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

/** #116: a plain-text part that only says "view this mail in your browser" (or is nearly empty). */
export function isPlaceholderText(plain: string) {
  const t = plain.trim();
  return t.length < 40 || (t.length < 400 && /view (this|the|it) (e-?mail|message|newsletter|mail)? ?(online|in (a |your )?(web )?browser)|html (version|e-?mail)|does ?n[o']t support html|enable html/i.test(t));
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

  const plainPart = findPart(msg.payload, "text/plain");
  const html = !plainPart || isPlaceholderText(plainPart) ? findPart(msg.payload, "text/html") : null;
  // #116: a placeholder plain part ("view in browser") gives way to the HTML version's text
  const plain = plainPart && html && isPlaceholderText(plainPart) ? null : plainPart;

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

// #108: named after DELT and its piles. Labels from before (MailSort/…) are renamed in place, so a
// student's labelled mail keeps its label.
export const LABEL_NAMES: Record<Priority, string> = {
  very_important: "DELT/Urgent",
  priority: "DELT/Priority",
  later: "DELT/Later",
  noise: "DELT/Noise",
};
export const OLD_LABEL_NAMES: Record<Priority, string> = {
  very_important: "MailSort/1 Very Important",
  priority: "MailSort/2 Priority",
  later: "MailSort/3 Later",
  noise: "MailSort/4 Noise",
};
const isDeltLabel = (name: string) => ["DELT", "MailSort"].some((p) => name === p || name.startsWith(`${p}/`));

const LABEL_COLORS: Record<Priority, { backgroundColor: string; textColor: string }> = {
  very_important: { backgroundColor: "#cc3a21", textColor: "#ffffff" },
  priority: { backgroundColor: "#eaa041", textColor: "#ffffff" },
  later: { backgroundColor: "#16a766", textColor: "#ffffff" },
  noise: { backgroundColor: "#999999", textColor: "#ffffff" },
};

/** Returns a map of priority -> Gmail label id, creating any labels that are missing. */
export async function ensureLabels(token: string): Promise<Record<Priority, string>> {
  const cached = labelCache.get(token); // #19: one label lookup per access token, not per move
  if (cached) return cached;
  const { labels = [] } = await gmail<{ labels?: { id: string; name: string }[] }>(token, "/labels");
  const out = {} as Record<Priority, string>;
  for (const p of Object.keys(LABEL_NAMES) as Priority[]) {
    const existing = labels.find((l) => l.name === LABEL_NAMES[p]);
    if (existing) {
      out[p] = existing.id;
      continue;
    }
    // #108: an old MailSort label: rename it, keeping its id and the mail it's on
    const old = labels.find((l) => l.name === OLD_LABEL_NAMES[p]);
    if (old) {
      await gmail(token, `/labels/${old.id}`, { method: "PATCH", body: JSON.stringify({ name: LABEL_NAMES[p] }) });
      out[p] = old.id;
      continue;
    }
    try {
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
    } catch (e) {
      // #107: another sync (the app and the background job) created it a moment ago: use that one
      if (!/\(409\)/.test((e as Error).message)) throw e;
      const again = await gmail<{ labels?: { id: string; name: string }[] }>(token, "/labels");
      const found = again.labels?.find((l) => l.name === LABEL_NAMES[p]);
      if (!found) throw e;
      out[p] = found.id;
    }
  }
  labelCache.set(token, out);
  return out;
}

/** Puts exactly one DELT label on a message (removes the other three). */
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
  attachments: Attachment[];
  unsubscribe: string | null;
};

const headerOf = (p: Part, name: string) => p.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? "";

/** Every file in a mail: parts with a file name, or inline pictures with a Content-ID. */
export function listAttachments(payload: Part): Attachment[] {
  const out: Attachment[] = [];
  const walk = (p: Part) => {
    const cid = headerOf(p, "content-id").replace(/^<|>$/g, "").trim() || null;
    const isFile = p.body?.attachmentId || (p.filename && p.body?.data);
    if (isFile && p.partId && (p.filename || (cid && p.mimeType?.startsWith("image/")))) {
      out.push({ part: p.partId, name: p.filename || `image.${(p.mimeType ?? "image/png").split("/")[1]}`, size: p.body?.size ?? 0, type: (p.mimeType ?? "application/octet-stream").toLowerCase(), cid });
    }
    p.parts?.forEach(walk);
  };
  walk(payload);
  return out;
}

export function findPartById(p: Part, id: string): Part | null {
  if (p.partId === id) return p;
  for (const c of p.parts ?? []) {
    const f = findPartById(c, id);
    if (f) return f;
  }
  return null;
}

export class TooBig extends Error {}

/** How the file is sent: pictures and PDFs open in place; anything else is a plain download. */
export function attachmentHeaders(name: string, type: string, size: number): Record<string, string> {
  const shown = SHOWN_TYPES.includes(type);
  const safeName = name.replace(/[\r\n"\\]/g, "_");
  return {
    "Content-Type": shown ? type : "application/octet-stream",
    "Content-Length": String(size),
    "Content-Disposition": `${shown ? "inline" : "attachment"}; filename="${safeName.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    "X-Content-Type-Options": "nosniff",
    // a file is never a page that can run anything; PDFs need no policy of their own to show
    ...(type === "application/pdf" ? {} : { "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }),
    // #129: never kept on disk (a shared lab computer); the page reuses an image it already loaded
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  };
}

/** #72: one attachment's bytes, read live from Gmail (never stored). */
export async function getAttachment(token: string, id: string, partId: string) {
  const msg = await gmail<{ payload: Part }>(token, `/messages/${id}?format=full`);
  const p = findPartById(msg.payload, partId);
  // only files (a name or a Content-ID), never the mail's own text parts
  if (!p || !(p.body?.attachmentId || p.body?.data) || !(p.filename || headerOf(p, "content-id"))) return null;
  if ((p.body.size ?? 0) > MAX_ATTACHMENT) throw new TooBig("Too big to open here");
  const data = p.body.data ?? (await gmail<{ data: string }>(token, `/messages/${id}/attachments/${p.body.attachmentId}`)).data;
  const bytes = Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const cid = headerOf(p, "content-id").replace(/^<|>$/g, "").trim();
  return { name: p.filename || cid || "attachment", type: (p.mimeType ?? "application/octet-stream").toLowerCase(), bytes };
}

/** The whole mail for the in-app reader. Read live, never stored. */
export async function getFullMessage(token: string, id: string): Promise<FullMessage> {
  const msg = await gmail<{ payload: Part; internalDate: string }>(token, `/messages/${id}?format=full`);
  const header = (name: string) => msg.payload.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? "";
  const attachments = listAttachments(msg.payload);
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

/** Removes DELT's labels (DELT/… and the old MailSort/…) from the student's Gmail. Their mail stays where it is. */
export async function removeDeltLabels(token: string): Promise<number> {
  const { labels = [] } = await gmail<{ labels?: { id: string; name: string }[] }>(token, "/labels");
  let n = 0;
  for (const l of labels.filter((l) => isDeltLabel(l.name))) {
    const res = await fetchWithin(`${API}/labels/${l.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }, TIMEOUT_MS.gmail, "Gmail");
    if (res.ok || res.status === 404) n++;
  }
  return n;
}

/** Tells Google to cancel DELT's access for this student. */
export async function revokeGoogleToken(stored: string): Promise<boolean> {
  const token = openToken(stored);
  if (!token) return false;
  const res = await fetchWithin("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }, TIMEOUT_MS.token, "Google");
  return res.ok || res.status === 400; // 400 = already revoked
}

/** #109: puts one DELT label on many messages at once (removing the other three), up to 1,000 per call. */
export async function setPriorityLabelMany(token: string, ids: string[], priority: Priority, labelIds: Record<Priority, string>) {
  const others = (Object.keys(labelIds) as Priority[]).filter((p) => p !== priority).map((p) => labelIds[p]);
  await batchModify(token, ids, [labelIds[priority]], others);
}
