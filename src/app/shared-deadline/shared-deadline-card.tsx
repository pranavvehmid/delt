"use client";

import { useSyncExternalStore } from "react";
import { F } from "@/lib/inbox";
import { parseSharedDeadline } from "@/lib/shared-deadline";

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

export default function SharedDeadlineCard() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => null);
  const card = hash && parseSharedDeadline(hash);
  return (
    <article className="shared-deadline-card">
      <p className="muted">Shared deadline</p>
      {card ? (
        <>
          <h1>{card.title}</h1>
          <p>Due <time dateTime={card.due}>{F.dateTime.format(new Date(card.due))} IST</time></p>
          {card.source && <p className="muted">Source: {card.source}</p>}
        </>
      ) : (
        <h1>{hash === null ? "Loading deadline…" : "This deadline link is incomplete"}</h1>
      )}
    </article>
  );
}
