"use client";

// The short message at the bottom of the screen, with Undo or a second choice when there is one.
import { useEffect, useState } from "react";

export type ToastMsg = { text: string; undo?: () => void; alt?: { label: string; run: () => void } };

const life = (t: ToastMsg) => (t.alt ? 8000 : t.undo ? 5000 : 2600);

export function useToast() {
  const [toast, setToast] = useState<ToastMsg | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), life(toast));
    return () => clearTimeout(t);
  }, [toast]);
  return [toast, setToast] as const;
}

export function Toast({ toast, onClose }: { toast: ToastMsg | null; onClose: () => void }) {
  if (!toast) return null;
  return (
    <div className="toast" role="status" aria-live="polite" key={toast.text} style={{ "--life": `${life(toast)}ms` } as React.CSSProperties}>
      <b className="rc" aria-hidden="true">
        Race control
      </b>
      <span>{toast.text}</span>
      {toast.alt && (
        <button
          onClick={() => {
            const run = toast.alt!.run;
            onClose();
            run();
          }}
        >
          {toast.alt.label}
        </button>
      )}
      {toast.undo && (
        <button
          onClick={() => {
            toast.undo!();
            onClose();
          }}
        >
          Undo
        </button>
      )}
    </div>
  );
}
