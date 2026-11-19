"""Rebuild Anyanwụ end to end.

    uv run python -m anyanwu.run            # backtests + 2027 forecasts
    uv run python -m anyanwu.run --offline  # use cached pages and page views only

Writes data/model/anyanwu.json (published to the site) and data/model/BACKTEST.md.
"""

from __future__ import annotations

import json
import sys
from dataclasses import asdict
from datetime import UTC, date, datetime

import numpy as np
import pandas as pd

from neli_pipeline.parties import normalise_party
from neli_pipeline.paths import PROCESSED
from neli_pipeline.states import STATES

from . import VERSION, attention, backtest, live, offices, upcoming
from . import governorship as G
from . import presidential as P
from .data import CODES, MODEL_DIR, Contestant, Race, family, governorship, presidential, same_person, tickets

OUT = MODEL_DIR / "anyanwu.json"
REPORT = MODEL_DIR / "BACKTEST.md"


def wiki_title(name: str, people: pd.DataFrame) -> str | None:
    for r in people.itertuples():
        if same_person(name, r.name):
            return r.wiki_title
    return None


def attention_vector(cons: list[Contestant], end: date, people: pd.DataFrame, extra: dict[str, str]) -> tuple[np.ndarray, list]:
    titles = [None if c.is_others else (extra.get(c.candidate) or wiki_title(c.candidate, people)) for c in cons]
    sh = attention.shares(titles, end)
    known = [s for s in sh if s]
    fill = float(np.exp(np.mean(np.log(known)))) if known else 1.0
    vec = np.array([s if s else fill for s in sh])
    return vec / vec.sum(), sh


def tune_gamma(races: dict[int, Race], params: P.Params, people) -> dict:
    """Pick the attention weight on the folds where page views exist (2019, 2023)."""
    folds = [(races[2015], races[2019], date(2019, 2, 22)), (races[2019], races[2023], date(2023, 2, 24))]
    vecs = [attention_vector(cur.contestants, end, people, {})[0] for _, cur, end in folds]
    grid = [0.0, 0.05, 0.1, 0.15]
    losses = []
    for g in grid:
        p = P.Params(**{**asdict(params), "gamma": g})
        losses.append(float(np.mean([P.fold_loss(a, b, p, v) for (a, b, _), v in zip(folds, vecs, strict=True)])))
    best = grid[int(np.argmin(losses))]
    return {"gamma": best, "grid": dict(zip(map(str, grid), losses, strict=True))}


def presidential_2027(races, params: P.Params, sigma: P.Sigma, people, lam: float = 0.0) -> tuple[dict, P.Forecast]:
    from . import polls

    t = tickets()
    cons = [
        Contestant(r.candidate, r.party, r.home_state or None, r.running_mate or None, r.running_mate_home_state or None, 2027)
        for r in t[t.year == 2027].itertuples()
    ] + [Contestant("Others", "OTH", year=2027)]
    att, raw = attention_vector(cons, date.today() - pd.Timedelta(days=1), people, {})
    poll = polls.average(2027, cons)
    fc = P.forecast(races[2023], cons, params, sigma, attention=att, poll=poll, lam=lam, n=10000, seed=2027)
    summ = fc.summary()
    summ["polls"] = {
        "weight": lam,
        "available": poll is not None,
        "average": None
        if poll is None
        else {c.candidate: (None if np.isnan(v) else float(v)) for c, v in zip(cons, poll, strict=True)},
    }
    for row, a in zip(summ["contestants"], raw, strict=True):
        row["attention_share"] = a
    return summ, fc


def _current_party(eid: str, cand: str, links: pd.DataFrame, people: pd.DataFrame) -> str | None:
    m = links[(links.election_id == eid) & (links.candidate == cand)]
    if not len(m):
        return None
    row = people[people.id == m.iloc[0].person_id]
    if not len(row) or not row.iloc[0].party:
        return None
    return normalise_party(row.iloc[0].party) or None


