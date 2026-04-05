# Changelog

All notable changes to MPP32 are documented here.

Format follows [Semantic Versioning](https://semver.org). Dates are UTC.

---

## [1.0.1] — 2026-04-01

### Changed
- Domain fully migrated to mpp32.org across all surfaces
- Updated social links and contact references throughout the platform
- Minor copy improvements on the Build and Ecosystem pages

### Fixed
- Logo rendering on link previews and share cards
- Mobile nav scroll lock on iOS Safari

---

## [1.0.0] — 2026-03-01

First stable release.

### Added
- Full production deployment on mpp32.org
- Custom domain CORS configuration
- X (Twitter) follow button in site footer
- Ecosystem directory with category filtering and live submission data
- Submission approval workflow

### Changed
- Final branding pass — MPP32 logo and amber color system locked
- Docs page expanded with full request/response examples and error code reference

---

## [0.9.0] — 2026-01-20

### Added
- Mobile-responsive layout for Playground and Dashboard
- Animated multi-step loading states across oracle query flow
- Alpha score trend display in Dashboard

### Changed
- Switched to optimistic UI updates for query results
- Refactored component structure — extracted shared UI primitives to reduce duplication

### Fixed
- Race condition in concurrent playground queries
- CoinGecko enrichment silently failing on tokens with no global listing

---

## [0.8.0] — 2025-12-10

### Added
- Ecosystem directory — public listing of community MPP services
- Builder submission form at `/build`
- `ProjectCard` component with category badges and query count display
- `EcosystemFilters` for category-based browsing

### Changed
- API response envelope standardized — all application routes return `{ data: ... }`
- Improved error messages across all endpoints

---

## [0.7.0] — 2025-11-05

### Added
- Hosted proxy feature — wrap any existing API endpoint with MPP payment gating
- `/api/proxy` route for proxied request forwarding
- Builder platform pages (Build, Use Cases, Pricing)
- `mppx` middleware integrated for per-query payment enforcement

### Changed
- Backend restructured into route modules
- Zod schemas centralized in `backend/src/types.ts` as shared API contracts

---

## [0.6.0] — 2025-10-01

### Added
- Dashboard page with localStorage-backed query history
- Average alpha score metric across query history
- Empty state onboarding flow for new users
- API configuration info panel

---

## [0.5.0] — 2025-09-12

### Added
- Playground page with live query terminal
- Multi-step loading animation during oracle queries
- Mock data carousel for unauthenticated demo
- `ScoreBar` and `PctChange` display components

### Changed
- Demo endpoint (`/api/intelligence/demo`) now returns full response shape

---

## [0.4.0] — 2025-08-20

### Added
- All 8 intelligence dimensions fully implemented
- Whale activity analysis (`whaleActivity` field)
- Smart money signal detection (`smartMoneySignals` field)
- CoinGecko enrichment for global market data
- `priceConfidence` and `coingeckoEnriched` flags on responses

### Changed
- Scoring model refined — alpha score is now a weighted composite
- Jupiter price API used as fallback when DexScreener price is unavailable

---

## [0.3.0] — 2025-07-15

### Added
- Use Cases page with six trader and developer personas
- Pricing page
- About page
- Blog scaffold

### Changed
- Landing page redesign — new hero section, stats bar, how-it-works explainer

---

## [0.2.0] — 2025-06-10

### Added
- Full API reference documentation at `/docs`
- Demo endpoint with no payment requirement
- Rug risk scoring (`rugRisk` field with contributing factors)
- Projected ROI field with low/high range and timeframe

### Fixed
- DexScreener rate limiting handled with graceful retry
- Ticker resolution is now case-insensitive

---

## [0.1.0] — 2025-05-01

Initial alpha release.

### Added
- Oracle endpoint — accepts any Solana contract address or ticker
- DexScreener integration for price and on-chain pair data
- Alpha score and pump probability (initial scoring model)
- React frontend with Hono backend
- Dark theme with amber accent system