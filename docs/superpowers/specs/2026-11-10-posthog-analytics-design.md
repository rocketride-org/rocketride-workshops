# PostHog analytics on the workshop site

Date: 2026-11-10 · Status: implemented

## Goal

See the Zero to Agent workshop as a funnel: who lands on the hub, opens each guide, completes each step, finishes, and clicks feedback or sign-up. Watch replays of where people get stuck.

PostHog project: "Default project" (id 726428), US cloud.

## Components

### `assets/analytics.js` (new, shared)

The only file that talks to PostHog, and the only copy of the project token. It's loaded in `<head>` on the hub and every guide, before the other scripts.

- PostHog's HTML snippet, unmodified, with `posthog.init(token, { api_host: 'https://us.i.posthog.com', defaults: '2026-08-30', person_profiles: 'identified_only' })`. Pageviews, autocapture and session replay come from the SDK. Replay is on in the project and masks all inputs.
- **Off locally:** does nothing on `file:`, `localhost`, `127.0.0.1` or `[::1]` unless the URL has `?posthog=1`.
- **Who and when:** each visitor is an anonymous PostHog id kept in their browser, and PostHog splits their activity into sessions itself (a new one after 30 minutes idle). Every event also carries `workshop_session`, built from the visitor's local date on each page load in the form `<mon>_<DD>_<YY>_workshop`, for example `nov_10_26_workshop`. Use it to filter or break down by event day.
- **Project settings:** the authorized URL is `https://rocketride-org.github.io/rocketride-workshops/`. Heatmaps are on. Replay and heatmaps record only on `https://rocketride-org.github.io` (`recording_domains`), so local test runs don't record.
- **Super properties:** guides get `page_kind: 'guide'` plus `workshop` and `module`, split from `<body data-key="<workshop>.<module>">`. The hub gets `page_kind: 'hub'`.
- **Events:** the other scripts dispatch DOM events and never call PostHog themselves.

| PostHog event | Source | Properties |
| --- | --- | --- |
| `workshop step completed` | `rr:step-done` from `codelab.js`, when a build step is newly marked done | `step` (1-based), `step_title`, `steps_total`, `via` (`next` or `checkpoint`) |
| `workshop finished` | `rr:finished` from `codelab.js` | Counted at most once per page load |
| `signup modal opened` | `rr:signup-open` from `signup.js` | `trigger` (`auto` or `click`) |
| `signup link clicked` | Click on the modal's **Sign up →** | none |
| `promo code copied` | Click on the promo code's **Copy** | none |
| `feedback opened` | Click on `.fb-pill`, `.fb-go` or the hub banner link | `placement` (`pill`, `finish dialog` or `hub banner`) |

### Changes to existing scripts

- `codelab.js`: a new `stepDone(i, via)` dispatches `rr:step-done`. It fires from `complete()` only when the step wasn't already done, and when a checkpoint gets ticked.
- `signup.js`: `open(auto)` dispatches `rr:signup-open`. The first-visit pop-up calls `open(true)`.

## Testing

Headless Chrome (playwright-core and local Chrome), with the site served by `python -m http.server` and every `*.posthog.com` request aborted. Assertions run against the snippet stub's queued calls:

- Localhost without `?posthog=1`: no `window.posthog` and no requests.
- Hub: init uses the token and US host. `page_kind: hub` is registered. The auto sign-up modal, the sign-up link, the promo copy and the pill each capture their event.
- Kanban: `module: kanban` is registered. Next, then Back, then Next gives exactly one `workshop step completed` (step 1, via `next`).
- Specter: ticking the last checkpoint and then clicking Finish gives one `workshop finished` and a step event via `checkpoint`. The dialog's feedback button captures `placement: finish dialog`.
- No page errors. `node scripts/validate.mjs` reports only the existing `alarm-clock` problems.
