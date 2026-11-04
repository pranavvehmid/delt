// Harder sorter cases: forwards, mixed signals, look-alike words.
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyByRules } from "../src/lib/rules";
import { profileFromName } from "../src/lib/profile";

const NOW = Date.parse("2026-11-03T10:00:00+05:30");
const ME = profileFromName("A B STUDENT NAME 26BCE0001", new Date(NOW));
type P = "very_important" | "priority" | "later" | "noise";

const m = (subject: string, body = "", from = "office@vit.ac.in") => ({
  id: "t", threadId: "t", fromName: "S", fromAddress: from, subject, snippet: "", receivedAt: new Date(NOW - 3600_000), body, unread: true,
});

const CASES: [string, string, string | undefined, P][] = [
  ["Fwd: Fwd: Hackathon at IIT Madras - registration closes 12 Nov", "Teams of 2-4. Open to all UG students.", undefined, "very_important"],
  ["Re: Reminder: Last date extended for FFCS slot change", "", undefined, "very_important"],
  ["Hackathon winners announced", "Congratulations to all winners of HackVIT.", undefined, "later"],
  ["Monthly newsletter: upcoming deadlines inside", "This edition covers club news and deadlines.", undefined, "later"],
  ["Coursera: enroll by Nov 10 and get 50% off", "Limited time offer. Buy now.", "no-reply@coursera.org", "noise"],
  ["Internship opportunity for first year students - apply by 9 Nov", "", undefined, "very_important"],
  ["Pay your exam fee before 15 Nov", "Exam fee payment link is live.", undefined, "very_important"],
  ["Kind attention: attendance below 75% in BACSE103", "Your attendance is below 75%. Meet your proctor.", undefined, "very_important"],
  ["Class test postponed to Friday", "", undefined, "very_important"],
  ["Talk on careers in AI by Google engineer", "All are welcome.", undefined, "later"],
  ["Workshop on Git & GitHub - registrations open", "Last date 6 Nov 2026. Limited seats.", undefined, "priority"],
  ["Thank you for attending the orientation", "", undefined, "later"],
  ["Code of conduct for hostel residents - mandatory reading", "", undefined, "priority"],
  ["Scholarship for women in STEM - final year students", "Only for final year students.", undefined, "later"],
  ["CodeChef SnackDown contest - register now", "Contest on 9 Nov 2026. Prize pool Rs 50,000.", "noreply@codechef.com", "very_important"],
  ["Your Amazon order has shipped", "Track your package.", "shipment-tracking@amazon.in", "noise"],
  ["Re: BAENG101 - DA08 Book Review", "Please submit your DA by 7 Nov 2026.", undefined, "very_important"],
  ["VIT Global Voices - reg", "Invitation to an event on 22 Oct.", undefined, "later"],
  // from real mail: paid programmes from other universities are "later", even with fees or "final call"
  ["RWTH Germany-Summer School Program 2027: Artificial Intelligence & Robotics", "Register and pay fee by 20th Nov (early bird) or 5th Dec 2026.", undefined, "later"],
  ["Final Call | few seats available | National University of Singapore – Artificial Intelligence Programme", "Apply now, limited seats. Programme fee applies.", undefined, "later"],
  ["Specialised Electric Vehicle Courses under the Bajaj BEST Programme", "Register now for the certificate courses.", undefined, "later"],
];

for (const [subject, body, from, want] of CASES) {
  test(`${want.padEnd(14)} ← ${subject}`, () => {
    const r = classifyByRules(m(subject, body, from), [], ME, NOW);
    assert.equal(r.priority, want, `got ${r.priority} (${r.category}: ${r.reason})`);
  });
}
