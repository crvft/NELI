"""Live model: update the pre-election forecast as results come in.

As states declare, their errors against the forecast tell us about the national and
zonal swings that also affect states still counting (the same factor structure the
forecast's uncertainty uses). For each contestant we update those factors with a
Gaussian posterior (declared states weigh in by how much of their vote is counted),
then re-simulate undeclared states around the shifted forecast. Declared states keep
their actual result; partly counted states mix counted and expected votes.
"""

from __future__ import annotations

import numpy as np

from .data import CODES, ZONES
from .presidential import THRESHOLD_STATES, ZIDX, Forecast, Sigma, clr


def update(fc: Forecast, observed: dict[int, tuple[np.ndarray, float]], n: int = 6000, seed: int = 5) -> dict:
    """observed: area index -> (counted shares [k], fraction of the area's vote counted)."""
    sigma: Sigma = fc.sigma
    a, k = fc.mean.shape
    zm = clr(fc.mean)
    rng = np.random.default_rng(seed)
    idx = np.array(sorted(observed), dtype=int)
    # Posterior over u = [national, zone_1..zone_6] per contestant
    prior_var = np.r_[sigma.national**2, np.full(len(ZONES), sigma.zone**2)]
    post_mean = np.zeros((k, 1 + len(ZONES)))
    post_cov = np.zeros((k, 1 + len(ZONES), 1 + len(ZONES)))
    A = np.zeros((len(idx), 1 + len(ZONES)))
    if len(idx):
        A[:, 0] = 1
        A[np.arange(len(idx)), 1 + ZIDX[idx]] = 1
    for j in range(k):
        if len(idx) == 0:
            post_mean[j] = 0
            post_cov[j] = np.diag(prior_var)
            continue
        obs = np.array([clr(observed[i][0][None])[0, j] for i in idx])
        frac = np.array([max(observed[i][1], 0.05) for i in idx])
        r = obs - zm[idx, j]
        w = frac / sigma.state**2
        prec = np.diag(1 / prior_var) + A.T @ (w[:, None] * A)
        cov = np.linalg.inv(prec)
        post_cov[j] = cov
        post_mean[j] = cov @ (A.T @ (w * r))
    # Simulate
    u = np.stack([rng.multivariate_normal(post_mean[j], post_cov[j], n) for j in range(k)], axis=2)  # [n, 7, k]
    shift = u[:, 0:1, :] + u[:, 1:, :][:, ZIDX, :]  # [n, a, k]
    z = np.log(np.clip(fc.mean, 1e-4, None))[None] + shift + rng.normal(0, sigma.state, (n, a, k))
    z -= z.max(2, keepdims=True)
    s = np.exp(z)
    s /= s.sum(2, keepdims=True)
    for i, (shares, frac) in observed.items():
        s[:, i, :] = frac * shares[None, :] + (1 - frac) * s[:, i, :]
    t = fc.turnout[:n] if len(fc.turnout) >= n else np.resize(fc.turnout, (n, a))
    nat = (s * t[:, :, None]).sum(1) / t.sum(1, keepdims=True)
    first = nat.argmax(1)
    spread = (s >= 0.25).sum(1)
    outright = spread[np.arange(n), first] >= THRESHOLD_STATES
    return {
        "first_prob": np.bincount(first, minlength=k) / n,
        "outright_prob": np.array([((first == j) & outright).mean() for j in range(k)]),
        "share_mean": nat.mean(0),
        "national_shift": post_mean[:, 0],
    }


def replay(
    fc: Forecast, actual: np.ndarray, totals: np.ndarray, order: list[int], checkpoints=(0, 6, 12, 18, 24, 30, 37)
) -> list[dict]:
    """Reveal states one by one in `order`; record the winner probabilities."""
    out = []
    winner = int(((actual * totals[:, None]).sum(0)).argmax())
    for c in checkpoints:
        obs = {i: (actual[i], 1.0) for i in order[:c]}
        u = update(fc, obs, n=3000)
        out.append({"declared": c, "winner_prob": float(u["first_prob"][winner]), "first_prob": u["first_prob"].tolist()})
    return out


__all__ = ["update", "replay", "CODES"]
