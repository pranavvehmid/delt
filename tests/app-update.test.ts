// The Android app offers its own update when a newer build is released.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildFromReleaseName, installedBuild, shouldOffer } from "../src/lib/app-update";

test("reads the build number from the release name", () => {
  assert.equal(buildFromReleaseName("DELT for Android (build 6)"), 6);
  assert.equal(buildFromReleaseName("DELT for Android (Build 12)"), 12);
  assert.equal(buildFromReleaseName("something else"), null);
  assert.equal(buildFromReleaseName(null), null);
});

test("knows which app build is running, and that a browser isn't the app", () => {
  assert.equal(installedBuild("?app=6", "", null), 6);
  assert.equal(installedBuild("", "android-app://in.delt.mail/", null), 0, "an app too old to say its build");
  assert.equal(installedBuild("", "", "6"), 6, "remembered from the first open");
  assert.equal(installedBuild("", "https://google.com/", null), null, "a normal browser");
  assert.equal(installedBuild("?app=abc", "", null), null);
});

test("offers the update only when a newer build exists and it wasn't just dismissed", () => {
  assert.equal(shouldOffer(5, 6, 0, 1000), true);
  assert.equal(shouldOffer(0, 6, 0, 1000), true);
  assert.equal(shouldOffer(6, 6, 0, 1000), false);
  assert.equal(shouldOffer(null, 6, 0, 1000), false, "never in a browser");
  assert.equal(shouldOffer(5, 6, 2000, 1000), false, "snoozed");
  assert.equal(shouldOffer(5, null, 0, 1000), false, "couldn't reach GitHub");
});

test("the app tells the site its build number when it opens", () => {
  assert.match(readFileSync("android/app/build.gradle", "utf8"), /startUrl: "https:\/\/\$\{siteHost\}\/\?app=\$\{versionCode\}#\/inbox"/);
});