def governorship_2027(gov_races: list[Race], pres_fc: P.Forecast, theta, theta_w, tau, offline: bool) -> list[dict]:
    people = pd.read_csv(PROCESSED / "people.csv", keep_default_na=False)
    links = pd.read_csv(PROCESSED / "candidate_people.csv", keep_default_na=False)
    articles = {} if offline else upcoming.governorship_2027()
    pres_cons = pres_fc.contestants
    out = []
    for code in upcoming.GENERAL_CYCLE:
        hist = [r for r in gov_races if r.state == code]
        if not hist:
            continue
        prev = hist[-1]
        w = prev.winner()
        inc = prev.contestants[w]
        wins = sum(1 for r in hist[-2:] if same_person(r.contestants[r.winner()].candidate, inc.candidate))
        term_limited = wins >= 2
        inc_party = _current_party(prev.key, inc.candidate, links, people) or inc.party
        inc_fam = family(inc_party, 2027)
        art = articles.get(code)
        noms = art["nominees"] if art else []
        if noms:
            cons = [Contestant(n, p, home=code, year=2027) for n, p in noms] + [Contestant("Others", "OTH", year=2027)]
            confirmed = True
        else:
            parties = ["APC", "PDP", "ADC", "NDC"]
            pres = backtest_latest_pres(code)
            for c, sh in zip(prev.contestants, prev.shares[0], strict=True):
                if (
                    sh >= 0.10
                    and c.party not in parties
                    and not c.is_others
                    and family(c.party, 2027) not in {family(x, 2027) for x in parties}
                ):
                    parties.append(c.party)
            for c, sh in pres:
                if sh >= 0.10 and c not in parties and c != "OTH":
                    parties.append(c)
            if inc_party not in parties:
                parties.append(inc_party)
            cons = []
            for p in parties:
                runs = (not term_limited) and family(p, 2027) == inc_fam
                cons.append(Contestant(inc.candidate if runs else f"{p} candidate", p, home=code, year=2027))
            cons.append(Contestant("Others", "OTH", year=2027))
            confirmed = False
        # Presidential 2027 forecast at this state stands in for the same-cycle result
        i = CODES.index(code)
        pres_race = Race("pres-2027-forecast", "presidential", 2027, CODES, pres_cons, pres_fc.mean, None)
        incumbent_running_name = None if term_limited else inc.candidate
        flags = [
            offices.for_candidate(prev.key, inc.candidate, code, 2027)
            if same_person(c.candidate, inc.candidate)
            else nominee_flags((art or {}).get("links", {}).get(c.candidate), code)
            for c in cons
        ]
        X = G.features(
            cons,
            2027,
            False,
            prev,
            pres_race,
            i,
            incumbent=incumbent_running_name,
            incumbent_family=inc_fam,
            history=hist,
            office_flags=flags,
        )
        cons2, X2, _y, _keep = G.group_minor(cons, X, None)
        pr = G.predict(X2, theta, tau, seed=hash(code) % 1000)
        winp = G.softmax(X2 @ theta_w)
        rows = [
            {
                "candidate": c.candidate,
                "party": c.party,
                "win_prob": float(winp[k]),
                "share_mean": float(pr["share_mean"][k]),
                "share_lo": float(pr["share_lo"][k]),
                "share_hi": float(pr["share_hi"][k]),
            }
            for k, c in enumerate(cons2)
        ]
        rows.sort(key=lambda r: -r["win_prob"])
        out.append(
            {
                "key": f"gov-{code.lower()}-2027",
                "state": code,
                "title": f"{STATES[code][0]} Governorship 2027",
                "date": upcoming.GOVERNORSHIP_DATE,
                "candidates_confirmed": confirmed,
                "incumbent": inc.candidate,
                "incumbent_party": inc_party,
                "incumbent_term_limited": term_limited,
                "open_seat": term_limited,
                "source_key": art["source_key"] if art else None,
                "contestants": rows,
            }
        )
    return out


def nominee_flags(title: str | None, state: str) -> list[float]:
    """Office signals for a 2027 nominee, from the article the election infobox links to."""
    if not title:
        return [0.0] * len(offices.SIGNALS)
    from neli_pipeline.build_people import parse_person
    from neli_pipeline.sources import wikipedia

    try:
        prof = parse_person(wikipedia.fetch(title.replace("/", "_")), title)
    except Exception:  # noqa: BLE001 - a missing article just means no signal
        return [0.0] * len(offices.SIGNALS)
    return offices.flags(prof.offices if prof else [], state, 2027)


