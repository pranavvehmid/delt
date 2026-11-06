// #72: files in a mail, shared by the server (which reads them from Gmail) and the reader (which shows them).

/** One file in a mail. `part` is Gmail's part number ("1.2"), which stays the same between fetches
 *  (attachment ids don't). `cid` is set when the file has a Content-ID, so the mail's HTML can show it inline. */
export type Attachment = { part: string; name: string; size: number; type: string; cid: string | null };

/** Types DELT shows inside the app. Everything else (SVG and HTML included, which can carry scripts) is a download. */
export const SHOWN_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"];
export const isPicture = (a: Pick<Attachment, "type">) => SHOWN_TYPES.includes(a.type) && a.type.startsWith("image/");
export const isPdf = (a: Pick<Attachment, "type">) => a.type === "application/pdf";

/** Vercel answers at most 4.5 MB; bigger files open in Gmail instead. */
export const MAX_ATTACHMENT = 4_400_000;

export const attachmentUrl = (mailId: string, a: Pick<Attachment, "part">) => `/api/emails/${encodeURIComponent(mailId)}/attachments/${a.part}`;

/** Point the mail's inline pictures (<img src="cid:...">) at DELT's attachment route. */
export function inlineCids(html: string, mailId: string, files: Attachment[]) {
  const byCid = new Map(files.filter((f) => f.cid && f.size <= MAX_ATTACHMENT).map((f) => [f.cid!.toLowerCase(), attachmentUrl(mailId, f)]));
  if (!byCid.size) return html;
  return html.replace(/(["'(=]\s*)cid:([^"')\s>]+)/gi, (m, pre, cid) => {
    const url = byCid.get(decodeURIComponent(cid).toLowerCase());
    return url ? `${pre}${url}` : m;
  });
}

/** Files to list under the summary: everything except pictures the mail already shows in its text. */
export function listedFiles(html: string | null, files: Attachment[]) {
  const body = (html ?? "").toLowerCase();
  return files.filter((f) => !(f.cid && isPicture(f) && body.includes(`cid:${f.cid.toLowerCase()}`)));
}
