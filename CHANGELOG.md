# Changelog

All notable changes to NELI (National Electoral Interface). Newest first.
Dates are 2026-11-18 unless stated. Entries before "Real data on the site" used **fictional sample data**.

---

## 3D vote-share terrain (desktop)

- **Toggle:** every presidential map (1999–2023, the 2027 projection, live) has a **View** picker beside its heading: Map / 3D terrain. It is desktop only (wide screen with a mouse).
- **What it shows:** one party at a time. A field of vertical lines covers Nigeria, each rising with the party's share of the vote; colour runs up the "plasma" scale from deep purple to bright yellow.
  - Heights blend smoothly between neighbouring states.
  - Hovering a state lights it, dims the rest and shows a tooltip with the exact figure (share, votes, rank).
- **Controls:**
  - Top-down it reads as a heat map; drag to tilt into a side view and rotate.
  - Scroll to zoom.
  - **Top / From the south / From the north** buttons.
- **Side panel:** "How to read" explains heights and colours (with the scale); a **Party** dropdown replaces "States led".
- **Implementation:** built with three.js (WebGL), loaded only when the 3D view is opened. Zone labels are hidden in this view.

## Party colours

- APC is now red and PDP green, and NDC takes the blue APC used. Other parties keep their colours. APC's predecessors (AD, ANPP, ACN, CPC) follow APC's red.

## Interaction polish

