# Changelog

All notable changes to NELI (National Electoral Interface). Newest first.
Dates are 2026-11-18 unless stated. Every entry so far uses **fictional sample data**; no real election data has been imported yet.

---

## [Unreleased] — Next up

### Data pipeline: presidential results (in progress)
- New Python project `pipeline/` (uv, pandas, ruff, pytest) with a provenance manifest (`data/sources/manifest.json`).
- Presidential results by state for 1999, 2003, 2015, 2019 and 2023, extracted from Wikipedia's cited transcriptions of INEC's declared results. Validated against INEC's national totals: exact for four years, within 0.12% (main candidates) for 2023. Report in `data/processed/VALIDATION_presidential.md`.
- Party lineage mapping (AD/APP/ANPP/AC/ACN/CPC → APC) for modelling continuity; ballot labels kept.
- 2007 and 2011 by-state results not yet available from any reachable source (recorded as gaps). Plan: proceed without them; fetch later via the user's own computer, where they slot in with no model changes.
- Registered voters: national registers 1999–2023, plus by-state registers for 2003 and 2023, reconciled with the national figures (Anambra 2023 derived, and flagged).
- Governorship results, 1999–2026: 249 of 252 held elections across all 36 states, including off-cycle races. Each election carries a coverage label: all candidates (174), top candidates only (59), winner only (16). The extractor rejects party primaries, merges joint tickets and reads nested infoboxes; it is spot-checked against known results.
- CI: a new `pipeline` job (ruff lint + format check + pytest).

- Data import (Supabase), in the order the forecasting model needs it: presidential results 1999–2023, then governorship (including off-cycle races).
- **Anyanwụ**, NELI's forecasting model (Python): pre-election forecast + live model, tuned and tested by walk-forward backtesting. Design in `HANDOVER.md`.
- Later: a public "How accurate is NELI?" page, once Anyanwụ is working (deliberately deferred).

## b5b8844 — Sort dropdowns, governors for every state, zone card spacing

- Reusable **sort dropdown** (`components/neli/sort-menu.tsx`; Radix dropdown, AlignUI/Fluid Functionalism styling, keyboard accessible, spring open/close).
  - Results by state (live page and every election page): Votes, Reported (live only), Alphabetical, Leader's share, Closest race.
  - Zone page states table: Votes, Reported (live only), Alphabetical, Turnout, Closest race.
  - LGA list in the map's state panel: Votes, Alphabetical, Leader's share, Closest race.
- Results table became a client component (`results-table.tsx`); rows are still computed on the server.
- Sample **governors for all 36 states**, plus the **FCT minister** (the FCT has no governor). The States page lists each state's sitting governor instead of a mix of governors and capitals. State pages show "Capital: … · … zone" under the name. A test asserts one governor per state.
- Zone cards: "Zone analytics" aligned to the card's right inset; the summary split into two lines with a 4px gap.

## 913f3ec — Live page layout, zone hover, chart touch scrubbing, footer credit

