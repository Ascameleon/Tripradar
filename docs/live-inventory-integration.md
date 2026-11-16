# TripBoost — live inventory integration

## Decision

Keep the current static application and small Node.js API as a zero-cost prototype. Do not add fake API responses, paid services or provider credentials to browser JavaScript. Live inventory requires approved supplier access and server-side secrets.

## Current verified backend

- Amadeus is the only supplier adapter connected in the current API. No live Skyscanner, KAYAK, Google Flights or Duffel connector is implemented.
- Flight and hotel endpoints validate input, enforce JSON content types, exact-origin CORS, bounded request sizes and request timeouts.
- The multi-destination endpoint fans out to at most nine destination codes with concurrency capped at two. It returns partial results when a destination fails.
- Global discovery is disabled by default. An operator must explicitly set `TRIPBOOST_DISCOVERY_ENABLED=true` after checking provider access, terms and potential costs.
- Current in-memory rate limits are 30 standard searches/minute/IP and one global discovery search/minute/IP. They are per process, not a distributed quota.
- No historical price database or comparable-price baseline is connected. A low live fare is therefore not labelled an exceptional promotion; it remains an unconfirmed decrease.
- No supplier credentials or production API deployment are configured in this repository. Successful CI tests do not establish live supplier access.

## Candidate provider path

- **Flights:** Amadeus Self-Service Flight Offers Search is the current adapter. Confirm account eligibility, production access, route coverage in selected international markets, usage limits and commercial terms before enabling live discovery.
- **Alternative flights and stays:** evaluate Duffel only after confirming onboarding, inventory and commercial terms.
- **Hotels:** assess hotel inventory separately. Do not assume that a flight API's hotel endpoints provide broad or bookable coverage.

Official documentation:
- Amadeus flights: https://developers.amadeus.com/self-service/category/flights
- Amadeus hotels: https://developers.amadeus.com/self-service/category/hotels
- Duffel: https://duffel.com/docs

## Target discovery architecture

1. Browser sends validated origin, destination codes, dates, passenger count and currency to the same-origin backend.
2. Backend validates IATA codes, dates, passenger count and currency; it rejects invalid or excessive requests.
3. Approved provider adapters call suppliers with server-held credentials and strict timeouts.
4. Normalize each offer into provider, offer ID, origin/destination, itinerary, departure/arrival times, total price, currency, stops, provider link and checked-at timestamp.
5. Sort only comparable prices; never combine currencies without a dated exchange-rate source.
6. Revalidate an offer with the supplier before redirecting. Search results are not a booking guarantee.
7. Apply request-size limits, content-type enforcement, per-client rate limits, strict timeouts and exact allowed-origin settings. Trust forwarded IP headers only behind a trusted proxy.
8. If a supplier fails or returns no offers, show an unavailable state; never fall back to invented prices.

## Required configuration (server only)

- Provider client ID and secret
- API environment (test or production)
- Exact allowed frontend origin
- Explicit discovery opt-in after provider terms/cost review
- Optional historical-price store and exchange-rate source, only when implemented and validated

Never commit real secrets. Add credentials only through encrypted deployment environment variables.

## Launch gates

- Confirm provider eligibility, production access and display rights.
- Verify actual inventory and fare coverage in the international markets selected for the product.
- Confirm attribution, caching restrictions, cancellation/fare conditions and deeplink terms.
- Store timestamped comparable observations before calling any fare an exceptional drop.
- Add mocked adapter tests, schema validation, timeout/error tests and end-to-end tests.
- Keep illustrative map markers clearly labelled until live data is connected and validated.
