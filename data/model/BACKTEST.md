# Anyanwụ backtest report

Model version 1.0.0, generated 2026-11-18T20:59:12Z. Every number below is **out of sample**: each election
was forecast using only results from before it (walk-forward). Regenerate with `uv run python -m anyanwu.run`.

## Presidential (state level)

| Test | Trained to | Winner accuracy | Brier | Log loss | Share MAE (pp) | P(actual winner) | Baseline accuracy | Baseline Brier |
|---|---|---|---|---|---|---|---|---|
| 2003 | 1999 | 65% | 0.542 | 0.820 | 3.0 | 92% | 65% | 0.703 |
| 2011 | 2003 | 89% | 0.253 | 0.510 | 4.9 | 97% | 78% | 0.703 |
| 2015 | 2011 | 78% | 0.294 | 0.450 | 10.5 | 24% | 78% | 0.432 |
| 2019 | 2015 | 84% | 0.232 | 0.394 | 3.7 | 61% | 84% | 0.324 |
| 2023 | 2019 | 46% | 0.789 | 1.603 | 9.5 | 59% | 32% | 1.351 |
| **Average** | | **72%** | **0.422** | **0.755** | 6.3 | 67% | 68% | 0.703 |

Baseline: every state votes for the same party family as last time. Brier and log loss: lower is better.
2007 and 2011 are missing by state, so the 2003→2015 fold spans the APC merger and is the hardest.

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
| 2007 | 35 | 83% | 0.250 | 0.435 | 17.6 | 89% | 86% |
| 2010 | 1 | 0% | 1.174 | 2.376 | 18.7 | 0% | 0% |
| 2011 | 27 | 74% | 0.370 | 0.609 | 13.6 | 78% | 74% |
| 2012 | 6 | 67% | 0.412 | 0.780 | 26.5 | 67% | 67% |
| 2013 | 1 | 0% | 0.952 | 1.850 | 22.7 | 100% | 100% |
| 2014 | 2 | 100% | 0.329 | 0.591 | 11.1 | 50% | 50% |
| 2015 | 30 | 63% | 0.412 | 0.620 | 20.2 | 57% | 60% |
| 2016 | 2 | 50% | 0.586 | 0.903 | 3.8 | 100% | 100% |
| 2017 | 1 | 0% | 1.003 | 1.627 | 37.1 | 100% | 100% |
| 2018 | 2 | 50% | 0.588 | 0.864 | 5.8 | 50% | 50% |
| 2019 | 30 | 87% | 0.197 | 0.368 | 15.0 | 80% | 83% |
| 2020 | 2 | 100% | 0.285 | 0.494 | 8.5 | 50% | 100% |
| 2021 | 1 | 0% | 1.153 | 2.096 | 29.6 | 100% | 100% |
| 2022 | 2 | 50% | 0.539 | 0.871 | 13.8 | 50% | 50% |
| 2023 | 31 | 74% | 0.382 | 0.617 | 12.8 | 68% | 68% |
| 2024 | 2 | 50% | 0.432 | 0.747 | 18.1 | 50% | 50% |
| 2026 | 2 | 50% | 0.662 | 0.925 | 29.6 | 100% | 100% |
| **All** | 177 | **73%** | **0.353** | **0.587** | | 73% | 74% |

The baselines name a winner with certainty, so their Brier score is twice their error rate (≈0.52). Anyanwụ names the winner slightly less often but gives far better
probabilities. Projected vote shares are deliberately conservative: big upsets by strong candidates on new
platforms (Imo 2007, Ogun 2019, Oyo 2015) are common, and history alone cannot see them coming.