- Sixth 2027 presidential candidate (sample): Fatima Yahaya Musa (SDP). Sample strengths re-tuned so the leader's chance stays around 95%, not 100%.
- Live page grid restructured into shared rows, so Leading candidates / Chance of winning and Vote share / By zone always end at exactly the same height.
- Results by state spans the full width (no horizontal scroll on desktop).
- Map: hover outline softened (2.2px → 1.5px). Hovering a zone label greys out states outside that zone and emphasises its leader line (desktop only).
- Charts on touch: press and hold keeps the tooltip; drag along the x-axis to scrub; lift to dismiss. `touch-action` sits on the HTML wrapper because browsers ignore it on SVG children.
- Boundaries credit padded and centred, using the same 16/20px insets as the panel sections.
- Footer on every page: "Built with love and okpa by Mico" (Mico links to https://x.com/crvft_).

## 399ea8d — Bigger map, zoom into states with LGA results, tooltip fixes, 12px floor

- **12px minimum enforced.** Text tokens use `max(12px, …rem)`. Root cause: AlignUI's 0.75rem sizes rendered at 11.25px on browsers with a 15px default font size.
- Map refitted: Nigeria fills most of the frame and neighbours are pushed to the edges. Zone labels moved to the free corners. Page gutter reduced by 8px. Map and panel sit side by side only from `xl`, so the map is larger on laptops.
- Tooltip always sits **below** the pointer and disappears as soon as the pointer leaves Nigeria's states.
- **Click a state → zoom.**
  - A spring camera (`spring.camera`, ~0.55s) zooms in; the rest of Nigeria dims to grey.
  - The state's **LGAs** fade in, coloured by leader, with their own tooltips.
  - The right panel shows the state, an LGA list and a prominent "Back to Nigeria" button (Esc also works). A compact back pill sits on the map on narrow screens.
- LGA boundaries (GRID3 via geoBoundaries, 774 LGAs) are generated into `public/geo/lga/<STATE>.json` (~12KB each, loaded on demand).
- Sample LGA results are derived from state results by iterative proportional fitting (`lib/lga.ts`), so they always add up to the state totals. Tests added.

## d76709f — Zone analytics, Fluid Functionalism rules, Hugeicons, platform upgrade

- **Platform:**
  - Next.js 16 (Cache Components + partial prefetching, typed routes), React 19.
  - Tailwind CSS 4 (CSS-first `@theme`, generated from AlignUI tokens), strict TypeScript.
- **Data layer:**
  - `lib/repo` (server-only, `'use cache'` + `cacheTag`) is the single place pages read data from.
  - `lib/domain.ts` holds the types; sample data lives in `lib/sample/dataset.ts`.
  - Analytics are pure functions.
- **Quality:** Vitest unit tests, ESLint 9 flat config, GitHub Actions CI (typecheck → lint → test → build).
- **Zone analytics** (`/zones/[code]`):
  - party share, turnout and register over time, with a cycle filter synced to the URL (`?cycle=2023`)
  - a states matrix (all cycles) or table (one cycle) that drills into `/states/[code]`
- State pages rebuilt on the same dashboard, with breadcrumbs.
- Design rules from **Fluid Functionalism** (conflicts agreed with the user):
  - surface ladder (raised surfaces get lighter in dark mode, shadow-led elevation)
  - overlay hover and selected states
  - 36/28px controls with 44px touch hit areas
  - gliding "fluid hover"
  - spring tiers, `reveal-product` page fade, and skeletons that wait 160ms before showing
- Hybrid typography: no uppercase or letter-spaced eyebrows, two main text colours, weight 550.
- **Hugeicons** replaced Remix icons. **Calligraph** rolling numbers.
- Unused AlignUI components and dependencies removed (re-add from AlignUI when needed).

## 4210ed1 — Upgrade to Next 16 / React 19; prune unused AlignUI components

## d0203a7 — Nigeria heat map, new chart style, distinct party colours

- Real state map (GRID3 boundaries) with washed-out neighbours, zone callouts, hover tooltip, and click to open a state panel beside an atlas-style "how to read" guide.
- Heat-map fills: solid = 20+ pt lead, tinted = 8–20 pts, striped = under 8 pts, dotted = awaiting results.
- Custom SVG line charts styled after the user's dark reference images: dotted grid, glow in dark mode, gap shading, end labels, projection fans. Recharts removed.
- Party colours chosen for maximum separation and checked for colour-blind readers: APC blue, PDP red, LP teal, NNPP amber.
- Sidebar subtitle: "National Electoral Interface". Body text 15px.

## bf83bdb — Ignore Vercel env file

## b5662b1 — Initial NELI interface on the AlignUI starter

- Next.js App Router project from the AlignUI free (MIT) starter. Geist font, brand `#002400`, type scale with a 12px minimum.
- Pages: Live results, Elections, Politicians (profiles), Forecasts, States.
- Fictional sample data; first versions of the live win-probability simulation and the forecast heuristic.

## Infrastructure milestones

- **Vercel:** project `neli` (team "Artifacts"). Domain **https://neli-interface.vercel.app**. Git connected to `crvft/NELI`; the production branch is currently `claude/confident-cray-e5t5ab`.
- **GitHub Actions CI:** passing on every push since d76709f.
