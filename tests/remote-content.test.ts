// #32, #71: "Load images" shows only when the mail would actually fetch something; a plain link doesn't.
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasRemoteContent as remote } from "../src/app/mail-frame";

test("pictures, backgrounds and stylesheets count as remote; links and data images don't", () => {
  assert.equal(remote('<a href="https://vit.ac.in">portal</a>'), false);
  assert.equal(remote('<img src="data:image/png;base64,AAAA">'), false);
  assert.equal(remote('<img data-src="https://x/a.png">'), false);
  assert.equal(remote(null), false);
  assert.equal(remote('<img src="https://x.example/a.png">'), true);
  assert.equal(remote("<img src=//x.example/a.png>"), true);
  assert.equal(remote('<td background="http://x.example/a.png">'), true);
  assert.equal(remote('<link rel="stylesheet" href="https://x.example/a.css">'), true);
  assert.equal(remote('<div style="background:url(https://x.example/a.png)">'), true);
});
