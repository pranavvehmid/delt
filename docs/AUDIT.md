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
