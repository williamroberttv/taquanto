---
version: alpha
name: Clerk
description: "A developer authentication platform with a clean, professional dual-mode canvas — light white (#FFFFFF) with cool gray surfaces for the dashboard, dark (#0A0A0A) for the marketing site's impactful moments — anchored by Clerk's violet-purple primary (#6C47FF). The UserButton, SignIn, and UserProfile components are Clerk's most visible design artifacts: polished white modals with thoughtful micro-interactions that developers embed directly. Typography uses Inter for both product and marketing with a clean hierarchy. The system communicates: auth is infrastructure, but it should be beautiful infrastructure."

colors:
  primary: "#6C47FF"
  on-primary: "#ffffff"
  primary-hover: "#5A35EE"
  ink: "#131316"
  ink-muted: "#747686"
  canvas: "#ffffff"
  surface-1: "#F7F7F8"
  surface-2: "#EFEFF1"
  border: "#E0E0E5"
  avatar-bg: "#6C47FF"
  success: "#1DB97B"
  danger: "#EF4444"

typography:
  display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -0.025em
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0

spacing:
  base: 8px
  scale: [4, 8, 12, 16, 24, 32, 48, 64, 96]

radius:
  sm: 4px
  md: 8px
  lg: 12px
  xl: 20px
  pill: 9999px

shadows:
  card: "0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)"
  elevated: "0 8px 32px rgba(0,0,0,0.12)"
  modal: "0 16px 48px rgba(0,0,0,0.16)"

motion:
  duration-fast: 100ms
  duration-base: 200ms
  easing: cubic-bezier(0.4, 0, 0.2, 1)
---

## Rationale

**Purple as developer-trust signal** — #6C47FF sits in the violet-indigo family associated with developer tools (Stripe, Linear, Vercel), which communicates category membership to Clerk's primary buyer: technical founders and engineering teams. It's distinctive within that palette while feeling at home in a developer context.

**The embedded component as the sales artifact** — Clerk's design investment is disproportionately in the SignIn card and UserButton because these are what developers ship to their users. Every design decision in those components is also a sales decision: a beautiful auth modal makes developers look good and makes it harder to justify switching providers.

**White modals to match any app** — Auth components need to embed invisibly in a wide range of product contexts. Pure white (#ffffff) with neutral surfaces ensures the SignIn card looks appropriate on a dark SaaS dashboard, a warm marketing site, or a professional enterprise portal — it's a deliberate chameleon strategy.

**Inter as the default of the modern web** — Clerk's developer audience has standardized on Inter for product interfaces. Using it everywhere (marketing and product) reduces the cognitive distance between Clerk's own brand and the apps that embed it, which subtly helps developers feel the components belong in their stack.

**"Secured by Clerk" footer in components** — This is brand building through distribution. Every embedded SignIn modal carries the Clerk brand into products that didn't choose to show it — a viral growth mechanism baked into a design decision about footer copy.

## 1. Visual Theme & Atmosphere
Clerk bets that developers will choose auth infrastructure that looks good because it reflects on their product. The SignIn component is Clerk's flagship: a white card with the developer's brand logo at top, clean form fields, and a social auth button stack that adapts to configured providers. The dashboard is minimal and clean — an admin surface for managing users, sessions, and JWT configuration without unnecessary complexity. Purple is the thread connecting brand to product to component.

## 2. Color System
- **Purple primary**: #6C47FF — the Clerk color; CTAs, active states, focus rings in components
- **Canvas**: Pure white for dashboard and embedded components
- **Cool surfaces**: #F7F7F8 / #EFEFF1 — neutral gray with slight cool tint for panels
- **Ink**: #131316 — very dark, near-black with slight cool undertone
- **Muted**: #747686 — subdued text for labels, helper text in form fields
- **Success green**: #1DB97B — verified badges, successful connection states

## 3. Typography
Inter at every level. The embedded components (SignIn, UserProfile) use Inter to match the broader developer ecosystem — it's the default "professional web app" typeface. Display sizes use 700 weight with tight tracking. The components themselves use slightly smaller base sizes (14px) for compact embedding.

## 4. Components & Patterns
- **SignIn card**: White modal, logo slot at top, email/password fields, social OAuth buttons, footer with "Secured by Clerk"
- **UserButton**: Small avatar button that opens a mini-profile popover — the signature Clerk UX
- **UserProfile**: Full settings page (name, email, password, connected accounts, sessions list)
- **Dashboard user table**: Columns for user, email, created, last signed in, status badge
- **JWT inspector**: Developer tool for viewing token claims in dashboard
- **Organization switcher**: Dropdown for multi-org apps, organization avatar + name

## 5. Spacing & Layout
Components: 24px internal padding, 480px default width for auth modals. Dashboard: 240px sidebar, content max 1100px. Generous row height in user tables (48px) for comfortable scanning.

## 6. Motion & Interaction
SignIn component: form fields focus with purple ring. Social buttons have hover lift (subtle translateY). Error states shake horizontally. UserButton popover opens with fade+scale. Session revoke triggers a soft disappear animation.

## Accessibility

### Contrast Ratios
- **Primary on background** (#6C47FF on #FFFFFF): 5.3:1 — passes AA, fails AAA
- **Text on background** (#131316 on #FFFFFF): 18.5:1 — passes AA, passes AAA
- **Muted on background** (#747686 on #FFFFFF): 4.5:1 — passes AA, fails AAA

### Minimum Requirements
- **Touch target**: 44×44px minimum for all interactive elements
- **Focus indicator**: #6C47FF outline, 2px, 2px offset
- **Focus contrast**: 5.3:1 against #FFFFFF background

### Motion
- Respects `prefers-reduced-motion`: yes — all transitions and animations should be suppressed
- All transitions use `@media (prefers-reduced-motion: reduce)` guard

### Notes
- Muted text #747686 sits at exactly 4.5:1 on white — this is right at the AA pass boundary; any rounding in implementation could cause a fail. Use the value precisely and do not lighten further.
- The violet primary #6C47FF at 5.3:1 passes AA for normal text; it can safely be used as a text link or label color, but will not pass AAA.
- UserButton popover fade+scale animation should be replaced with an instant display under `prefers-reduced-motion`, as the combined transform+opacity transition can cause issues for motion-sensitive users.
- Error shake animation should also be suppressed under `prefers-reduced-motion`; use a static error border highlight instead.
