# TripBoost — adaptation of Sellbird/Harvey agent patterns

Status: architecture proposal for the existing TripRadar repository (the product is being positioned as TripBoost).
Scope: reuse proven architectural ideas, not Sellbird source code.

## Decision

Do not embed or fork Sellbird into TripBoost. Sellbird is an autonomous B2B cold-outreach product; TripBoost is a consumer flight-and-hotel comparison product. Its email prospecting, contact enrichment, mailbox sending, LinkedIn outreach and sales pipeline are not product features we need.

Adopt only the transferable patterns:
- a small heartbeat/scheduler that makes deterministic decisions before calling an LLM;
- narrowly scoped specialist agents;
- editable Markdown skills and prompts;
- persistent observations and price history as the durable asset;
- explicit budgets, human approval and a kill switch;
- extensions that add features without patching the core application.

Sellbird's current repository is AGPL-3.0. This document describes a clean-room adaptation of architectural concepts; it does not copy Sellbird code. Any future code reuse or dependency must receive a separate licence review first.

## Fit with the current TripRadar codebase

The current app is a dependency-free Node.js 20+ PWA with a small HTTP API. The API already validates flight/hotel searches and calls Amadeus server-side; the browser must never receive provider credentials. The app supports optional live Amadeus search and explicitly labels demo catalogue prices as fictional.

Keep that architecture. Do not add Python, Docker-only requirements, a paid model API, a paid search provider, email outreach, or a second dashboard just to imitate Sellbird.

## Proposed TripBoost agent responsibilities

1. **Deal Scout (deterministic first):** inspect saved searches and verified supplier responses; normalize currency, dates, passenger count and total price; reject incomplete or stale offers.
2. **Price Analyst (model optional):** explain why a verified fare is unusual only when sufficient historical observations exist. Never invent a baseline or claim a discount without evidence.
3. **Trip Planner:** compare verified flight + hotel combinations using the user's dates, occupancy and budget. Clearly mark partial totals and excluded fees.
4. **Alert Manager:** prepare price-drop or availability alerts for searches the user explicitly saved. Notifications remain opt-in and can be paused globally.
5. **Quality Reviewer (deterministic):** block alerts when provider data is missing, expired, mismatched in currency/occupancy, or based on demo data.

The first release should work without an LLM. If a model is later added, use the user's existing eligible subscription through an explicitly configured local CLI integration; otherwise keep the feature disabled. Never silently fall back to a paid API.

## Heartbeat model

Run a bounded server-side cycle only when a persistent store and a verified live provider are configured:

```
wake -> check pause/budget -> load due saved searches
     -> refresh through existing provider adapter
     -> validate and normalize -> compare with stored observations
     -> queue candidate alert -> log outcome -> sleep
```

- Start with a conservative interval (for example, 6 hours); do not poll continuously.
- Deduplicate by saved-search ID, offer identity and observation timestamp.
- Apply per-user and global request caps; respect provider rate limits and terms.
- A failed provider call is recorded as an error, never as “no deals found”.
- No background monitoring when only the static PWA is deployed; show that alerts require the API service to be running.

## Data model to introduce only with the implementation

- `saved_searches`: origin, destination/region, date window, return date, adults, rooms, budget, currency, enabled, created_at.
- `offer_observations`: provider, provider offer ID, search ID, price, currency, itinerary/stay dates, occupancy, checked_at, expires_at.
- `alert_queue`: search ID, observation ID, reason, status (pending/approved/sent/suppressed), created_at.
- `agent_runs`: run ID, started_at, finished_at, status, requests_used, error_code.

Store only what is necessary. Never store provider secrets in browser storage or expose them in API responses.

## Approval and safety rules

- Price alerts are opt-in per saved search.
- No booking, payment, purchase, email campaign or external message is sent automatically.
- A notification must link to a fresh supplier search; it is not a reservation guarantee.
- Include checked-at time, provider, currency, occupancy and exclusions.
- Global pause switch stops all scheduled checks and queued alerts.
- A deterministic gate suppresses demo prices, expired offers, currency mismatches and incomplete totals.
- Log decisions in plain language so an empty result can be distinguished from an API outage.

## Delivery sequence

1. **Read-only foundation:** inspect current front-end state and API provider response shape; document exact offer identity and expiry semantics.
2. **Persistence:** add a minimal storage adapter and migrations only after selecting the deployment target. Keep the current no-dependency local development path where possible.
3. **Saved searches:** persist explicit user searches and expose create/list/delete/pause endpoints.
4. **Price observations:** refresh only via the existing Amadeus adapter; store normalized observations and enforce request budgets.
5. **Alerts:** add opt-in alert queue and visible approval/disable controls; no outbound email dependency in MVP.
6. **Agent layer:** add deterministic Scout/Reviewer first. Add an LLM analyst only if it materially improves explanations and can run within the user's existing subscription.
7. **Verification:** tests for no fabricated prices, no demo-price alerts, stale-offer suppression, currency/occupancy matching, deduplication, pause switch, budget caps, provider outage reporting, and secret isolation.

## Acceptance criteria

- Existing flight and hotel search flows remain intact.
- Existing tests continue to pass.
- No price is described as live unless it came from a successful supplier response.
- No paid API or subscription is introduced by default.
- No booking or message is sent without an explicit user action.
- Agent runs are bounded, observable and stoppable.
- Mobile PWA remains usable without the agent service.

## Source reviewed

- Sellbird (formerly Harvey): https://github.com/ethanplusai/sellbird
- Sellbird architecture: `docs/how-it-works.md`, `docs/extensions.md`, `docs/skills-and-agents.md`
- Existing project: https://github.com/Ascameleon/Tripradar
