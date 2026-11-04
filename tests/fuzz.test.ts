// Random-data checks for the inbox logic and the sorter, for any student.
import { test } from "node:test";
import assert from "node:assert/strict";
import { deadlineBuckets, filterMail, groupByDay, pileCounts, BUCKETS, PILES, type Mail } from "../src/lib/inbox";
import { classifyByRules } from "../src/lib/rules";
import { profileFromName } from "../src/lib/profile";

const NOW = Date.parse("2026-11-04T12:00:00+05:30");
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const WORDS = ["CAT-1", "exam", "FFCS", "hackathon", "fee", "holiday", "mess", "club", "sale", "Gravitas", "DA-2", "quiz", "notice", "webinar", "placement", "Re:", "Fwd:", "Reminder:", "தமிழ்", "₹500", "", "  ", "(urgent)"];
const PRI = PILES.map((p) => p.key);

function randomMail(i: number): Mail {
  const hasDue = rnd() < 0.35;
  return {
    id: `r${i}`,
    from_name: rnd() < 0.1 ? null : pick(["Office of DSW", "ACM-VIT", "COE", "Prof. Rao", "'Dean' via B.Tech"]),
    from_address: rnd() < 0.05 ? null : pick(["sw@vit.ac.in", "acm@vitstudent.ac.in", "noreply@coursera.org"]),
    subject: rnd() < 0.05 ? null : Array.from({ length: 1 + Math.floor(rnd() * 6) }, () => pick(WORDS)).join(" "),
    summary: pick(["", "Short summary.", "Register by Friday."]),
    snippet: "",
    received_at: new Date(NOW - Math.floor(rnd() * 60 * 86400_000)).toISOString(),
    priority: pick(PRI),
    category: "other",
    deadline: hasDue ? new Date(NOW + Math.floor((rnd() - 0.4) * 40 * 86400_000)).toISOString() : null,
    is_done: rnd() < 0.15,
    unread: rnd() < 0.4,
  };
}
const MAILS = Array.from({ length: 3000 }, (_, i) => randomMail(i));

test("All never hides a mail; piles add up to All", () => {
  const all = filterMail(MAILS, { pile: "all", unreadOnly: false, query: "" });
  assert.equal(all.length, MAILS.length);
  const sum = PRI.reduce((n, p) => n + filterMail(MAILS, { pile: p, unreadOnly: false, query: "" }).length, 0);
  assert.equal(sum, MAILS.length);
  const c = pileCounts(MAILS);
  assert.equal(c.all.total, MAILS.length);
  assert.equal(PRI.reduce((n, p) => n + c[p].total, 0), MAILS.length);
  assert.equal(c.all.unread, MAILS.filter((m) => m.unread).length);
});

test("Unread only returns exactly the unread mail", () => {
  for (const p of ["all", ...PRI] as const) {
    const u = filterMail(MAILS, { pile: p, unreadOnly: true, query: "" });
    assert.ok(u.every((m) => m.unread && (p === "all" || m.priority === p)));
    assert.equal(u.length, MAILS.filter((m) => m.unread && (p === "all" || m.priority === p)).length);
  }
});

test("search: every hit contains the words, nothing that matches is missed, case-insensitive", () => {
  for (const q of ["exam", "EXAM", "ffcs", "acm", "₹500", "தமிழ்", "register by", "dsw", "zzz-nothing"]) {
    const hits = filterMail(MAILS, { pile: "all", unreadOnly: false, query: q });
    const want = MAILS.filter((m) => [m.subject, m.from_name, m.from_address, m.summary].some((s) => s?.toLowerCase().includes(q.toLowerCase().trim())));
    assert.equal(hits.length, want.length, q);
  }
  // spaces only = no filter
  assert.equal(filterMail(MAILS, { pile: "all", unreadOnly: false, query: "   " }).length, MAILS.length);
});

