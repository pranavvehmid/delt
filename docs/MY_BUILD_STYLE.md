# How Pranav builds

[S] = you said it. [I] = I inferred it from the code or history; please confirm or correct those.

## Project structure
- [I] One Next.js app; client components flat in `src/app/` named by what they show (`mail-view.tsx`, `inbox-list.tsx`), hooks as `use-*.ts`, logic with no React in `src/lib/`.
- [S] Big files get split around 200 lines (#41 split the mail view and settings).
- [S] Styles are plain CSS split per look, not Tailwind classes in markup.
- [S] Measured layout tests are the standard for done. Every feature has a test: unit tests for logic, Playwright for what's on screen, including measured layout (edges, spacing, type sizes).
- [S] Everything free: no paid services, fonts shipped with the app.

## Design decisions
- [S] Precision: elements on a real grid, lined up to the pixel, nothing "roughly" placed.
- [S] One spacing scale and one type scale; no magic numbers.
- [S] Strong hierarchy: obvious what matters most on each screen.
- [S] No clutter, no crowded areas next to wasted empty space.
- [S] Fonts with character, consistent sizes, weights and line heights.
- [S] Textures only when deliberate; no rough noise.
- [S] Motion like broadcast graphics: fast, snappy, precise; never generic fades.
- [S] For F1: exactly the broadcast and Instagram style, not "inspired by", not the F1 website.
- [S] It must feel like a professional app on the phone: no browser chrome, no lag.
- [I] Accessibility is non-negotiable: 4.5:1 text, 44px touch targets, keyboard use, reduce-motion.

## Permanent UI checklist (run on every UI task)
1. Tabs aligned: equal gaps, clear active state, lined up with the content below.
2. Space used well: nothing cramped beside something empty; content width fits the window.
3. Fonts: right face, sizes on the scale, consistent weights and line heights.
4. Spacing: every padding, margin and gap on the 4px scale.
5. No crookedness: shared edges and baselines line up (measured, not eyeballed).
6. No rough textures or decoration without a reason.
7. Polish: hover, focus, pressed, loading, empty and error states all designed.
8. Laptop and phone both checked by screenshot; the phone app has no browser bar.
9. Smooth: no frame over ~100ms on a mid-range phone for common actions.

## Workflow habits
- [S] Short prompts; turn them into a technical brief and act on it.
- [S] Don't ask lots of questions; make sensible calls and say what you assumed.
- [S] File every problem as a public GitHub issue, fix one by one, commit and push after each, close with the SHA.
- [S] When a test fails, note it and move on; come back to all failures at the end. Run long suites in the background.
- [S] Work fast; keep replies short; detail goes in docs.
- [S] Commits must be real work (no dummy or backdated commits).
- [S] Plain, human wording in UI and docs; no AI-sounding phrases.
- [I] Strict self-audit with measured before/after numbers, and honest reporting of what isn't done.

## Every prompt (Part A)
1. Translate it into a brief: Goal, Context, Exact requirements, Non-goals, Acceptance criteria, Risks and assumptions.
2. Show the brief in 10 lines or fewer.
3. Execute from the brief.
4. Fill gaps from this file and the code; say what was assumed.
5. Save the brief to docs/briefs/YYYY-MM-DD-name.md.
