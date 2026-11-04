"use client";

import { useEffect, useState } from "react";
import type { FullMessage } from "@/lib/gmail";

// The original mail, read live from Gmail and shown in a locked-down frame:
// no scripts, no access to DELT, links open in a new tab.

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const linkify = (s: string) => s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');

function frameDoc(m: FullMessage) {
  const body = m.html ?? `<pre>${linkify(escapeHtml(m.text ?? "(This mail has no readable text.)"))}</pre>`;
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'">
<base target="_blank">
<style>
  html,body{margin:0;background:#fffdf7;color:#1b1238}
  body{padding:22px 24px;font:15.5px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;word-wrap:break-word}
  img{max-width:100%;height:auto} table{max-width:100%} a{color:#5b2fd6}
  pre{white-space:pre-wrap;font:15px/1.6 ui-monospace,Consolas,monospace;margin:0}
</style></head><body>${body}</body></html>`;
}

const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function MailReader({ id, gmailLink, onClose }: { id: string; gmailLink: string; onClose: () => void }) {
  const [msg, setMsg] = useState<FullMessage | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(`/api/emails/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!alive) return;
        if (!r.ok) setError(d.error ?? "Couldn't load this mail");
        else setMsg(d);
      })
      .catch(() => alive && setError("Couldn't reach the server"));
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <>
      <div className="veil" style={{ zIndex: 64 }} onClick={onClose} />
      <aside className="reader" role="dialog" aria-modal="true" aria-label={msg?.subject ?? "Mail"}>
        <div className="block reader-card">
          <header className="reader-head">
            <div className="flex items-start justify-between gap-3">
              <span className="mono reader-kicker">FULL MAIL · LIVE FROM GMAIL</span>
              <div className="flex gap-2">
                <a className="btn" href={gmailLink} target="_blank" rel="noreferrer">
                  ↗ Gmail
                </a>
                <button className="btn" onClick={onClose} aria-label="Close">
                  ✕
                </button>
              </div>
            </div>
            <h2>{msg?.subject ?? (error ? "Couldn't open this mail" : "Opening…")}</h2>
            {msg && (
              <dl className="reader-meta">
                <dt>FROM</dt>
                <dd>{msg.from}</dd>
                <dt>TO</dt>
                <dd>{msg.to || "—"}</dd>
                {msg.cc && (
                  <>
                    <dt>CC</dt>
                    <dd>{msg.cc}</dd>
                  </>
                )}
                <dt>DATE</dt>
                <dd>{new Date(msg.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</dd>
              </dl>
            )}
            {msg && msg.attachments.length > 0 && (
              <div className="reader-att">
                {msg.attachments.map((a, i) => (
                  <span key={i} className="achip" style={{ background: "var(--cream)" }}>
                    <b>📎</b>
                    <span>
                      {a.name} · {kb(a.size)}
                    </span>
                  </span>
                ))}
                <span className="hint">open in Gmail to download</span>
              </div>
            )}
          </header>
          <div className="reader-body">
            {error && <p className="hint" style={{ padding: 24 }}>{error}</p>}
            {!msg && !error && <div className="reader-loading dot">· · ·</div>}
            {msg && (
              <iframe
                title="Mail content"
                className="reader-frame"
                sandbox="allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer"
                srcDoc={frameDoc(msg)}
              />
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
