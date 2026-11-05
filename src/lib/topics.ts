// Learning from moves by topic, not only by sender (#25). Pure, tested in tests/topics.test.ts.
// Per student: their own moves only, never shared with anyone else.
import type { Correction } from "./types";

const STOP = new Set(
  "about after again also among from have here into just more most only other over same some such than that their them then there these they this those through under very what when where which while will with your yours fwd reg dear students student vit vellore campus please kindly regarding reminder notice update".split(" "),
);
/** Meaningful words in a subject: lower case, 4+ letters, no common filler. */
export function topicWords(subject: string): Set<string> {
  return new Set(
    subject
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w)),
  );
}
const overlap = (a: Set<string>, b: Set<string>) => [...a].filter((w) => b.has(w)).length;

/** The pile to use for a sender the student moved before. If they moved this sender's mail to
 *  different piles, the move whose subject is most like this one wins; ties go to the newest. */
export function senderPile(fromAddress: string, subject: string, corrections: Correction[]): Correction["priority"] | null {
  const mine = corrections.filter((c) => c.from.toLowerCase() === fromAddress.toLowerCase());
  if (!mine.length) return null;
  if (new Set(mine.map((c) => c.priority)).size === 1) return mine[0].priority;
  const words = topicWords(subject);
  let best = mine[0], bestScore = -1;
  for (const c of mine) {
    const score = overlap(words, topicWords(c.subject));
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best.priority;
}

/** A pile for mail from any sender, when it shares 2+ meaningful words with at least 2 of the
 *  student's moves and all of those moves went to the same pile. */
export function topicPile(subject: string, corrections: Correction[]): Correction["priority"] | null {
  const words = topicWords(subject);
  if (words.size < 2) return null;
  const alike = corrections.filter((c) => overlap(words, topicWords(c.subject)) >= 2);
  if (alike.length < 2) return null;
  const piles = new Set(alike.map((c) => c.priority));
  return piles.size === 1 ? alike[0].priority : null;
}
