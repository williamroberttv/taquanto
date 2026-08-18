# Product analytics

TaQuanto uses PostHog for anonymous page and product analytics. The browser SDK
is loaded only when a valid production project token is configured. Autocapture
and session recording are enabled, all replayed inputs are masked, and person
profiles are never created.

## Events

| Event                   | When                                             | Properties                                                                                                 |
| ----------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `$pageview`             | Initial load and every browser history change    | PostHog page properties, including `$pathname`                                                             |
| `search_submitted`      | A valid, non-duplicate search starts             | `search_type`, `query`, `query_type`, `fuel`, `fuel_id`, `days`, `location_mode`, `municipality`, `radius` |
| `search_results_loaded` | The first usable response for the search arrives | `search_type`, `fuel_id`, `result_count`, `days`, `location_mode`, `municipality`, `radius`                |
| `result_detail_opened`  | A result detail is opened                        | `search_type`                                                                                              |
| `favorite_added`        | A result is saved locally                        | `search_type`                                                                                              |
| `favorite_removed`      | A saved result is removed                        | `search_type` when the originating search is known                                                         |

Product-only and fuel-only properties are omitted from the other search type.
Coordinates are deliberately excluded. `municipality` is omitted for nearby
searches, while `radius` is omitted for municipality searches. Product queries
are trimmed and normalized to lowercase.

Autocapture covers ordinary clicks, `$pageview` covers Angular history changes,
and Session Replay keeps all input contents masked.

## Suggested dashboard

Create a dashboard named **TaQuanto — uso do produto** with at most these five insights:

1. **Uso** — `$pageview`, unique users and breakdown by `$pathname`.
2. **Pesquisas** — `search_submitted`, total events and breakdown by `search_type`.
3. **Demanda** — `search_submitted`, breakdown by `query` for products or `fuel`/`fuel_id` for fuels.
4. **Conversão** — funnel `$pageview` → `search_submitted` → `search_results_loaded` → `result_detail_opened` → `favorite_added`.
5. **Região e proximidade** — `search_submitted`, breakdown by `municipality` and `location_mode`.

Use `search_results_loaded` with `result_count = 0` for searches without results.
Use total event counts for popularity rankings and unique users only for reach;
the application is public and intentionally does not identify visitors.
