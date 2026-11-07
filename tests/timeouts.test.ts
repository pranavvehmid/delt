// #84: a Google call that never answers fails within its time limit instead of hanging the sync.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { fetchWithin, TIMEOUT_MS } from "../src/lib/gmail";
import { AI_TIMEOUT_MS } from "../src/lib/classify";

test("a call that never answers fails with a readable message at the time limit", async () => {
  const server = createServer(() => {}).listen(0); // accepts, never answers
  const port = (server.address() as { port: number }).port;
  const t = Date.now();
  await assert.rejects(fetchWithin(`http://127.0.0.1:${port}/`, {}, 300, "Gmail"), /Gmail didn't answer within 0.3s/);
  assert.ok(Date.now() - t < 2000);
  server.close();
});

test("every Google call has a limit well under one sync's budget", () => {
  assert.ok(TIMEOUT_MS.token <= 10_000 && TIMEOUT_MS.gmail <= 15_000 && AI_TIMEOUT_MS <= 20_000);
});
