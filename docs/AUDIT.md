# Frontend audit

Started 2026-11-06 from fresh screenshots (`shots/audit/`, `shots/phone-*`): phone 412px,
laptop 1366×657 and 1536×730, all three looks. F1-specific items wait for `docs/f1-reference/`.
Status: open / fixed (SHA) / blocked.

## Summary
Critical 2 · Major 10 · Minor 7 · Blocked on references 6 (A19 added 2026-11-07)

## Items

| ID | Sev | Where | What's wrong | Why it fails the bar | Status |
|---|---|---|---|---|---|
| A01 | critical | Android app (#78) | App can open as a Chrome tab with an address bar | Doesn't feel like an app at all | open: needs phone check |
| A02 | critical | Grid theme, whole look | Built from memory of F1 TV graphics, not from the Instagram/broadcast references the user wants; no script + bold driver-name pairing | Wrong reference = wrong look, however polished | blocked: references |
| A03 | major | Minimal, laptop top bar (`look-shared.css .mast sup`) | Unread counts sit low like subscripts ("Inbox ₄") | `top: 0.5em` was tuned for 34px titles, wrong at 18px | fixed (af4f22a) |
| A04 | major | Glyph, laptop list column (`.chips`) | Pile chips are cut off at the column edge ("Later 2" clipped, Noise hidden) | Crowded; looks broken, hides a filter | fixed (2559b25) |
| A05 | major | Laptop, nothing open (`.mv-empty`) | ~900px of empty pane saying "No mail open" | Wasted space on the biggest screen | fixed (97a319e) |
| A06 | major | Grid, P1 position (`.row[data-pos="1"] .pos`) | Red `#e10600` "1" on `#1f1f27` is ~3.7:1 | Under 4.5:1 for 16px text | fixed (d24a046) |
| A07 | major | Grid, mail open (#77) | Worst frame ~100–150ms at 4x slowdown | Above the 100ms smoothness target | partial: repeat opens 53–88ms, first open 103–137ms (drawing the screen the first time) |
| A08 | major | Empty states everywhere (`list-states.tsx`, Deadlines) | Centred grey sentence in a large void ("Nothing else is due.") | No hierarchy or design; feels unfinished | fixed (c069ed7) |
| A09 | major | Loading states | Grey shimmer bars, same in every look | Generic; no look identity (Grid should load like a tower filling) | fixed (1c181ce) |
| A10 | major | Minimal, Needs you rows (`.when::before`) | Red dash floats above the time between rows, reads like a stray divider | Crooked-looking mark with no clear owner | fixed (c71da6b) |
| A11 | major | Grid mail view (`.mv-subj`, `.mv-bar`) | Subject is 8px under a red rule that's under a grey hairline: three lines stacked, cramped top | Clutter and crowding at the most important spot | fixed (20b36b2) |
| A12 | minor | Appearance sheet, all looks (`.seg`) | Selected segment starts 8–10px in from the content edge, not on it | Breaks the left edge everything else shares | fixed (af4f22a) |
| A13 | minor | Grid laptop top bar | Red block under the logo plus the mail pane's red rule: two red lines at different heights | Accent overused; no single focal point | fixed (20b36b2) |
| A14 | minor | Grid phone header | "UPDATED JUST NOW" in spaced capitals competes with the section titles | Status text louder than it needs to be | fixed (20b36b2) |
| A15 | minor | Deadlines rows, Minimal/Grid (`.iconbtn.labelled`) | "Calendar" / "Done" labels are sentence case, everything else in Grid is caps | Inconsistent label style | fixed (3378682) |
| A16 | minor | Sign-in page | Not reviewed in Grid since #73; still uses Minimal's layout | Unchecked screen | fixed (fff7a08) |
| A17 | minor | Glyph look cards preview | Dotted texture in a 120px thumbnail looks like noise | Texture without a purpose at that size | fixed (3ed46b1) |
| A18 | minor | All looks, laptop | Mail column capped at 780px, centred in the pane, leaving uneven side space on 1536px | Width not tied to the grid | fixed (97a319e) |
| A19 | major | Open mail, keyboard (`mail-frame.tsx`) | With focus on a link inside the mail, Esc and J/K did nothing (found by CI) | Keyboard users get stuck in the mail | fixed (7728b4b) |

### Blocked on F1 references (to be specified in `docs/F1_STYLE_SPEC.md`)
| ID | What |
|---|---|
| F01 | Palette and colour coding sampled from the Instagram grid (teams, sessions, results) |
| F02 | Type pairing: script first name + heavy surname; licensed font choice side by side |
| F03 | Grid-announcement animation (P1, P2, P3… with bold kinetic lettering) |
| F04 | Pre-race intro / bumper as the app's opening sequence |
| F05 | Cards, badges and results in the Instagram colour logic |
| F06 | Textures and shapes taken from the references, not invented |

## Fix plan (in order)
1. Foundation: A06 (contrast), A03 (count position), A12 (segment edge).
2. Layout: A04 (chips fit), A05 + A18 (laptop pane use), A11 + A13 (Grid mail header).
3. Components: A10, A15, A14, A08 (empty states), A09 (loading states).
4. Performance: A07.
5. Screens not yet checked: A16, A17.
6. F1 rebuild: F01–F06 once references arrive; then re-audit Grid against them.
7. A01 on a real phone.

## Full technical audit (7 Nov 2026): GitHub issues #79–#186

Label `audit-2026-11-07`. Severity: 1 critical, 28 major, 79 minor.

| # | Sev | Area | Title |
|---|---|---|---|
| #79 | critical | security, infra | Gmail's restricted scope needs Google verification; unverified apps stop at 100 users |
| #80 | major | privacy, bug | The service worker caches the signed-in inbox page in any browser, including shared computers |
| #81 | major | privacy, sorting | AI requests send other mails' senders and subjects, which the privacy text doesn't say |
| #82 | major | bug, infra | Background sync loads every user in one query, and Supabase returns at most 1,000 rows |
| #83 | major | security, performance | The API rate limiter only works inside one server instance |
| #84 | major | bug, infra | No network call has a timeout (Google token, Gmail, Gemini) |
| #85 | major | sorting, bug | The app's own sync never AI-checks new low-confidence mail that rules put in Later or Noise |
| #86 | major | sorting, bug | Deadline ranges pick the start date, so open registrations look closed |
| #87 | major | sorting | Students whose register number can't be read are treated as first-years |
| #88 | major | sorting | The student profile only knows B.Tech branch codes |
| #89 | major | ux | A first sync brings in only 14 days of mail |
| #90 | major | privacy, infra | Old mail purging can be skipped forever |
| #91 | major | bug | "Mark all read" sends up to 1,000 ids in one database URL |
| #92 | major | performance | The app re-downloads up to 300 deadline rows on every refresh |
| #93 | major | performance, infra | Servers run in Dublin while students are in India |
| #94 | major | infra | Background sync depends on GitHub Actions' schedule, which is best-effort |
| #95 | major | infra | Production errors are invisible: no error tracking or alerts |
| #96 | major | infra | Production deploys are manual, from a laptop |
| #97 | major | security, infra | The Android signing key lives in a OneDrive-synced folder |
| #98 | major | bug, infra | The app's update check hits GitHub's 60-requests-per-hour limit on shared campus Wi-Fi |
| #99 | major | infra, ux | The Android app is a sideloaded APK with no release history |
| #100 | major | accessibility | Grid shows piles by colour alone |
| #101 | major | ux | On a phone, a mail's own text starts more than halfway down the screen |
| #102 | major | ux | On a phone, the first mail starts almost halfway down the inbox |
| #103 | major | sorting | An AI-picked deadline isn't checked against the mail |
| #104 | major | security, sorting | Mail text can steer the AI's pile (prompt injection) |
| #105 | major | performance | Unread state is mirrored by listing up to 2,000 unread ids on every sync |
| #106 | minor | bug | The "later" sync phase has no lock, so two tabs can run it at once |
| #107 | minor | bug | Two syncs can both try to create the Gmail labels |
| #108 | minor | ux | Gmail labels are still named "MailSort/…" |
| #109 | minor | performance | Each new mail gets its own Gmail label call |
| #110 | minor | bug | Bulk pile moves are marked as labelled before Gmail confirms |
| #111 | minor | bug | Gmail updates after a move or read change fail silently |
| #112 | minor | bug | Changing a mail that doesn't exist still returns OK |
| #113 | minor | bug | A deadline can be set to any date, even 1970 or 9999 |
| #114 | minor | bug | Sender rules: Settings and the sorter see different lists |
| #115 | minor | ux | Forgetting a sender rule changes nothing that's already sorted |
| #116 | minor | sorting | The sorter reads the plain-text part even when it's only a placeholder |
| #117 | minor | bug | HTML-to-text decoding misses most entities |
| #118 | minor | performance | Each sync writes the users row 3–4 separate times |
| #119 | minor | performance | Every inbox load also writes "last seen" and re-reads the user |
| #120 | minor | performance | Mail list queries fetch every column |
| #121 | minor | performance | Missing indexes for the filters sync runs every time |
| #122 | minor | performance | Search scans every stored mail with ILIKE across four columns |
| #123 | minor | infra | An unused `deadlines` table is still in the schema |
| #124 | minor | infra | Database changes have no versioned migrations |
| #125 | minor | performance | The retention purge deletes across all students in one unbounded statement |
| #126 | minor | privacy | Saved sender rules keep full mail previews forever |
| #127 | minor | privacy | The full Google display name, with register number, is stored |
| #128 | minor | privacy | Notifications show subject and sender on the lock screen, with no option |
| #129 | minor | privacy | Attachments stay in the browser's disk cache for an hour |
| #130 | minor | bug | Deleting data on one device leaves other devices signed in and broken |
| #131 | minor | bug | A shared phone silently moves notifications to whoever signed in last |
| #132 | minor | ux | Re-saving notifications sends the test message every time |
| #133 | minor | security | Raw error messages from the database and Google go to the browser |
| #134 | minor | security | The page CSP allows inline scripts |
| #135 | major | security | Rotating AUTH_SECRET can silently lock out every student |
| #136 | major | security | Every query runs as the database owner; row-level security has no policies |
| #137 | minor | ux | Google shows the consent screen on every sign-in |
| #138 | minor | bug | A failed save of the Google token is only logged |
| #139 | minor | performance | The background job sends reminders one student at a time after its budget |
| #140 | minor | infra | All students share one free Gemini key |
| #141 | minor | sorting | The AI model name is an alias that changes underneath |
| #142 | minor | sorting | AI summaries aren't checked against the style rules |
| #143 | minor | sorting | Rules only understand English cues |
| #144 | minor | sorting | Sorting accuracy isn't measured in production |
| #145 | minor | ux | Reporting a wrong pile needs a GitHub account |
| #146 | minor | sorting | Sender rules match an exact address only |
| #147 | minor | infra | The `category` field is computed and stored but barely used |
| #148 | minor | bug | DELT's pull-to-refresh fights the browser's own in a Chrome tab |
| #149 | minor | performance | Search requests can pile up |
| #150 | minor | ux | Every sync failure says "Couldn't reach Gmail" |
| #151 | minor | performance | Every open tab or device polls the sync route every 5 minutes |
| #152 | minor | ux | A session expiring mid-use reloads the whole page |
| #153 | minor | ux | The app is locked to portrait |
| #154 | minor | design | The installed app's launch colours are always light |
| #155 | minor | bug | "Large text" uses CSS zoom |
| #156 | minor | ux | Few keyboard shortcuts, and no help for them |
| #157 | minor | ux | "Load images" isn't remembered per sender |
| #158 | minor | ux | Most students never turn on notifications |
| #159 | minor | ux | Mails can't be opened offline, even ones already read |
| #160 | minor | ux | Deadline reminders are fixed at 24 hours before |
| #161 | minor | ux | "Add to calendar" only supports Google Calendar |
| #162 | minor | ux | Date-only deadlines are shown as "11:59 pm" |
| #163 | minor | ux | Swipe directions are fixed and sit next to Android's back gesture |
| #164 | minor | performance | Long lists render every loaded row |
| #165 | minor | performance | The 30-second clock re-renders every row |
| #166 | minor | performance | Dark mail recolouring runs as one long task |
| #167 | minor | performance | Each attachment request re-downloads the whole message |
| #168 | minor | performance | Thumbnails download full-size photos |
| #169 | minor | ux | "Wrong pile? Report it" sits on every open mail |
| #170 | minor | testing | Local browser tests run on the dev server, which is slow and flaky |
| #171 | minor | testing | Throwaway `zz-*` specs run with the real suite |
| #172 | minor | testing | WebKit browser tests hang on Windows with animations on |
| #173 | minor | testing | API route handlers have no runtime tests |
| #174 | minor | testing | Smoothness isn't measured in CI |
| #175 | minor | testing | No visual regression tests |
| #176 | minor | infra | No automated dependency updates |
| #177 | minor | infra | Production depends on a beta auth library |
| #178 | minor | infra | No database backups on the free tier |
| #179 | minor | infra | Background rounds can run longer than the 15-minute schedule |
| #180 | minor | documentation | README test badge says 231 tests |
| #181 | minor | documentation | README images show the old design |
| #182 | minor | documentation | DESIGN.md's code map is out of date |
| #183 | minor | infra | Several source files are well over the 200-line limit |
| #184 | minor | design | Stylesheets have become a log of fixes |
| #185 | minor | infra | The package is still named vit-mail-organizer |
| #186 | minor | accessibility | Touch users have no visible alternative to swiping |

## Frontend audit, major issues (7 Nov 2026), label `frontend-audit`: #187–#236 (50)

- #187 Settings is one long phone sheet, even on a laptop
- #188 Preferences are split between two entry points
- #189 The half-moon header button doesn't do what it looks like
- #190 Where navigation lives changes with the look
- #191 Deadlines on a laptop wastes the reading pane
- #192 Glyph still cuts deadline titles off
- #193 The laptop overview repeats the list next to it
- #194 Every launch shows loading placeholders: the inbox isn't rendered on the server
- #195 Every student downloads the CSS for all three looks
- #196 On a laptop, Back walks through every mail you opened
- #197 Switching tabs throws away your scroll position
- #198 Grid's position numbers change all the time
- #199 Grid's LEADER and +1D 2H gaps aren't explained anywhere
- #200 The three looks are three layouts, not three skins
- #201 The open mail jumps as its images load
- #202 The laptop list and reading pane can't be resized
- #203 On 1920px screens a third of the window is empty
- #204 The app isn't designed or tested below 412px width
- #205 Transparent logos disappear in dark mail
- #206 The photo viewer can't zoom or swipe
- #207 PDFs take you out of the app
- #208 AI settings speak in developer jargon
- #209 Sign-in doesn't prepare students for Google's permission screen
- #210 If the server fails, the inbox shows loading placeholders forever
- #211 The unread badge counts Noise and promotions
- #212 A second action replaces the first action's Undo
- #213 Icons mix SVG drawings, Unicode arrows and text symbols
- #214 There are seven kinds of button
- #215 Day headings scroll away in long lists
- #216 Tapping the active tab doesn't scroll back to the top
- #217 Appearance changes are previewed behind a dark veil
- #218 Blocked notifications give no way forward
- #219 Phones have no at-a-glance summary
- #220 Counts appear in four places and mean four different things
- #221 Grid's entrance animation replays on every app launch
- #222 The sign-in page has no laptop design
- #223 The browser tab never shows unread mail or the open subject
- #224 The list never says why a mail is urgent
- #225 AI-written summaries look like the sender's words
- #226 Due dates don't show where they came from
- #227 No sign of how sure DELT is about a pile
- #228 A crash anywhere shows a blank screen
- #229 There's no designed 404 page
- #230 Filters and search are lost on reload or relaunch
- #231 Failed actions look like they worked
- #232 Rows don't show attachments
- #233 Tablets get a stretched phone layout
- #234 Choosing an accent colour changes the colour of urgency
- #235 Banners stack above the list
- #236 Keyboard users must tab through every row to reach the open mail

## Feature proposals (7 Nov 2026), label `feature-idea`: #237–#286 (50)

- #237 Reply and forward without leaving DELT
- #238 Conversation view for mail threads
- #239 Search with filters: sender, pile, date, attachments
- #240 Select several mails and act on them at once
- #241 Snooze a mail until a time
- #242 Pin mails to the top
- #243 Custom piles beyond the four
- #244 Weekly look-ahead summary
- #245 Morning briefing
- #246 Calendar view of deadlines
- #247 Calendar feed that syncs deadlines automatically
- #248 Exam schedule view
- #249 Fee and payment tracker
- #250 Attendance warnings at a glance
- #251 Placement and internship tracker
- #252 Events and clubs calendar
- #253 Clean up noisy senders
- #254 Sender pages
- #255 Home screen widget with next deadlines
- #256 Quiet hours and per-pile notifications
- #257 Share a deadline with classmates
- #258 Share a mail summary to WhatsApp
- #259 Translate a mail
- #260 Ask your inbox a question
- #261 One place for every attachment
- #262 Use more than one account
- #263 Open DELT to other colleges
- #264 Tell DELT your interests to tune sorting
- #265 Spot reschedules and cancellations
- #266 Fold repeated reminders into one
- #267 Inbox insights
- #268 Download my data
- #269 Maintainer dashboard
- #270 Command palette
- #271 DELT inside Gmail
- #272 Turn a mail into a task
- #273 Campus venues link to a map
- #274 High-contrast theme
- #275 Reading options: font and spacing
- #276 App in Hindi, Tamil and Telugu
- #277 Write your own sorting rules
- #278 Activity history
- #279 Tidy up past deadlines automatically
- #280 Archive and delete from DELT
- #281 Academic calendar overlay
- #282 Warn about phishing and fake notices
- #283 Read text in poster images
- #284 One-tap actions: Register, Pay, Join
- #285 Exam focus mode
- #286 Remind me about this mail
