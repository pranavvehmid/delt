"use client";

// One mail, full screen. Everything about it in one place: pile, deadline,
// summary, then the original mail read live from Gmail (never stored).
import { useEffect, useRef, useState } from "react";
import type { EmailRow, Priority } from "@/lib/supabase";
import type { FullMessage } from "@/lib/gmail";
import { PILES, cleanSender, cleanSubject, dueLevel, dueText, pileLabel, wrongPileLink } from "@/lib/inbox";
import { calendarLink } from "@/lib/insights";
import { useDialog } from "./use-dialog";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const linkify = (s: string) => s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// In dark themes the mail is shown dark (issue #26): the whole frame is colour-inverted, and pictures
// are inverted back so photos and logos keep their real colours. "Original colours" turns it off.
const DARK_MAIL_KEY = "delt-mail-original";
const KEEP = "img,video,picture,svg,canvas,iframe,[style*='background-image']";

// The mail runs in a sandbox with no scripts at all; links open outside DELT.
function frameDoc(m: FullMessage, darkBg: string | null) {
  const body = m.html ?? `<pre>${linkify(esc(m.text ?? "(This mail has no readable text.)"))}</pre>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'">
<base target="_blank">
<style>
  html,body{margin:0;background:#fff;color:#1d1b22}
  body{padding:18px 16px 28px;font:15.5px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow-wrap:anywhere}
  img{max-width:100%!important;height:auto!important} table{max-width:100%!important} td{word-break:break-word}
  a{color:#5b3fd6} pre{white-space:pre-wrap;font:15px/1.6 system-ui,sans-serif;margin:0}
  blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #ddd;color:#555}
${darkBg ? `html,body{background:${darkBg}!important} ${KEEP}{filter:invert(1) hue-rotate(180deg)}` : ""}
</style></head><body>${body}</body></html>`;
}

