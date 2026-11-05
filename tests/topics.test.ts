// #25: moves teach topics, not only senders.
import { test } from "node:test";
import assert from "node:assert/strict";
import { senderPile, topicPile, topicWords } from "../src/lib/topics";

const c = (from: string, subject: string, priority: "very_important" | "priority" | "later" | "noise") => ({ from, subject, priority });

test("meaningful words only", () => {
  assert.deepEqual([...topicWords("Fwd: Weekly Newsletter - Issue 42 for students")].sort(), ["issue", "newsletter", "weekly"]);
});

test("moving two newsletters to Noise sends the next one there, from any sender", () => {
  const moves = [c("a@club.in", "Weekly newsletter issue 41", "noise"), c("b@club.in", "Weekly newsletter issue 40", "noise")];
  assert.equal(topicPile("Weekly newsletter issue 42", moves), "noise");
  assert.equal(topicPile("Hostel fee payment", moves), null, "unrelated");
});

test("one move isn't a pattern, and mixed answers teach nothing", () => {
  assert.equal(topicPile("Weekly newsletter issue 42", [c("a@x", "Weekly newsletter issue 41", "noise")]), null);
  assert.equal(topicPile("Weekly newsletter issue 42", [c("a@x", "Weekly newsletter issue 41", "noise"), c("b@x", "Weekly newsletter issue 40", "later")]), null);
});

test("one sender, different piles: the move with the most similar subject wins", () => {
  const moves = [c("dsw@vit.ac.in", "Hostel fee payment reminder", "very_important"), c("dsw@vit.ac.in", "Cultural night invitation", "noise")];
  assert.equal(senderPile("dsw@vit.ac.in", "Hostel fee payment last date", moves), "very_important");
  assert.equal(senderPile("DSW@vit.ac.in", "Cultural night tickets", moves), "noise");
  assert.equal(senderPile("other@vit.ac.in", "anything", moves), null);
  assert.equal(senderPile("dsw@vit.ac.in", "Something new", [c("dsw@vit.ac.in", "x", "later")]), "later");
});
