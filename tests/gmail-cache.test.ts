// #19: one token refresh per hour per student, one label lookup per token.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ensureLabels, getAccessToken, resetTokenCache } from "../src/lib/gmail";

let calls: string[] = [];
let expiresIn = 3600;
beforeEach(() => {
  resetTokenCache();
  calls = [];
  expiresIn = 3600;
  globalThis.fetch = (async (url: string | URL) => {
    const u = String(url);
    calls.push(u.includes("oauth2") ? "token" : u.includes("/labels") ? "labels" : u);
    if (u.includes("oauth2")) return new Response(JSON.stringify({ access_token: `at-${calls.length}`, expires_in: expiresIn }));
    if (u.endsWith("/labels")) return new Response(JSON.stringify({ labels: ["1 Very Important", "2 Priority", "3 Later", "4 Noise"].map((n, i) => ({ id: `L${i}`, name: `MailSort/${n}` })) }));
    return new Response("{}", { status: 404 });
  }) as typeof fetch;
});

test("the access token is reused until shortly before it expires", async () => {
  const a = await getAccessToken("1//refresh-A");
  const b = await getAccessToken("1//refresh-A");
  assert.equal(a, b);
  assert.deepEqual(calls, ["token"]);
  await getAccessToken("1//refresh-B");
  assert.deepEqual(calls, ["token", "token"], "each student has their own");
});

test("a token with under 5 minutes left is refreshed", async () => {
  expiresIn = 200;
  await getAccessToken("1//refresh-A");
  await getAccessToken("1//refresh-A");
  assert.deepEqual(calls, ["token", "token"]);
});

test("labels are looked up once per access token", async () => {
  const t = await getAccessToken("1//refresh-A");
  const one = await ensureLabels(t);
  const two = await ensureLabels(t);
  assert.deepEqual(one, two);
  assert.equal(calls.filter((c) => c === "labels").length, 1);
});

test("#107: if another sync created the label first (409), DELT uses that label", async () => {
  let listed = 0;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith("/labels") && init?.method === "POST") return new Response('{"error":{"code":409,"message":"Label name exists or conflicts"}}', { status: 409 });
    if (u.endsWith("/labels")) {
      listed++;
      // first look: nothing yet; second look: the other sync's labels are there
      const names = listed === 1 ? [] : ["1 Very Important", "2 Priority", "3 Later", "4 Noise"];
      return new Response(JSON.stringify({ labels: names.map((n, i) => ({ id: `X${i}`, name: `MailSort/${n}` })) }));
    }
    return new Response("{}", { status: 404 });
  }) as typeof fetch;
  const ids = await ensureLabels("at-race");
  assert.equal(ids.very_important, "X0");
  assert.equal(ids.noise, "X3");
});