test("results are newest first and day groups keep every mail in order", () => {
  const all = filterMail(MAILS, { pile: "all", unreadOnly: false, query: "" });
  for (let i = 1; i < all.length; i++) assert.ok(Date.parse(all[i - 1].received_at) >= Date.parse(all[i].received_at));
  const groups = groupByDay(all, NOW);
  assert.deepEqual(groups.flatMap((g) => g.mails.map((m) => m.id)), all.map((m) => m.id));
  assert.equal(new Set(groups.map((g) => g.key)).size, groups.length, "a day appears twice");
});

test("deadlines: never noise, each mail in one bucket, sorted by due date", () => {
  const b = deadlineBuckets(MAILS, NOW);
  const ids = BUCKETS.flatMap((k) => b[k].map((m) => m.id));
  assert.equal(new Set(ids).size, ids.length, "a mail is in two buckets");
  for (const k of BUCKETS) {
    for (const m of b[k]) {
      assert.ok(m.deadline && m.priority !== "noise");
      assert.equal(m.is_done, k === "Done");
    }
    if (k !== "Done") for (let i = 1; i < b[k].length; i++) assert.ok(Date.parse(b[k][i - 1].deadline!) <= Date.parse(b[k][i].deadline!));
  }
  for (const m of b.Overdue) assert.ok(Date.parse(m.deadline!) < NOW && NOW - Date.parse(m.deadline!) <= 7 * 86400_000);
  for (const k of ["Today", "Tomorrow", "This week", "Later"] as const) for (const m of b[k]) assert.ok(Date.parse(m.deadline!) >= NOW);
});

test("3000 random mails filter + group + bucket in well under a second", () => {
  const t = performance.now();
  for (let i = 0; i < 5; i++) {
    groupByDay(filterMail(MAILS, { pile: pick(["all", ...PRI] as const), unreadOnly: rnd() < 0.5, query: pick(["", "exam", "acm"]) }), NOW);
    deadlineBuckets(MAILS, NOW);
  }
  assert.ok(performance.now() - t < 1000);
});

// ---------- the sorter works for every student, not just one ----------
const m = (subject: string, body = "", from = "office@vit.ac.in") => ({
  id: "t", threadId: "t", fromName: "S", fromAddress: from, subject, snippet: "", receivedAt: new Date(NOW - 3600_000), body, unread: true,
});
const sortFor = (name: string | null, s: string, b = "") => classifyByRules(m(s, b), [], profileFromName(name, new Date(NOW)), NOW);

test("batch-only mail: Later for other batches, normal for that batch", () => {
  const mail = ["Internship drive for 2025 batch students - register by 10 Nov 2026", "Only 2025 batch students are eligible."] as const;
  assert.equal(sortFor("A STUDENT 26BCE0001", ...mail).priority, "later");
  assert.equal(sortFor("B STUDENT 25BCE0042", ...mail).priority, "very_important");
});

test("senior-year mail goes to Later for first years only", () => {
  const mail = ["Final year project review schedule - submit by 12 Nov 2026"] as const;
  assert.equal(sortFor("A STUDENT 26BIT0101", ...mail).priority, "later");
  assert.notEqual(sortFor("C STUDENT 23BIT0101", ...mail).priority, "noise");
});

test("every branch and staff (no register number) get exams as Urgent", () => {
  for (const name of ["A 26BCE0001", "B 26BEC0002", "C 25BME0003", "D 24BAI0004", "E 26MIS0005", "Dr. F Staff", null]) {
    assert.equal(sortFor(name, "CAT-1 exam schedule released").priority, "very_important", String(name));
  }
});

test("the sorter never crashes on random subjects for any profile", () => {
  const names = ["A 26BCE0001", "B 23BEC0002", null, "", "Z 99XYZ9999"];
  for (let i = 0; i < 1500; i++) {
    const r = sortFor(pick(names), Array.from({ length: Math.floor(rnd() * 8) }, () => pick(WORDS)).join(" "), pick(["", "Register by 10 Nov 2026.", "Last date 31/02/2026", "Pay ₹500 by tomorrow 6 PM"]));
    assert.ok(PRI.includes(r.priority));
    if (r.deadline) assert.ok(!Number.isNaN(Date.parse(r.deadline)));
  }
});