export default function MailView({
  id, row, now, gmailLink, onClose, onPatch, onReauth, restoreFocus,
}: {
  id: string;
  row: EmailRow | null;
  now: number;
  gmailLink: string;
  onClose: () => void;
  onPatch: (p: { read?: boolean; is_done?: boolean; priority?: Priority }) => void;
  onReauth?: () => void;
  restoreFocus?: () => HTMLElement | null;
}) {
  const [msg, setMsg] = useState<FullMessage | null>(null);
  const [error, setError] = useState("");
  const [tries, setTries] = useState(0);
  const [height, setHeight] = useState(240);
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  // dark mail in dark themes, unless the student asked for the original colours
  const [darkTheme, setDarkTheme] = useState(false);
  const [original, setOriginal] = useState(false);
  const [darkBg, setDarkBg] = useState<string | null>(null);
  useEffect(() => {
    const read = () => {
      const dark = document.documentElement.dataset.theme === "dark";
      setDarkTheme(dark);
      setDarkBg(dark ? "transparent" : null); // the page shows through, exactly its own colour
    };
    read();
    try {
      setOriginal(localStorage.getItem(DARK_MAIL_KEY) === "1");
    } catch {}
    const watch = new MutationObserver(() => setTimeout(read, 400)); // after the theme cross-fade
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-tone", "data-look"] });
    return () => watch.disconnect();
  }, []);
  const dimMail = darkTheme && !original;
  const toggleOriginal = () => {
    setOriginal((o) => {
      try {
        localStorage.setItem(DARK_MAIL_KEY, o ? "0" : "1");
      } catch {}
      return !o;
    });
  };
  useDialog(box, true, onClose, restoreFocus);

  useEffect(() => {
    let alive = true;
    setMsg(null);
    setError("");
    fetch(`/api/emails/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (r.ok) setMsg(d);
        else {
          if (d.reauth) onReauth?.();
          setError(r.status === 401 ? "You've been signed out. Reload and sign in again." : d.error ?? "Gmail didn't return this mail.");
        }
      })
      .catch(() => alive && setError("You're offline."));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tries]);

  // Lock the page behind (Esc and focus are handled by useDialog).
  useEffect(() => {
    document.documentElement.classList.add("locked");
    return () => document.documentElement.classList.remove("locked");
  }, []);

  // Grow the frame to the mail's own height, so the whole mail scrolls as one page.
  function fit() {
    const doc = frame.current?.contentDocument;
    if (!doc?.documentElement) return;
    setHeight(Math.max(160, doc.documentElement.scrollHeight));
    doc.querySelectorAll("img").forEach((img) => img.complete || img.addEventListener("load", fit, { once: true }));
  }

  const subject = cleanSubject(row?.subject ?? msg?.subject ?? null);
  const sender = msg?.from || cleanSender(row?.from_name ?? null);

  return (
    <div className={`mailview ${row ? `p-${row.priority}` : ""}`} role="dialog" aria-modal="true" aria-labelledby="mv-title" ref={box}>
      <header className="mv-bar">
        <button className="iconbtn" onClick={onClose} aria-label="Back to list" title="Back">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <div className="mv-acts">
          {row && (
            <>
              <button className="pillbtn" onClick={() => onPatch({ read: !row.unread })}>{row.unread ? "Mark read" : "Mark unread"}</button>
              <button className={`pillbtn ${row.is_done ? "on" : ""}`} aria-pressed={row.is_done} onClick={() => onPatch({ is_done: !row.is_done })}>
                {row.is_done ? "✓ Done" : "Done"}
              </button>
            </>
          )}
          <a className="pillbtn" href={gmailLink} target="_blank" rel="noreferrer" aria-label="Open in Gmail (new tab)">Gmail ↗</a>
        </div>
      </header>

      <div className="mv-scroll">
        <article className="mv-page">
          <h1 className="mv-subj" id="mv-title" tabIndex={-1} data-autofocus>
            {subject}
          </h1>
          <div className="mv-from">
            <b>{sender}</b>
            <span className="muted">
              {new Date(msg?.date ?? row?.received_at ?? now).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}
              {msg?.to ? ` · to ${msg.to.length > 40 ? "you and others" : msg.to}` : ""}
            </span>
          </div>

          {row && (
            <div className="mv-pile" role="radiogroup" aria-label="Pile">
              <span className="muted lbl">Pile</span>
              {PILES.map((p) => (
                <button key={p.key} role="radio" aria-checked={row.priority === p.key} className={`pchip p-${p.key} ${row.priority === p.key ? "on" : ""}`} onClick={() => row.priority !== p.key && onPatch({ priority: p.key })}>
                  <i className="tagdot" />
                  {p.label}
                </button>
              ))}
            </div>
          )}
          {row && (
            <a className="mv-report muted" href={wrongPileLink(subject, cleanSender(row.from_name), pileLabel(row.priority))} target="_blank" rel="noreferrer" title="Opens a public GitHub issue. Check it before posting.">
              Wrong pile? Report it ↗
            </a>
          )}

          {row?.deadline && (
            <div className={`mv-due lv-${dueLevel(row.deadline, now)}`}>
              <span>
                <b>Due {dueText(row.deadline, now)}</b>
                <span className="muted"> · {new Date(row.deadline).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}</span>
              </span>
              <a className="pillbtn" href={calendarLink(subject, row.deadline, row.summary)} target="_blank" rel="noreferrer">+ Calendar</a>
            </div>
          )}

          {row?.summary && (
            <p className="mv-sum">
              <span className="muted lbl">Summary</span>
              {row.summary}
            </p>
          )}

          {msg?.unsubscribe && (
            <a className="mv-unsub muted" href={msg.unsubscribe} target="_blank" rel="noreferrer noopener">Unsubscribe ↗</a>
          )}
          {msg && msg.attachments.length > 0 && (
            <div className="mv-att">
              {msg.attachments.map((a, i) => (
                <a key={i} className="att" href={gmailLink} target="_blank" rel="noreferrer" title="Open in Gmail to download">
                  📎 <span className="ell">{a.name}</span> <small className="muted">{kb(a.size)}</small>
                </a>
              ))}
            </div>
          )}

          <div className="mv-body">
            {error ? (
              <div className="mv-err" role="alert">
                <b>Couldn&apos;t load this mail</b>
                <span className="muted">{error}</span>
                <div>
                  <button className="pillbtn" onClick={() => setTries((t) => t + 1)}>Try again</button>
                  <a className="pillbtn" href={gmailLink} target="_blank" rel="noreferrer">Open in Gmail ↗</a>
                </div>
              </div>
            ) : !msg ? (
              <div className="mv-loading" aria-label="Loading the mail" role="status">
                <span className="sk" style={{ width: "90%" }} />
                <span className="sk" style={{ width: "75%" }} />
                <span className="sk" style={{ width: "82%" }} />
                <span className="sk" style={{ width: "40%" }} />
              </div>
            ) : (
              <>
              {darkTheme && (
                <button className="mv-colours link" onClick={toggleOriginal} aria-pressed={original}>
                  {original ? "Show dark" : "Original colours"}
                </button>
              )}
              <iframe
                ref={frame}
                title="Mail content"
                className={`mv-frame ${dimMail ? "dim" : ""}`}
                // same-origin only so the height can be measured; no allow-scripts, so nothing in the mail can run
                sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer"
                srcDoc={frameDoc(msg, dimMail ? darkBg : null)}
                onLoad={fit}
                style={{ height }}
              />
              </>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
