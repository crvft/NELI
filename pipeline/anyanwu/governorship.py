"""Governorship model.

Each candidate's score combines:
- the state's last governorship result, carried by candidate and party family
  (vote pools, as in the presidential model)
- the state's last presidential result, carried by party family
- incumbency: the sitting governor running again; the governor's party
- the president's party ("federal might"), separately for off-cycle races

Scores become vote shares through a softmax (a multinomial logit). Coefficients are
fitted by maximum likelihood on earlier elections only (walk-forward by year), with a
ridge penalty. Win probabilities come from simulating score noise whose size is
estimated from the training residuals.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.optimize import minimize

from .data import Contestant, Race, family, same_person

FEATURES = [
    "last_gov",
    "last_pres",
    "incumbent_running",
    "governors_party",
    "presidents_party",
    "presidents_party_offcycle",
    "no_base",
    "log_last_gov",
    "log_last_pres",
    "personal_best",
]
EPS = 0.002


def presidents_family(year: int) -> str:
    """Party family of the sitting president during a year's governorship elections
    (PDP 1999–May 2015, APC since)."""
    return "PDP" if year <= 2015 else "APC"


def carry(
    prev: Race | None, cons: list[Contestant], w_c: float, w_0: float, by_candidate: bool = True, area: int = 0
) -> np.ndarray:
    """Expected shares for `cons` from a previous result's pools (one area)."""
    out = np.zeros(len(cons))
    if prev is None or prev.shares is None:
        return np.full(len(cons), 1 / len(cons))
    orphan = 0.0
    for j, old in enumerate(prev.contestants):
        s = prev.shares[area, j]
        if old.is_others:
            orphan += s
            continue
        t = np.array(
            [
                (w_c if by_candidate and same_person(c.candidate, old.candidate) else 0.0)
                + (1.0 if c.fam == old.fam and c.fam != "OTHER" else 0.0)
                for c in cons
            ]
        )
        if t.sum() == 0:
            orphan += s
            continue
        out += s * t / (t.sum() + w_0)
        orphan += s * w_0 / (t.sum() + w_0)
    out = np.maximum(out, 1e-3)
    out += orphan * out / out.sum()
    return out / out.sum()


@dataclass
class Example:
    race: Race
    X: np.ndarray  # [k, features]
    y: np.ndarray | None  # actual shares


def features(
    cons: list[Contestant],
    year: int,
    off_cycle: bool,
    prev_gov: Race | None,
    prev_pres: Race | None,
    pres_area: int | None,
    incumbent: str | None = None,
    incumbent_family: str | None = None,
    w_c: float = 1.5,
    w_0: float = 0.1,
    history: list[Race] | None = None,
) -> np.ndarray:
    g = carry(prev_gov, cons, w_c, w_0)
    p = (
        carry(prev_pres, cons, 0.0, w_0, by_candidate=False, area=pres_area or 0)
        if prev_pres is not None
        else np.full(len(cons), 1 / len(cons))
    )
    if prev_gov is not None and incumbent is None:
        w = prev_gov.winner()
        incumbent = prev_gov.contestants[w].candidate
        incumbent_family = prev_gov.contestants[w].fam
    pf = presidents_family(year)
    # A candidate's best share in any earlier governorship race in this state
    # (former governors and repeat contenders carry a personal vote across parties)
    best = np.zeros(len(cons))
    for r in history or []:
        for j, old in enumerate(r.contestants):
            for k, c in enumerate(cons):
                if same_person(c.candidate, old.candidate):
                    best[k] = max(best[k], float(r.shares[0, j]))
    rows = []
    for k, c in enumerate(cons):
        rows.append(
            [
                g[k],  # shares, not logs: an upset from a tiny base shouldn't dominate the fit
                p[k],
                float(same_person(c.candidate, incumbent)),
                float(incumbent_family is not None and c.fam == incumbent_family),
                float(c.fam == pf),
                float(c.fam == pf and off_cycle),
                float(g[k] < 0.01 and p[k] < 0.01),  # no vote base anywhere: a minor candidate
                np.log(g[k] + EPS),
                np.log(p[k] + EPS),
                best[k],
            ]
        )
    return np.array(rows)


