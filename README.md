# NELI — National Electoral Interface

One place to follow Nigerian elections live, look back at past results, and see the track record of everyone elected or appointed, from LGA chairmen to the president.

> **Current status: interface phase.** Every person and vote figure in `lib/data.ts` is **fictional sample data** used to design the interface. Parties, states and zones are real.

## Stack

- Next.js 14 (App Router, statically generated) + TypeScript
- Tailwind CSS with the [AlignUI](https://alignui.com) free starter tokens and components (MIT, see `LICENSE-alignui`)
- Geist Sans / Geist Mono
- Brand colour `#002400` (`--brand-*` / `--primary-*` in `app/globals.css`)
- Custom SVG line charts (dotted grid, glowing lines in dark mode, projection fans)
- Nigeria map: GRID3 state boundaries via geoBoundaries (CC BY 4.0) + Natural Earth neighbours; rebuild with `node scripts/build-map.mjs`
- Type scale: 12px minimum, even steps (12, 14, 16, 18, 20, 24, 32…); body text is 15px

## Pages

| Route | What it shows |
|---|---|
| `/` | Live election: heat map of Nigeria (hover for details, click for a state breakdown), leaders, win probability, vote-share timeline, zones, state table |
| `/elections`, `/elections/[id]` | All elections (live / past / upcoming) and their full results or forecast |
| `/politicians`, `/politicians/[id]` | Directory and profiles: party history, offices, votes per election, where votes came from |
| `/forecasts` | Upcoming elections with win probabilities and the factors behind them |
| `/states`, `/states/[code]` | Results by state, office holders and state elections |

## Develop

```bash
npm install
npm run dev
```

## Data roadmap

1. **2023 general elections**: INEC results and IReV polling-unit sheets → Supabase
2. **1999–2019**: INEC reports (PDF extraction)
3. **Profiles**: NASS, PLAC "Shine Your Eye", Wikidata, INEC candidate lists
4. **Live pipeline**: IReV polling + EC8A sheet extraction + review queue
5. **Boundaries**: GRID3 / HDX for a geographic map alongside the tile map
