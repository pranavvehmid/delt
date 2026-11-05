<p align="center">
  <img src="assets/banner.svg" alt="DELT: college mail, sorted by what needs you first" width="100%">
</p>

<p align="center">
  <a href="https://github.com/pranavvehmid/delt/releases/latest/download/DELT.apk">
    <img src="assets/download.svg" alt="Download DELT for Android" width="100%">
  </a>
</p>

<p align="center">
  <a href="https://delt-mu.vercel.app"><img alt="Web app" src="https://img.shields.io/badge/web-delt--mu.vercel.app-1c1917?style=flat-square"></a>
  <a href="https://github.com/pranavvehmid/delt/releases/latest"><img alt="Android release" src="https://img.shields.io/github/v/release/pranavvehmid/delt?style=flat-square&label=android&color=1c1917"></a>
  <a href="#tests"><img alt="174 tests passing" src="https://img.shields.io/badge/tests-174%20passing-1c1917?style=flat-square"></a>
  <img alt="Free" src="https://img.shields.io/badge/cost-free-c8102e?style=flat-square">
</p>

DELT reads your VIT Gmail and sorts every mail into four piles, so exams, registrations, fees and deadlines are always at the top. It works for any `@vitstudent.ac.in` account and costs nothing to run.

<p align="center">
  <img src="assets/stats.svg" alt="174 tests passing · 14 mail apps studied · 3000 random mails, no crash · 0 rupees to run" width="100%">
</p>

## How it sorts

<p align="center">
  <img src="assets/sorting.svg" alt="Each mail is printed darker the more it matters" width="100%">
</p>

| Pile | What goes here |
|---|---|
| **Urgent** | exams, quizzes, CBTs, course and mock registration, FFCS, interviews, fee payments, anything with a deadline that applies to you |
| **Priority** | hackathons and contests, official notices: timetable changes, holidays, hostel and mess, transport, results |
| **Later** | achievements, guest lectures, webinars, club events, study-abroad programmes, scholarships |
| **Noise** | promotions, sales, admissions for other programmes |

Your register number (for example `26BCE…`) is in your Google name, so DELT knows your batch. Mail meant for other batches or seniors goes to Later.

If you move a mail to a different pile, DELT does the same for that sender from then on.

Most mail is sorted by simple rules. When the rules aren't sure, Google Gemini's free tier takes a second look.

## Using it

<p align="center">
  <img src="assets/tabs.svg" alt="Inbox and Deadlines" width="100%">
</p>

- **Inbox** has every mail from the last 60 days, newest first. Filter by pile, show unread only, or search.
- **Tap a mail** to read the whole thing inside DELT. You can move it to another pile, add its deadline to Google Calendar, or mark it done.
- **Deadlines** lists the due dates found in your mail: overdue, today, tomorrow, this week, later.
- On a phone, swipe right to mark read, swipe left to mark done. You can undo either.
- **Wrong pile?** Each open mail has a link that starts a GitHub issue with the subject and pile filled in.

New mail is checked when you open the app and every 5 minutes while it's open. In the background, a free GitHub Actions job checks students who used DELT this week about every 15 minutes, and everyone else at least once a day.

### Settings

Account menu → Settings:

- **Notifications:** a phone alert for new urgent mail, and a reminder for any deadline due within a day.
- **AI sorting:** DELT shares one free Gemini key between students, with a daily allowance each. You can add your own free key from [Google AI Studio](https://aistudio.google.com/apikey); it's stored encrypted and only used for your mail.

### Appearance

Tap ◐ in the top bar.

| Setting | Options |
|---|---|
| Look | **Minimal**: black and white, one typeface. More important mail is printed darker, and urgent mail gets a small red mark. **Glyph**: purple and gold, dot-matrix type |
| Theme | Light, Dark, Extra dark (pure black), Auto |
| Accent | Default, Purple, Blue, Green, Red, Gold |
| Text | Normal, Large |
| Spacing | Comfortable, Compact |

## Install

**Android:** download [DELT.apk](https://github.com/pranavvehmid/delt/releases/latest/download/DELT.apk), open it (allow installs from your browser if Android asks), and sign in with your VIT account. The app opens the website full screen in Chrome, so updates arrive without reinstalling. GitHub Actions builds a new APK whenever the Android code changes.

**iPhone:** open [delt-mu.vercel.app](https://delt-mu.vercel.app) in Safari, then Share → Add to Home Screen.

## Privacy

- DELT can read and label your mail. It can't delete anything.
- It stores a short preview and a one-line summary of each mail, not the full text. The full mail is fetched from Gmail when you open it.
- Every student sees only their own mail. Each database query is tied to the signed-in account, and the tests check this.
- Google may use what is sent to Gemini's free tier to improve its models. Leave `GEMINI_API_KEY` empty to use rules only.
- If you add your own Gemini key, it's encrypted before it's stored.
- Notifications use your browser's own push service. Turning them off removes the device from DELT.

## Run your own copy

```bash
git clone https://github.com/pranavvehmid/delt && cd delt
npm install
cp .env.example .env.local   # Google OAuth, Supabase and Gemini keys (all free)
npm run dev
```

Create the tables by running [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor. Then `bash scripts/push-secrets.sh` copies the notification keys to Vercel and the sync secret to GitHub.

## Tests

`npm test` runs 174 checks in a few seconds:

- 80+ real VIT mails and the pile each should land in
- dates in the formats VIT uses (`15/11/2026`, `15th Nov`, `Nov 15`, `tomorrow 6 PM`), year rollover, impossible dates like 31 Feb
- HTML mail, nested attachments, group senders, ₹ and Tamil text
- 3,000 random mails: no crashes, search and filters never lose a mail, every deadline lands in one group
- other batches, branches and staff accounts
- every API route checks sign-in, and every mail query is limited to the signed-in student
- every combination of appearance settings
- who background sync picks, the shared AI allowance, encrypted keys, and which notifications get sent

`scripts/eval.ts` compares the rules against Gemini and your own corrections on your inbox. It only reads.

## Contributing

Open tasks are in [Issues](https://github.com/pranavvehmid/delt/issues). Ones marked [good first issue](https://github.com/pranavvehmid/delt/labels/good%20first%20issue) are small. If you're a VIT student, the most useful thing is trying it on your own inbox: see [docs/TESTING.md](docs/TESTING.md).

Setup steps and rules for pull requests are in [CONTRIBUTING.md](CONTRIBUTING.md).

## More

- [docs/DESIGN.md](docs/DESIGN.md): what the app is for, how sorting works, why it looks the way it does
- [docs/RESEARCH.md](docs/RESEARCH.md): 14 open-source mail apps and what DELT took from each
- [LICENSE](LICENSE): MIT

<p align="center">
  <img src="assets/footer.svg" alt="DELT, for VIT students. Free and open source." width="100%">
</p>

<p align="center"><sub>Next.js · Supabase · Gmail API · Vercel · Android TWA · pictures drawn by <code>tools/make_art.mjs</code></sub></p>
