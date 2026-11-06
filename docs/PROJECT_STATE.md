# Project state

Updated 2026-11-06.

## Live
- Production (delt-mu.vercel.app) runs code up to 436117a (#70). Everything below from #71 on
  is pushed to `main` and passes CI, but is **not deployed yet** (waiting for the user's go-ahead).
- Android app: `app-latest` release, signed with the `delt` key; Digital Asset Links verified (`linked: true`).

## Finished (pushed, CI green)
- Sorting: rules + optional Gemini check; 63-mail held-out set at 100% (#24).
- Inbox, Deadlines, mail reader, Settings, Appearance, sender rules, push notifications, offline cache.
- Frontend round 1 (#67–#70): alignment, 4px spacing scale, type scale, details.
- #71 dark mail readable in every dark theme (per-element recolouring, 4.5:1).
- #72 attachments: inline `cid:` pictures, thumbnails + viewer, PDFs, downloads.
- #73/#74 Grid restyled after F1 broadcast graphics (upright Saira, carbon panels, timing tower, LEADER on P1).
- #75 Grid motion (colour band leads a wipe, text rises from a mask, 35ms stagger, plays once).
- #76 laptop layout (top bar across the window, scaling list column, pane under the bar).
- #77 smoother screen changes (no page snapshot on open/tab switch, chunked rendering, 12 first rows).

## Half-done
- #77: Grid's mail open still has frames around 100–150ms at 4x CPU slowdown.
- #78: Android app sometimes shows Chrome's address bar. Server side verified; app now shows a note
  when it opens as a plain tab. Needs a check on the user's phone.
- F1 theme: the user says the reference should be F1's Instagram and TV graphics (grid intro,
  pre-race video, script first name + bold surname), not the website. Blocked on reference
  screenshots/clips in `docs/f1-reference/`. See `docs/AUDIT.md`.

## Broken / known
- WebKit browser tests with animations on hang on this Windows machine only (CI passes).

## Open issues that need people, a phone or money
#1 real inboxes, #5 Gmail push, #15 staff accounts, #17 iPhone, #37 handover plan, #78 phone check.

## Next
1. User drops F1 references; write `docs/F1_STYLE_SPEC.md`; pick fonts side by side.
2. Work through `docs/AUDIT.md` in order, one item per commit.
3. Deploy when the user says so.
