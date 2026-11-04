// Sorter tests: realistic VIT mails and the pile a first-year student expects.
// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyByRules } from "../src/lib/rules";
import { profileFromName } from "../src/lib/profile";
import type { ParsedMessage } from "../src/lib/gmail";

const NOW = Date.parse("2026-11-03T10:00:00+05:30"); // a Tuesday
const RECEIVED = new Date(NOW - 2 * 3600_000);
const ME = profileFromName("A B STUDENT NAME 26BCE0001", new Date(NOW));

type P = "very_important" | "priority" | "later" | "noise";
type Case = { subject: string; body?: string; from?: string; want: P; cat?: string; due?: string };

function mail(c: Case): ParsedMessage {
  return {
    id: "t",
    threadId: "t",
    fromName: "Sender",
    fromAddress: c.from ?? "office@vit.ac.in",
    subject: c.subject,
    snippet: "",
    receivedAt: RECEIVED,
    body: c.body ?? "",
    unread: true,
  };
}

const CASES: Case[] = [
  // ---------- exams, quizzes, tests -> very important ----------
  { subject: "CAT-1 Examination Schedule - Fall Semester 2026-27", body: "The CAT-1 examinations will be held from 10/11/2026.", want: "very_important", cat: "exam" },
  { subject: "IACHY101_BACHY101_FALL_2026: Reminder: Quiz 4 Today (22-10-2026)", want: "very_important", cat: "exam" },
  { subject: "Online Computer-Based Test (CBT) _ 5th Module (Bio-Inspired Design in Engineering)", want: "very_important", cat: "exam" },
  { subject: "Missed quizzes for BACHY101", body: "Students who missed quizzes can take the re-quiz on 6 Nov.", want: "very_important", cat: "exam" },
  { subject: "FAT Hall Ticket download - reg", body: "Download your hall ticket from VTOP before 20 Nov 2026.", want: "very_important", cat: "exam" },
  { subject: "Lab exam schedule for BCSE102P", want: "very_important", cat: "exam" },
  { subject: "Viva voce for Engineering Physics lab", body: "Viva on 7th November 2026, 2 PM.", want: "very_important", cat: "exam" },
  { subject: "Seating arrangement for CAT 2", want: "very_important", cat: "exam" },

  // ---------- registrations -> very important ----------
  { subject: "Winter 2026-27 FFCS Registration Schedule and Venues- reg", want: "very_important", cat: "registration" },
  { subject: "Winter 2026–27 Mock Registration Instructions for First-Year Students", want: "very_important", cat: "registration" },
  { subject: "Guidelines – Course Registration (Winter Semester 2026 - 27", want: "very_important", cat: "registration" },
  { subject: "Fwd: MECHNOVATE ’26 | Registrations Now Open for VIT Vellore Students!", body: "Register by 8 November 2026.", want: "very_important" },
  { subject: "Riviera'27 | Call for Student Committee Applications | Join the Organizing Team!", body: "Apply on or before 5 Nov 2026.", want: "very_important", cat: "registration" },
  { subject: "Last date to submit the bonafide request form", body: "Last date is 6/11/2026.", want: "very_important", due: "2026-11-06" },
  { subject: "Hostel fee payment reminder", body: "All students must complete the hostel fee payment on or before 10/11/2026.", want: "very_important", due: "2026-11-10" },

  // ---------- interviews ----------
  { subject: "Shortlisted candidates for the interview - ACM VIT recruitment", body: "Interview on 5 Nov 2026 at 5 PM in SJT 301.", want: "very_important", cat: "interview" },
  { subject: "Selection round for Robotics Club - first years", body: "Selection round on 6 November.", want: "very_important", cat: "interview" },

  // ---------- hackathons & competitions ----------
  { subject: "HackVIT 2026 - Registrations Open", body: "A 36-hour hackathon open to all years. Last date to register is 15th November 2026, 11:59 PM.", want: "very_important", cat: "hackathon", due: "2026-11-15" },
  { subject: "IDEATHON 2026 - REMINDER-Your Idea Can Make a Difference!", body: "Registrations close on 20 Nov 2026.", want: "very_important", cat: "hackathon" },
  { subject: "Last Chance: ARC Open Challenge 2026 | ICE-to-Electric Motorcycle Retrofit", body: "Registration deadline extended to 8 Nov 2026.", want: "very_important", cat: "competition" },
  { subject: "Invitation to the Inauguration of SUSTAINATHON 2026 – National Hackathon", want: "later", cat: "hackathon" },
  { subject: "Results of CodeSprint coding contest", want: "later" },
  { subject: "Invitation - One day Hackathon - reg", body: "A one day hackathon will be conducted. Details to follow.", want: "priority", cat: "hackathon" },

  // ---------- official notices -> priority ----------
  { subject: "24-10-2026 (Saturday) _ Instructional Day for all the students", want: "priority", cat: "announcement" },
  { subject: "ONLINE MESS CHANGE", body: "Mess change window is open for all hostellers.", want: "priority" },
  { subject: "Temporary Relocation of Lab Classes on 26 October 2026", want: "priority", cat: "announcement" },
  { subject: "Diwali Vacation Transport Service for Students to Katpadi Railway Station-reg", want: "priority", cat: "announcement" },
  { subject: "Classes cancelled on Friday due to rain", want: "priority" },
  { subject: "Circular: Revised academic calendar", want: "priority", cat: "announcement" },
  { subject: "Welcome to BAEEE101-Basic Engineering", want: "priority", cat: "academic" },
  { subject: "Postponement of CAT-1 examinations", body: "CAT-1 exams have been postponed.", want: "very_important" },

  // ---------- account / security ----------
  { subject: "Security alert", from: "no-reply@accounts.google.com", want: "priority", cat: "account" },
  { subject: "Enroll in 2-step verification now to avoid losing domain access", from: "workspace-noreply@google.com", want: "priority", cat: "account" },

  // ---------- scholarships -> later ----------
  { subject: "AICTE Yashasvi Scholarship Scheme for the First Year B.Tech. Students", body: "Apply before 15 Dec 2026.", want: "later", cat: "scholarship" },
  { subject: "Merit-cum-means scholarship applications invited", want: "later", cat: "scholarship" },

  // ---------- achievements -> later ----------
  { subject: "Congratulations to Team Proto Lab for Securing 5th Position at Techexpo, IIT Guwahati", want: "later", cat: "achievement" },
  { subject: "Sports Achievements 2026 - Boxing", want: "later", cat: "achievement" },
  { subject: "Congratulations to Team Coding Legends for Securing First Prize at the UCO Bank Hackathon", want: "later", cat: "achievement" },

  // ---------- events, talks, programmes -> later ----------
  { subject: "Invitation - Online foreign industry guest lecture - reg.", want: "later", cat: "club_event" },
  { subject: "Loyola Marymount University (LMU), Los Angeles- USA- STEM Webinar Series", want: "later", cat: "club_event" },
  { subject: "Special Movie Screening on Nov-1st-reg", want: "later", cat: "club_event" },
  { subject: "Blood Donation Camp Invitation: October 28th-reg", want: "later", cat: "club_event" },
  { subject: "2nd, Nov 2026-Today's Clubs and Chapters-Reg", want: "later", cat: "club_event" },
  { subject: "Orientation session on 2+2 ITP with the University of Evansville, USA: reg", want: "later", cat: "club_event" },
  { subject: "Master classes from University of Southern Denmark: Reg", want: "later", cat: "club_event" },
  { subject: "Immersion program in Hiroshima University, Japan, Dec15th till Dec26th : reg", want: "later", cat: "club_event" },
  { subject: "TAM Scripts | The AI & ML Club's Official Newsletter - Third Edition", want: "later" },
  { subject: "Gratitude for the successful conduct of \"VIT GLOBAL VOICES 2026\" - reg.", want: "later", cat: "newsletter" },

  // ---------- not for a first year -> later ----------
  { subject: "Final year students: SAP Project Registration on VTOP", want: "later" },
  { subject: "Internship drive for final year students only", body: "This drive is only for final year students. Apply by 20 Nov.", want: "later" },
  { subject: "Minor degree registration - 2023 batch students", body: "Applicable for B.Tech 2023 batch students only.", want: "later" },
  { subject: "Launch of MBA 2027 Application | Apply Now Through VITBEE 2027- reg.", want: "later" },

  // ---------- placement ----------
  { subject: "Fwd: Internship Opportunities at JAS Connect", want: "later", cat: "placement" },
  { subject: "Important Alert: Beware of Fake Internship/Placement Emails/WhatsApp-reg", want: "later" },

  // ---------- noise ----------
  { subject: "Riviera’26 Merchandise – Extension of Discount Sale on Saturday, 31-October-2026", want: "noise", cat: "promotion" },
  { subject: "50% off on all courses - limited time!", body: "Buy now.", from: "deals@udemy-mail.com", want: "noise", cat: "promotion" },
  { subject: "Apple Mac @ University Program – Exclusive Apple Offers for the VIT Community", want: "noise", cat: "promotion" },
  { subject: "Folder shared with you: \"Ventura \"", from: "drive-shares-dm-noreply@google.com", want: "noise" },

  // ---------- the "- reg" trap: VIT's "regarding" must not mean registration ----------
  { subject: "Lost & Found Items (1 Sep 2026 & 31 Oct 2026) - reg", want: "later" },
  { subject: "Introducing FREE & Confidential Counselling Platform For VITians - reg", want: "later" },
  { subject: "Invitation - State Level Poster Exhibition - 28-10- 2026 - reg.", want: "later" },
];

