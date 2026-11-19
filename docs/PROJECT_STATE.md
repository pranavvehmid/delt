# Project state

Updated 2026-11-19.

## Live
- Production runs `b75b68c`, the Grid refresh and issues #100 and #221 on top of the previous
  live commit `414de98`. The same Grid changes are on `main` through PR #307.
- The later changes from `main` need a separate release after checking the production Supabase
  schema, including `users.name` and the later-sync lock.
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

- Audit A03–A19 fixed (2026-11-07); A07 partial.
- Fix round 1 (2026-11-07): 46 issues from the full audit closed, each with a test (list in `docs/AUDIT.md`).

## Half-done
- A07/#77: Grid's first mail open of a session is 103–137ms at 4x slowdown; repeat opens 53–88ms.
- #78: Android app sometimes shows Chrome's address bar. Server side verified; app now shows a note
  when it opens as a plain tab. Needs a check on the user's phone.
- Grid: the first typography and spacing pass used the supplied pre-race intro.
  Additional Grid audits, including the explanation of timing labels (#199), are open.
- Personal Gmail: PR #308 specifies the External OAuth pilot and proposes weights for VIT
  and personal mail. The pilot and sorting changes have yet to be implemented.

## Broken / known
- WebKit browser tests with animations on hang on this Windows machine only (CI passes).

## Open issues that need people, a phone or money
#1 real inboxes, #5 Gmail push, #15 staff accounts, #17 iPhone, #37 handover plan, #78 phone check.

## Next
0. Deploy (needs the user's go-ahead): production is still at 436117a.
1. User drops F1 references; write `docs/F1_STYLE_SPEC.md`; pick fonts side by side.
2. F1 rebuild (F01–F06), then re-audit Grid against the references.
3. Deploy when the user says so.