- **Cards clip their contents,** so a row's hover fill never spills past the rounded corners.
- **Politician pages:** the "In office" / "Not in office" chip sits beside the name.
- **Map legend:** hovering a party dims every state (or LGA, when zoomed) it doesn't lead, like hovering a zone label.
- **One tooltip style everywhere:** party tags, share bars (incl. "By geopolitical zone") and seat bars use the map's tooltip instead of the browser's.
- **Fluid hover** on the politician election history, Senate/House lists, and every dropdown menu (incl. the state page's election picker); keyboard moves the same highlight.
- **Elections page:** when each year has one election (e.g. Presidential), year groups flow in two columns; cards in a row share a height.

## Map fix: blank states

- **Fix:** close-race states, those inside 8 points that should be striped, rendered pure white and ignored hover.
  - **Cause:** the stripe patterns were built from the party list, which became a lookup proxy when 100+ parties were added, so no patterns were created.
  - **Now:** patterns are built for every party on the map.
- **Hover works on every state and LGA**, even where nothing is painted.
- **States or LGAs with no results** get a faint brand tint instead of grey or white. Their tooltip gives the name, the geopolitical zone, and "Data missing" (or "No polling-unit results uploaded yet" during a live count). Tied results say "Inconclusive".

## Senate, House of Reps and LGA results

- **Senate:** every senatorial district for 1999–2023 (~108 per year).
- **House of Reps:** 2015 (some states), 2019 (276 constituencies) and 2023 (327).
  - **Where it comes from:** Wikipedia's per-state articles and the national 2023 article. The winner comes from each article's summary table; vote counts are attached where the district has a results table.
  - **How complete:** 1,425 races; 341 have vote counts and 1,084 only the winner.
  - **Flagged races:** 10 races whose figures contradict the declared winner are kept as winner-only and flagged.
  - **Where to see it:** state pages now have Senate and House of Reps views (seats by party, every district), and each race has its own page.
- **Results by local government area:**
  - **Coverage:** 26 elections pass a quality gate, which requires at least 90% of the state's LGAs matched to the map and LGA totals within 3% of the state result. That's 23 governorship elections and 2023 presidential in Lagos, Ekiti and Bayelsa.
  - **On the map:** zooming into those states shows **official** LGA results; elsewhere the map still uses labelled estimates.
  - **Elsewhere:** governorship pages get a "Results by LGA" table.
  - **The gap:** most 2023 presidential state articles have LGA tables whose cells are still "TBD".
  - **Validation report:** `data/processed/VALIDATION_lga.md`.
- **Elections page:** shows 60 races at a time. Winner-only races say so instead of showing 100%.
- **Faster builds:** only presidential, governorship and upcoming races and major politicians are prerendered. Other pages render on first visit and are cached.

## Anyanwụ 1.1: candidate signals and polls

- **Governorship candidate signals:** the offices a candidate held *before* the election, from their Wikipedia profile: deputy governor, senator or representative, federal minister, and state executive (commissioner, Secretary to the State Government, chief of staff).
  - For 2027 nominees, profiles come from the links in the election article's infobox.
  - Backtest: winner accuracy 71% → **76%**, now above both baselines (73–74%). Brier score 0.37 → **0.34**.
  - Most of the gain comes from former federal ministers.
- **Light polling input (presidential):** a reviewed poll file, `data/model/presidential_polls.csv`, records each poll with its method.
  - Only surveys count; online and smartphone panels are excluded.
  - Polls nudge each candidate's national share by a weight learned walk-forward and shrunk towards zero: currently 25%.
  - Backtest (2023 test): Brier score 0.79 → 0.71. Across all five tests: 0.42 → **0.41**; log loss 0.76 → **0.69**.
  - There are no survey polls of the 2027 race yet, and the forecast page says so.

## State pages by election type, cleaner forecasts

- **State pages: election-type picker.** Presidential, Governorship, Senate and House of Assembly.
  - The choice is kept in the URL (`?type=governorship`).
  - Governorship shows the state's full history, including off-cycle years. Years where only the winner is on record are marked and left out of the share chart.
  - Each view opens with Anyanwụ's 2027 forecast for that state.
  - Senate and House of Assembly say plainly that their results aren't on record yet. The FCT explains why it has no governorship elections.
- **Year tabs:** each tab is sized to its label with even padding, the active pill included. On phones the row scrolls and keeps the selected year in view.
- **Forecasts page:** grouped by election type.
  - Presidential first.
  - Then a governorship section with a tally of favourites, compact cards (six at first, then "Show all 28 states") and a sort menu: closest race, most certain, state, zone.
- **Governorship result pages:**
  - "About this result" card: coverage, cycle, register and source link.
  - The one-row "results by state" table is gone.
  - Winner-only results no longer show "100%" or "ahead of undefined".
- **State election lists:** upcoming races show Anyanwụ's favourite.

## Anyanwụ V1 and politician bios

- **Anyanwụ** (`pipeline/anyanwu/`), NELI's forecasting model, with forecasts for the 2027 elections on the site.
  - **Presidential, 16 Jan 2027:**
    - Vote pools follow candidates, parties and running mates.
    - Home-region effects.
    - National, zonal and state uncertainty.
    - The 25%-in-24-states rule, including the chance of a run-off.
    - A projected map.
  - **Governorship, 6 Feb 2027:** 28 states. Nominees where Wikipedia has them, otherwise by party, with the assumptions stated on the page.
  - **Walk-forward backtests** on every past election. Report: `data/model/BACKTEST.md`.
    - Presidential Brier 0.49 vs 0.74 for the "same party as last time" baseline.
    - Governorship Brier 0.37 vs ~0.52.
  - **Live model** that updates from declared states, tested by replaying 2023.
  - **Online attention** (Wikipedia page views) shown separately. The backtests gave it no weight.
- **Politician profiles from Wikipedia:**
  - opening summary with attribution
  - age, birth date and place, state of birth
  - every office with its term
  - current party, education, occupation
- Candidates are linked through the election articles' own links, so spelling variants merge into one person.
- **Fixes:**
  - Delta 2023 governorship result: the infobox's vote and percentage labels were swapped.
  - Year-aware party families in the model (the 2018 "APP" is not the 1999 APP).
- New party colours for ADC and NDC.

## Real data on the site

- **Supabase**:
  - Schema and read-only row-level security; data loaded through one transactional `neli_reload` function (service role only).
  - New pipeline steps: `export_sql` (SQL seed plus the party registry for the web app) and `load_supabase`.
- **Website reads real data**:
  - Presidential 1999–2023 (no 2007/2011 by state yet) and 249 governorship elections, 1999–2026.
  - Politicians are derived from results. Offices come from wins and party history from tickets. Nothing biographical is invented.
  - All 100+ parties are labelled; historical parties take their family's colour.
- **No live election:** the home page shows the 2023 presidential result, the nav says "Latest results", the "Coming up next" strip hides itself, and Forecasts explains that forecasts arrive with Anyanwụ.
- **Honest gaps:**
  - Unknown voter registers show "—". Turnout is never estimated, and charts skip years without a register.
  - LGA map figures are labelled as estimated.
  - Governorship pages show the year where the polling date isn't on record.
- Zone charts group parties by family (AD-APP / ANPP / ACN / CPC → APC) so lines continue through mergers.
- Removed every "Sample data" badge and the sidebar sample-data card (now "About the data").

## [Unreleased] — Next up

### Data pipeline: presidential results (in progress)
- New Python project `pipeline/` (uv, pandas, ruff, pytest) with a provenance manifest (`data/sources/manifest.json`).
- Presidential results by state for 1999, 2003, 2015, 2019 and 2023, extracted from Wikipedia's cited transcriptions of INEC's declared results. Validated against INEC's national totals: exact for four years, within 0.12% (main candidates) for 2023. Report in `data/processed/VALIDATION_presidential.md`.
- Party lineage mapping (AD/APP/ANPP/AC/ACN/CPC → APC) for modelling continuity; ballot labels kept.
- 2007 and 2011 by-state results not yet available from any reachable source (recorded as gaps). Plan: proceed without them; fetch later via the user's own computer, where they slot in with no model changes.
- Registered voters: national registers 1999–2023, plus by-state registers for 2003 and 2023, reconciled with the national figures (Anambra 2023 derived, and flagged).
- Governorship results, 1999–2026: 249 of 252 held elections across all 36 states, including off-cycle races. Each election carries a coverage label: all candidates (174), top candidates only (59), winner only (16). The extractor rejects party primaries, merges joint tickets and reads nested infoboxes; it is spot-checked against known results.
- CI: a new `pipeline` job (ruff lint + format check + pytest).

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
