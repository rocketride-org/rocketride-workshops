# Workshop feedback: obvious, timely, small

Date: 2026-11-10 · Status: approved, implemented

## Goal

Make it impossible to miss that we want feedback after the Zero to Agent workshop, without feedback boxes taking up guide content. Feedback form: `https://bit.ly/4zwo6GB` (500 free tokens for everyone who fills it out).

Principle: a tiny always-there handle, plus a big ask only at the moment it's earned (the end of the hour), plus time reserved for it in the room.

## Components

### 1. `assets/feedback.js` (new, shared)

One purpose: everything feedback. Loaded by the hub and every guide, after `codelab.js`/`signup.js`.

- Holds the only copy of the form URL (`FEEDBACK_URL`) and the QR image path.
- **Header pill**: injects `<a class="fb-pill">` into `.bar-in` on every page (guides: before `#meta`; hub: before `nav`). Text `🎁 500 free tokens · Feedback`; at ≤640px `🎁 Feedback`. Opens the form in a new tab directly (no dialog). Green (`--ok`) so it reads as distinct from the orange brand accent.
- **Completion dialog** (`<dialog class="signup fb-done">`, reusing the sign-up modal's styles):
  - Heading "You built 3 apps in an hour 🎉", line "Claim your 500 free tokens: 2-minute feedback."
  - Primary button **Give feedback →** (new tab) and a "Not now" text button.
  - **QR code** of the form URL beside the button (stacked under it on phones), captioned "On your phone? Scan this." Static SVG at `images/feedback-qr.svg` (see QR below); if the image fails to load it's hidden and the button remains.
  - **Confetti** burst when the dialog opens: self-written, no dependency. A full-viewport `<canvas>` above the backdrop, ~120 particles in brand colors (accent, ok, info, warn), gravity + drift, ~2.5s then removed. Skipped entirely under `prefers-reduced-motion: reduce`. `pointer-events:none`.
  - Closes on Esc, ×, "Not now", or click outside. Opening the form also closes it.
  - Shown at most once per browser: `localStorage['rr.feedback.prompted.v1'] = '1'` (try/catch; if storage is blocked it may show again — acceptable).
  - API: `window.rrFeedback.celebrate()` opens it (respecting the once flag); `{force:true}` ignores the flag.

### 2. Trigger: end of Specter only

- `codelab.js`: on the last build step, when `<body>` has **no** `data-next`, the pager shows a **Finish 🎉** button. Clicking it marks the step done and dispatches `document` event `rr:finished`. Ticking the last build step's checkpoint also dispatches `rr:finished`.
- `modules/specter-mutual/index.html`: remove `data-next`/`data-next-title` from `<body>`, add `data-feedback-finale`.
- `feedback.js`: on `rr:finished`, if `body[data-feedback-finale]`, call `celebrate()`.
- Kanban and Excalidraw keep their `data-next` links to the next project; they never fire the dialog.

### 3. Hub that changes with progress

- `feedback.js` on the hub reads `localStorage` keys `rr.zero-to-agent.<module>.v1` for the live workshop's modules (from `window.WORKSHOPS`); "has progress" = any key whose `done` is non-empty.
- No progress: no feedback banner (pill only); sign-up stays primary; sign-up modal auto-opens on first visit as today.
- Has progress: insert a prominent banner above `#workshops` — "🎁 Claim 500 free tokens: tell us how the workshop went" + **Give feedback →** (+ QR thumbnail on wide screens); the workshop's sign-up button switches to the ghost style; skip the auto-open sign-up modal.

### 4. Removals

- Inline `.feedback` boxes: end of Kanban Step 5, end of Specter Step 8, bottom of hub.
- Specter Step 8 keeps a one-line celebration note above the checkpoint; final checkpoint text no longer mentions feedback (the dialog does).
- `.feedback` CSS stays (reused by the hub's progress banner).

### 5. Time in the room

- Specter 35 → 32 min: Step 4 (claims) 10 → 8, Step 7 (Claude screens) 9 → 8. Update its schedule table (end row "0:32 · Done") and README/FACILITATOR.
- Hub: `workshops.js` Specter `duration: 32`; workshop chip reads "57 min + 3 min feedback" (add `feedbackMinutes: 3` to the workshop and render it).
- Specter FACILITATOR run-of-show + Kanban/Excalidraw FACILITATOR overview: **0:57 · Feedback (3 min)** — put `images/feedback-qr.svg` on the projector, ask everyone to fill it in before leaving; the dialog shows the same QR on their screens.

## QR code

Static file `images/feedback-qr.svg`, supplied by the user (star-shaped modules with the RocketRide mark), encoding the form URL. Used by the completion dialog, the hub banner (72px, hidden ≤640px) and the facilitator's projector slide. If it fails to load, it's removed and the button remains.

## Testing

Headless Chrome (playwright-core + local Chrome), served via `python -m http.server`:
- Pill present on hub + 3 guides, desktop and 390px (no horizontal scroll).
- Specter: last step shows **Finish 🎉**; clicking it opens the dialog once, sets the flag; reload + Finish does not reopen; ticking the last checkpoint also triggers (fresh storage).
- Kanban/Excalidraw last step still links to the next project; no dialog.
- Dialog: QR image loads, button href is the form URL, Esc/Not now close; confetti canvas appears and is removed; with `reducedMotion: 'reduce'` no canvas.
- Hub: empty storage → no banner, sign-up primary, modal auto-opens; seeded progress → banner above projects, sign-up ghost, no auto modal.
- No page errors; `node scripts/validate.mjs` unchanged (only the pre-existing `alarm-clock` problems).
