# Decisions

One line each: what, and why. Newest first.

- 2026-11-06 Grid font is Saira (variable, wdth 50–125, wght 100–900, SIL OFL 1.1, `src/app/fonts/saira/OFL.txt`). F1's Formula1 Display is proprietary; Saira's squared wide capitals are the closest free match found so far. To be re-checked side by side once F1 references arrive.
- 2026-11-06 No F1 or team logos anywhere; Grid recreates the style, not the marks.
- 2026-11-06 Opening a mail and switching tabs don't use View Transitions; closing a mail does. A page snapshot forces React to render synchronously first (90–170ms at 4x slowdown).
- 2026-11-06 The mail's own iframe is created 300ms after the panel opens, so building that document doesn't drop frames during the slide.
- 2026-11-06 Attachments are found by Gmail part number, not attachment id (ids change on every fetch). Images and PDFs are sent inline; everything else (SVG and HTML included) downloads with nosniff and a sandbox policy.
- 2026-11-06 Attachments over 4.4MB open in Gmail: Vercel's response limit is 4.5MB.
- 2026-11-06 Dark mail recolours element by element (light backgrounds to the theme's dark, text lifted to 4.5:1, hue kept) instead of inverting the frame; inversion broke grey text and dark mails.
- 2026-11-06 A plain `<a href>` doesn't trigger "Load images"; only pictures, backgrounds and stylesheets load remote content.
- 2026-11-06 Grid's timing tower: P1 is always LEADER; other rows show how long they've waited.
- 2026-11-06 The Grid entrance plays once per page load (`html.settled`); replaying it on every filter cost frames.
- 2026-11-06 Laptop (≥1000px): one fixed top bar across the window; list column `clamp(380px, 32vw, 520px)`; bar 64px.
- 2026-11-05 One spacing scale (4px steps) and one type scale; browser tests reject anything off them.
- 2026-11-05 Every font ships with the app (no Google Fonts requests), so builds and privacy don't depend on a CDN.
- 2026-11-05 Mail bodies are never stored; they're read live from Gmail when opened.
