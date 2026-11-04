<p align="center">
  <img src="assets/banner.svg" alt="DELT: your VIT inbox, sorted" width="100%">
</p>

<p align="center">
  <b>Your VIT inbox, sorted.</b> Exams, registrations and hackathons first. Everything else, later.<br>
  <a href="https://delt-mu.vercel.app"><b>Open DELT →</b></a> &nbsp;·&nbsp;
  <a href="../../releases/latest"><b>Download the Android app (APK) →</b></a>
</p>

---

## What it does

DELT signs in with your **VIT Google account**, reads your college mail, and sorts every message into one of four piles:

| Pile | What lands here |
|---|---|
| 🔴 **Urgent** | exams, quizzes, CBTs, course & mock registration, FFCS, interviews, fee payments, anything with a deadline that applies to you |
| 🟠 **Priority** | official notices and decisions: timetable changes, holidays, hostel & mess, transport, results |
| 🟢 **Later** | achievements, guest lectures, webinars, club events, study-abroad programmes, scholarships to check |
| ⚪ **Noise** | promotions, merch sales, admissions for other programmes |

It knows you're a first year from the register number in your VIT name (`26BCE…`), so mail meant for seniors drops to Later on its own.
Move a mail by hand once and DELT remembers that sender.

## Five tabs, one job each

| Tab | Job |
|---|---|
| **Today** | morning brief: your top 3, today's mail count (received · read · unread), deadlines DELT found that need a yes/no |
| **New** | unread mail as a swipe deck: → got it, ← not for me (marks read in Gmail too) |
| **Board** | Urgent · Chances (hackathons, contests) · Notices, with a category spotlight |
| **Deadlines** | add your own, track ones found in mail, see the week day by day |
| **Inbox** | every mail grouped by day; mark read/unread, change priority or category |

Tap any mail for a summary, or **Read full mail** to see the original inside DELT. It's fetched live from Gmail and never stored.

## Install on Android

1. On your phone, open the [latest release](../../releases/latest) and download **DELT.apk**.
2. Open it. If Android asks, allow installing apps from your browser.
3. Sign in with your `@vitstudent.ac.in` account.

The app is a [Trusted Web Activity](https://developer.chrome.com/docs/android/trusted-web-activity/): it opens DELT full-screen in Chrome, so Google sign-in works and updates arrive without reinstalling.

On iPhone, open the site in Safari and use **Share → Add to Home Screen**.

## Privacy

- Reads and labels mail; **never deletes** anything.
- Stores only a short preview and the summary of each mail, never full bodies.
- Only VIT accounts can sign in, and each person only ever sees their own mail.
- Mail the rules aren't sure about is checked by Google Gemini's free tier, which Google may use to improve its models. Leave `GEMINI_API_KEY` empty to sort with rules only.

## Run your own copy

```bash
git clone https://github.com/pranavvehmid/delt && cd delt
npm install
cp .env.example .env.local   # fill in Google OAuth, Supabase, Gemini (all free)
npm run dev
```

Create the tables by running [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor.
Test the sorting rules with `npm test`.

<sub>Next.js · Supabase · Gmail API · Vercel · Android TWA. Design borrowed from Nothing's Glyph look, in purple and gold.</sub>