def backtest_latest_pres(code: str) -> list[tuple[str, float]]:
    r = presidential()[2023]
    i = CODES.index(code)
    return [(c.party, float(r.shares[i, k])) for k, c in enumerate(r.contestants)]


def main(offline: bool = False) -> int:
    races = presidential()
    gov = governorship()
    people = pd.read_csv(PROCESSED / "people.csv", keep_default_na=False)

    print("Presidential walk-forward backtest…")
    pbt = backtest.presidential_backtest(races)
    params = P.Params(**pbt["final_params"])
    sigma = P.Sigma(**pbt["final_sigma"])
    g = tune_gamma(races, params, people)
    params.gamma = g["gamma"]
    pbt["attention"] = g

    print("Live model replay of 2023…")
    f = pbt["folds"][-1]
    fc23 = P.forecast(races[2019], races[2023].contestants, P.Params(**f["params"]), P.Sigma(**f["sigma"]), n=3000)
    rng = np.random.default_rng(23)
    replays = [live.replay(fc23, races[2023].shares, races[2023].totals, list(rng.permutation(len(CODES)))) for _ in range(5)]
    cps = [r["declared"] for r in replays[0]]
    pbt["live_replay_2023"] = {
        "winner": "Bola Tinubu",
        "checkpoints": cps,
        "mean_winner_prob": [float(np.mean([rp[i]["winner_prob"] for rp in replays])) for i in range(len(cps))],
        "min_winner_prob": [float(np.min([rp[i]["winner_prob"] for rp in replays])) for i in range(len(cps))],
    }

    print("2027 presidential forecast…")
    pres27, fc27 = presidential_2027(races, params, sigma, people, lam=pbt["polls"]["lam"])
    pres27.update(
        {
            "key": "pres-2027",
            "title": "2027 Presidential Election",
            "date": upcoming.PRESIDENTIAL_DATE,
            "source_key": None if offline else upcoming.presidential_2027_source(),
        }
    )

    print("Governorship walk-forward backtest…")
    gbt = backtest.governorship_backtest(gov, races)
    theta = np.array([gbt["final_theta"][k] for k in G.FEATURES])
    theta_w = np.array([gbt["final_theta_winner"][k] for k in G.FEATURES])
    print("2027 governorship forecasts…")
    gov27 = governorship_2027(gov, fc27, theta, theta_w, gbt["final_tau"], offline)

    payload = {
        "model": "Anyanwụ",
        "version": VERSION,
        "generated_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "presidential": pres27,
        "governorship": gov27,
        "params": {"presidential": asdict(params), "sigma": asdict(sigma), "governorship_tau": gbt["final_tau"]},
        "backtest": {"presidential": pbt, "governorship": gbt},
    }
    OUT.write_text(json.dumps(payload, indent=1, ensure_ascii=False) + "\n")
    REPORT.write_text(report(payload))
    print(f"Wrote {OUT.relative_to(MODEL_DIR.parent.parent)} and {REPORT.name}")
    for r in pres27["contestants"]:
        print(f"  {r['candidate']:<22} {r['party']:<5} win {r['first_prob']:.0%}  share {r['share_mean']:.1%}")
    print(f"  run-off {pres27['runoff_prob']:.0%}")
    return 0


def _pct(x, d=0):
    return "–" if x is None else f"{x * 100:.{d}f}%"


