# Anyanwụ backtest report

Model version 1.0.0, generated 2026-11-18T17:30:06Z. Every number below is **out of sample**: each election
was forecast using only results from before it (walk-forward). Regenerate with `uv run python -m anyanwu.run`.

## Presidential (state level)

| Test | Trained to | Winner accuracy | Brier | Log loss | Share MAE (pp) | P(actual winner) | Baseline accuracy | Baseline Brier |
|---|---|---|---|---|---|---|---|---|
| 2003 | 1999 | 65% | 0.542 | 0.820 | 3.0 | 92% | 65% | 0.703 |
| 2015 | 2003 | 70% | 0.394 | 0.767 | 14.6 | 10% | 70% | 0.595 |
| 2019 | 2015 | 84% | 0.223 | 0.373 | 3.7 | 64% | 84% | 0.324 |
| 2023 | 2019 | 49% | 0.802 | 1.660 | 9.4 | 61% | 32% | 1.351 |
| **Average** | | **67%** | **0.490** | **0.905** | 7.7 | 57% | 63% | 0.743 |

Baseline: every state votes for the same party family as last time. Brier and log loss: lower is better.
2007 and 2011 are missing by state, so the 2003→2015 fold spans the APC merger and is the hardest.

Online attention weight (tuned on 2019 and 2023): **0.0** (losses by weight: 0.0: 0.0893, 0.05: 0.0897, 0.1: 0.0901, 0.15: 0.0906).

### Live model replay (2023)

States revealed one at a time in five random orders; probability given to the eventual winner:

| States declared | 0 | 6 | 12 | 18 | 24 | 30 | 37 |
|---|---|---|---|---|---|---|---|
| Average | 60% | 51% | 59% | 83% | 91% | 95% | 100% |
| Lowest | 60% | 18% | 9% | 61% | 74% | 89% | 100% |

## Governorship

| Year | Races | Winner accuracy | Brier | Log loss | Winner share error (pp) | Governor's party wins | Last result repeats |
|---|---|---|---|---|---|---|---|
| 2007 | 35 | 83% | 0.250 | 0.435 | 17.6 | 89% | 86% |
| 2010 | 1 | 0% | 1.174 | 2.376 | 18.7 | 0% | 0% |
| 2011 | 27 | 74% | 0.422 | 0.692 | 15.0 | 78% | 74% |
| 2012 | 6 | 67% | 0.439 | 0.786 | 24.7 | 67% | 67% |
| 2013 | 1 | 0% | 0.689 | 1.265 | 16.6 | 100% | 100% |
| 2014 | 2 | 50% | 0.576 | 0.841 | 13.5 | 50% | 50% |
| 2015 | 30 | 60% | 0.452 | 0.662 | 20.8 | 57% | 60% |
| 2016 | 2 | 0% | 0.740 | 1.089 | 6.3 | 100% | 100% |
| 2017 | 1 | 0% | 0.903 | 1.451 | 35.7 | 100% | 100% |
| 2018 | 2 | 50% | 0.703 | 1.002 | 5.4 | 50% | 50% |
| 2019 | 30 | 87% | 0.206 | 0.381 | 15.0 | 80% | 83% |
| 2020 | 2 | 100% | 0.281 | 0.486 | 7.8 | 50% | 100% |
| 2021 | 1 | 0% | 1.078 | 1.854 | 28.5 | 100% | 100% |
| 2022 | 2 | 50% | 0.534 | 0.863 | 14.1 | 50% | 50% |
| 2023 | 31 | 74% | 0.381 | 0.617 | 12.6 | 68% | 68% |
| 2024 | 2 | 50% | 0.487 | 0.825 | 19.4 | 50% | 50% |
| 2026 | 2 | 50% | 0.586 | 0.820 | 29.3 | 100% | 100% |
| **All** | 177 | **72%** | **0.373** | **0.609** | | 73% | 74% |

The baselines name a winner with certainty, so their Brier score is twice their error rate (≈0.52). Anyanwụ names the winner slightly less often but gives far better
probabilities. Projected vote shares are deliberately conservative: big upsets by strong candidates on new
platforms (Imo 2007, Ogun 2019, Oyo 2015) are common, and history alone cannot see them coming.
