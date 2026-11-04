"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { EmailRow } from "@/lib/supabase";

// Unread mail as a deck of cards.
//   swipe right / → : "Got it"      (marks read, stays where it was sorted)
//   swipe left  / ← : "Not for me"  (marks read, moves to Noise, teaches the sorter)
//   tap / Enter     : open the details

const THRESHOLD = 110;

export type DeckCardInfo = { fill: string; label: string; meta: string; title: string; summary: string; from: string };

export default function SwipeDeck({
  items,
  info,
  onKeep,
  onDismiss,
  onOpen,
}: {
  items: EmailRow[];
  info: (e: EmailRow) => DeckCardInfo;
  onKeep: (e: EmailRow) => void;
  onDismiss: (e: EmailRow) => void;
  onOpen: (e: EmailRow) => void;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<0 | 1 | -1>(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const top = items[0];

  function finish(dir: 1 | -1) {
    if (!top || leaving) return;
    setLeaving(dir);
    setTimeout(() => {
      if (dir === 1) onKeep(top);
      else onDismiss(top);
      setLeaving(0);
      setDx(0);
    }, 260);
  }

  const down = (ev: PointerEvent<HTMLDivElement>) => {
    if (leaving) return;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    start.current = { x: ev.clientX, y: ev.clientY };
    setDragging(true);
  };
  const move = (ev: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    setDx(ev.clientX - start.current.x);
  };
  const up = (ev: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const moved = Math.hypot(ev.clientX - start.current.x, ev.clientY - start.current.y);
    start.current = null;
    setDragging(false);
    if (Math.abs(dx) > THRESHOLD) finish(dx > 0 ? 1 : -1);
    else {
      setDx(0);
      if (moved < 6 && top) onOpen(top);
    }
  };
  const key = (ev: KeyboardEvent<HTMLDivElement>) => {
    if (!top) return;
    if (ev.key === "ArrowRight") finish(1);
    else if (ev.key === "ArrowLeft") finish(-1);
    else if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      onOpen(top);
    }
  };

  if (!top) {
    return (
      <div className="deck-empty">
        <b className="dot">INBOX ZERO</b>
        <span>No unread mail ✦ new ones land here</span>
      </div>
    );
  }

  const x = leaving ? leaving * 640 : dx;
  const keepAmt = Math.max(0, Math.min(1, x / THRESHOLD));
  const skipAmt = Math.max(0, Math.min(1, -x / THRESHOLD));

  return (
    <div className="deck-wrap">
      <div
        className="deck"
        tabIndex={0}
        role="group"
        aria-label={`Unread mail, ${items.length} left. Right arrow: got it. Left arrow: not for me. Enter: open.`}
        onKeyDown={key}
      >
        {items
          .slice(0, 3)
          .reverse()
          .map((e) => {
            const depth = items.indexOf(e); // 0 = top card
            const c = info(e);
            const isTop = depth === 0;
            const style: CSSProperties = isTop
              ? {
                  background: c.fill,
                  transform: `translateX(${x}px) rotate(${x / 18}deg)`,
                  transition: dragging ? "none" : "transform .26s cubic-bezier(.3,1.3,.6,1)",
                  zIndex: 3,
                }
              : {
                  background: c.fill,
                  transform: `translateY(${depth * 16}px) rotate(${depth % 2 ? 2.5 : -2.5}deg) scale(${1 - depth * 0.04})`,
                  zIndex: 3 - depth,
                };
            return (
              <div
                key={e.id}
                className={`card ${isTop ? "top" : ""}`}
                style={style}
                onPointerDown={isTop ? down : undefined}
                onPointerMove={isTop ? move : undefined}
                onPointerUp={isTop ? up : undefined}
                onPointerCancel={isTop ? up : undefined}
                aria-hidden={!isTop}
              >
                {isTop && (
                  <>
                    <span className="stamp keep" style={{ opacity: keepAmt }}>GOT IT</span>
                    <span className="stamp skip" style={{ opacity: skipAmt }}>NOT FOR ME</span>
                  </>
                )}
                <div className="code">
                  <span className="tag">{c.label.toUpperCase()}</span>
                  <span>{c.meta}</span>
                </div>
                <h3>{c.title}</h3>
                <p>{c.summary}</p>
                <div className="from">{c.from}</div>
              </div>
            );
          })}
      </div>
      <div className="deck-actions">
        <button className="btn" onClick={() => finish(-1)} aria-label="Not for me">
          ✕ <span>Not for me</span>
        </button>
        <span className="deck-count mono">
          <b className="dot">{items.length}</b> new
        </span>
        <button className="btn gold" onClick={() => finish(1)} aria-label="Got it">
          ✓ <span>Got it</span>
        </button>
      </div>
    </div>
  );
}
