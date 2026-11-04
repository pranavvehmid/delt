<p align="center">
  <img src="assets/banner.svg" alt="DELT: your VIT inbox, sorted" width="100%">
</p>

<p align="center">
  <a href="https://github.com/pranavvehmid/delt/releases/latest/download/DELT.apk">
    <img src="assets/download.svg" alt="Download DELT.apk for Android" width="100%">
  </a>
</p>

<p align="center">
  <a href="https://delt-mu.vercel.app"><img alt="Open the web app" src="https://img.shields.io/badge/open-delt--mu.vercel.app-f5c842?style=for-the-badge&labelColor=17112b"></a>
  <a href="https://github.com/pranavvehmid/delt/releases/latest"><img alt="Latest Android release" src="https://img.shields.io/github/v/release/pranavvehmid/delt?style=for-the-badge&label=android&color=b9a2ff&labelColor=17112b"></a>
  <a href="#tests"><img alt="151 tests passing" src="https://img.shields.io/badge/tests-151%20passing-5ee6b0?style=for-the-badge&labelColor=17112b"></a>
  <img alt="Free" src="https://img.shields.io/badge/cost-%E2%82%B90-fff3d1?style=for-the-badge&labelColor=17112b">
</p>

<p align="center">
  <b>Your VIT inbox, sorted.</b> Exams, registrations and hackathons first. Everything else, later.
</p>

<p align="center">
  <img src="assets/stats.svg" alt="151 tests passing · 14 repos studied · 3000 random mails, 0 crashes · ₹0 to run" width="100%">
</p>

## What it does

<p align="center">
  <img src="assets/sorting.svg" alt="Mail drops from your VIT inbox into four piles: Urgent, Priority, Later, Noise" width="100%">
</p>

DELT signs in with your **VIT Google account**, reads your college mail, and sorts every message into one of four piles:

| Pile | What lands here |
|---|---|
| 🟡 **Urgent** | exams, quizzes, CBTs, course & mock registration, FFCS, interviews, fee payments, anything with a deadline that applies to you |
| 🟠 **Priority** | official notices and decisions: timetable changes, holidays, hostel & mess, transport, results |
| 🟣 **Later** | achievements, guest lectures, webinars, club events, study-abroad programmes, scholarships to check |
| ⚪ **Noise** | promotions, merch sales, admissions for other programmes |

It knows you're a first year from the register number in your VIT name (`26BCE…`), so mail meant for seniors drops to Later on its own.
Move a mail by hand once and DELT remembers that sender.

## One inbox. Every mail.

<p align="center">
  <img src="assets/tabs.svg" alt="Inbox, full mail, deadlines" width="100%">
</p>

| Screen | What you do there |
|---|---|
| **Inbox** | every mail in one list, newest first, grouped by day. Each has a colour tag for its pile. Tap the chips (All · Urgent · Priority · Later · Noise) to filter, or **Unread only**. Nothing ever leaves this list |
| **Mail** | tap any mail to read the **whole original** inside DELT. Move it to another pile (DELT remembers that sender), add its deadline to Google Calendar, mark unread or done |
| **Deadlines** | dates found in your mail, sorted: Overdue · Today · Tomorrow · This week · Later · Done |

On a phone, **swipe right** to mark read or unread and **swipe left** to mark done. Every action has **Undo**.

DELT checks for new mail when you open it, every 5 minutes while it's open, and once a day at 7 AM.

**Make it yours** with the ◐ button:

| Option | Choices |
|---|---|
| Look | **Minimal** (default): Swiss-style. One typeface, no boxes, and importance shown as ink: urgent mail is darkest with a red mark, noise is faint · **Glyph**: bold dot-matrix cards in purple and gold |
| Theme | Light · Dark · Extra dark (pure black, like Nothing OS) · Auto (follows your phone) |
| Accent | Default · Purple · Blue · Green · Red · Gold |
| Text | Normal · Large |
| Spacing | Comfortable · Compact (hides the summary line) |

How it all works, and why: [docs/DESIGN.md](docs/DESIGN.md).

## Install on Android

1. On your phone, tap [**Download DELT.apk**](https://github.com/pranavvehmid/delt/releases/latest/download/DELT.apk).
2. Open it. If Android asks, allow installing apps from your browser.
3. Sign in with your `@vitstudent.ac.in` account.

The app is a [Trusted Web Activity](https://developer.chrome.com/docs/android/trusted-web-activity/): it opens DELT full-screen in Chrome, so Google sign-in works and updates arrive without reinstalling. A fresh APK is built and published by GitHub Actions whenever the Android app changes.

On iPhone, open [the site](https://delt-mu.vercel.app) in Safari and use **Share → Add to Home Screen**.

## Privacy

- Reads and labels mail; **never deletes** anything.
- Stores only a short preview and the summary of each mail, never full bodies.
- Any `@vitstudent.ac.in` student can sign in. Each student only ever sees and changes their own mail (every database query is tied to the signed-in account, and tests check this).
- Mail the rules aren't sure about is checked by Google Gemini's free tier, which Google may use to improve its models. Leave `GEMINI_API_KEY` empty to sort with rules only.

## Run your own copy

```bash
git clone https://github.com/pranavvehmid/delt && cd delt
npm install
cp .env.example .env.local   # fill in Google OAuth, Supabase, Gemini (all free)
npm run dev
```

Create the tables by running [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor.

## Tests

`npm test` runs 151 checks in about 3 seconds:

- **80+ real VIT mails** and the pile a first year expects: exams, FFCS, scholarships, seniors-only, achievements, the `- reg` trap
- **Dates** in every format VIT uses (`15/11/2026`, `15th Nov`, `Nov 15`, `tomorrow 6 PM`), year rollover, impossible days like 31 Feb
- **Parsing**: HTML mail, nested multiparts, group senders, ₹ and Tamil text
- **Stress**: 3,000 random mails never crash; 1,000 typical mails sort in under a second
- **Inbox logic**: filters never hide mail under All, day groups follow IST, deadline buckets merge reminders and skip noise; 3,000 random mails checked for search, filters and deadlines
- **Every student**: other batches and branches, seniors, staff with no register number; batch-only mail goes to Later only for the wrong batch
- **Safety**: every API route checks sign-in, and every mail query is limited to the signed-in student
- **Appearance**: every combination of look, theme, accent, text and spacing is applied the same way before the page paints

`scripts/eval.ts` compares the free rules with AI and hand-sorted answers on your own inbox (read-only).

## Why it works the way it does

See [docs/RESEARCH.md](docs/RESEARCH.md): 14 open-source mail sorters, what each does well, and which ideas DELT borrows.

<p align="center">
  <img src="assets/footer.svg" alt="Made for VITians" width="100%">
</p>

<p align="center"><sub>Next.js · Supabase · Gmail API · Vercel · Android TWA · art drawn by <code>tools/make_art.mjs</code></sub></p>
