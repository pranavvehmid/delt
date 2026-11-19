"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { F } from "@/lib/inbox";
import { sharedDeadlineUrl, type SharedDeadline } from "@/lib/shared-deadline";
import { useDialog } from "./use-dialog";

export default function DeadlineShare({ deadline }: { deadline: SharedDeadline }) {
  const [origin, setOrigin] = useState("");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const sheet = useRef<HTMLElement>(null);
  const linkField = useRef<HTMLInputElement>(null);
  const open = origin !== "";
  const close = () => setOrigin("");
  useDialog(sheet, open, close);

  function start() {
    setTitle(deadline.title.slice(0, 160));
    setSource(deadline.source.replace(/<?[^\s<>]+@[^\s<>]+>?/g, "").trim().slice(0, 100));
    setStatus("");
    setOrigin(window.location.origin);
  }

  const url = open && title.trim() ? sharedDeadlineUrl(origin, { title, source, due: deadline.due }) : "";
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied");
    } catch {
      linkField.current?.focus();
      linkField.current?.select();
      setStatus("Link selected. Use your device's copy command.");
    }
  }

  return (
    <>
      <button className="iconbtn labelled" onClick={start} aria-label="Share deadline">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m-4 4 4-4 4 4M5 11v10h14V11" /></svg>
        <small aria-hidden="true">Share</small>
      </button>
      {open && createPortal(
        <>
          <div className="veil" onClick={close} />
          <section className="sheet deadline-share" role="dialog" aria-modal="true" aria-labelledby="deadline-share-title" ref={sheet}>
            <header className="sheet-head">
              <h2 id="deadline-share-title" tabIndex={-1} data-autofocus>Share deadline</h2>
              <button className="link" onClick={close}>Close</button>
            </header>
            <p className="muted">Anyone with the link can see these details.</p>
            <label>Title<input value={title} maxLength={160} onChange={(event) => { setTitle(event.target.value); setStatus(""); }} /></label>
            <p>Due {F.dateTime.format(new Date(deadline.due))} IST</p>
            <label>Source<input value={source} maxLength={100} onChange={(event) => { setSource(event.target.value); setStatus(""); }} /></label>
            <label>Share link<input ref={linkField} readOnly value={url} /></label>
            <button className="pillbtn" onClick={copy} disabled={!url}>Copy link</button>
            {status && <p role="status">{status}</p>}
          </section>
        </>,
        document.body,
      )}
    </>
  );
}
