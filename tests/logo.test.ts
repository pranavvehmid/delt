// The app icon is the DELT wordmark everywhere: web icons, favicon and the Android app.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DOT, WORDMARK } from "../src/lib/logo";

const RES = "android/app/src/main/res/drawable/";

test("Android launcher and themed icons use the same wordmark as the web icons", () => {
  for (const f of ["ic_launcher_foreground.xml", "ic_launcher_monochrome.xml"]) {
    const xml = readFileSync(RES + f, "utf8");
    assert.ok(xml.includes(`android:pathData="${WORDMARK}"`), f);
    assert.ok(xml.includes(`M${DOT.cx - DOT.r},${DOT.cy}`), f + " dot");
  }
  assert.ok(readFileSync("src/app/icon.svg", "utf8").includes(WORDMARK), "favicon");
});

test("the wordmark stays inside Android's 66-unit safe circle", () => {
  const nums = [...WORDMARK.matchAll(/([MHVA])\s*([\d.]+)(?:[ ,]([\d.]+))?/g)];
  let x = 0, y = 0;
  const pts: [number, number][] = [];
  for (const [, c, a, b] of nums) {
    if (c === "M") [x, y] = [Number(a), Number(b)];
    if (c === "H") x = Number(a);
    if (c === "V") y = Number(a);
    pts.push([x, y]);
  }
  pts.push([DOT.cx + DOT.r, DOT.cy + DOT.r], [DOT.cx + DOT.r, DOT.cy - DOT.r]);
  for (const [px, py] of pts) assert.ok(Math.hypot(px - 54, py - 54) <= 33, `${px},${py} outside the safe zone`);
});
