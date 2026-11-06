"use client";

// The Deadlines tab: mail with a due date, grouped by when it's due.
import { useState } from "react";
import type { EmailRow } from "@/lib/supabase";
import { BUCKETS, F, cleanSender, cleanSubject, dueInBucket, dueLevel, pileLabel, type deadlineBuckets } from "@/lib/inbox";
import { calendarLink } from "@/lib/insights";
import { Empty, Skeleton } from "./list-states";
import type { Patch } from "./use-mail-actions";

type Props = {
  loaded: boolean;
  buckets: ReturnType<typeof deadlineBuckets<EmailRow>>;
  now: number;
  onOpen: (m: EmailRow) => void;
  onPatch: (id: string, p: Patch) => void;
};

export default function DeadlinesList({ loaded, buckets, now, onOpen, onPatch }: Props) {
  const [showDone, setShowDone] = useState(false);
  return (
    <main className="page">
      <div className="pagehead">
        <h1>Deadlines</h1>
        <p className="muted">Due dates found in your mail.</p>
      </div>
      {!loaded ? (
        <Skeleton />
      ) : BUCKETS.every((b) => buckets[b].length === 0) ? (
        <Empty title="No deadlines" hint="When a mail mentions a due date, it shows up here." />
      ) : (
        BUCKETS.filter((b) => buckets[b].length > 0).map((b) => (
          <section key={b} className={`day bucket b-${b.replace(" ", "")}`}>
            <h2 className="dayhead">
              {b}
              <span className="muted">{buckets[b].length}</span>
              {b === "Done" && (
                <button className="link" onClick={() => setShowDone((s) => !s)}>
                  {showDone ? "Hide" : "Show"}
                </button>
              )}
            </h2>
            {(b !== "Done" || showDone) && (
              <ul className="rows">
                {buckets[b].map((m) => (
                  <li key={m.id} className={`row due-row p-${m.priority} ${m.is_done ? "done" : ""}`} data-mail={m.id}>
                    <button className="row-main" onClick={() => onOpen(m)}>
                      <span className={`datebox lv-${dueLevel(m.deadline!, now)}`}>
                        <b>{F.dayNum.format(Date.parse(m.deadline!))}</b>
                        <small>{F.monthShort.format(Date.parse(m.deadline!))}</small>
                      </span>
                      <span className="row-text">
                        <span className="subj">{cleanSubject(m.subject)}</span>
                        <span className="meta">
                          <span className={`due lv-${dueLevel(m.deadline!, now)}`}>{dueInBucket(m.deadline!, b, now)}</span>
                          <span className={`tag p-${m.priority}`}>{pileLabel(m.priority)}</span>
                          <span className="muted ell">{cleanSender(m.from_name)}</span>
                        </span>
                      </span>
                    </button>
                    <div className="row-acts">
                      {/* #55: icons with words, not just tooltips phones never show */}
                      <a className="iconbtn labelled" href={calendarLink(cleanSubject(m.subject), m.deadline!, m.summary)} target="_blank" rel="noreferrer" aria-label="Add to Google Calendar">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v14H4zM4 10h16M8 3v4m8-4v4" /></svg>
                        <small aria-hidden="true">Calendar</small>
                      </a>
                      <button className={`iconbtn labelled check ${m.is_done ? "on" : ""}`} onClick={() => onPatch(m.id, { is_done: !m.is_done })} aria-label={m.is_done ? "Mark not done" : "Mark done"}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
                        <small aria-hidden="true">{m.is_done ? "Undo" : "Done"}</small>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
      {loaded && BUCKETS.some((b) => b !== "Done" && buckets[b].length > 0) && <p className="foot muted"><span className="finish">Nothing else is due</span></p>}
    </main>
  );
}
