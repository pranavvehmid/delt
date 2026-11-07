// Mail parsing and deadline reading.
import { test } from "node:test";
import assert from "node:assert/strict";
import { decode, findPart, htmlToText, parseFrom, type Part } from "../src/lib/gmail";
import { classifyByRules } from "../src/lib/rules";

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_");

test("parseFrom handles VIT group senders, quotes and bare addresses", () => {
  assert.deepEqual(parseFrom(`"'Director SW' via B.Tech 2026" <btech2026@vitstudent.ac.in>`), { name: "'Director SW' via B.Tech 2026", address: "btech2026@vitstudent.ac.in" });
  assert.deepEqual(parseFrom("Office of SW <SW@VIT.AC.IN>"), { name: "Office of SW", address: "sw@vit.ac.in" });
  assert.deepEqual(parseFrom("noreply@codechef.com"), { name: "noreply@codechef.com", address: "noreply@codechef.com" });
});

test("decode reads Gmail's url-safe base64, including Indian scripts and ₹", () => {
  assert.equal(decode(b64url("Prize ₹1,50,000 – வணக்கம்")), "Prize ₹1,50,000 – வணக்கம்");
});

test("findPart prefers the right part inside nested multiparts", () => {
  const msg: Part = {
    mimeType: "multipart/mixed",
    parts: [
      { mimeType: "multipart/alternative", parts: [
        { mimeType: "text/plain", body: { data: b64url("plain body") } },
        { mimeType: "text/html", body: { data: b64url("<p>html body</p>") } },
      ] },
      { mimeType: "application/pdf", filename: "poster.pdf", body: { attachmentId: "x", size: 1000 } },
    ],
  };
  assert.equal(findPart(msg, "text/plain"), "plain body");
  assert.equal(findPart(msg, "text/html"), "<p>html body</p>");
  assert.equal(findPart(msg, "text/calendar"), null);
});

test("htmlToText keeps link targets, drops styles and scripts, decodes entities", () => {
  const html = `<style>p{color:red}</style><script>alert(1)</script><p>Register&nbsp;<a href="https://forms.gle/abc">here</a> &amp; win!</p><br>Team &lt;2-4&gt;`;
  const t = htmlToText(html);
  assert.match(t, /Register here \(https:\/\/forms\.gle\/abc\) & win!/);
  assert.match(t, /Team <2-4>/);
  assert.doesNotMatch(t, /alert|color:red/);
});

// ---------- deadline formats seen in VIT mail ----------
const NOW = Date.parse("2026-11-03T10:00:00+05:30");
const due = (body: string, subject = "Register now", now = NOW) =>
  classifyByRules(
    { id: "t", threadId: "t", fromName: "S", fromAddress: "office@vit.ac.in", subject, snippet: "", receivedAt: new Date(now - 3600_000), body, unread: true },
    [],
    undefined,
    now,
  ).deadline;

const DATES: [string, string][] = [
  ["Last date is 15/11/2026.", "2026-11-15T23:59:00+05:30"],
  ["Last date: 15-11-26", "2026-11-15T23:59:00+05:30"],
  ["Deadline: 15.11.2026", "2026-11-15T23:59:00+05:30"],
  ["Register by 15th November 2026", "2026-11-15T23:59:00+05:30"],
  ["Register by 15 Nov", "2026-11-15T23:59:00+05:30"],
  ["Register by November 15, 2026", "2026-11-15T23:59:00+05:30"],
  ["Register by Nov 15th", "2026-11-15T23:59:00+05:30"],
  ["Last date is 15 Nov 2026, 5:30 PM", "2026-11-15T17:30:00+05:30"],
  ["Last date is 15 Nov 2026 at 10 am", "2026-11-15T10:00:00+05:30"],
  ["Register before tomorrow 6 PM", "2026-11-04T18:00:00+05:30"],
  ["Deadline today", "2026-11-03T23:59:00+05:30"],
];
for (const [body, want] of DATES) {
  test(`deadline: "${body}" → ${want}`, () => assert.equal(due(body), want));
}

test("deadline: a date with no year in December means next January", () => {
  const dec = Date.parse("2026-12-20T10:00:00+05:30");
  assert.equal(due("Register by 5 Jan", "Register now", dec), "2027-01-05T23:59:00+05:30");
});

test("deadline: no date means no deadline", () => {
  assert.equal(due("Register soon, details to follow."), null);
});

test("deadline: the soonest date after a deadline word wins over event dates", () => {
  assert.equal(due("Event on 20 Nov 2026. Last date to register is 10 Nov 2026."), "2026-11-10T23:59:00+05:30");
});

// ---------- #116, #117: getting readable text out of a mail ----------
import { decodeEntities, isPlaceholderText } from "../src/lib/gmail";
test("#117: numeric and common named entities are decoded", () => {
  assert.equal(decodeEntities("Don&rsquo;t miss &#8377;500 &ndash; due &#x31;5 Nov&hellip; &amp; more"), "Don’t miss ₹500 – due 15 Nov… & more");
  assert.equal(decodeEntities("&unknown; &#0; stays"), "&unknown; &#0; stays");
  assert.equal(htmlToText("<p>Fee&nbsp;&#8377;1,200</p><a href='https://pay.vit.ac.in'>Pay</a>"), "Fee ₹1,200\nPay (https://pay.vit.ac.in)");
});
test("#116: a 'view in your browser' plain part is recognised as a placeholder", () => {
  assert.equal(isPlaceholderText("View this email in your browser"), true);
  assert.equal(isPlaceholderText("Your email client does not support HTML. Open the link."), true);
  assert.equal(isPlaceholderText(""), true);
  assert.equal(isPlaceholderText("Dear students, CAT-1 exams start on 18 Nov. The detailed schedule is attached; check your slot and venue before the exam day."), false);
});
