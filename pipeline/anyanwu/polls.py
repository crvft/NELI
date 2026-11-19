"""Opinion polls: a light, backtested input to the presidential model.

Nigerian presidential polling is sparse and uneven (self-selected online polls,
smartphone panels that overstate urban voters), so polls only nudge the national
share of each candidate towards the poll average: new = (1 - λ) × model + λ × polls.
λ is chosen by the backtest on the elections that had polls (2015, 2023; 2019's two
polls are of unclear method and excluded by default), and capped at 0.5.

Polls are recorded in data/model/presidential_polls.csv with their method.
"""

from __future__ import annotations

from datetime import date, timedelta
from functools import cache

import numpy as np
import pandas as pd

from .data import MODEL_DIR, Contestant, same_person

ELECTION_DAY = {2015: date(2015, 3, 28), 2019: date(2019, 2, 23), 2023: date(2023, 2, 25), 2027: date(2027, 1, 16)}
SURVEY_METHODS = {"face-to-face survey", "phone survey", "survey"}
WINDOW_DAYS = 183  # polls from the last six months before polling day


@cache
def table() -> pd.DataFrame:
    path = MODEL_DIR / "presidential_polls.csv"
    df = pd.read_csv(path, keep_default_na=False) if path.exists() else pd.DataFrame()
    if len(df):
        df["fieldwork_end"] = pd.to_datetime(df.fieldwork_end).dt.date
    return df


def average(year: int, cons: list[Contestant], methods: set[str] | None = SURVEY_METHODS) -> np.ndarray | None:
    """Poll average per contestant (shares among the named candidates, so undecided
    respondents are left out), or None when no qualifying poll exists. Contestants a
    poll doesn't name get NaN."""
    df = table()
    if not len(df) or year not in ELECTION_DAY:
        return None
    day = ELECTION_DAY[year]
    df = df[(df.year == year) & (df.fieldwork_end <= day) & (df.fieldwork_end >= day - timedelta(days=WINDOW_DAYS))]
    if methods is not None:
        df = df[df.method.isin(methods)]
    if not len(df):
        return None
    per_poll = []
    for _, g in df.groupby(["pollster", "fieldwork_end"]):
        v = np.full(len(cons), np.nan)
        for r in g.itertuples():
            k = next((i for i, c in enumerate(cons) if same_person(c.candidate, r.candidate)), None)
            if k is not None:
                v[k] = float(r.share)
        named = ~np.isnan(v)
        if named.sum() < 2:
            continue
        v[named] = v[named] / v[named].sum()
        per_poll.append(v)
    if not per_poll:
        return None
    arr = np.array(per_poll)
    out = np.full(len(cons), np.nan)
    seen = ~np.isnan(arr).all(0)
    out[seen] = np.nanmean(arr[:, seen], axis=0)
    return out


def apply(shares: np.ndarray, totals: np.ndarray, poll: np.ndarray | None, lam: float) -> np.ndarray:
    """Shift each polled contestant's national share towards the poll average,
    keeping each state's pattern (a uniform multiplicative shift)."""
    if poll is None or lam <= 0:
        return shares
    w = totals / totals.sum()
    nat = (w[:, None] * shares).sum(0)
    polled = ~np.isnan(poll)
    # Poll shares are among the polled candidates; rescale to their combined model share
    target = nat.copy()
    target[polled] = poll[polled] * nat[polled].sum()
    new_nat = (1 - lam) * nat + lam * target
    out = shares * (new_nat / np.clip(nat, 1e-6, None))[None, :]
    return out / out.sum(1, keepdims=True)


GRID = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5]


def tune(cases: list[tuple], n0: float = 2.0) -> dict:
    """Choose λ on earlier elections that had survey polls, then shrink it towards 0
    with n0 pseudo-elections of "no information": λ = λ̂ · n / (n + n0).
    cases: (base_shares, actual_shares, totals, poll_average) per election."""
    cases = [c for c in cases if c[3] is not None]
    if not cases:
        return {"lam": 0.0, "raw": 0.0, "n": 0, "grid": {}}
    losses = {}
    for lam in GRID:
        ls = []
        for base, actual, totals, poll in cases:
            s = apply(base, totals, poll, lam)
            w = totals / totals.sum()
            ls.append(float((w[:, None] * (s - actual) ** 2).sum()))
        losses[str(lam)] = float(np.mean(ls))
    raw = float(GRID[int(np.argmin(list(losses.values())))])
    n = len(cases)
    return {"lam": raw * n / (n + n0), "raw": raw, "n": n, "grid": losses}
