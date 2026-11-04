import "server-only";
import { db, type Priority } from "./supabase";
import { classifyByRules, type RuleResult } from "./rules";
import { aiEnabled, classifyWithAI, QuotaExhausted } from "./classify";
import {
  ensureLabels,
  getAccessToken,
  getMessage,
  listMessageIds,
  setPriorityLabel,
  type ParsedMessage,
} from "./gmail";
import type { Classification, Correction } from "./types";
import { profileFromName, type StudentProfile } from "./profile";

const FIRST_SYNC_DAYS = 14;
const MAX_PER_SYNC = 150;
const PARALLEL = 5;
// Gemini's free tier allows only a few requests per minute, so AI calls are
// spaced out and stop once this much of the run has passed.
const AI_GAP_MS = 4500;
const AI_TIME_BUDGET_MS = 35_000;
const LABEL_BACKFILL_MAX = 150;

export type SyncResult = {
  email: string;
  fetched: number;
  sorted: number;
  sortedByAI: number;
  rechecked: number;
  labeled: number;
  errors: string[];
};

const RANK = { very_important: 0, priority: 1, later: 2, noise: 3 } as const;

export async function syncUser(email: string): Promise<SyncResult> {
  const started = Date.now();
  const result: SyncResult = { email, fetched: 0, sorted: 0, sortedByAI: 0, rechecked: 0, labeled: 0, errors: [] };

  const { data: user, error } = await db.from("users").select("*").eq("email", email).single();
  if (error || !user) throw new Error(`No saved Google account for ${email}. Sign in again.`);

  const token = await getAccessToken(user.refresh_token);
  const profile: StudentProfile = profileFromName(user.name);

  // First run: last 14 days. Later runs: everything since the last sync, plus an hour of overlap.
  const since = user.last_synced_at
    ? Math.floor(new Date(user.last_synced_at).getTime() / 1000) - 3600
    : Math.floor(Date.now() / 1000) - FIRST_SYNC_DAYS * 86400;
  const startedAt = new Date().toISOString();

  const ids = await listMessageIds(token, `after:${since} -in:sent -in:drafts -in:chats`, MAX_PER_SYNC);
  result.fetched = ids.length;

  const { data: known } = ids.length
    ? await db.from("emails").select("id").in("id", ids)
    : { data: [] as { id: string }[] };
  const knownIds = new Set((known ?? []).map((r) => r.id));
  const todo = ids.filter((id) => !knownIds.has(id));

  // Your manual corrections teach both sorters.
  const { data: corrected } = await db
    .from("emails")
    .select("from_address, subject, priority")
    .eq("user_email", email)
    .eq("user_corrected", true)
    .order("created_at", { ascending: false })
    .limit(30);
  const corrections: Correction[] = (corrected ?? []).map((c) => ({
    from: c.from_address ?? "",
    subject: c.subject ?? "",
    priority: c.priority,
  }));

  // 1. Download and sort new mail with the free rules.
  const items: { msg: ParsedMessage; c: Classification; rules: RuleResult; byAI: boolean }[] = [];
  for (let i = 0; i < todo.length; i += PARALLEL) {
    await Promise.all(
      todo.slice(i, i + PARALLEL).map(async (id) => {
        try {
          const msg = await getMessage(token, id);
          const rules = classifyByRules(msg, corrections, profile);
          items.push({ msg, c: rules, rules, byAI: false });
        } catch (e) {
          result.errors.push(`${id}: ${(e as Error).message}`);
        }
      }),
    );
  }

  // 2. Ask free Gemini about the new mails that matter most or that the rules weren't sure about.
  let aiStopped = !aiEnabled();
  let lastAI = 0;
  const askAI = async (msg: ParsedMessage) => {
    const wait = lastAI + AI_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastAI = Date.now();
    return classifyWithAI(msg, corrections, profile);
  };
  const aiTimeLeft = () => !aiStopped && Date.now() - started < AI_TIME_BUDGET_MS;
  const onAIError = (id: string, e: unknown) => {
    if (e instanceof QuotaExhausted) {
      aiStopped = true;
      result.errors.push("Free AI limit reached for now; the rest were sorted by rules.");
    } else {
      result.errors.push(`AI ${id}: ${(e as Error).message}`);
    }
  };

  const candidates = items
    .filter(({ rules }) => rules.confidence < 0.95 && (rules.confidence < 0.6 || RANK[rules.priority] <= 1))
    .sort((a, b) => RANK[a.rules.priority] - RANK[b.rules.priority] || b.msg.receivedAt.getTime() - a.msg.receivedAt.getTime());
  for (const item of candidates) {
    if (!aiTimeLeft()) break;
    try {
      item.c = await askAI(item.msg);
      item.byAI = true;
      result.sortedByAI++;
    } catch (e) {
      onAIError(item.msg.id, e);
    }
  }

  // 3. Save new mail.
  for (let i = 0; i < items.length; i += PARALLEL) {
    await Promise.all(
      items.slice(i, i + PARALLEL).map(async ({ msg, c, byAI }) => {
        const { error: insertError } = await db.from("emails").upsert({
          id: msg.id,
          user_email: email,
          thread_id: msg.threadId,
          from_name: msg.fromName,
          from_address: msg.fromAddress,
          subject: msg.subject,
          snippet: msg.snippet,
          received_at: msg.receivedAt.toISOString(),
          priority: c.priority,
          category: c.category,
          summary: c.summary,
          deadline: c.deadline,
          reason: c.reason,
          sorted_by: byAI ? "ai" : "rules",
          unread: msg.unread,
          gmail_labeled: false,
        });
        if (insertError) result.errors.push(`${msg.id}: ${insertError.message}`);
        else result.sorted++;
      }),
    );
  }

  // 4. Spare AI time: re-check older rules-sorted mail, most important and newest first.
  if (aiTimeLeft()) {
    const { data: backlog } = await db
      .from("emails")
      .select("id, priority")
      .eq("user_email", email)
      .eq("sorted_by", "rules")
      .eq("user_corrected", false)
      .in("priority", ["very_important", "priority"])
      .order("received_at", { ascending: false })
      .limit(10);
    for (const row of backlog ?? []) {
      if (!aiTimeLeft()) break;
      try {
        const c = await askAI(await getMessage(token, row.id));
        await db
          .from("emails")
          .update({ ...c, sorted_by: "ai", gmail_labeled: c.priority === row.priority })
          .eq("id", row.id)
          .eq("user_email", email);
        result.rechecked++;
      } catch (e) {
        onAIError(row.id, e);
      }
    }
  }

  // 5. Put Gmail labels on everything not yet labeled (new mail, re-checked mail, past failures).
  const { data: unlabeled } = await db
    .from("emails")
    .select("id, priority")
    .eq("user_email", email)
    .eq("gmail_labeled", false)
    .order("received_at", { ascending: false })
    .limit(LABEL_BACKFILL_MAX);
  if (unlabeled?.length) {
    try {
      const labelIds = await ensureLabels(token);
      for (let i = 0; i < unlabeled.length; i += PARALLEL) {
        await Promise.all(
          unlabeled.slice(i, i + PARALLEL).map(async (row) => {
            try {
              await setPriorityLabel(token, row.id, row.priority as Priority, labelIds);
              await db.from("emails").update({ gmail_labeled: true }).eq("id", row.id);
              result.labeled++;
            } catch (e) {
              result.errors.push(`Label ${row.id}: ${(e as Error).message}`);
            }
          }),
        );
      }
    } catch (e) {
      result.errors.push(`Labels: ${(e as Error).message}`);
    }
  }

  // 6. Mirror Gmail's unread state, so mail read in Gmail leaves the NEW deck too.
  try {
    const unreadNow = new Set(await listMessageIds(token, "is:unread newer_than:60d -in:sent -in:chats", 300));
    const { data: flagged } = await db.from("emails").select("id").eq("user_email", email).eq("unread", true);
    const nowRead = (flagged ?? []).map((r) => r.id).filter((id) => !unreadNow.has(id));
    if (nowRead.length) await db.from("emails").update({ unread: false }).in("id", nowRead).eq("user_email", email);
    if (unreadNow.size) await db.from("emails").update({ unread: true }).in("id", [...unreadNow]).eq("user_email", email).eq("unread", false);
  } catch (e) {
    result.errors.push(`Unread refresh: ${(e as Error).message}`);
  }

  await db.from("users").update({ last_synced_at: startedAt }).eq("email", email);
  return result;
}
