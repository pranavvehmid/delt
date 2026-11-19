export type SharedDeadline = { title: string; due: string; source: string };

const oneline = (value: string, limit: number) => value.replace(/\s+/g, " ").trim().slice(0, limit);

export function sharedDeadlineUrl(origin: string, { title, due, source }: SharedDeadline) {
  const url = new URL("/shared-deadline", origin);
  url.hash = new URLSearchParams({ title: oneline(title, 160), due, source: oneline(source, 100) }).toString();
  return url.toString();
}

export function parseSharedDeadline(hash: string): SharedDeadline | null {
  if (hash.length > 4096) return null;
  const fields = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const title = oneline(fields.get("title") ?? "", 160);
  const due = Date.parse(fields.get("due") ?? "");
  if (!title || !Number.isFinite(due)) return null;
  return { title, due: new Date(due).toISOString(), source: oneline(fields.get("source") ?? "", 100) };
}
