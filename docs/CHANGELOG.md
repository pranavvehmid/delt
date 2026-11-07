# Changelog

Newest first. Commit SHAs in brackets.

## 2026-11-07 (fix round 1, 46 issues; not deployed yet)
- Privacy: signed-in pages no longer cached in browser tabs (#80); AI gets only sender domains from past moves, no register number (#81, #87); attachments never kept on disk (#129); no raw server errors in the browser (#133).
- Sync and data: every student synced past 1,000 (#82); timeouts on Google/Gemini (#84); daily batched purge (#90, #125); six-week first sync (#89); labels named DELT/… and labelled in bulk (#108, #109); Gmail failures retried and reported (#110, #111); label race fixed (#107).
- Sorting: date ranges end on their last date (#86); AI deadlines and Urgent upgrades checked against the mail (#103, #104); unsure low-pile mail AI-checked (#85); entities and placeholder text parts (#116, #117); summaries tidied (#142); one rule list (#114).
- App: error page and 404 (#228, #229); failed changes roll back (#231); server failures show Try again (#210); one banner at a time (#235); badge counts Urgent+Priority (#211); tab title, filters and scroll remembered (#223, #230, #197, #216); laptop Back leaves the pane (#196); deadline titles in full (#192); accent no longer recolours urgency (#234); transparent logos in dark mail (#205); deadlines downloaded only when needed (#92); app update check via DELT (#98); sign-in failures explained (#138); deleted accounts sign other devices out (#130).

## 2026-11-07 (audit fixes; not deployed yet)
- Esc and J/K work while focus is inside the mail itself (A19) [7728b4b].
- Grid sign-in page in the Grid look (A16) [fff7a08]; Glyph preview dots quieter (A17) [3ed46b1].
- Loading rows fill the row and pulse on the GPU; they were squeezed into a 28–52px column (A09) [1c181ce].
- Empty states with a mark, a real title and a useful hint (A08) [c069ed7].
- Minimal marks urgent mail with a red time, not a floating dash (A10) [c71da6b]; Grid labels in caps (A15) [3378682].
- Grid: one red focal point, one rule over the open mail, quiet sync status (A11, A13, A14) [20b36b2].
- Laptop: "Today" overview in the empty pane; open mail on a 40px gutter (A05, A18) [97a319e].
- Laptop: every pile filter visible in the list column (A04) [2559b25].
- Minimal laptop counts at the top of tab titles; segmented choices on the content edge (A03, A12) [af4f22a].
- Grid leader position readable in an accent block (A06) [d24a046].

## 2026-11-06
- Docs: project memory files (CLAUDE.md, PROJECT_STATE, DECISIONS, THEMES, MY_BUILD_STYLE, LEARNING_NOTES, AUDIT).
- The app says so when it opens as a plain Chrome tab, with the fix (#78) [dca4e50].
- Smoother: no page snapshot when opening a mail or switching tabs; first draw is 12 rows (#77) [e85aeab].
- Laptops get a desktop layout: top bar across the window, scaling list column (#76) [8aa5e25, b41c3fa].
- Grid moves like F1 grid graphics: colour band, wipe, text rising from a mask (#75) [8a123b5].
- Grid restyled after F1 broadcast graphics; the list is a timing tower; LEADER is always P1 (#73, #74) [0d32898].
- Photos and PDFs in a mail can be seen in DELT (#72) [d1b7428].
- Dark mail is readable in every dark theme (#71) [d6b650b].

## 2026-11-05
- Frontend round 1: tabs and alignment, spacing scale, type scale, details (#67–#70).
- Held-out test set for sorting; rules reach 100% on it (#24).
- Mail reader split into smaller files; sheets over a mail behave (#41).
