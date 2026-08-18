# Product analytics

TaQuanto uses PostHog for anonymous page and product analytics. The browser SDK
is loaded only when a valid production project token is configured. Autocapture
and session recording are disabled, and person profiles are never created.

## Events

| Event                      | When                                          | Properties                                                               |
| -------------------------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| `$pageview`                | Initial load and every browser history change | PostHog page properties, including `$pathname`                           |
| `landing_cta_clicked`      | A landing-page call to action is selected     | `cta`, `destination`                                                     |
| `product_search_submitted` | A valid, non-duplicate product search starts  | `query`, `query_type`, `days`, `location_mode`, `municipality`, `radius` |
| `fuel_search_submitted`    | A valid, non-duplicate fuel search starts     | `fuel`, `fuel_id`, `days`, `location_mode`, `municipality`, `radius`     |

Coordinates are deliberately excluded. `municipality` is omitted for nearby
searches, while `radius` is omitted for municipality searches. Product queries
are normalized to lowercase so equivalent searches share the same breakdown.

## Suggested dashboard

Create a dashboard named **TaQuanto — uso do produto** with these insights:

1. **Páginas mais acessadas** — Trends, `$pageview`, total events, breakdown by
   `$pathname`.
2. **CTA mais clicado na landing** — Trends, `landing_cta_clicked`, total
   events, breakdown by `cta`.
3. **Produtos mais pesquisados** — Trends, `product_search_submitted`, total
   events, breakdown by `query`.
4. **Combustíveis mais pesquisados** — Trends, `fuel_search_submitted`, total
   events, breakdown by `fuel`.
5. **Como as pessoas pesquisam** — Trends containing both search events,
   breakdown by `location_mode`; duplicate the insight for `municipality` and
   `days` when regional or period comparisons are needed.
6. **Landing para pesquisa** — Funnel from `landing_cta_clicked` to either
   search event, within one day.

Use total event counts for popularity rankings. Use unique users only for reach;
the application is public and intentionally does not identify visitors.
