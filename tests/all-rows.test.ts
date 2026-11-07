// #82: background sync must see every student, not only the first 1,000.
import { test } from "node:test";
import assert from "node:assert/strict";
import { allRows } from "../src/lib/all-rows";

const table = Array.from({ length: 2345 }, (_, i) => ({ email: `s${i}` }));
const fake = (from: number, to: number) => Promise.resolve({ data: table.slice(from, to + 1).slice(0, 1000), error: null });

test("pages through every row past the 1,000-row cap", async () => {
  const { data, error } = await allRows(fake);
  assert.equal(error, null);
  assert.equal(data.length, 2345);
  assert.equal(new Set(data.map((r) => r.email)).size, 2345);
});

test("exactly 1,000 rows: one more request, then stops", async () => {
  let calls = 0;
  const { data } = await allRows((a, b) => (calls++, Promise.resolve({ data: table.slice(0, 1000).slice(a, b + 1), error: null })));
  assert.equal(data.length, 1000);
  assert.equal(calls, 2);
});

test("an error stops and is returned with what came before", async () => {
  const { data, error } = await allRows((a) => Promise.resolve(a === 0 ? { data: table.slice(0, 1000), error: null } : { data: null, error: { message: "boom" } }));
  assert.equal(data.length, 1000);
  assert.equal(error?.message, "boom");
});
