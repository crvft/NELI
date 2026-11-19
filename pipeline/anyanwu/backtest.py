"""Walk-forward backtests: every past election is forecast using only what came before it.

Metrics (state level unless noted):
- winner accuracy: share of states where the most likely winner won
- Brier score: mean squared error of the win probabilities (0 is perfect; lower is better)
- log loss: -log(probability given to the actual winner), clipped at 1%
- share MAE: mean absolute error of national vote shares, in percentage points
- national: probability given to the actual national winner
"""

from __future__ import annotations

from dataclasses import asdict

import numpy as np

from . import presidential as P
from .data import Race


def _state_metrics(probs: np.ndarray, cur: Race) -> dict:
    """probs [area, k] win probabilities."""
    y = np.zeros_like(probs)
    win = cur.shares.argmax(1)
    y[np.arange(len(win)), win] = 1
    p_true = probs[np.arange(len(win)), win]
    return {
        "winner_accuracy": float((probs.argmax(1) == win).mean()),
        "brier": float(((probs - y) ** 2).sum(1).mean()),
        "log_loss": float(-np.log(np.clip(p_true, 0.01, 1)).mean()),
    }


def _national(cur: Race) -> np.ndarray:
    w = cur.totals / cur.totals.sum()
    return (w[:, None] * cur.shares).sum(0)


def presidential_folds(races: dict[int, Race]) -> list[tuple[Race, Race]]:
    years = sorted(races)
    return [(races[a], races[b]) for a, b in zip(years, years[1:], strict=False)]


def baseline_params() -> P.Params:
    """'Same party as last time': pools follow party family only, no home effects."""
    return P.Params(w_c=0, w_r=0, w_0=0.05, b_s=0, b_z=0, b_rs=0, b_rz=0)


def presidential_backtest(races: dict[int, Race]) -> dict:
    folds = presidential_folds(races)
    from . import polls

    out_folds = []
    oos_resid = []  # out-of-sample residual parts, for later folds' sigma
    poll_cases = []  # (base, actual, totals, poll) from earlier folds, for λ
    for j, (prev, cur) in enumerate(folds):
        params = P.fit(folds[:j])
        sigma = _sigma_from(oos_resid)
        poll = polls.average(cur.year, cur.contestants)
        lam = polls.tune(poll_cases)["lam"]
        fc = P.forecast(prev, cur.contestants, params, sigma, poll=poll, lam=lam, n=4000, seed=11 + j)
        poll_cases.append((P.base_shares(prev, cur.contestants, params), cur.shares, cur.totals, poll))
        summ = fc.summary()
        probs = np.array([[c["win_prob"] for c in s["contestants"]] for s in summ["states"]])
        nat_actual = _national(cur)
        winner = int(nat_actual.argmax())
        m = _state_metrics(probs, cur)
        m["share_mae_pp"] = float(np.mean(np.abs(np.array([r["share_mean"] for r in summ["contestants"]]) - nat_actual)) * 100)
        m["national_winner_prob"] = summ["contestants"][winner]["first_prob"]
        # Baseline
        base = P.base_shares(prev, cur.contestants, baseline_params())
        bprobs = (base == base.max(1, keepdims=True)).astype(float)
        bm = _state_metrics(bprobs, cur)
        w = cur.totals / cur.totals.sum()
        bnat = (w[:, None] * base).sum(0)
        bm["share_mae_pp"] = float(np.mean(np.abs(bnat - nat_actual)) * 100)
        bm["national_winner_prob"] = float(bnat.argmax() == winner)
        out_folds.append(
            {
                "train_until": prev.year,
                "test": cur.year,
                "poll_weight": lam,
                "polls_available": poll is not None,
                "params": asdict(params),
                "sigma": asdict(sigma),
                "anyanwu": m,
                "baseline": bm,
                "forecast": [
                    {"candidate": r["candidate"], "party": r["party"], "share": r["share_mean"], "first_prob": r["first_prob"]}
                    for r in summ["contestants"]
                ],
                "actual": [
                    {"candidate": c.candidate, "party": c.party, "share": float(nat_actual[k])}
                    for k, c in enumerate(cur.contestants)
                ],
            }
        )
        oos_resid.append(P.residual_parts(prev, cur, params))
    final_params = P.fit(folds)
    final_cases = [
        (P.base_shares(a, b.contestants, final_params), b.shares, b.totals, polls.average(b.year, b.contestants))
        for a, b in folds
    ]
    return {
        "polls": polls.tune(final_cases),
        "folds": out_folds,
        "final_params": asdict(final_params),
        "final_sigma": asdict(_sigma_from(oos_resid)),
        "summary": _avg(out_folds),
    }


def _sigma_from(parts: list, n0: float = 4.0) -> P.Sigma:
    if not parts:
        return P.PRIOR_SIGMA
    out = {}
    for i, name in enumerate(["national", "zone", "state"]):
        x = np.concatenate([pp[i] for pp in parts])
        prior = getattr(P.PRIOR_SIGMA, name)
        n = len(x) if i == 0 else len(x) / (6 if i == 1 else 30)
        out[name] = float(np.sqrt((n * np.mean(x**2) + n0 * prior**2) / (n + n0)))
    return P.Sigma(**out)


