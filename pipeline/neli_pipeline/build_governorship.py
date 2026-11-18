"""Build governorship results (every state, every cycle incl. off-cycle) from Wikipedia.

    uv run python -m neli_pipeline.build_governorship

Articles are discovered from the per-state "gubernatorial elections" categories
(cached list in data/raw/governorship_titles.json; rediscover with --discover).

Writes:
  data/processed/governorship_results.csv  election x candidate (party as on the ballot + lineage)
  data/processed/governorship_summary.csv  election: totals, registered, checks, off-cycle flag
  data/processed/VALIDATION_governorship.md coverage, checks and gaps
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from urllib.parse import unquote

import pandas as pd
import requests

from .extract.results_table import extract_results
from .paths import PROCESSED, RAW
from .sources import wikipedia as wp
from .states import STATES, normalise_state

TITLES = RAW / "governorship_titles.json"
GENERAL_CYCLES = {1999, 2003, 2007, 2011, 2015, 2019, 2023}


def discover() -> dict[str, dict]:
    """List '<year> <State> State gubernatorial election' articles per state category."""
    found: dict[str, dict] = {}
    for code, (name, _) in STATES.items():
        if code == "FC":
            continue  # the FCT has no governor
        url = f"https://en.wikipedia.org/wiki/Category:{name.replace(' ', '_')}_State_gubernatorial_elections"
        for attempt in range(4):
            r = requests.get(url, headers={"User-Agent": wp.USER_AGENT}, timeout=60)
            if r.status_code == 200:
                break
            time.sleep(10 * (attempt + 1))
        part = r.text.split('id="mw-pages"')[1] if 'id="mw-pages"' in r.text else ""
        for t in re.findall(r'<a href="/wiki/([^"#?]+)" title="[^"]*">', part):
            t = unquote(t)
            m = re.match(r"(\d{4})_(.+?)_State_gubernatorial_election$", t)
            if m and int(m.group(1)) >= 1999:
                found[t] = {"year": int(m.group(1)), "state_code": normalise_state(m.group(2).replace("_", " "))}
        time.sleep(1.5)
    TITLES.parent.mkdir(parents=True, exist_ok=True)
    TITLES.write_text(json.dumps(found, indent=1))
    return found


def _merge_joint_tickets(rows):
    """1999: APP and AD sometimes backed one candidate and articles list the same votes
    under both. Count them once, as the joint ticket."""
    from .extract.results_table import CandidateResult

    out, seen = [], {}
    for r in rows:
        key = r.votes
        if key in seen and {seen[key].party, r.party} <= {"APP", "AD"} and r.votes > 0:
            prev = seen[key]
            out[out.index(prev)] = CandidateResult(
                candidate=prev.candidate or r.candidate,
                party="AD-APP",
                lineage=prev.lineage,
                votes=prev.votes,
                party_label=f"{prev.party_label} + {r.party_label} (joint ticket, listed twice in source)",
            )
            continue
        seen[key] = r
        out.append(r)
    return out


def build(rediscover: bool = False, upcoming_from: int = 2027) -> int:
    titles = discover() if rediscover or not TITLES.exists() else json.loads(TITLES.read_text())
    result_rows, summary_rows, missing = [], [], []
    for title, meta in sorted(titles.items(), key=lambda kv: (kv[1]["year"], kv[1]["state_code"])):
        year, code = meta["year"], meta["state_code"]
        if year >= upcoming_from:
            continue  # not held yet
        html = wp.fetch(title)
        src = wp.record(f"wikipedia:governorship:{year}:{code}", title, html)
        res = extract_results(html)
        eid = f"gov-{code.lower()}-{year}"
        if res is None:
            missing.append((eid, title))
            continue
        rows = _merge_joint_tickets(res.rows)
        for r in rows:
            result_rows.append(
                {
                    "election_id": eid,
                    "year": year,
                    "state_code": code,
                    "candidate": r.candidate,
                    "party": r.party,
                    "party_label": r.party_label,
                    "lineage": r.lineage,
                    "votes": r.votes,
                    "source": src.key,
                }
            )
        s = res.summary
        total = s.get("total_votes")
        valid = s.get("valid_votes")
        reference = valid or total
        cand = res.candidate_total
        summary_rows.append(
            {
                "election_id": eid,
                "year": year,
                "state_code": code,
                "off_cycle": year not in GENERAL_CYCLES,
                "coverage": {"table": "all candidates", "infobox": "top candidates only", "winner only": "winner only"}[
                    res.origin
                ],
                "candidates": len(res.rows),
                "candidate_sum": cand,
                "valid_votes": valid,
                "rejected_votes": s.get("rejected_votes"),
                "total_votes": total,
                "registered": s.get("registered"),
                "accredited": s.get("accredited"),
                # does the candidate list add up to the article's own valid/total figure?
                "sum_check": None if not reference else round((cand - reference) / reference, 4),
                "source": src.key,
            }
        )
    results = pd.DataFrame(result_rows)
    summary = pd.DataFrame(summary_rows)
    PROCESSED.mkdir(parents=True, exist_ok=True)
    results.to_csv(PROCESSED / "governorship_results.csv", index=False)
    summary.to_csv(PROCESSED / "governorship_summary.csv", index=False)
    _report(summary, missing, titles, upcoming_from)
    print(f"{len(summary)} elections, {len(results)} candidate rows; {len(missing)} articles without a results table")
    return 0


def _report(summary: pd.DataFrame, missing: list, titles: dict, upcoming_from: int) -> None:
    held = {t: m for t, m in titles.items() if m["year"] < upcoming_from}
    by_year = summary.groupby("year").agg(elections=("election_id", "count"), off_cycle=("off_cycle", "first"))
    exact = summary["sum_check"].fillna(1).eq(0)
    close = summary["sum_check"].abs().le(0.005)
    no_ref = summary["sum_check"].isna()
    lines = [
        "# Governorship results: validation",
        "",
        "Generated by `neli_pipeline.build_governorship`. Source: Wikipedia governorship articles (exact revisions in",
        "`data/sources/manifest.json`), which transcribe INEC's declared results with citations.",
        "",
        f"- Articles found (held): **{len(held)}**; elections extracted: **{len(summary)}**; without any results: **{len(missing)}**.",
        f"- Coverage: all candidates **{int((summary.coverage == 'all candidates').sum())}**; top candidates only (infobox; minor"
        f" parties missing) **{int((summary.coverage == 'top candidates only').sum())}**; winner only (no figures for the others,"
        f" mostly 2003) **{int((summary.coverage == 'winner only').sum())}**.",
        "- Use for modelling: shares only from 'all candidates' rows (or 'top candidates only' against the article's own valid/total);",
        "  'winner only' rows tell us who won and the register, never vote shares.",
        f"- Candidate votes add up to the article's own valid/total figure: exactly **{int(exact.sum())}**, within 0.5% **{int((close & ~exact).sum())}**,",
        f"  off by more than 0.5% **{int((~close & ~no_ref).sum())}**, no total to check against **{int(no_ref.sum())}**.",
        "- A gap above 0.5% usually means the article lists only the main candidates (minor parties omitted) or a",
        "  transcription slip. These elections stay in the data with the gap recorded in `sum_check`.",
        "",
        "## Elections per year",
        "",
        by_year.reset_index().to_markdown(index=False),
        "",
        "## Off by more than 0.5%",
        "",
        summary.loc[
            ~close & ~no_ref, ["election_id", "candidates", "candidate_sum", "valid_votes", "total_votes", "sum_check"]
        ].to_markdown(index=False)
        or "None",
        "",
        "## Articles without a results table",
        "",
    ]
    lines += [f"- {eid}: {t}" for eid, t in missing] or ["None"]
    (PROCESSED / "VALIDATION_governorship.md").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--discover", action="store_true", help="re-list articles from Wikipedia categories")
    sys.exit(build(p.parse_args().discover))
