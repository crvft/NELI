"""Presidential model.

1. Vote pools. Every state's result last time is a set of pools, one per ticket
   (candidate + party + running mate). Each pool flows to this election's tickets by
   how they are linked: the same candidate (w_c), the same party family (w_f = 1, the
   reference), a running-mate link (w_r), with a share leaking to minor candidates
   (w_0). This is what lets the model follow realignments, e.g. Obi's 2023 LP vote
   when he runs for NDC in 2027, or Atiku's PDP vote when he runs for ADC.
2. Home effects. A candidate does better in their home state (b_s) and zone (b_z), as
   does a running mate (b_rs, b_rz). A pool loses its old candidate's home effect and
   gains the new one's when it moves.
3. Uncertainty (finance-style factor model): errors in centred log-ratio share space
   are national (sigma_n, shared by every state), zonal (sigma_z, shared within a
   geopolitical zone: "neighbours vote alike") and state-level (sigma_s). Each sigma is
   estimated from earlier backtest residuals and shrunk towards a prior.
4. Simulation applies the constitutional rule: most votes and at least 25% in 24 of
   the 37 areas (two-thirds of the states, counting the FCT); otherwise a run-off.

Parameters are tuned jointly across all available walk-forward folds.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, fields

import numpy as np
from scipy.optimize import minimize

from .data import CODES, ZONE, ZONES, Contestant, Race, same_person

ZIDX = np.array([ZONES.index(ZONE[c]) for c in CODES])
THRESHOLD_STATES = 24  # two-thirds of 36 states + FCT, as INEC applied it in 2023


@dataclass
class Params:
    w_c: float = 1.5  # candidate continuity (relative to party family = 1)
    w_r: float = 0.5  # running-mate link
    w_0: float = 0.1  # leak to minor candidates
    b_s: float = 0.6  # home state (log-share boost)
    b_z: float = 0.3  # home zone
    b_rs: float = 0.2  # running mate's home state
    b_rz: float = 0.1  # running mate's home zone
    gamma: float = 0.0  # online attention (low weight, capped)

    BOUNDS = {
        "w_c": (0.0, 6.0),
        "w_r": (0.0, 3.0),
        "w_0": (0.01, 1.0),
        "b_s": (0.0, 1.5),
        "b_z": (0.0, 1.2),
        "b_rs": (0.0, 1.0),
        "b_rz": (0.0, 1.0),
        "gamma": (0.0, 0.15),
    }

    def vector(self, names):
        return np.array([getattr(self, n) for n in names])

    @classmethod
    def from_vector(cls, names, v, base: Params | None = None):
        d = asdict(base or cls())
        d.update(dict(zip(names, map(float, v), strict=True)))
        return cls(**d)


@dataclass
class Sigma:
    national: float = 0.35
    zone: float = 0.20
    state: float = 0.25


PRIOR_SIGMA = Sigma()


def home_effect(c: Contestant, p: Params) -> np.ndarray:
    """Log-share boost by area for a ticket's home state and zone."""
    h = np.zeros(len(CODES))
    if c.is_others:
        return h
    for st, bs, bz in ((c.home, p.b_s, p.b_z), (c.rm_home, p.b_rs, p.b_rz)):
        if st in ZONE:
            h += bz * (ZONES.index(ZONE[st]) == ZIDX)
            h[CODES.index(st)] += bs
    return h


def link(new: Contestant, old: Contestant, p: Params) -> float:
    if new.is_others or old.is_others:
        return 0.0
    w = 0.0
    if same_person(new.candidate, old.candidate):
        w += p.w_c
    if new.fam == old.fam and new.fam != "OTHER":
        w += 1.0
    if same_person(new.candidate, old.running_mate) or same_person(new.running_mate, old.candidate):
        w += p.w_r
    return w