def report(p: dict) -> str:
    pb, gb = p["backtest"]["presidential"], p["backtest"]["governorship"]
    lines = [
        "# Anyanwụ backtest report",
        "",
        f"Model version {p['version']}, generated {p['generated_at']}. Every number below is **out of sample**: each election",
        "was forecast using only results from before it (walk-forward). Regenerate with `uv run python -m anyanwu.run`.",
        "",
        "## Presidential (state level)",
        "",
        "| Test | Trained to | Winner accuracy | Brier | Log loss | Share MAE (pp) | P(actual winner) | Baseline accuracy | Baseline Brier |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for f in pb["folds"]:
        a, b = f["anyanwu"], f["baseline"]
        lines.append(
            f"| {f['test']} | {f['train_until']} | {_pct(a['winner_accuracy'])} | {a['brier']:.3f} | {a['log_loss']:.3f} | "
            f"{a['share_mae_pp']:.1f} | {_pct(a['national_winner_prob'])} | {_pct(b['winner_accuracy'])} | {b['brier']:.3f} |"
        )
    s = pb["summary"]
    lines += [
        f"| **Average** | | **{_pct(s['anyanwu']['winner_accuracy'])}** | **{s['anyanwu']['brier']:.3f}** | **{s['anyanwu']['log_loss']:.3f}** | "
        f"{s['anyanwu']['share_mae_pp']:.1f} | {_pct(s['anyanwu']['national_winner_prob'])} | {_pct(s['baseline']['winner_accuracy'])} | {s['baseline']['brier']:.3f} |",
        "",
        "Baseline: every state votes for the same party family as last time. Brier and log loss: lower is better.",
        "2007 by state was never published (no fold); 2011 is estimated from NDI's state percentages (model only).",
        "",
        f"Opinion polls (surveys only; online and app panels excluded): weight **{pb['polls']['lam']:.2f}** "
        f"(best on {pb['polls']['n']} elections with polls: {pb['polls']['raw']}, shrunk towards 0). "
        "Weights used in each test (from earlier elections only): "
        + ", ".join(f"{f['test']}: {f['poll_weight']:.2f}" for f in pb["folds"])
        + ".",
        "",
        f"Online attention weight (tuned on 2019 and 2023): **{pb['attention']['gamma']}** "
        f"(losses by weight: {', '.join(f'{k}: {v:.4f}' for k, v in pb['attention']['grid'].items())}).",
        "",
        "### Live model replay (2023)",
        "",
        "States revealed one at a time in five random orders; probability given to the eventual winner:",
        "",
        "| States declared | " + " | ".join(map(str, pb["live_replay_2023"]["checkpoints"])) + " |",
        "|---|" + "---|" * len(pb["live_replay_2023"]["checkpoints"]),
        "| Average | " + " | ".join(_pct(x) for x in pb["live_replay_2023"]["mean_winner_prob"]) + " |",
        "| Lowest | " + " | ".join(_pct(x) for x in pb["live_replay_2023"]["min_winner_prob"]) + " |",
        "",
        "## Governorship",
        "",
        "| Year | Races | Winner accuracy | Brier | Log loss | Winner share error (pp) | Governor's party wins | Last result repeats |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for f in gb["folds"]:
        a = f["anyanwu"]
        lines.append(
            f"| {f['test']} | {f['races']} | {_pct(a['winner_accuracy'])} | {a['brier']:.3f} | {a['log_loss']:.3f} | "
            f"{'–' if a['winner_share_mae_pp'] is None else f'{a[chr(119) + "inner_share_mae_pp"]:.1f}'} | "
            f"{_pct(f['baseline_governors_party'])} | {_pct(f['baseline_last_result'])} |"
        )
    gs = gb["summary"]
    lines += [
        f"| **All** | {gs['races']} | **{_pct(gs['anyanwu']['winner_accuracy'])}** | **{gs['anyanwu']['brier']:.3f}** | "
        f"**{gs['anyanwu']['log_loss']:.3f}** | | {_pct(gs['baseline_governors_party'])} | {_pct(gs['baseline_last_result'])} |",
        "",
        "The baselines name a winner with certainty, so their Brier score is twice their error rate "
        f"(≈{2 * (1 - gs['baseline_last_result']):.2f}). Anyanwụ names the winner slightly less often but gives far better",
        "probabilities. Projected vote shares are deliberately conservative: big upsets by strong candidates on new",
        "platforms (Imo 2007, Ogun 2019, Oyo 2015) are common, and history alone cannot see them coming.",
        "",
    ]
    return "\n".join(lines)


if __name__ == "__main__":
    sys.exit(main(offline="--offline" in sys.argv))
