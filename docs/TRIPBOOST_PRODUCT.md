# TripBoost — Product brief

## Vision
TripBoost is a global travel-opportunity radar. The traveller does not have to choose a destination first: the map reveals where it may be unusually attractive to travel now or soon.

## Core experience
1. Enter origin, departure window, return window (optional), travellers and currency.
2. Search multiple destinations and connected sources concurrently.
3. Normalize and compare offers by total price, currency, route, travel dates, cabin, baggage, stops and party size.
4. Plot only real provider results on the world map. Demonstration pins must remain visibly marked as examples.
5. Show source, airline/provider, checked-at time, terms and a direct supplier link when the source supplies one.
6. Send the traveller to the supplier. TripBoost does not issue tickets, take payment or manage bookings.

## What counts as an exceptional deal
A low observed fare is not automatically a promotion. An offer can be labelled exceptional only when a trusted historical baseline exists with at least five observations and a matching comparison key, currency and comparable conditions. Until then it is a live fare with “Baisse non confirmée”.

## Technical direction
- Keep the existing static/PWA front-end and Node.js API; do not restart the repository.
- Provider adapters are independent and interchangeable.
- The discovery endpoint fans out destination searches with Promise.allSettled so one source or destination failure does not suppress other results.
- Keep API secrets server-side.
- Do not scrape protected pages, bypass access controls, fabricate prices or claim unconnected sources are live.
- Keep currencies separate unless a dated and trusted FX source is integrated.
- Cache and historical-price storage must respect each provider's terms.

## Current implementation boundary
The first TripBoost evolution adds a map-first interface, a parallel multi-destination API endpoint and evidence-based deal classification. Amadeus is the only working provider adapter inherited from TripRadar. Other source connectors, historical baseline storage, exact supplier deep links and live map inventory remain future implementation work and are not claimed as completed.
