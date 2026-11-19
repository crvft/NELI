# Anyanwụ backtest report

Model version 1.1.0, generated 2026-11-19T15:27:52Z. Every number below is **out of sample**: each election
was forecast using only results from before it (walk-forward). Regenerate with `uv run python -m anyanwu.run`.

## Presidential (state level)

| Test | Trained to | Winner accuracy | Brier | Log loss | Share MAE (pp) | P(actual winner) | Baseline accuracy | Baseline Brier |
|---|---|---|---|---|---|---|---|---|
| 2003 | 1999 | 65% | 0.542 | 0.820 | 3.0 | 92% | 65% | 0.703 |
| 2011 | 2003 | 89% | 0.253 | 0.510 | 4.9 | 97% | 78% | 0.703 |
| 2015 | 2011 | 78% | 0.294 | 0.450 | 10.5 | 24% | 78% | 0.432 |
| 2019 | 2015 | 84% | 0.232 | 0.394 | 3.7 | 61% | 84% | 0.324 |
| 2023 | 2019 | 49% | 0.705 | 1.276 | 7.2 | 60% | 32% | 1.351 |
| **Average** | | **73%** | **0.405** | **0.690** | 5.9 | 67% | 68% | 0.703 |

Baseline: every state votes for the same party family as last time. Brier and log loss: lower is better.
2007 by state was never published (no fold); 2011 is estimated from NDI's state percentages (model only).

Opinion polls (surveys only; online and app panels excluded): weight **0.25** (best on 2 elections with polls: 0.5, shrunk towards 0). Weights used in each test (from earlier elections only): 2003: 0.00, 2011: 0.00, 2015: 0.00, 2019: 0.17, 2023: 0.17.

Online attention weight (tuned on 2019 and 2023): **0.0** (losses by weight: 0.0: 0.0911, 0.05: 0.0912, 0.1: 0.0913, 0.15: 0.0915).

### Live model replay (2023)

States revealed one at a time in five random orders; probability given to the eventual winner:

| States declared | 0 | 6 | 12 | 18 | 24 | 30 | 37 |
|---|---|---|---|---|---|---|---|
| Average | 60% | 52% | 60% | 78% | 88% | 91% | 100% |
| Lowest | 60% | 29% | 19% | 60% | 71% | 83% | 100% |

## Governorship

| Year | Races | Winner accuracy | Brier | Log loss | Winner share error (pp) | Governor's party wins | Last result repeats |
|---|---|---|---|---|---|---|---|
| 2007 | 35 | 83% | 0.228 | 0.407 | 17.5 | 89% | 86% |
| 2010 | 1 | 0% | 1.187 | 2.446 | 19.5 | 0% | 0% |
| 2011 | 27 | 78% | 0.324 | 0.569 | 14.0 | 78% | 74% |
| 2012 | 6 | 67% | 0.384 | 0.710 | 23.3 | 67% | 67% |
| 2013 | 1 | 0% | 0.827 | 1.541 | 20.0 | 100% | 100% |
| 2014 | 2 | 100% | 0.269 | 0.517 | 7.6 | 50% | 50% |
| 2015 | 30 | 70% | 0.376 | 0.577 | 19.4 | 57% | 60% |
| 2016 | 2 | 100% | 0.434 | 0.679 | 6.1 | 100% | 100% |
| 2017 | 1 | 0% | 0.985 | 1.539 | 35.7 | 100% | 100% |
| 2018 | 2 | 100% | 0.291 | 0.567 | 9.6 | 50% | 50% |
| 2019 | 30 | 83% | 0.231 | 0.396 | 15.5 | 80% | 83% |
| 2020 | 2 | 100% | 0.254 | 0.454 | 10.2 | 50% | 100% |
| 2021 | 1 | 0% | 1.126 | 1.752 | 27.2 | 100% | 100% |
| 2022 | 2 | 50% | 0.497 | 0.874 | 16.1 | 50% | 50% |
| 2023 | 31 | 74% | 0.401 | 0.679 | 12.9 | 68% | 68% |
| 2024 | 2 | 50% | 0.516 | 0.911 | 19.2 | 50% | 50% |
| 2026 | 2 | 50% | 0.709 | 1.007 | 29.5 | 100% | 100% |
| **All** | 177 | **76%** | **0.338** | **0.573** | | 73% | 74% |

The baselines name a winner with certainty, so their Brier score is twice their error rate (≈0.52). Anyanwụ names the winner slightly less often but gives far better
probabilities. Projected vote shares are deliberately conservative: big upsets by strong candidates on new
platforms (Imo 2007, Ogun 2019, Oyo 2015) are common, and history alone cannot see them coming.
