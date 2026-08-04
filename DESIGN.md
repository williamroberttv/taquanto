---
name: TaQuanto
status: implemented
description: 'A trustworthy, approachable public-price interface for Alagoas. Clean neutral surfaces and a restrained violet accent keep dense sale data readable, while the elephant mascot gives the product a recognizable local personality.'
---

# TaQuanto design system

This document is the visual and interaction source of truth. It describes the design implemented by the custom daisyUI themes in `src/styles.css` and the feature styles beside each Angular component.

## Product principles

1. **Evidence before promotion.** Lead with the sale value, establishment, date, and location. Never style a historical record like a guaranteed offer.
2. **Useful without an account.** Search, recent searches, favorites, and theme selection work in the browser without sign-up friction.
3. **Alagoas is the context.** Municipality selection, optional consent-based proximity, and maps make geography understandable without implying visitor tracking.
4. **Quiet structure, memorable brand.** Neutral cards hold dense information; violet actions and the elephant mascot provide recognition.
5. **Accessible by default.** Semantic HTML, keyboard operation, readable contrast, and reduced motion are part of every component definition.

## Foundations

### Color

| Token   | Light     | Dark      | Use                                               |
| ------- | --------- | --------- | ------------------------------------------------- |
| Canvas  | `#ffffff` | `#0f1115` | Page background                                   |
| Surface | `#f7f7f8` | `#171a21` | Grouped sections and secondary panels             |
| Card    | `#ffffff` | `#14171d` | Results, dialogs, and primary content             |
| Ink     | `#131316` | `#f4f5f7` | Primary text                                      |
| Muted   | `#6b6d7a` | `#b4bac7` | Supporting text                                   |
| Border  | `#e0e0e5` | `#343946` | Dividers and field boundaries                     |
| Primary | `#6c47ff` | `#8c72ff` | Actions, focus, active states, and price emphasis |
| Success | `#17855d` | `#54d8a2` | Confirmed positive state                          |
| Warning | `#8a5a00` | `#ffd166` | Validation and caution                            |
| Error   | `#b42318` | `#ff8a80` | Failures that require attention                   |

Do not lighten muted text or primary actions without checking WCAG AA contrast in both themes. Color must never be the only carrier of meaning.

### Typography

- Primary family: Inter.
- Fallback: Roboto, then `sans-serif`.
- Display headings: bold, tight line height and tracking, responsive rather than fixed.
- Body: 1rem or larger for primary reading, with approximately 1.6–1.75 line height.
- Metadata: compact but never below a readable 0.75rem.
- Prices: bold and primary-colored, paired with the unit when one exists.

### Spacing and shape

- Base spacing unit: 4 px; common steps are 8, 12, 16, 24, 32, 48, and 64 px.
- Main content width: `max-w-6xl`.
- Field and card radius: 8 px by default.
- Pill radius is reserved for compact status and chip patterns.
- Cards use restrained borders or low-elevation shadows; hierarchy comes from spacing before decoration.
- Interactive targets must be at least 44 × 44 px.

## Themes

The light theme is the deterministic prerender default. In a browser, the saved `taquanto-theme` value takes priority; otherwise the operating-system preference selects light or dark. The selected theme is applied through `data-theme` on the document root.

Both themes must preserve the same hierarchy and semantics. Dark mode is not a color inversion and must use its documented tokens.

## Layout

- Start mobile-first with one readable column.
- At wider breakpoints, results expand from one to two, three, and four columns.
- Search filters keep the product or fuel input, location controls, period, and submit action together.
- Page headings and explanatory copy use narrower reading widths inside the main grid.
- Header navigation remains sticky; mobile navigation uses a native `<details>` disclosure.
- Dialogs fit the viewport and keep their close action easy to reach.

## Core patterns

### Header

Contains the TaQuanto wordmark, primary navigation, mobile disclosure, and theme toggle. The home link has an explicit accessible name. Navigation labels remain short and task-oriented.

### Landing page

Uses a direct product statement, clear calls to product and fuel searches, source context, a three-step explanation, local browser features, and illustrative mascot assets. The sales and map content here is a labeled preview, not live data.

Static images use Angular's `NgOptimizedImage`. Meaningful images have descriptive Portuguese alternative text; decorative elements are hidden from assistive technology.

### Search filters

The product-search journey is ordered as:

1. Enter a product description or GTIN.
2. Select a supported period.
3. Select a municipality or enable nearby search and choose a radius.
4. Submit explicitly.

Fuel search replaces the text query with one of the six source-defined categories and otherwise reuses the same location, period, result, and cache patterns.

Fields use visible labels or a screen-reader label, helper text, native input constraints, and an adjacent action. Validation is specific enough to recover from the error.

### Municipality and proximity controls

The municipality control is a searchable native disclosure containing every Alagoas municipality and its IBGE code. Filtering ignores case and accents, returns focus to the trigger after selection, and exposes listbox semantics.

Nearby search is an explicit alternative to municipality selection. Before requesting browser geolocation, a native dialog explains that coordinates are sent to the API and not stored. Radius choices are 5, 10, and 15 km; permission or geolocation failures are announced next to the filters.

### Sale record cards

The information hierarchy is value, product, establishment, address, sale time, then actions. Cards must:

- use “registro de venda” language;
- show missing data explicitly instead of inventing it;
- expose favorite state with `aria-pressed`;
- keep details and favorite actions keyboard reachable;
- avoid implying that the value is still available.

### Dialogs and maps

Use native `<dialog>` through daisyUI's modal styling. A visible close button and backdrop close action are both provided. Result and detail map markers appear only for valid source coordinates. Result maps state how many records could be positioned and show the selected radius for nearby searches.

Leaflet is imported only in the browser and only when a map is needed. OpenStreetMap attribution remains visible.

### Recent searches and favorites

Recent product searches use a compact list that shows query, municipality or nearby radius, and period. Precise coordinates are never stored. Favorites preserve the sale snapshot rather than representing a live product. Empty states explain the next useful action.

### Feedback states

- Loading: skeleton cards plus a polite screen-reader status.
- Empty: plain explanation tied to the active filters.
- Cache refresh: a polite inline status that does not hide usable stale data.
- Validation: inline warning close to the form.
- Terminal failure: alert or toast with a retry-oriented message.
- Disabled: visual state plus native `disabled`.

## Accessibility contract

Every change must continue to meet WCAG AA and pass automated AXE checks.

- Use semantic landmarks and one descriptive `h1` per page.
- Associate inputs with labels and group related controls under headings.
- Preserve a visible 2 px primary focus outline with 2 px offset.
- Do not create pointer-only actions; result-map markers, menus, dialogs, pagination, and favorites require keyboard support.
- Use `aria-live="polite"` for asynchronous progress and `role="alert"` for actionable failures.
- Keep decorative SVGs and previews at `aria-hidden="true"`.
- Name icon-only buttons with an action and object.
- Retain text equivalents when a map or image is unavailable.
- Keep all controls at least 44 px on either axis.

## Motion

Motion clarifies state but is not required to understand content. The global reduced-motion rule shortens animations and transitions, and smooth scrolling is disabled when `prefers-reduced-motion: reduce` is active. Do not add shaking, parallax, or autoplaying content.

## Implementation boundaries

- Tailwind CSS 4 provides layout and utility styling through `@import 'tailwindcss'`.
- daisyUI supplies compatible controls through the two custom TaQuanto themes.
- Application-specific layout, searchable location controls, and Leaflet presentation stay in local component styles or the documented global map overrides.
- Prefer native elements such as `dialog`, `details`, `button`, `select`, and `input`.
- Do not introduce a parallel token system or a default daisyUI theme.
