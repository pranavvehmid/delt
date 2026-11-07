// #81: the AI never sees other mails' subjects or full addresses through the student's past moves.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { correctionHints } from "../src/lib/classify";

test("past moves reach the AI as sender domains and piles only", () => {
  const hints = correctionHints([
    { from: "dean.office@vit.ac.in", subject: "Disciplinary hearing for 26BCE0001", priority: "very_important" },
    { from: "noreply@vit.ac.in", subject: "Another private subject", priority: "noise" },
    { from: "club@gmail.example", subject: "Party", priority: "later" },
  ]);
  assert.match(hints, /- vit\.ac\.in -> very_important/);
  assert.match(hints, /- gmail\.example -> later/);
  assert.doesNotMatch(hints, /Disciplinary|private|Party|dean\.office|noreply|26BCE/);
  assert.equal(hints.match(/vit\.ac\.in/g)?.length, 1, "one line per domain");
});

test("what the consent and privacy texts say matches what is sent", () => {
  const privacy = readFileSync("src/app/privacy/page.tsx", "utf8");
  assert.match(privacy, /your year and programme/);
  assert.match(privacy, /sender domains you moved/);
  assert.match(readFileSync("src/app/settings-ai.tsx", "utf8"), /your year and programme and the sender domains/);
});

test("#87: a student whose register number can't be read isn't described as a first-year", async () => {
  const { describeProfile, profileFromName } = await import("../src/lib/profile");
  const unknown = describeProfile(profileFromName("Priya Sharma"));
  assert.doesNotMatch(unknown, /first-year|B\.Tech/);
  assert.match(unknown, /unknown/);
});

test("#81: the AI is told year and programme, never the register number", async () => {
  const { describeProfile, profileFromName } = await import("../src/lib/profile");
  const d = describeProfile(profileFromName("A B STUDENT NAME 26BCE0001", new Date("2026-11-07")));
  assert.match(d, /first-year B\.Tech Computer Science and Engineering student \(2026 batch\)/);
  assert.doesNotMatch(d, /26BCE0001/);
});