for (const c of CASES) {
  test(`${c.want.padEnd(14)} ← ${c.subject.slice(0, 70)}`, () => {
    const r = classifyByRules(mail(c), [], ME, NOW);
    assert.equal(r.priority, c.want, `priority (reason: ${r.reason})`);
    if (c.cat) assert.equal(r.category, c.cat, "category");
    if (c.due) assert.equal(r.deadline?.slice(0, 10), c.due, "deadline");
  });
}

test("a sender you corrected always wins", () => {
  const r = classifyByRules(mail({ subject: "Weekly club update", from: "club@vit.ac.in", want: "noise" }), [{ from: "club@vit.ac.in", subject: "", priority: "noise" }], ME, NOW);
  assert.equal(r.priority, "noise");
});

test("deadline time is read when given", () => {
  const r = classifyByRules(mail({ subject: "Register now: Codeathon", body: "Register by 12 Nov 2026, 5:30 PM.", want: "very_important" }), [], ME, NOW);
  assert.equal(r.deadline, "2026-11-12T17:30:00+05:30");
});

test("a deadline that already passed does not make mail urgent", () => {
  const r = classifyByRules(mail({ subject: "HackFest registrations", body: "Registrations closed on 1 Nov 2026.", want: "later" }), [], ME, NOW);
  assert.notEqual(r.priority, "very_important");
});

test("profile: register number gives batch, branch and year", () => {
  assert.deepEqual(
    { batch: ME.batch, code: ME.branchCode, year: ME.year },
    { batch: 2026, code: "BCE", year: 1 },
  );
  assert.equal(profileFromName("X Y 24BIT0042", new Date(NOW)).year, 3);
  assert.equal(profileFromName("No Number", new Date(NOW)).batch, null);
});
