# How it works

Short notes on what runs under the hood. Newest first.

## Laptop "Today" overview (A05)
- **Data:** no new fetches. It reuses what the inbox already has: `counts.all.unread`, `needsYou(all, now)` (unread urgent or soon-due mail, soonest first) and the deadline buckets (Overdue, Today, Tomorrow, This week…).
- **Next deadline:** the first mail across the buckets in order, skipping Done.
- **Path:** `inbox-app.tsx` renders `<Overview>` when the screen is wide and no mail is open; each item calls the same `openMail` the list uses, so focus, read state and Back behave the same.
- **Why not auto-open the first mail:** opening marks it read; the student should choose that.

## Why the loading bars were tiny (A09)
- Minimal and Grid lay rows out on a CSS grid: a fixed first column (time or position, 28–52px) and the text. Placeholder rows have no time or position element, so the text block fell into the narrow first column. A single column for `.skeleton .row-main` fixes it.

## Smooth screen changes (#77)
- **Problem:** a View Transition snapshots the page, then React must render synchronously inside its callback; nothing moves until that finishes.
- **Logic:** `useRoute` (`src/app/use-screen.ts`) compares the old and new route. Opening a mail or switching tabs uses React's `startTransition`, which renders in small chunks and yields to the browser between them. Only closing a mail uses the snapshot slide-out.
- **Motion:** the mail panel animates itself with a CSS `transform` animation. Transform and opacity run on the GPU compositor, so the main thread can stay busy without dropping frames.
- **Deferral:** the mail's iframe (a whole document to parse and lay out) mounts 300ms later, after the slide.
- **Why:** measured with Chrome's long-animation-frame API at 4x CPU slowdown; the worst frames halved.

## Timing tower and F1 entrance (#74, #75)
- **Data:** each row gets `data-pos` (its place in the sorted list) and `--i = min(pos, 14)`.
- **Gap:** `gapText(receivedAt, now, pos === 1)` (`src/lib/inbox.ts`): P1 is LEADER; the others show `now - receivedAt` as +M / +H / +D.
- **Entrance:** three CSS keyframes per row, each delayed by `--i × 35ms`: a coloured band translates across (`f1-sweep`), the panel's `clip-path` opens left to right (`f1-wipe`), and the text moves up while a matching `clip-path` hides what's below its final box (`f1-rise`), so it looks masked.
- **Play once:** `html.settled` is added 1.6s after the first mail shows; the rules only match `:not(.settled)`.

## Attachments (#72)
- **Model:** Gmail returns the mail as a tree of MIME parts. `listAttachments` walks it and keeps parts with a filename, or images with a `Content-ID`. Each is keyed by `partId` ("1.2"), because Gmail's `attachmentId` changes on every fetch.
- **Path:** the browser asks `/api/emails/:id/attachments/:part`. The route checks you own the mail, refetches the message, finds the part, downloads its bytes from Gmail (base64url), and streams them with safe headers.
- **Inline pictures:** `inlineCids` rewrites `src="cid:x"` in the mail's HTML to that route, and the frame's CSP allows the app's own origin.
- **Why not store files:** privacy; mail is read live and never saved.

## Dark mail (#71)
- **Algorithm:** read every element's computed colours in one pass, then write changes in a second pass (reading after each write would force a restyle each time).
- **Backgrounds:** convert to HSL. A light one becomes a dark tint near the page colour (white becomes exactly the page); a dark one stays.
- **Text:** take the background it actually sits on (nearest ancestor with a background). If contrast is under 4.5:1, mirror the lightness for dark text, then raise it in 2% steps until it passes. Hue is kept.
- **Code:** `src/app/mail-dark.ts`, called from `mail-frame.tsx` when the frame loads.
- **Why not invert:** inversion turned grey text into dark grey on black and flipped dark mails white.
