// #72: attachments. Which parts count as files, how inline pictures are wired up, and what's safe to show.
import { test } from "node:test";
import assert from "node:assert/strict";
import { attachmentHeaders, findPartById, listAttachments, type Part } from "../src/lib/gmail";
import { MAX_ATTACHMENT, attachmentUrl, inlineCids, listedFiles } from "../src/lib/attachments";

const mail: Part = {
  partId: "",
  mimeType: "multipart/mixed",
  parts: [
    {
      partId: "0",
      mimeType: "multipart/related",
      parts: [
        { partId: "0.0", mimeType: "text/html", body: { data: "PGI-aGk8L2I-", size: 12 } },
        { partId: "0.1", mimeType: "image/png", filename: "", headers: [{ name: "Content-ID", value: "<poster@vit>" }], body: { attachmentId: "A1", size: 2000 } },
      ],
    },
    { partId: "1", mimeType: "application/pdf", filename: "Brochure.pdf", body: { attachmentId: "A2", size: 90_000 } },
    { partId: "2", mimeType: "image/jpeg", filename: "team.jpg", body: { attachmentId: "A3", size: 300_000 } },
    { partId: "3", mimeType: "text/plain", body: { data: "aGk", size: 2 } },
  ],
};

test("lists files and inline pictures by their part number, never the mail's own text", () => {
  const files = listAttachments(mail);
  assert.deepEqual(files.map((f) => [f.part, f.name, f.type, f.cid]), [
    ["0.1", "image.png", "image/png", "poster@vit"],
    ["1", "Brochure.pdf", "application/pdf", null],
    ["2", "team.jpg", "image/jpeg", null],
  ]);
  assert.equal(findPartById(mail, "2")?.filename, "team.jpg");
  assert.equal(findPartById(mail, "9"), null);
});

test("inline pictures (cid:) point at DELT's own route; unknown ones are left alone", () => {
  const files = listAttachments(mail);
  const html = `<img src="cid:poster@vit"><img src='cid:missing'><div style="background:url(cid:POSTER@vit)">`;
  const out = inlineCids(html, "m1", files);
  assert.ok(out.includes(`src="${attachmentUrl("m1", { part: "0.1" })}"`), out);
  assert.ok(out.includes("cid:missing"));
  assert.ok(out.includes(`url(/api/emails/m1/attachments/0.1)`), out);
  assert.equal(attachmentUrl("a/b", { part: "1" }), "/api/emails/a%2Fb/attachments/1");
});

test("pictures already shown in the mail aren't listed again; real attachments are", () => {
  const files = listAttachments(mail);
  assert.deepEqual(listedFiles(`<img src="cid:poster@vit">`, files).map((f) => f.part), ["1", "2"]);
  assert.deepEqual(listedFiles(`<p>no pictures</p>`, files).map((f) => f.part), ["0.1", "1", "2"]);
});

test("pictures and PDFs open in place; everything else, SVG and HTML included, downloads", () => {
  for (const t of ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"]) {
    const h = attachmentHeaders("a", t, 10);
    assert.equal(h["Content-Type"], t);
    assert.match(h["Content-Disposition"], /^inline/);
  }
  for (const t of ["image/svg+xml", "text/html", "application/msword", "application/zip"]) {
    const h = attachmentHeaders("a", t, 10);
    assert.equal(h["Content-Type"], "application/octet-stream", t);
    assert.match(h["Content-Disposition"], /^attachment/);
    assert.match(h["Content-Security-Policy"], /sandbox/);
  }
  const h = attachmentHeaders('ré"sumé\r\n.pdf', "application/pdf", 10);
  assert.equal(h["X-Content-Type-Options"], "nosniff");
  assert.doesNotMatch(h["Content-Disposition"], /[\r\n]|é"/);
  assert.match(h["Content-Disposition"], /filename\*=UTF-8''r%C3%A9%22sum%C3%A9/);
  assert.ok(MAX_ATTACHMENT < 4.5e6, "fits Vercel's response limit");
});
