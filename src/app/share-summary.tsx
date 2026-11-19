"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDialog } from "./use-dialog";
import { F } from "@/lib/inbox";

export default function ShareSummary({ subject, summary, deadline }: { subject: string; summary: string; deadline: string | null }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");
  const sheet = useRef<HTMLElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  useDialog(sheet, open, () => setOpen(false));

  function start() {
    const date = deadline === null ? NaN : Date.parse(deadline);
    setDraft([subject.trim(), summary.trim(), Number.isFinite(date) ? `Due: ${F.dateTime.format(date)} IST` : ""].filter(Boolean).join("\n\n"));
    setStatus("");
    setOpen(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft.trim());
      setStatus("Copied");
    } catch {
      field.current?.focus();
      field.current?.select();
      setStatus("Text selected. Use your device's copy command.");
    }
  }

  const text = draft.trim();
  return (
    <>
      <button className="link mv-share-trigger" type="button" onClick={start} aria-label="Share summary">Share</button>
      {open && createPortal(
        <>
          <div className="veil" onClick={() => setOpen(false)} />
          <section className="sheet share-summary" role="dialog" aria-modal="true" aria-labelledby="share-summary-title" ref={sheet}>
            <header className="sheet-head">
              <h2 id="share-summary-title" tabIndex={-1} data-autofocus>Share summary</h2>
              <button className="link" onClick={() => setOpen(false)}>Close</button>
            </header>
            <label htmlFor="share-summary-text">Review or edit the text before sharing</label>
            <textarea
              id="share-summary-text" ref={field} rows={6} maxLength={2000} value={draft}
              onChange={(event) => { setDraft(event.target.value); setStatus(""); }}
            />
            <div className="share-summary-actions">
              <button className="pillbtn" onClick={copy} disabled={!text}>Copy text</button>
              {text && <a className="pillbtn on" href={`https://wa.me/?${new URLSearchParams({ text })}`} target="_blank" rel="noreferrer">Open WhatsApp</a>}
            </div>
            {status && <p role="status">{status}</p>}
          </section>
        </>,
        document.body,
      )}
    </>
  );
}
