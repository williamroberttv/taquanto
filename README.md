# TáQuanto Frontend

TáQuanto is a public price-consultation frontend for Alagoas. It presents product-price information from the TáQuanto API, which is the separate backend responsible for integrating with the official Economiza Alagoas/SEFAZ-AL API.

This repository must not call SEFAZ directly and must not expose SEFAZ credentials in browser code.

## Current State

- Angular 22 frontend with SSR/prerender configured.
- Public landing page at `/`, prerendered at build time.
- Client-rendered public product search at `/buscar`, connected to the TáQuanto API.
- Leaflet is dynamically imported after browser render for the landing map preview.
- Tailwind CSS and daisyUI are configured through `src/styles.css` with custom TáQuanto light and dark themes.
- Unit tests run through Angular's unit-test builder with Vitest installed.
- Production deploy publishes the static Angular build to S3 and serves it through CloudFront.

Not implemented yet: authentication, saved searches, alerts, consumer pages, and personalized history.

## Architecture Rules

- Only the public landing page is prerendered for a fast, indexable first load; search and future application routes render as SPA views.
- Authenticated pages should behave as SPA views after login is available.
- The frontend talks to API TáQuanto, never directly to Economiza Alagoas/SEFAZ-AL.
- Basic product search must stay public; login is only for future personal features.
- Map coordinates are optional. If the API does not provide coordinates, show textual location and do not invent map points.
- Prices are historical NFC-e sale records, not guaranteed offers or promotions.

## Design Direction

The UI follows `DESIGN.md`, the Clerk-inspired design notes currently used for this project: white and cool gray surfaces, polished embedded-product feel, restrained purple primary actions, Inter typography, compact cards, clear focus states, and WCAG AA contrast.

TáQuanto-specific content should stay grounded in price discovery: product, value, establishment, location, and sale recency. Avoid marketing copy that implies discounts, offers, or official SEFAZ ownership.

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

## Production Deploy

Pushes to `main` deploy `dist/taquanto/browser` through GitHub Actions. The
`production` environment must define these variables:

- `AWS_REGION`
- `AWS_DEPLOY_ROLE_ARN`
- `S3_BUCKET`
- `CLOUDFRONT_DISTRIBUTION_ID`

The workflow authenticates with AWS through GitHub OIDC, synchronizes the build
with S3, removes stale files, and waits for the CloudFront invalidation to
complete. CloudFront is responsible for routing `/api/*` to the TáQuanto API and
falling back to `index.csr.html` for client-rendered routes.

## Optional Production Container

The existing Nginx image remains available for local or manual deployments:

```bash
docker build -f ci/prod/Dockerfile -t taquanto-frontend .
docker run --rm -p 8080:80 taquanto-frontend
```
