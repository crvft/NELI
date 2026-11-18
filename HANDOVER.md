# NELI — Handover

Everything a new session needs to pick up where we left off. Read this first, then `CHANGELOG.md` and `README.md`.

---

## 1. What NELI is

**NELI = National Electoral Interface.** A one-stop platform for Nigerian elections (Nigeria only, for now):

- **Live elections (the main goal):** who is leading, where, by how much, and the probability of winning, based on both the current count and past track records.
- **History:** results as far back as possible, across presidential, governorship, Senate, House of Reps, State Assembly and local government (LGA) races.
- **People:** a profile for everyone elected or appointed: party history, offices held, votes per election, and where their votes came from (zones and states).
- **Forecasts:** who is likely to win upcoming elections.

Owner: Mico (X: [@crvft_](https://x.com/crvft_)). Footer credit on every page: "Built with love and okpa by Mico".

## 2. Where things live

| Thing | Location |
|---|---|
| Repo | `crvft/NELI` (GitHub) |
| Working branch | `claude/confident-cray-e5t5ab` (all work so far) |
| Live site | **https://neli-interface.vercel.app** (Vercel project `neli`, team "Artifacts") |
| Vercel production branch | currently `claude/confident-cray-e5t5ab`, so every push deploys to the live site. Consider switching it to `main`, with this branch getting previews. |
| CI | GitHub Actions `.github/workflows/ci.yml`: typecheck → lint → test → build |
| Database | **Supabase** (connected via MCP; not used yet: planned for real data) |

Cloud sessions are ephemeral: the Vercel CLI login and the Vercel plugin need re-doing in a new container (`npm i -g vercel`, `vercel login`).

## 3. Status (end of last session)

- The interface is built and live, running on **fictional sample data** (`lib/sample/dataset.ts`). Every page shows a "Sample data" badge. Parties, states, zones, boundaries and LGA counts are real; people and numbers are invented.
- **Not started yet:** real data import, and the forecasting model **Anyanwụ**.
- **Agreed order of work:** (1) source and import real data, presidential first, then governorship; (2) build Anyanwụ in Python and tune/test it on that history; (3) later, the public accuracy page.

## 4. Architecture

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router (Turbopack), React 19, TypeScript strict |
| Rendering | Cache Components (partial prerendering) + partial prefetching; static shell, cached data, live data streamed |
| Data access | `lib/repo/index.ts` (server-only, `'use cache'` + `cacheTag`). **The only module pages read data from**; swap the sample data for Supabase here. |
| Domain | Types in `lib/domain.ts`; pure analytics in `lib/analytics.ts`, `lib/region.ts`, `lib/map-data.ts`, `lib/lga.ts` |
| Styling | Tailwind CSS 4, CSS-first `@theme` in `app/globals.css` (AlignUI tokens) |
| Motion | `motion/react`; spring tiers in `lib/motion.ts`; Calligraph for rolling numbers |
| Icons | Hugeicons (free set), all through `components/icons.tsx` |
| Maps | GRID3 state + LGA boundaries (geoBoundaries, CC BY 4.0), Natural Earth neighbours. Build with `npm run build:map` → `lib/map-shapes.json` + `public/geo/lga/*.json` |
| Tests | Vitest (`tests/`): tallies, zone/state roll-ups, probabilities, LGA fitting, one governor per state |
| Planned | Supabase Postgres (source of truth, generated types, SQL views), Supabase Realtime (live push), **Python** ingestion + modelling workers that write to Postgres and call `revalidateTag` |

Commands: `npm run dev`, `npm run check` (typecheck + lint + tests), `npm run build`, `npm run build:map`.

### Key files

- `app/`: routes: `/` (live), `/elections`, `/elections/[id]`, `/politicians`, `/politicians/[id]`, `/forecasts`, `/states`, `/states/[code]`, `/zones/[code]`
- `components/neli/`
  - `nigeria-map.tsx`: heat map, zoom into states, LGAs, tooltips
  - `map-guide.tsx`: the "how to read" panel beside the map
  - `line-chart.tsx`: the custom chart
  - `region-dashboard.tsx`: zone and state analytics
  - `election-view.tsx`, `results-table.tsx`, `sort-menu.tsx`
- `components/motion/`: `fluid-hover.tsx`, `animated-number.tsx`, `motion-provider.tsx`
- `components/shell/`: sidebar, mobile nav, theme toggle, footer

## 5. Design decisions (agreed; don't change without asking)

**Base:** AlignUI (https://alignui.com), the free MIT starter (`LICENSE-alignui`). Anything not in the free set is designed to match AlignUI. Font: **Geist**. Brand colour: **#002400**.

**Typography**
- **12px minimum** everywhere, then even steps (12, 14, 16, 18, 20, 24…). Tokens are floored with `max(12px, …)`.
- **Body text 15px.** The rest of the scale is unchanged.
- **Hybrid rules (from Fluid Functionalism):** no uppercase or letter-spaced labels, no eyebrow labels above titles, two main text colours (a third only for disabled), headings and selected items at weight 550.

**Fluid Functionalism** (https://www.fluidfunctionalism.com) is applied on top of AlignUI. Its UI kit and icons are **not** used. Where it conflicts with AlignUI, **ask the user first.** Agreed so far:
- Surfaces: an 8-step elevation ladder. In light mode raised surfaces are white and separated by shadow. In dark mode raised surfaces get lighter (#171717 → #3a3a3a). Hover and selected states are translucent overlays.
- Sizes: controls 36px (default) / 28px (compact); touch screens get ≥44px hit areas (`hit` utility).
- Fluid hover: one highlight glides between items (`FluidHover`); pointer devices only, clickable items only.
- Motion: spring tiers fast 0.08s, moderate 0.16s, slow 0.24s; exits one tier quicker. One deliberate addition: `spring.camera` (~0.55s) for the full-frame map zoom, because the user asked for an iOS/macOS-style smooth zoom.
- `reveal-product` page fade. Skeleton loaders only after 160ms, so fast loads never flash.

**Other design rules**
- **Icons:** Hugeicons. **Numbers:** Calligraph (https://calligraph.raphaelsalaja.com) rolling digits.
- **Party colours** (CVD-checked, light and dark): APC blue `#2563eb`, PDP red `#dc2626`, LP teal `#0d9488`, NNPP amber `#f59e0b`; APGA violet, ADC slate, SDP pink, others grey. Avoid green for parties (it's the brand colour).
- **Charts:** styled after the user's dark reference images (dotted grid, thin lines, glow in dark mode, shaded gap between the leaders, end labels, dotted projection), with a light-mode equivalent. Touch: press and hold, drag to scrub.
- **Map:**
  - Real Nigeria, with neighbours washed out (near-white in light mode, darker in dark mode, outlines still visible). Styled after the user's Japanese atlas reference: zone callouts, and a right-hand guide panel.
  - Heat-map fills: solid ≥20 pts, tinted 8–20 pts, striped <8 pts, dotted = awaiting results.
  - Tooltip always below the pointer; hidden when the pointer leaves Nigeria.
  - Clicking a state zooms in to its LGAs; the panel holds the Back button (Esc also works).
  - Hovering a zone label greys out the other zones.
- **Layout:** cards side by side share a row (equal heights). Results tables are full width with a sort dropdown.

## 6. Data plan (next task)

Sources discussed (verify access before building each importer):

| Need | Sources |
|---|---|
| Live results | INEC **IReV** (polling-unit EC8A sheet images; no public API, so poll its endpoints and extract figures with **Gemini**, which is connected, plus a human review queue); INEC collation announcements; Yiaga Africa, CDD, Stears |
| History 1999–2023 | INEC reports and result PDFs (one-off extraction); IReV archives for 2022–2025 off-cycle and 2023 (polling-unit level); community datasets for 2023 |
| Before 1999 | African Elections Database, CLEA (Constituency-Level Elections Archive), Wikipedia (sourced) |
| LGA elections | each state's electoral commission (SIEC): sparse, state by state |
| People | NASS website, PLAC "Shine Your Eye", INEC final candidate lists, Wikipedia/Wikidata; appointees from FEC records and the Gazette |
| Maps | GRID3 / HDX boundaries (already used); INEC polling-unit register (~176,846 units) |
| Polls | NOI Polls, Afrobarometer (sparse) |

Import order: **presidential 1999–2023 → governorship (incl. off-cycle)**, then Senate, House of Reps and State Assembly.

### 6.1 Data pipeline (started)
- Python project in `pipeline/` (uv). Run `cd pipeline && uv sync && uv run python -m neli_pipeline.build_presidential`.
- Sources are cached in `data/raw/` (git-ignored). **Provenance** for every source (exact Wikipedia revision, retrieval time, sha256, licence) is recorded in `data/sources/manifest.json`.
- **Done:** presidential results by state for **1999, 2003, 2015, 2019, 2023** → `data/processed/presidential_state_votes.csv` (year × state × candidate, with `party` as on the ballot and `lineage` for continuity), `presidential_state_summary.csv`, `presidential_national.csv`, and `VALIDATION_presidential.md`.
- **Validation:** the sum of state rows equals INEC's declared national totals exactly for 1999, 2003, 2015 and 2019. In 2023 the main candidates are within 0.12% and "Others" within 0.75% (recorded, with tests asserting the bounds).
- **Gaps:**
  - **2007 and 2011** state-level presidential results: there is no by-state table on English, French or German Wikipedia; the African Elections Database is offline; the Internet Archive drops connections from the cloud environment.
  - Options: INEC's official result sheets (if the user has PDFs), fetching from a machine where archive.org works, or another public dataset.
  - **Registered voters by state:** not in these tables; needed for turnout and for the live model's estimate of votes still to come. Source from INEC registers.
- **Registered voters** (`uv run python -m neli_pipeline.build_registers`):
  - National registers for 1999, 2003, 2015, 2019 and 2023 come from each national article's infobox → `registered_voters_national.csv`.
  - By state for **2003** (national table) and **2023** (37 per-state articles) → `registered_voters.csv`. Both reconcile exactly with the national figure.
  - **Anambra 2023** is *derived*: the national register minus the other 36 states (2,656,437). Its article says 2,536,156, which doesn't reconcile. This is flagged in the `note` column.
  - 2019 national register per Wikipedia is 82,344,107, versus the ~84.0M INEC figure commonly quoted. Recorded as sourced; verify against INEC when possible.
  - **Gap:** by-state registers for 1999, 2015 and 2019 (the 2019 per-state article series doesn't exist).
  - Useful later: HDX has UNFPA population by state and LGA (`cod-ps-nga`), for model inputs such as youth share.
- **Gotcha:** the state code `NA` (Nasarawa) is read as "missing" by pandas; always `keep_default_na=False`.
- IReV (inecelectionresults.ng) is an Angular app over an API. Its result data is polling-unit **sheet images** (EC8A), for live and polling-unit-level work later. Its backend host refused connections from this environment.
- Wikipedia's REST API rate-limits shared cloud egress heavily; the regular `/wiki/<title>` page works and embeds the revision ID (`wgRevisionId`). 2007/2015/2019 presidential titles redirect to the "general election" articles.

## 7. Anyanwụ: the forecasting model (design agreed, not built)

**Name:** Anyanwụ. **Language:** Python (decided). **Version 1 scope:** presidential and governorship races.

**Why replace the current code** (`lib/analytics.ts`, placeholders written to make the interface work):
- The live model reads each state's final vote total, which is only known in sample data.
- Its random swings aren't linked across candidates or states.
- It looks up past results by candidate, not by party.
- All its settings were picked by hand and never tested.
- The forecast is a heuristic (last share × 1.12 for incumbency, then a softmax with a hand-picked steepness of 8).
- The governorship 25%-of-LGAs rule is missing.

### 7.1 Pre-election forecast
- Predicts each party's share in each state (and LGA where data allows), using:
  - past results and trends
  - candidate effects: home zone and state, the North–South rotation ("zoning") convention, the religious balance of the ticket, incumbency
  - party lineage: mergers and splits, e.g. ACN + CPC + ANPP → APC in 2013
  - turnout trends
  - polls, given little weight
  - social media signals: discussed, see 7.5
- Uncertainty is **correlated** across states through shared factors (zone, urban, religion-linked voting).
- Output: thousands of simulated elections with the exact constitutional rules applied:
  - President: most votes plus ≥25% in 24 of 37 states (two-thirds, counting FCT), else a run-off.
  - Governor: most votes plus ≥25% in two-thirds of the state's LGAs.

### 7.2 Live model
- Starts from the pre-election forecast. Each batch of polling-unit results updates the estimate for its own area, for similar areas, and for neighbouring areas.
- The votes still to come are estimated from **registered voters × expected turnout**, never from final totals.
- It corrects for the order in which areas usually report.

### 7.3 What it borrows from others (combined into one model)
| From | Technique |
|---|---|
| Weather forecasting | ensembles (many simulated runs); calibration ("70%" should happen ~70% of the time; Brier and log scores); data assimilation / Kalman-style updating, used for the live model |
| Finance (risk models) | correlated risk via shared factors; shrinkage, i.e. stable estimates from little history |
| Maps / spatial statistics | "neighbouring areas vote alike": a spatial model using the LGA adjacency network from our boundary files. (Shortest-path / A* algorithms were considered and rejected: they find routes, they don't estimate probabilities.) |
| The Economist (2020 US model, Gelman & Morris; code published) | Bayesian structure combining fundamentals and polls. Check its licence before reusing any code. |
| New York Times "Needle" (documented) | live estimation of the vote still to come from partial precinct results |
| FiveThirtyEight (documented) | methodology for combining inputs and reporting uncertainty |

### 7.4 Tuning and testing: walk-forward backtesting
- Train on 1999 → predict 2003; 1999–2003 → 2007; … 1999–2019 → 2023. Each test only sees earlier data.
- Settings are tuned **jointly across all folds**, not tuned per fold and then averaged (the user proposed averaging; we agreed joint tuning is more robust). Per-fold settings are kept too, to check they're stable.
- Only 7 presidential elections exist, so tuning also uses governorship (incl. off-cycle) and later legislative races at state and LGA level, which gives thousands of data points.
- Metrics: vote-share error per state, winner accuracy per state, calibration, Brier and log score.
- **It must beat a naive baseline** ("same as last time, shifted by the national swing") to ship.
- Tools: PyMC or Stan (Bayesian), scikit-learn (baselines), pandas.
- Runs offline. Tuned settings and forecasts are stored in Supabase; the Python ingestion worker updates live probabilities; the website only reads.

### 7.5 Social media signals (decided)
- **Low-weight input only.** Online signals are easily distorted (bots, paid engagement), and online Nigeria is not the electorate. In 2023, Obi dominated online and came third.
- **Free sources only for now** (no paid API budget): **Google Trends** (search interest back to 2004) and **Wikipedia page views** (daily since 2015). They're used as "momentum/surge" features, corrected for the online skew, and **kept only if the backtests show they improve accuracy**, at whatever weight the backtests justify.
- **Paid sources later, maybe:** X, TikTok, Facebook, YouTube. Start recording from free endpoints where possible, so history accumulates for future elections.
- Show "online attention" separately on candidate profiles; it must never quietly drive the win probability.

### 7.6 Deferred
- Public **"How accurate is NELI?"** page with backtest results and the calibration chart. Agreed for later, once Anyanwụ works.

## 8. Working agreements with the user

- Ask before choices that are genuinely the user's (e.g. Fluid Functionalism vs AlignUI conflicts). Otherwise make the sensible call and say so.
- Verify visually in light and dark mode, desktop and mobile, before reporting done. Report honestly what was and wasn't verified.
- Never present sample data as real: keep the badge until the real import.
- Fictional people must not copy real politicians' names. (Some sample personas loosely echo real archetypes; they disappear with the real import.)
- Commit with clear messages; push to the working branch; CI must pass.

## 9. Open questions and decisions log

- 2026-11-18: Python confirmed for Anyanwụ. Accuracy page deferred. V1 scope: presidential + governorship. Model name: **Anyanwụ**. Combine techniques from The Economist, NYT, finance risk models and spatial "neighbours vote alike" models into one model.
- 2026-11-18: Social media is a low-weight input; free sources only (Google Trends, Wikipedia page views); paid APIs possibly later.
- 2026-11-18: Data pipeline started (Python, `pipeline/`). Presidential by state done for 1999, 2003, 2015, 2019, 2023; 2007/2011 are gaps (see §6.1).
- 2026-11-18: 2007/2011 presidential gap: **option 3 now** (proceed without them; backtest folds 1999→2003→2015→2019→2023), **option 2 later** (when convenient, the user attaches their own computer via Remote Control so the Internet Archive copy of the African Elections Database can be fetched from there). The user has no INEC PDFs.
  - Plug-in path: add an extractor for the archived page, add 2007/2011 to `YEARS` in `build_presidential.py`, rebuild. The tests and validation report cover them automatically, and Anyanwụ's backtest picks up whatever years exist in `data/processed` (no code change), adding the 2003→2007, 2007→2011 and 2011→2015 folds.
- Next: registered voters by state; governorship results (incl. off-cycle); then load into Supabase and start Anyanwụ.