def group_minor(cons: list[Contestant], X: np.ndarray, y: np.ndarray | None):
    """Fold candidates with no vote base anywhere (and not the incumbent) into one
    "Others" entry, so dozens of minor names don't each take a slice of the softmax."""
    minor = (X[:, 0] < 0.01) & (X[:, 1] < 0.01) & (X[:, 2] == 0) & (X[:, 9] < 0.05)
    if minor.sum() <= 1:
        return cons, X, y, list(range(len(cons)))
    keep = np.nonzero(~minor)[0].tolist()
    xo = X[minor].sum(0)
    xo[2:6] = 0
    xo[6] = 1.0
    xo[7:9] = np.log(xo[0:2] + EPS)
    xo[9] = 0.0
    cons2 = [cons[i] for i in keep] + [Contestant("Others", "OTH")]
    X2 = np.vstack([X[keep], xo])
    y2 = None if y is None else np.append(y[keep], y[minor].sum())
    return cons2, X2, y2, keep


def softmax(z: np.ndarray) -> np.ndarray:
    z = z - z.max()
    e = np.exp(z)
    return e / e.sum()


PRIOR = np.array([2.0, 1.5, 0.6, 0.3, 0.2, 0.2, -1.0, 1.0, 0.6, 1.0])


# Win probabilities use the shares directly; projected vote shares use their logs
# (multiplicative), which lets a dominant party reach landslide shares.
WIN_COLS = [0, 1, 2, 3, 4, 5, 6, 9]
SHARE_COLS = [2, 3, 4, 5, 6, 7, 8, 9]


def fit(examples: list[Example], ridge: float = 0.5, target: str = "share") -> np.ndarray:
    """target="share": multinomial likelihood of vote shares (for projected shares).
    target="winner": conditional logit on who won (for win probabilities); this also
    uses races where only the winner is on record."""
    if target == "winner":
        exs = []
        for e in examples:
            w = e.race.meta["winner"] if "winner" in e.race.meta else e.race.winner()
            y = np.zeros(len(e.race.contestants))
            y[w] = 1.0
            exs.append(Example(e.race, e.X, y))
    else:
        exs = [e for e in examples if e.y is not None]
    if not exs:
        return PRIOR.copy()
    cols = np.array(WIN_COLS if target == "winner" else SHARE_COLS)
    mask = np.zeros(len(PRIOR))
    mask[cols] = 1.0

    def nll(theta):
        theta = theta * mask
        total, grad = 0.0, np.zeros_like(theta)
        for e in exs:
            p = softmax(e.X @ theta)
            total -= float(e.y @ np.log(np.clip(p, 1e-9, None)))
            grad -= e.X.T @ (e.y - p * e.y.sum())
        total /= len(exs)
        grad /= len(exs)
        total += ridge * float((((theta - PRIOR) * mask) ** 2).sum()) / len(exs)
        grad += 2 * ridge * (theta - PRIOR) / len(exs)
        return total, grad * mask

    r = minimize(nll, PRIOR * mask, jac=True, method="L-BFGS-B")
    return r.x * mask


def noise_scale(examples: list[Example], theta: np.ndarray) -> float:
    """SD of log-share errors for the top two finishers (shrunk towards 0.35)."""
    res = []
    for e in examples:
        if e.y is None:
            continue
        p = softmax(e.X @ theta)
        top = np.argsort(-e.y)[:2]
        res.extend((np.log(np.clip(e.y[top], 1e-3, None)) - np.log(np.clip(p[top], 1e-3, None))).tolist())
    if not res:
        return 0.35
    n0 = 20
    return float(np.sqrt((len(res) * np.mean(np.square(res)) + n0 * 0.35**2) / (len(res) + n0)))


def predict(X: np.ndarray, theta: np.ndarray, tau: float, n: int = 4000, seed: int = 3) -> dict:
    rng = np.random.default_rng(seed)
    base = X @ theta
    z = base[None, :] + rng.normal(0, tau, (n, len(base)))
    z -= z.max(1, keepdims=True)
    s = np.exp(z)
    s /= s.sum(1, keepdims=True)
    win = s.argmax(1)
    return {
        "share_mean": softmax(base),
        "share_lo": np.quantile(s, 0.1, axis=0),
        "share_hi": np.quantile(s, 0.9, axis=0),
        "win_prob": np.bincount(win, minlength=len(base)) / n,
    }


def as_contestants(rows: list[tuple[str, str]]) -> list[Contestant]:
    return [Contestant(c, p) for c, p in rows]


__all__ = ["FEATURES", "Example", "features", "fit", "noise_scale", "predict", "presidents_family", "family"]
