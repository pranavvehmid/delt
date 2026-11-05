// Cases taken from real VIT mail where the rules disagreed with a careful reading (Nov 2026 eval).
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyByRules } from "../src/lib/rules";
import { profileFromName } from "../src/lib/profile";

const NOW = Date.parse("2026-11-03T10:00:00+05:30");
const ME = profileFromName("A B STUDENT NAME 26BCE0001", new Date(NOW));
const m = (subject: string, body = "", from = "office@vit.ac.in") => ({
  id: "t", threadId: "t", fromName: "S", fromAddress: from, subject, snippet: "", receivedAt: new Date(NOW - 3600_000), body, unread: true,
});
const pile = (s: string, b = "", f?: string) => classifyByRules(m(s, b, f), [], ME, NOW).priority;

test("open fest registrations count as opportunities (Urgent), as the student asked", () => {
  assert.equal(pile("Fwd: MECHNOVATE ’26 | Registrations Now Open for VIT Vellore Students", "Register before 20 Nov 2026 for workshops and events."), "very_important");
  assert.equal(pile("Gravitas 2026 registrations open", "Register on the portal by 12 Nov 2026."), "very_important");
});

test("an invitation to a summit stays an event even if the body mentions a competition", () => {
  assert.notEqual(
    pile("Fwd: VITTBI referral: Invitation to Innovation Confluence 2026–27", "The confluence includes a startup competition. Registration link below. Last date 15 Nov 2026."),
    "very_important",
  );
});

test("academic registrations stay Urgent", () => {
  assert.equal(pile("FFCS registration for Winter Semester 2026-27 opens tomorrow"), "very_important");
  assert.equal(pile("Course registration - last date 10 Nov 2026"), "very_important");
  assert.equal(pile("Mock registration schedule", "Mock course registration on 8 Nov 2026."), "very_important");
  assert.equal(pile("Hostel room registration for next semester - register by 12 Nov 2026"), "very_important");
});

test("open hackathons and contests still rank high", () => {
  assert.equal(pile("HackVIT 2026 - registrations close Friday", "Register by 6 Nov 2026."), "very_important");
  assert.equal(pile("Code2Create: coding contest - register now", "Contest on 9 Nov 2026."), "very_important");
});

// ---- issue #2: patterns from the Nov 2026 eval that apply to every student ----
test("open calls for submissions count like open registrations", () => {
  assert.equal(pile("RIVIERA’27 | EVENT PROPOSAL SUBMISSIONS OPEN!", "Submit your proposal by 12 Nov 2026."), "very_important");
});

test("something you personally must collect is Urgent", () => {
  assert.equal(pile("Please come and collect your Engineering Drawing Workbook - Reg"), "very_important");
});

test("a Google Drive file shared with you is Urgent", () => {
  assert.equal(pile('Folder shared with you: "Ventura"', "A B shared a folder with you.", "drive-shares-dm-noreply@google.com"), "very_important");
});

test("optional minors, honours and open electives go to Later, even during FFCS", () => {
  assert.equal(pile("Register for the Minor in Quantum Technologies during FFCS - Applications open"), "later");
  assert.equal(pile("Honours in Data Science - applications invited"), "later");
  assert.equal(pile("BAHUM220 - Yoga for Human Excellence - Open Elective - reg"), "later");
  // the FFCS itself stays Urgent
  assert.equal(pile("FFCS registration for Winter Semester opens tomorrow"), "very_important");
});

test("instructions for international students go to Later", () => {
  assert.equal(pile("Reminder: Important Instructions for OCI / Foreign Nationals Travelling Home"), "later");
  assert.equal(pile("NRI students: document verification schedule"), "later");
});
