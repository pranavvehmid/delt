"use client";

// The first time a student opens DELT (#56): what the piles mean, that moving a mail teaches
// DELT, and how to act on mail. Shown once per device; "Got it" or Esc closes it.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDialog } from "./use-dialog";
import { transition } from "./motion";

const KEY = "delt-welcomed";

export default function Welcome({ ready }: { ready: boolean }) {
  const [open, setOpen] = useState(false);
  const [touch, setTouch] = useState(false);
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!ready) return;
    try {
      setTouch(window.matchMedia("(pointer: coarse)").matches);
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {}
  }, [ready]);
  const close = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    transition(() => setOpen(false));
  };
  useDialog(box, open, close);
  if (!open) return null;
  return createPortal(
    <>
      <div className="veil" onClick={close} />
      <section className="sheet welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title" ref={box}>
        <div className="sheet-grip" aria-hidden="true" />
        <h2 id="welcome-title" tabIndex={-1} data-autofocus>
          Welcome to DELT
        </h2>
        <p className="muted">Your college mail, sorted by what needs you first. Three things to know:</p>
        <ol className="welcome-steps">
          <li>
            <b>Four piles.</b> Urgent: exams, registrations, fees. Priority: notices, hackathons. Later: events and club mail. Noise: promotions. What needs you soon sits at the top of All.
          </li>
          <li>
            <b>Moving a mail teaches DELT.</b> Put a mail in another pile and new mail from that sender goes there too. You can undo it, or move just that one.
          </li>
          <li>
            <b>{touch ? "Swipe to act." : "Act from the list."}</b>{" "}
            {touch ? "Swipe a mail right to mark it read, left when it's done. Pull down to check for new mail." : "Hover a mail for read and done buttons, or open it and use J and K to go through your mail."}
          </li>
        </ol>
        <button className="cta" onClick={close}>
          Got it
        </button>
      </section>
    </>,
    document.body,
  );
}
