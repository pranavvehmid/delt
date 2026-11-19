import { test } from "node:test";
import assert from "node:assert/strict";
import { campusVenues } from "../src/lib/campus-venues";

test("recognizes distinct Vellore venues in the order they appear", () => {
  const venues = campusVenues("student@vitstudent.ac.in", "Meet at SJT 501, then TT Gallery and Anna Auditorium. SJT-501");
  assert.deepEqual(venues.map(({ name }) => name), ["Silver Jubilee Tower", "Technology Tower", "Anna Auditorium"]);
  assert.deepEqual(venues.map(({ url }) => new URL(url).searchParams.get("query")), [
    "Silver Jubilee Tower, VIT Vellore", "Technology Tower, VIT Vellore", "Anna Auditorium, VIT Vellore",
  ]);
  for (const { url } of venues) assert.equal(new URL(url).origin, "https://www.google.com");
});

test("ignores ambiguous codes, URL text, personal accounts and another campus", () => {
  assert.deepEqual(campusVenues("staff@vit.ac.in", "See TT and SJT. https://example.com/SJT-501"), []);
  assert.deepEqual(campusVenues("user@example.org", "Venue: SJT 501"), []);
  assert.deepEqual(campusVenues("staff@vit.ac.in", "VIT Chennai: SJT 501"), []);
});
