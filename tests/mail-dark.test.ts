// #71: mail shown dark stays readable. Every text colour ends up 4.5:1 on its background,
// light backgrounds become dark, dark ones stay, and colours keep their hue.
import { test } from "node:test";
import assert from "node:assert/strict";
import { contrast, darkBackground, parseColor, readableText, type RGB } from "../src/app/mail-dark";

const PAGES: Record<string, RGB> = { "Extra dark": [0, 0, 0], Dark: [24, 24, 27], Grid: [21, 21, 30] };
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;

test("reads the colour formats browsers give back", () => {
  assert.deepEqual(parseColor("rgb(1, 2, 3)"), [1, 2, 3, 1]);
  assert.deepEqual(parseColor("rgba(1, 2, 3, 0.5)"), [1, 2, 3, 0.5]);
  assert.deepEqual(parseColor("rgb(1 2 3 / 50%)"), [1, 2, 3, 0.5]);
  assert.equal(parseColor("transparent"), null);
});

test("every common mail text colour passes 4.5:1 on every dark page, on white and grey boxes too", () => {
  const texts = ["#000000", "#1d1b22", "#333333", "#666666", "#999999", "#aaaaaa", "#cccccc", "#c00000", "#1a73e8", "#0b8043", "#5b3fd6", "#ff9900"];
  const boxes = ["#ffffff", "#f5f5f5", "#eeeeee", "#fff8e1", "#e8f0fe", "#222222", "#003366"];
  for (const [name, page] of Object.entries(PAGES)) {
    for (const box of boxes) {
      const bg = darkBackground(hex(box), page);
      for (const t of texts) {
        const out = readableText(hex(t), bg);
        assert.ok(contrast(out, bg) >= 4.5, `${name}: ${t} on ${box} -> ${out} is ${contrast(out, bg).toFixed(2)}:1`);
      }
    }
  }
});

test("light backgrounds turn dark; white becomes the page itself; dark ones stay", () => {
  for (const page of Object.values(PAGES)) {
    const white = darkBackground([255, 255, 255], page);
    assert.ok(contrast(white, page) < 1.15, `white -> ${white}, page ${page}`);
    assert.ok(contrast(darkBackground(hex("#fff8e1"), page), [255, 255, 255]) > 10, "a pale tint becomes dark");
  }
  assert.deepEqual(darkBackground(hex("#003366"), [0, 0, 0]), hex("#003366"));
});

test("colours keep their hue: red stays red, blue stays blue", () => {
  const bg: RGB = [0, 0, 0];
  const red = readableText(hex("#c00000"), bg), blue = readableText(hex("#1a73e8"), bg);
  assert.ok(red[0] > red[1] * 1.5 && red[0] > red[2] * 1.5, `red -> ${red}`);
  assert.ok(blue[2] > blue[0] && blue[2] > blue[1], `blue -> ${blue}`);
});

test("text that's already readable isn't touched; grey stays quieter than black text", () => {
  assert.deepEqual(readableText([240, 240, 240], [0, 0, 0]), [240, 240, 240]);
  const bg: RGB = [0, 0, 0];
  const body = readableText(hex("#1d1b22"), bg), grey = readableText(hex("#999999"), bg);
  assert.ok(grey[0] < body[0], `grey ${grey} vs body ${body}`);
});
