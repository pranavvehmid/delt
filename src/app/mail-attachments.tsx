"use client";

// #72: a mail's files. Pictures show as thumbnails and open in a viewer inside DELT; PDFs open in the
// browser's own PDF viewer (on Android, the phone's); anything else downloads. Files too big for the
// server to pass on open in Gmail. Read live from Gmail each time, never stored.
import { useEffect, useRef, useState } from "react";
import { MAX_ATTACHMENT, attachmentUrl, isPdf, isPicture, type Attachment } from "@/lib/attachments";
import { useDialog } from "./use-dialog";

const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const ext = (name: string) => (name.match(/\.(\w{1,5})$/)?.[1] ?? "file").toUpperCase();

export default function MailAttachments({ mailId, files, gmailLink }: { mailId: string; files: Attachment[]; gmailLink: string }) {
  const [viewing, setViewing] = useState<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  if (!files.length) return null;
  const pictures = files.filter((f) => isPicture(f) && f.size <= MAX_ATTACHMENT);
  const others = files.filter((f) => !pictures.includes(f));

  return (
    <section className="mv-att" aria-label={`${files.length} attachment${files.length > 1 ? "s" : ""}`}>
      {pictures.length > 0 && (
        <ul className="att-thumbs">
          {pictures.map((f, i) => (
            <li key={f.part}>
              <button
                className="att-thumb"
                onClick={(e) => {
                  opener.current = e.currentTarget;
                  setViewing(i);
                }}
                aria-label={`View ${f.name}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a private file from the student's own mail, not a site image */}
                <img src={attachmentUrl(mailId, f)} alt="" loading="lazy" decoding="async" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <ul className="att-files">
          {others.map((f) => {
            const big = f.size > MAX_ATTACHMENT;
            const url = attachmentUrl(mailId, f);
            const props = big
              ? { href: gmailLink, target: "_blank", rel: "noreferrer" }
              : isPdf(f) || isPicture(f)
                ? { href: url, target: "_blank", rel: "noreferrer" }
                : { href: url, download: f.name };
            return (
              <li key={f.part}>
                <a className="att" {...props}>
                  <span className={`att-kind ${isPdf(f) ? "pdf" : ""}`} aria-hidden="true">{isPdf(f) ? "PDF" : ext(f.name)}</span>
                  <span className="att-name">
                    <span className="ell">{f.name}</span>
                    <small className="muted">
                      {kb(f.size)} · {big ? "Open in Gmail ↗" : isPdf(f) ? "Open ↗" : "Download"}
                    </small>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
      {viewing !== null && (
        <Viewer
          mailId={mailId}
          files={pictures}
          index={viewing}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
          restoreTo={() => opener.current}
        />
      )}
    </section>
  );
}

function Viewer({ mailId, files, index, onIndex, onClose, restoreTo }: { mailId: string; files: Attachment[]; index: number; onIndex: (i: number) => void; onClose: () => void; restoreTo: () => HTMLElement | null }) {
  const box = useRef<HTMLDivElement>(null);
  useDialog(box, true, onClose, restoreTo);
  // the phone's Back button closes the picture, not the mail: one history step while it's open
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!history.state?.deltViewer) history.pushState({ deltViewer: 1 }, "");
    const pop = () => close.current();
    window.addEventListener("popstate", pop);
    const el = box.current;
    return () => {
      window.removeEventListener("popstate", pop);
      // closed with a button or Esc: take back the step we added (not when React only re-runs the effect)
      setTimeout(() => !el?.isConnected && history.state?.deltViewer && history.back());
    };
  }, []);
  const f = files[index];
  const url = attachmentUrl(mailId, f);
  const step = (d: number) => onIndex((index + d + files.length) % files.length);
  return (
    <div
      className="att-viewer"
      ref={box}
      role="dialog"
      aria-modal="true"
      aria-label={f.name}
      onKeyDown={(e) => {
        if (files.length > 1 && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
          e.preventDefault();
          step(e.key === "ArrowRight" ? 1 : -1);
        }
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="att-bar">
        <span className="ell att-title">
          {f.name} {files.length > 1 && <small>{index + 1} of {files.length}</small>}
        </span>
        <a className="pillbtn" href={url} download={f.name}>Download</a>
        <button className="pillbtn" onClick={onClose} data-autofocus>Close</button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- a private file from the student's own mail */}
      <img key={f.part} className="att-full" src={url} alt={f.name} />
      {files.length > 1 && (
        <div className="att-steps">
          <button className="pillbtn" onClick={() => step(-1)} aria-label="Previous picture">‹</button>
          <button className="pillbtn" onClick={() => step(1)} aria-label="Next picture">›</button>
        </div>
      )}
    </div>
  );
}
