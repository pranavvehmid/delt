"use client";

import { useMemo, useState } from "react";
import { calendarDay, calendarDays, deadlineKind, moveCalendar, type CalendarView } from "@/lib/deadline-calendar";
import { F, cleanSubject } from "@/lib/inbox";
import type { EmailRow } from "@/lib/supabase";

const longDate = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const monthName = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dayNavigation: Partial<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

export default function DeadlineCalendar({ mails, now, onOpen }: { mails: EmailRow[]; now: number; onOpen: (mail: EmailRow) => void }) {
  const today = calendarDay(now);
  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState(today);
  const byDay = useMemo(() => {
    const grouped = new Map<number, EmailRow[]>();
    for (const mail of mails) {
      const time = Date.parse(mail.deadline ?? "");
      if (!Number.isFinite(time)) continue;
      const day = calendarDay(time);
      const items = grouped.get(day) ?? [];
      items.push(mail);
      grouped.set(day, items);
    }
    return grouped;
  }, [mails]);
  const days = calendarDays(anchor, view);
  const visible = byDay.get(selected) ?? [];
  const legend = [...new Set(days.flatMap((day) => (byDay.get(day) ?? []).map(deadlineKind)))];
  const jump = (day: number) => { setAnchor(day); setSelected(day); };

  return (
    <section className="deadline-calendar" aria-label="Deadline calendar">
      <div className="calendar-controls">
        <div className="seg" aria-label="Calendar period" role="group">
          <button className={view === "week" ? "on" : ""} aria-pressed={view === "week"} onClick={() => { setView("week"); setAnchor(selected); }}>Week</button>
          <button className={view === "month" ? "on" : ""} aria-pressed={view === "month"} onClick={() => { setView("month"); setAnchor(selected); }}>Month</button>
        </div>
        <button className="link" onClick={() => jump(today)}>Today</button>
      </div>
      <div className="calendar-heading">
        <button className="iconbtn" aria-label={`Previous ${view}`} onClick={() => jump(moveCalendar(anchor, view, -1))}>‹</button>
        <h2 aria-live="polite">{view === "month" ? monthName.format(anchor) : `${shortDate.format(days[0])} – ${shortDate.format(days[6])}`}</h2>
        <button className="iconbtn" aria-label={`Next ${view}`} onClick={() => jump(moveCalendar(anchor, view, 1))}>›</button>
      </div>
      <div className="calendar-grid" role="group" aria-label={`${view === "week" ? "Week" : "Month"} dates`}>
        {weekdays.map((day) => <span key={day} className="calendar-weekday muted" aria-hidden="true">{day}</span>)}
        {days.map((day, index) => {
          const deadlineList = byDay.get(day) ?? [];
          const kinds = [...new Set(deadlineList.map(deadlineKind))];
          return (
            <button key={day} id={`calendar-day-${day}`} className="calendar-date"
              aria-current={day === today ? "date" : undefined} aria-pressed={day === selected}
              aria-label={`${longDate.format(day)}, ${deadlineList.length} ${deadlineList.length === 1 ? "deadline" : "deadlines"}`}
              tabIndex={day === selected ? 0 : -1} onClick={() => setSelected(day)}
              onKeyDown={(event) => {
                const shift = dayNavigation[event.key];
                if (shift === undefined || days[index + shift] === undefined) return;
                event.preventDefault();
                setSelected(days[index + shift]);
                document.getElementById(`calendar-day-${days[index + shift]}`)?.focus();
              }}>
              {new Date(day).getUTCDate()}
              {kinds.length > 0 && <span className="calendar-markers" aria-hidden="true">{kinds.map((kind) => <i key={kind} data-kind={kind} />)}</span>}
            </button>
          );
        })}
      </div>
      {legend.length > 0 && <ul className="calendar-legend" aria-label="Deadline types">
        {legend.map((kind) => <li key={kind}><span className="calendar-kind" data-kind={kind}>{kind}</span></li>)}
      </ul>}
      <section className="calendar-details" aria-label={longDate.format(selected)}>
        <h3>{longDate.format(selected)}</h3>
        {visible.length > 0 ? (
          <ul>
            {visible.map((mail) => (
              <li key={mail.id}>
                <button onClick={() => onOpen(mail)}>
                  <span className="calendar-kind" data-kind={deadlineKind(mail)}>{deadlineKind(mail)}</span>
                  <span>{cleanSubject(mail.subject)}</span>
                  <small className="muted">{F.time.format(new Date(mail.deadline!))} IST</small>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="muted">No deadlines on this day.</p>}
      </section>
    </section>
  );
}
