"use client";

// Keyboard and screen reader basics for every panel that covers the screen (issue #8):
// focus moves into it, Tab stays inside, Esc closes, and focus goes back where it was.
import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, iframe, [tabindex]:not([tabindex="-1"])';

export function useDialog(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void, restoreTo?: () => HTMLElement | null) {
  const close = useRef(onClose);
  close.current = onClose;
  const restore = useRef(restoreTo);
  restore.current = restoreTo;

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const box = ref.current;
    // the heading if there is one (so a screen reader reads the title first), else the first control
    const start = box?.querySelector<HTMLElement>("[data-autofocus]") ?? box?.querySelector<HTMLElement>(FOCUSABLE);
    start?.focus({ preventScroll: true });

    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== "Tab" || !box) return;
      const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !box.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    // Tab out of the mail's own frame skips the key handler, so also catch focus landing outside.
    const guard = (e: FocusEvent) => {
      if (box && e.target instanceof Node && !box.contains(e.target)) box.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", key);
    document.addEventListener("focusin", guard);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("focusin", guard);
      const back = restore.current?.() ?? before;
      // after React has put the list back
      // (skipped if the panel is still on screen: React re-runs effects in development)
      requestAnimationFrame(() => !box?.isConnected && back?.isConnected && back.focus({ preventScroll: true }));
    };
  }, [open, ref]);
}
