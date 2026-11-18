# NELI — National Electoral Interface

One place to follow Nigerian elections live, look back at past results, and see the track record of everyone elected or appointed, from LGA chairmen to the president.

> **Current status: interface phase.** Every person and vote figure in `lib/data.ts` is **fictional sample data** used to design the interface. Parties, states and zones are real.

## Architecture

Built for speed, reliability and smooth interaction.

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict) | Server Components send almost no JS for data-heavy pages |
| Rendering | Cache Components (partial prerendering) + partial prefetching | Static shell served instantly from the CDN; cached data segments; live data streams in |
| Data access | `lib/repo` — the only module pages read from; `'use cache'` + `cacheTag` per election/region/person | Swapping sample data for Supabase is a change to one file; ingestion invalidates exactly what changed |
| Domain | `lib/domain.ts` types; pure functions in `lib/analytics.ts`, `lib/region.ts`, `lib/map-data.ts` | No hidden data imports, so every calculation is unit-tested |
| Styling | Tailwind CSS 4 (CSS-first `@theme`) with AlignUI tokens | Faster builds; tokens live in `app/globals.css` |
| Motion | Motion (`motion/react`) with three spring tiers (`lib/motion.ts`), Calligraph for numbers | One motion vocabulary; transforms/opacity only; reduced motion respected |
| Icons | Hugeicons (free set) via `components/icons.tsx` | One wrapper, one stroke weight, tree-shaken |
| Quality | Vitest unit tests, ESLint 9 (Next core-web-vitals + TS), GitHub Actions CI | Typecheck → lint → test → build on every push |
| Hosting | Vercel (Fluid Compute) | Global CDN for the static shell, Node runtime for data |

**Planned for real data:** Supabase Postgres as the source of truth (typed with generated types, aggregates as SQL views), Supabase Realtime to push live results, and ingestion workers (Python, for PDF/OCR extraction from INEC result sheets) that write to Postgres and call `revalidateTag`.

## Design system

- **AlignUI** components and tokens ([alignui.com](https://alignui.com), MIT starter; see `LICENSE-alignui`)
- **Fluid Functionalism** rules applied on top (agreed per conflict):
  - Surfaces: 8-step elevation ladder — light raised surfaces are white separated by shadow; dark raised surfaces get lighter (#171717 → #3a3a3a). Hover/selected are translucent overlays (`bg-hover`, `bg-selected`).
  - Sizes: controls 36px default / 28px compact; touch screens get ≥44px hit areas (`hit` utility).
  - Fluid hover: one highlight glides between items (`components/motion/fluid-hover.tsx`), pointer only.
  - Motion: springs fast 0.08s / moderate 0.16s / slow 0.24s; exits one tier quicker; `reveal-product` page fade; skeletons wait 160ms before appearing.
  - Typography (hybrid): 12px minimum, 15px body (NELI's rule); sentence-case headings, no letter-spaced eyebrows, two main text colours, weights 400/550.
- Geist Sans / Geist Mono; brand `#002400`
- Party colours: APC blue, PDP red, LP teal, NNPP amber — checked for colour-vision deficiency in both themes

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run check      # typecheck + lint + unit tests
npm run build
```

## Pages

| Route | What it shows |
|---|---|
| `/` | Live election: heat map of Nigeria (hover for details; click a state to zoom into its LGAs), leaders, win probability, vote-share timeline, zones, state table |
| `/elections`, `/elections/[id]` | All elections (live / past / upcoming) and their full results or forecast |
| `/politicians`, `/politicians/[id]` | Directory and profiles: party history, offices, votes per election, where votes came from |
| `/forecasts` | Upcoming elections with win probabilities and the factors behind them |
| `/states` | Result map, zone cards (open a zone) and states (open a state) |
| `/zones/[code]` | Geopolitical zone analytics: party share, turnout and register over time, filter by cycle, states table/matrix |
| `/states/[code]` | Same analytics for one state, plus office holders and local elections |

## Data roadmap

1. **2023 general elections**: INEC results and IReV polling-unit sheets → Supabase
2. **1999–2019**: INEC reports (PDF extraction)
3. **Profiles**: NASS, PLAC "Shine Your Eye", Wikidata, INEC candidate lists
4. **Live pipeline**: IReV polling + EC8A sheet extraction + review queue
5. **Boundaries**: GRID3 / HDX for a geographic map alongside the tile map