def base_shares(prev: Race, cons: list[Contestant], p: Params, attention: np.ndarray | None = None) -> np.ndarray:
    """Expected shares [area, contestant] for a new contest from the previous result."""
    assert prev.shares is not None
    k_oth = next((k for k, c in enumerate(cons) if c.is_others), None)
    out = np.zeros((len(CODES), len(cons)))
    h_new = np.array([home_effect(c, p) for c in cons]).T  # [area, k]
    orphan = np.zeros(len(CODES))
    for j, old in enumerate(prev.contestants):
        pool = prev.shares[:, j]
        if old.is_others:
            if k_oth is not None:
                out[:, k_oth] += pool
            continue
        t = np.array([link(c, old, p) for c in cons])
        if t.sum() == 0:  # the ticket's party and people are gone: spreads over the new field
            orphan += pool
            continue
        leak = p.w_0
        denom = t.sum() + leak
        h_old = home_effect(old, p)
        for k in np.nonzero(t)[0]:
            out[:, k] += pool * (t[k] / denom) * np.exp(h_new[:, k] - h_old)
        if k_oth is not None:
            out[:, k_oth] += pool * leak / denom
    # Contestants with no pool at all (brand-new parties) start from a small floor,
    # boosted at home; the national error term carries the uncertainty.
    floor = 0.004 * np.exp(h_new)
    out = np.maximum(out, floor)
    out += orphan[:, None] * out / out.sum(1, keepdims=True)
    if attention is not None and p.gamma > 0:
        out *= attention[None, :] ** p.gamma
    return out / out.sum(1, keepdims=True)


# ---------------------------------------------------------------------------
# Fitting
# ---------------------------------------------------------------------------


def fold_loss(prev: Race, cur: Race, p: Params, attention=None) -> float:
    pred = base_shares(prev, cur.contestants, p, attention)
    w = cur.totals / cur.totals.sum()
    return float((w[:, None] * (pred - cur.shares) ** 2).sum())


FIT = ["w_c", "w_r", "w_0", "b_s", "b_z", "b_rs", "b_rz"]


def fit(folds: list[tuple[Race, Race]], base: Params | None = None, ridge: float = 2e-4) -> Params:
    """Tune parameters jointly across folds (average loss), with a ridge pull towards
    the prior so a few folds can't push them to extremes (shrinkage)."""
    base = base or Params()
    if not folds:
        return base
    x0 = base.vector(FIT)
    scale = np.array([Params.BOUNDS[n][1] for n in FIT])

    def obj(x):
        p = Params.from_vector(FIT, x, base)
        loss = np.mean([fold_loss(a, b, p) for a, b in folds])
        return loss + ridge * float((((x - x0) / scale) ** 2).sum())

    r = minimize(obj, x0, method="L-BFGS-B", bounds=[Params.BOUNDS[n] for n in FIT])
    return Params.from_vector(FIT, r.x, base)


def clr(s: np.ndarray) -> np.ndarray:
    z = np.log(np.clip(s, 1e-3, None))
    return z - z.mean(-1, keepdims=True)


def residual_parts(prev: Race, cur: Race, p: Params):
    """National, zonal and state components of the forecast error (clr space), for
    contestants that mattered (>=3% nationally)."""
    pred = base_shares(prev, cur.contestants, p)
    r = clr(cur.shares) - clr(pred)
    w = cur.totals / cur.totals.sum()
    nat_share = (w[:, None] * cur.shares).sum(0)
    keep = [k for k, c in enumerate(cur.contestants) if not c.is_others and nat_share[k] >= 0.03]
    nat, zon, st = [], [], []
    for k in keep:
        n = float((w * r[:, k]).sum())
        nat.append(n)
        for z in range(len(ZONES)):
            m = z == ZIDX
            zm = float((w[m] * r[m, k]).sum() / w[m].sum()) - n
            zon.append(zm)
            st.extend((r[m, k] - n - zm).tolist())
    return np.array(nat), np.array(zon), np.array(st)


