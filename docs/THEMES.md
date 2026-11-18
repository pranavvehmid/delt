# Themes

## How switching works
`src/app/use-look.ts` and `src/app/appearance.tsx` write attributes on `<html>`, saved in
`localStorage["delt-prefs"]`:
- `data-look`: `minimal` | `glyph` | `grid`
- `data-theme`: `light` | `dark` (Grid forces dark)
- `data-tone="black"`: Extra dark (pure black)
- `data-accent`: accent colour (Grid calls these driver colours)
- `data-size="large"`, `data-density="compact"`

Cascade order (`src/app/app.css`): `base.css` → `look-shared.css` → `look-minimal.css` →
`look-glyph.css` → `themes.css` → `look-grid.css`.

## Shared tokens (CSS custom properties)
`--bg`, `--surface`, `--surface2`, `--text`, `--muted`, `--line`, `--accent`, `--on-accent`,
`--due-soon`, `--due-week`, `--font`, `--head`, `--ease`. Minimal and Grid add `--ink` (r g b),
`--floor` (lowest readable alpha for small text) and `--floor-lg` (24px+).
Contrast of every pile in every theme is computed in `tests/contrast.test.ts`.

## Minimal
Swiss style. IBM Plex Sans; importance shown by ink, size and weight; one red accent; square corners.
Tokens: `look-shared.css` (top) and `look-minimal.css`.

## Glyph
Playful cards with thick outlines and offset shadows, Space Grotesk, Doto dot-matrix for page titles and dates.
Tokens: top of `look-glyph.css`.

## Grid (F1)
Tokens: top of `look-grid.css`.
- Palette now: carbon `#15151e`, panel `#1f1f27`, panel 2 `#2b2b35`, line `#38383f`, grey `#a3a3a8`,
  red `#e10600`; flags red `#ff3b30`, yellow `#ffd200`, green `#00d26a`, blue `#3d8bff` for the four piles.
- Type: Saira at 125% width for display headlines and timing figures, with regular-width
  Saira for mail. Caveat adds a handwritten accent to the overview title.
- Shape: square panels with a 10px rounded top-right corner (`--corner`).
- Motion: `--f1` expo-out; the first eight inbox rows get a band, wipe and rise once per
  local day. Reduced-motion users get the rows immediately.
- Driver colours: papaya, teal, navy, racing, sky, pink, gold.
- The supplied broadcast intro informed the contrast between handwritten details,
  heavy capitals and open title-card spacing. Inbox rows keep their timing layout and
  spell out the priority so the stripe colour is only one cue.