def _avg(folds: list[dict]) -> dict:
    keys = folds[0]["anyanwu"].keys()
    return {who: {k: float(np.mean([f[who][k] for f in folds])) for k in keys} for who in ("anyanwu", "baseline")}


# ---------------------------------------------------------------------------
# Governorship
# ---------------------------------------------------------------------------


def governorship_examples(races: list[Race], pres: dict[int, Race]):
    """Each held governorship race with features built only from earlier results."""
    from . import governorship as G
    from .data import CODES

    by_state: dict[str, list[Race]] = {}
    out = []
    for r in sorted(races, key=lambda r: (r.year, r.key)):
        prev_list = [p for p in by_state.get(r.state, []) if p.year < r.year]
        prev = prev_list[-1] if prev_list else None
        # Same-cycle presidential result if there was one (held ~2 weeks earlier),
        # else the latest before
        pyears = [y for y in pres if y <= r.year]
        prev_pres = pres[max(pyears)] if pyears else None
        if prev is not None:
            from . import offices

            flags = [offices.for_candidate(r.key, c.candidate, r.state, r.year) for c in r.contestants]
            X = G.features(
                r.contestants, r.year, r.off_cycle, prev, prev_pres, CODES.index(r.state), history=prev_list, office_flags=flags
            )
            y = r.shares[0] if r.coverage != "winner only" else None
            cons, X, y, keep = G.group_minor(r.contestants, X, y)
            w = r.winner()
            win_idx = keep.index(w) if w in keep else len(cons) - 1
            rr = Race(r.key, r.kind, r.year, r.areas, cons, None, r.totals, r.state, r.off_cycle, r.coverage, {"winner": win_idx})
            ex = G.Example(rr, X, y)
            out.append(ex)
        by_state.setdefault(r.state, []).append(r)
    return out


def governorship_backtest(races: list[Race], pres: dict[int, Race]) -> dict:
    from . import governorship as G

    exs = governorship_examples(races, pres)
    years = sorted({e.race.year for e in exs})
    folds = []
    for y in years:
        train = [e for e in exs if e.race.year < y]
        test = [e for e in exs if e.race.year == y]
        if len([e for e in train if e.y is not None]) < 20:
            continue
        theta = G.fit(train)
        theta_w = G.fit(train, target="winner")
        tau = G.noise_scale(train, theta)
        rows, base_inc, base_last = [], [], []
        for e in test:
            pr = G.predict(e.X, theta, tau)
            pr["win_prob"] = G.softmax(e.X @ theta_w)
            win = e.race.meta["winner"]
            k = len(e.race.contestants)
            yv = np.zeros(k)
            yv[win] = 1
            rows.append(
                {
                    "correct": float(pr["win_prob"].argmax() == win),
                    "brier": float(((pr["win_prob"] - yv) ** 2).sum()),
                    "log_loss": float(-np.log(max(pr["win_prob"][win], 0.01))),
                    "winner_share_err_pp": float(abs(pr["share_mean"][win] - e.y[win]) * 100) if e.y is not None else None,
                }
            )
            inc = e.X[:, 3].argmax() if e.X[:, 3].any() else e.X[:, 0].argmax()
            base_inc.append(float(inc == win))
            base_last.append(float(e.X[:, 0].argmax() == win))
        errs = [r["winner_share_err_pp"] for r in rows if r["winner_share_err_pp"] is not None]
        folds.append(
            {
                "test": y,
                "races": len(test),
                "theta": dict(zip(G.FEATURES, map(float, theta), strict=True)),
                "theta_winner": dict(zip(G.FEATURES, map(float, theta_w), strict=True)),
                "tau": tau,
                "anyanwu": {
                    "winner_accuracy": float(np.mean([r["correct"] for r in rows])),
                    "brier": float(np.mean([r["brier"] for r in rows])),
                    "log_loss": float(np.mean([r["log_loss"] for r in rows])),
                    "winner_share_mae_pp": float(np.mean(errs)) if errs else None,
                },
                "baseline_governors_party": float(np.mean(base_inc)),
                "baseline_last_result": float(np.mean(base_last)),
            }
        )
    n = np.array([f["races"] for f in folds], float)

    def wavg(get):
        v = np.array([get(f) for f in folds], float)
        return float((v * n).sum() / n.sum())

    theta = G.fit(exs)
    theta_w = G.fit(exs, target="winner")
    return {
        "folds": folds,
        "summary": {
            "races": int(n.sum()),
            "anyanwu": {
                "winner_accuracy": wavg(lambda f: f["anyanwu"]["winner_accuracy"]),
                "brier": wavg(lambda f: f["anyanwu"]["brier"]),
                "log_loss": wavg(lambda f: f["anyanwu"]["log_loss"]),
            },
            "baseline_governors_party": wavg(lambda f: f["baseline_governors_party"]),
            "baseline_last_result": wavg(lambda f: f["baseline_last_result"]),
        },
        "final_theta": dict(zip(G.FEATURES, map(float, theta), strict=True)),
        "final_theta_winner": dict(zip(G.FEATURES, map(float, theta_w), strict=True)),
        "final_tau": G.noise_scale(exs, theta),
    }
