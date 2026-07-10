# TaQuanto Frontend

TaQuanto is a public price-consultation frontend for Alagoas. It presents product-price information from the TaQuanto API, which is the separate backend responsible for integrating with the official Economiza Alagoas/SEFAZ-AL API.

This repository must not call SEFAZ directly and must not expose SEFAZ credentials in browser code.

## Current State

- Angular 22 frontend with SSR/prerender configured.
- Public landing page at `/`.
- Static preview content only; real search is not connected yet.
- Leaflet is dynamically imported after browser render for the landing map preview.
- Tailwind CSS is available through `src/styles.css`.
- Unit tests run through Angular's unit-test builder with Vitest installed.
- Production Docker image builds the Angular app and runs the SSR server on port `4000`.

Not implemented yet: TaQuanto API integration, product search route, authentication, saved searches, alerts, consumer pages, and personalized history.

## Architecture Rules

- Public pages use SSR/prerender for fast first load and shareable/indexable content.
- Authenticated pages should behave as SPA views after login is available.
- The frontend talks to API TaQuanto, never directly to Economiza Alagoas/SEFAZ-AL.
- Basic product search must stay public; login is only for future personal features.
- Map coordinates are optional. If the API does not provide coordinates, show textual location and do not invent map points.
- Prices are historical NFC-e sale records, not guaranteed offers or promotions.

## Design Direction

The UI follows `DESIGN.md`, the Clerk-inspired design notes currently used for this project: white and cool gray surfaces, polished embedded-product feel, restrained purple primary actions, Inter typography, compact cards, clear focus states, and WCAG AA contrast.

TaQuanto-specific content should stay grounded in price discovery: product, value, establishment, location, and sale recency. Avoid marketing copy that implies discounts, offers, or official SEFAZ ownership.

## Development

```bash
npm install
npm start
```

Open `http://localhost:4200/`.

## Build

```bash
npm run build
```

## Tests

```bash
npm test
```

## Production Container

```bash
docker build -f ci/prod/Dockerfile -t taquanto-frontend .
docker run --rm -p 4000:4000 taquanto-frontend
```

Angular SSR validates the request host. For a real domain, pass the allowed host explicitly:

```bash
docker run --rm -p 4000:4000 -e NG_ALLOWED_HOSTS=taquanto.com.br taquanto-frontend
```

Use a comma-separated list for multiple domains. Do not use `*` unless another trusted layer validates `Host` and `X-Forwarded-Host`.
