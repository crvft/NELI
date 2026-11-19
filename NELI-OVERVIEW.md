# NELI: National Electoral Interface

NELI is a website about Nigerian elections. It shows live results, results from past elections, profiles of politicians, and forecasts from its own model, **Anyanwụ**.

- **Live site:** https://neli-interface.vercel.app
- **Coverage:** Nigeria only, 1999 to today, with forecasts for 2027.
- **Built with:**
  - Website: Next.js 16, React 19 and Tailwind CSS 4, using the AlignUI design system, hosted on Vercel.
  - Database: Supabase (Postgres).
  - Data pipeline and model: Python.
- **Design:** the Geist typeface and brand colour #002400. It works on desktop and mobile, in light and dark mode.

---

## 1. What NELI does today

### Election results
- **Presidential elections**, state by state: 1999, 2003, 2015, 2019 and 2023. Every year except 2023 matches INEC's declared national totals exactly; 2023 is within 0.12%.
- **Governorship elections:** 249 of 252 elections from 1999 to 2026, in all 36 states, including off-cycle states such as Anambra, Edo, Ondo, Ekiti, Osun, Kogi, Bayelsa and Imo.
  - Each election is labelled with how complete its source is: all candidates, top candidates only, or winner only.
- **Registered voters:** national totals for every year, and state totals where they exist (2003 and 2023).
- **Sources:** every figure records the exact source it came from.

### Map and analysis
- **Nigeria map:** an interactive map coloured by who led each state, with geopolitical zones marked. It also applies the 25%-in-24-states rule.
- **Zoom:** click a state to zoom in. Local government results there are estimated from the state result and labelled as such.
- **Zone and state pages:**
  - Party vote share over time, with merged parties traced as one family. For example, AD, ANPP, ACN and CPC appear as APC's line.
  - Turnout, voter registers, who led each election, and how much the vote swung.
- **Election-type picker on state pages:** presidential, governorship, Senate and House of Assembly. Senate and Assembly results are not loaded yet, and the page says so.
- **Sorting:** results tables can be sorted by votes, alphabetically, by winning share or by closest race.

### Politicians
- **263 profiles** drawn from Wikipedia, credited with a link to the exact version used. Each shows:
  - a short biography
  - age, birth date and place, and state of birth
  - every office held, with dates
  - current party, education and occupation
- **Election record:** past races, votes per election, where their votes came from, and party history.
- **Spelling variants** of the same person are merged into one profile. For example, "Sanwoolu" and "Sanwo-Olu".

### Anyanwụ forecasts
- **2027 presidential election (16 January 2027):**
  - each candidate's chance of winning and projected vote share
  - the chance of a run-off
  - a projected map, and a forecast for each state
- **2027 governorship elections (6 February 2027):** 28 states.
  - Where nominees are confirmed, the forecast is by candidate. Elsewhere it is by party, and the page states the assumptions.
- **Forecasts page:** the presidential race first, then the governorship races. These can be sorted by closest race, most certain, state or zone, and expanded to show all 28.
- **Online attention:** Wikipedia page views per candidate, shown separately. They are not used in the forecast.

### Website experience
- Light and dark mode, and a layout that works on phones.
- Animated numbers, and loading placeholders only where needed.
- Accessible controls: keyboard navigation, touch targets at least 44px, and support for reduced motion.

---

## 2. How Anyanwụ works

### Presidential model
- **Vote pools.** Each state's last result is split into pools, one per ticket. Each pool follows its candidate, party and running mate into the next election. This is how Obi's 2023 Labour vote follows him to the NDC, and Atiku's PDP vote to the ADC.
- **Home advantage.** Candidates and running mates gain in their home state and zone.
- **Uncertainty.** Errors are modelled at three levels: national, zone and state. Thousands of simulated elections then apply the constitutional rules, including run-offs.

### Governorship model
It draws on:
- the state's last governorship result
- the presidential result in the same cycle
- the candidate's best previous result
- incumbency
- the president's party, with a separate effect in off-cycle races

### Live model
On election night it updates the forecast as states declare, then re-simulates the states still counting. It has been tested by replaying 2023.

### Testing
Each past election was forecast using only the results that came before it.

**Presidential** (5 elections, state level):

| | Anyanwụ | Baseline: every state votes the same party as last time |
|---|---|---|
| Brier score (lower is better) | 0.41 | 0.70 |
| States where its favourite won | 73% | 68% |

**Governorship** (177 races):

| | Anyanwụ | Baseline |
|---|---|---|
| Brier score (lower is better) | 0.34 | about 0.52 |
| Correct winner | 76% | 73–74% |

The full report is in `data/model/BACKTEST.md`.

### Known limits
- **2007:** state results for 2007 were never published officially.
- **2011:** state results come from NDI's percentages, an estimate covering 32 states.
- **Calibration:** with only a handful of presidential elections, the model's probabilities cannot be fully proven.

---

## 3. Data gaps (and why)

| Gap | Status |
|---|---|
| 2007 presidential results by state | **Do not exist officially.** INEC under Maurice Iwu never published them. |
| 2011 presidential results by state | INEC's official annex is empty or lost. NDI's percentages are used for the model only. |
| Voter registers by state for 1999, 2015 and 2019 | Not yet found |
| 149 governorship elections | Missing their voter register |
| Abia 2007, Yobe 2015 and Bauchi 2019 governorship | No results table in any source found |
| Senate, House of Reps and State Assembly results | Not loaded yet |
| Local government results | Estimated, not real results |

---

## 4. Future capabilities and improvements

### Model (Anyanwụ)
- **Done in 1.1:** governorship candidate signals from offices held before the election, and survey polls as a light presidential input.
- **More governorship candidate signals:** defecting governors bringing their political machine. There's no history of defections to learn from yet.
- **National mood input:** incumbency fatigue and the economy.
- **Ticket balance:** effects of the North–South zoning convention and the religious balance of the ticket.
- **Better projected vote shares:** governorship shares are currently too conservative.
- **Governorship rule:** governors also need 25% of the vote in two-thirds of the state's local government areas.
- **Neighbouring areas vote alike:** a local-level spatial term using local government boundaries. This depends on local results.
- **Statistical approach:** a fuller Bayesian model, using PyMC.
- **Public accuracy page:** "How accurate is NELI?", with the backtest results and a calibration chart.

### Data
- Senate, House of Reps and State Assembly results, which would give thousands more races to learn from.
- Local government-level results, from INEC and from election articles that carry local tables.
- The missing voter registers, and confirmed 2027 nominees as they are announced.
- The November 2027 governorship elections in Kogi, Bayelsa and Imo.
- After 16 January 2027: actual presidential results feeding into the governorship forecasts.

### Live election night
- A feed from INEC's IReV results portal, reading result-sheet images with Gemini and passing them through a human review queue.
- The live model connected to that feed, with real-time probabilities on the site.

### Product
- Online attention from more sources (Google Trends, and paid social data later).
- Senate, Reps and Assembly views on every state page.
- Comparison tools: candidate against candidate, and election against election.
- Data downloads and an API for journalists and researchers.

---

*See `HANDOVER.md` for full technical details and `CHANGELOG.md` for what changed when.*
