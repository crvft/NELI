"""Candidate signals from the offices a candidate held *before* an election, taken
from their Wikipedia profile (data/processed/people.csv).

- deputy_governor: deputy governor of the same state (often the anointed successor)
- legislator: senator or member of the House of Representatives
- minister: federal minister (incl. Attorney General / FCT minister)
- state_executive: state commissioner, Secretary to the State Government, chief of
  staff to a governor (the governor's machine)

Only offices that started before the election year count, so nothing about the
result leaks in. Caveat: winners are more likely than losers to have a detailed
Wikipedia infobox, which can flatter these signals in the backtest.
"""

from __future__ import annotations

import json
import re
from functools import cache

import pandas as pd

from neli_pipeline.paths import PROCESSED
from neli_pipeline.states import STATES

SIGNALS = ["deputy_governor", "legislator", "minister", "state_executive"]


@cache
def _people() -> dict[str, list[dict]]:
    path = PROCESSED / "people.csv"
    if not path.exists():
        return {}
    df = pd.read_csv(path, keep_default_na=False)
    return {r.id: json.loads(r.offices or "[]") for r in df.itertuples()}


@cache
def _links() -> dict[tuple[str, str], str]:
    path = PROCESSED / "candidate_people.csv"
    if not path.exists():
        return {}
    df = pd.read_csv(path, keep_default_na=False)
    return {(r.election_id, r.candidate): r.person_id for r in df.itertuples()}


def _start_year(term: str | None) -> int | None:
    m = re.search(r"\b(19|20)\d{2}\b", term or "")
    return int(m.group(0)) if m else None


def classify(title: str, state: str) -> str | None:
    t = title.lower()
    name = STATES[state][0].lower()
    if t.startswith("deputy governor") and "bank" not in t:
        return "deputy_governor" if name in t else None
    if re.search(r"\bsenat|house of representatives|member of the house\b|speaker of the house", t):
        return "legislator"
    if re.search(r"\bminister\b|attorney general", t) and "chief minister" not in t:
        return "minister"
    if re.search(r"commissioner|secretary to the (state )?government|chief of staff", t) and "electoral" not in t:
        return "state_executive"
    return None


def flags(offices: list[dict], state: str, year: int) -> list[float]:
    """1/0 per signal for offices that began before `year`."""
    out = dict.fromkeys(SIGNALS, 0.0)
    for o in offices:
        y = _start_year(o.get("term"))
        if y is None or y >= year:
            continue
        kind = classify(o.get("title", ""), state)
        if kind:
            out[kind] = 1.0
    return [out[s] for s in SIGNALS]


def for_candidate(election_id: str, candidate: str, state: str, year: int) -> list[float]:
    pid = _links().get((election_id, candidate))
    return flags(_people().get(pid, []), state, year) if pid else [0.0] * len(SIGNALS)
