"""Load NELI's processed results into the shapes the model uses."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from functools import cache

import numpy as np
import pandas as pd

from neli_pipeline.parties import lineage
from neli_pipeline.paths import DATA, PROCESSED
from neli_pipeline.states import STATES

CODES = sorted(STATES)  # 37 areas (36 states + FCT)
ZONE = {c: z for c, (_n, z) in STATES.items()}
ZONES = sorted(set(ZONE.values()))
MODEL_DIR = DATA / "model"


def name_key(s: str) -> frozenset[str]:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    drop = {"dr", "chief", "prince", "alhaji", "senator", "engr", "mrs", "mr", "sir", "prof", "barr", "hon", "otunba"}
    return frozenset(t for t in re.findall(r"[a-z]+", s) if t not in drop and len(t) > 1)


@cache
def _person_ids() -> dict[str, str]:
    """Candidate name as spelled in the results -> person id, from the Wikipedia links
    (build_people). Resolves spellings like "Sanwoolu" / "Sanwo-Olu"."""
    path = PROCESSED / "candidate_people.csv"
    if not path.exists():
        return {}
    df = pd.read_csv(path, keep_default_na=False)
    return dict(zip(df.candidate, df.person_id, strict=True))


def same_person(a: str | None, b: str | None) -> bool:
    """Same person if both names link to the same Wikipedia article; otherwise if they
    share at least two name tokens (e.g. "Charles Soludo" / "Charles Chukwuma Soludo")."""
    if not a or not b:
        return False
    if a == b:
        return True
    ids = _person_ids()
    if a in ids and b in ids:
        return ids[a] == ids[b]
    ka, kb = name_key(a), name_key(b)
    if min(len(ka), len(kb)) < 2:
        return False
    return len(ka & kb) >= 2


# Codes of parties that merged into APC in 2013. After the merger the same letters were
# reused by unrelated new parties (e.g. the Action Peoples Party, "APP", from 2018).
_MERGED_2013 = {"AD", "APP", "AC", "ACN", "CPC", "ANPP"}


def family(party: str, year: int | None = None) -> str:
    """Party family for continuity across mergers; unknown parties are their own family."""
    if party in ("OTH", "Others", ""):
        return "OTHER"
    if year is not None and year > 2013 and party in _MERGED_2013:
        return party
    fam = lineage(party)
    return party if fam == "OTHER" else fam


@dataclass
class Contestant:
    candidate: str
    party: str
    home: str | None = None  # state code
    running_mate: str | None = None
    rm_home: str | None = None
    year: int | None = None

    @property
    def fam(self) -> str:
        return family(self.party, self.year)

    @property
    def is_others(self) -> bool:
        return self.candidate == "Others" or self.party == "OTH"


@dataclass
class Race:
    """One election: contestants and their vote shares by area (if held)."""

    key: str
    kind: str  # presidential | governorship
    year: int
    areas: list[str]
    contestants: list[Contestant]
    shares: np.ndarray | None = None  # [area, contestant]
    totals: np.ndarray | None = None  # valid votes per area
    state: str | None = None
    off_cycle: bool = False
    coverage: str = "all candidates"
    meta: dict = field(default_factory=dict)

    def winner(self, area: int = 0) -> int:
        assert self.shares is not None
        return int(np.argmax(self.shares[area]))


@cache
def tickets() -> pd.DataFrame:
    return pd.read_csv(MODEL_DIR / "presidential_tickets.csv", keep_default_na=False)


def _ticket(year: int, cand: str, party: str) -> Contestant:
    t = tickets()
    row = t[(t.year == year) & (t.candidate == cand)]
    if len(row):
        r = row.iloc[0]
        return Contestant(cand, party, r.home_state or None, r.running_mate or None, r.running_mate_home_state or None, year)
    return Contestant(cand, party, year=year)


@cache
def presidential() -> dict[int, Race]:
    """Held presidential elections by year, state × contestant. Minor candidates
    (under 1% nationally) are folded into "Others"."""
    df = pd.read_csv(PROCESSED / "presidential_state_votes.csv", keep_default_na=False)
    out = {}
    for year, g in df.groupby("year"):
        nat = g.groupby(["candidate", "party"]).votes.sum().sort_values(ascending=False)
        total = nat.sum()
        major = [(c, p) for (c, p), v in nat.items() if c != "Others" and v / total >= 0.01]
        cons = [_ticket(int(year), c, p) for c, p in major] + [Contestant("Others", "OTH")]
        votes = np.zeros((len(CODES), len(cons)))
        for r in g.itertuples():
            i = CODES.index(r.state_code)
            k = next((j for j, c in enumerate(cons[:-1]) if c.candidate == r.candidate and c.party == r.party), len(cons) - 1)
            votes[i, k] += r.votes
        tot = votes.sum(1)
        out[int(year)] = Race(f"pres-{year}", "presidential", int(year), CODES, cons, votes / tot[:, None], tot)
    out[2011] = _presidential_2011(out[2015])
    return dict(sorted(out.items()))


def _presidential_2011(ref: Race) -> Race:
    """2011 for the model only, from NDI's final report (state percentages for the main
    parties; INEC's official state annex is not available anywhere). Missing states
    (CR, EK, EN, ON, PL) take their zone's average; state vote totals are 2015's,
    scaled to the 2011 national valid vote (38,209,978). Never shown as results."""
    df = pd.read_csv(MODEL_DIR / "presidential_2011_ndi.csv", keep_default_na=False).set_index("state_code")
    cols = ["PDP", "CPC", "ACN", "ANPP"]
    cands = ["Goodluck Jonathan", "Muhammadu Buhari", "Nuhu Ribadu", "Ibrahim Shekarau"]
    cons = [_ticket(2011, c, p) for c, p in zip(cands, cols, strict=True)] + [Contestant("Others", "OTH", year=2011)]
    known = {c: np.r_[df.loc[c, cols].to_numpy(float) / 100, 0.0] for c in df.index}
    for v in known.values():
        v[-1] = max(0.0, 1 - v[:-1].sum())
    shares = np.zeros((len(CODES), len(cons)))
    for i, c in enumerate(CODES):
        if c in known:
            shares[i] = known[c]
        else:
            peers = [known[x] for x in known if ZONE[x] == ZONE[c]]
            shares[i] = np.mean(peers, axis=0)
    shares /= shares.sum(1, keepdims=True)
    totals = ref.totals * (38_209_978 / ref.totals.sum())
    return Race("pres-2011", "presidential", 2011, CODES, cons, shares, totals, meta={"source": "NDI final report (estimated)"})


@cache
def governorship() -> list[Race]:
    res = pd.read_csv(PROCESSED / "governorship_results.csv", keep_default_na=False)
    summ = pd.read_csv(PROCESSED / "governorship_summary.csv", keep_default_na=False).set_index("election_id")
    out = []
    for eid, g in res.groupby("election_id", sort=False):
        s = summ.loc[eid]
        g = g.groupby(["candidate", "party"], as_index=False).votes.sum().sort_values("votes", ascending=False)
        cons = [
            Contestant(r.candidate or f"{r.party} candidate", r.party, home=s.state_code, year=int(s.year))
            for r in g.itertuples()
        ]
        v = g.votes.to_numpy(float)
        if v.sum() <= 0:
            continue
        out.append(
            Race(
                eid,
                "governorship",
                int(s.year),
                [s.state_code],
                cons,
                (v / v.sum())[None, :],
                np.array([v.sum()]),
                state=s.state_code,
                off_cycle=str(s.off_cycle) == "True",
                coverage=s.coverage,
            )
        )
    out.sort(key=lambda r: (r.year, r.state))
    return out