def estimate_sigma(folds, p: Params, n0: float = 4.0) -> Sigma:
    """Pooled residual SDs, shrunk towards the prior with n0 pseudo-observations."""
    if not folds:
        return PRIOR_SIGMA
    parts = [residual_parts(a, b, p) for a, b in folds]
    out = {}
    for i, f in enumerate(fields(Sigma)):
        x = np.concatenate([pp[i] for pp in parts])
        prior = getattr(PRIOR_SIGMA, f.name)
        n = len(x) if i == 0 else len(x) / (6 if i == 1 else 30)  # effective sample sizes
        out[f.name] = float(np.sqrt((n * np.mean(x**2) + n0 * prior**2) / (n + n0)))
    return Sigma(**out)


# ---------------------------------------------------------------------------
# Simulation
# ---------------------------------------------------------------------------


@dataclass
class Forecast:
    contestants: list[Contestant]
    mean: np.ndarray  # [area, k] expected shares
    sims: np.ndarray  # [n, area, k] simulated shares
    turnout: np.ndarray  # [n, area] simulated valid votes
    sigma: Sigma

    def national(self) -> np.ndarray:  # [n, k]
        v = self.sims * self.turnout[:, :, None]
        return v.sum(1) / self.turnout.sum(1, keepdims=True)

    def summary(self) -> dict:
        nat = self.national()
        first = nat.argmax(1)
        spread = (self.sims >= 0.25).sum(1)  # [n, k]
        n = len(nat)
        outright = spread[np.arange(n), first] >= THRESHOLD_STATES
        rows = []
        for k, c in enumerate(self.contestants):
            rows.append(
                {
                    "candidate": c.candidate,
                    "party": c.party,
                    "running_mate": c.running_mate,
                    "home_state": c.home,
                    "first_prob": float((first == k).mean()),
                    "outright_prob": float(((first == k) & outright).mean()),
                    "share_mean": float(nat[:, k].mean()),
                    "share_lo": float(np.quantile(nat[:, k], 0.1)),
                    "share_hi": float(np.quantile(nat[:, k], 0.9)),
                    "states_25_mean": float(spread[:, k].mean()),
                }
            )
        states = []
        win = self.sims.argmax(2)
        for i, code in enumerate(CODES):
            states.append(
                {
                    "code": code,
                    "contestants": [
                        {
                            "party": c.party,
                            "candidate": c.candidate,
                            "share_mean": float(self.sims[:, i, k].mean()),
                            "share_lo": float(np.quantile(self.sims[:, i, k], 0.1)),
                            "share_hi": float(np.quantile(self.sims[:, i, k], 0.9)),
                            "win_prob": float((win[:, i] == k).mean()),
                        }
                        for k, c in enumerate(self.contestants)
                    ],
                }
            )
        return {"contestants": rows, "runoff_prob": float((~outright).mean()), "states": states}


def simulate(mean: np.ndarray, totals: np.ndarray, sigma: Sigma, n: int = 8000, seed: int = 7, cons=None) -> Forecast:
    rng = np.random.default_rng(seed)
    a, k = mean.shape
    z = np.log(np.clip(mean, 1e-4, None))[None]
    eta = rng.normal(0, sigma.national, (n, 1, k))
    zeta = rng.normal(0, sigma.zone, (n, len(ZONES), k))[:, ZIDX, :]
    eps = rng.normal(0, sigma.state, (n, a, k))
    zz = z + eta + zeta + eps
    zz -= zz.max(2, keepdims=True)
    s = np.exp(zz)
    s /= s.sum(2, keepdims=True)
    t = totals[None] * np.exp(rng.normal(0, 0.10, (n, 1)) + rng.normal(0, 0.15, (n, a)))
    return Forecast(cons or [], mean, s, t, sigma)


def forecast(
    prev: Race, cons: list[Contestant], p: Params, sigma: Sigma, attention=None, poll=None, lam: float = 0.0, **kw
) -> Forecast:
    from . import polls

    mean = polls.apply(base_shares(prev, cons, p, attention), prev.totals, poll, lam)
    return simulate(mean, prev.totals, sigma, cons=cons, **kw)
