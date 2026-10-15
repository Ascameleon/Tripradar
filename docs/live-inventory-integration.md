# TripRadar — Live inventory integration plan

## Decision

Keep the current static application as a lightweight, zero-infrastructure prototype. Do not add fake API responses or put provider credentials in browser JavaScript. Live search requires a small server-side adapter because API secrets must remain private.

## Candidate provider path

- **Flights:** evaluate Amadeus Self-Service Flight Offers Search first for a narrow MVP; its official documentation describes itinerary search and price confirmation. Confirm account eligibility, production access, route coverage from Algeria, usage limits, and commercial terms before selecting it.
- **Alternative / combined flights and stays:** evaluate Duffel's Flights and Stays APIs if its commercial onboarding, inventory, and terms fit the product. Verify actual destination coverage and live-mode access before committing.
- **Hotels:** assess the chosen provider's hotel inventory separately. Do not assume a flight API's hotel endpoints provide broad or bookable coverage.

Official documentation:
- Amadeus flight API guide: https://developers.amadeus.com/self-service/category/flights
- Amadeus hotel API guide: https://developers.amadeus.com/self-service/category/hotels
- Duffel API documentation: https://duffel.com/docs

## Minimal architecture

1. Browser sends validated search criteria to a same-origin backend endpoint.
2. Backend validates IATA codes, dates, passenger count, currency, and budget; rejects invalid or excessive requests.
3. Provider adapter calls the supplier with server-held credentials and a strict timeout.
4. Normalize each offer into: provider, offer ID, origin/destination, segments, departure/arrival times with time zones, total price, currency, baggage, stops, provider deeplink, checked-at timestamp, and expiry if supplied.
5. Sort by comparable total price; never combine different currencies without a dated exchange-rate source.
6. Revalidate an offer with the supplier before redirecting to a booking flow. Search results are not a booking guarantee.
7. If a supplier fails or returns no offers, show a clear unavailable state; never silently fall back to invented prices.

## Required configuration (server only)

- Provider client ID / API key
- Provider client secret / access token
- API environment (test or production)
- Allowed origins and rate limits
- Optional exchange-rate source, only if cross-currency sorting is implemented

Do not commit real secrets. Add credentials only through the deployment platform's encrypted environment variables.

## Launch gates

- Confirm provider eligibility and production access.
- Confirm Algeria-origin route coverage and hotel inventory in target destinations.
- Confirm legal display requirements, attribution, caching restrictions, and affiliate/booking terms.
- Verify actual prices against provider responses and re-check timestamps/expiry.
- Add mocked adapter tests, schema validation tests, timeout/error tests, and end-to-end tests.
- Keep demonstration destinations visibly marked until live data is connected and validated.

## Current limitation

No supplier credentials or backend deployment are configured in this repository. Therefore live flight/hotel results cannot truthfully be enabled by a front-end-only change. The current external search links are a safe bridge while provider access is arranged.