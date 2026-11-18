"""Extract state-level presidential results from a Wikipedia election article.

Each article has (a) a national results table listing candidate, party and votes and
(b) a by-state table. Column headings in (b) vary by year: "Bola Tinubu APC",
"Obasanjo", "Valid", "Invalid", "Total"... We identify the by-state table by how
many rows are recognisable states, then match each candidate column to (a) by
surname, so party labels always come from the source itself, never from memory.
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass

import pandas as pd

from ..parties import lineage, normalise_party
from ..states import STATES, normalise_state

NON_CANDIDATE = re.compile(
    r"^(state|valid|invalid|rejected|total|turnout|registered|accredited|others?|margin|votes cast|total valid votes|turnout \(%\))",
    re.I,
)


@dataclass
class Candidate:
    name: str
    party: str
    national_votes: int | None


def _num(x: object) -> int | None:
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return None
    s = re.sub(r"\[[^\]]*\]", "", str(x))
    s = s.replace(",", "").replace("−", "-").strip()
    if not re.fullmatch(r"-?\d+(\.0+)?", s):
        return None
    return int(float(s))


def _label(col: object) -> tuple[str, str]:
    """(group, metric) for a possibly multi-level column."""
    if isinstance(col, tuple):
        parts = [str(c) for c in col if not str(c).startswith("Unnamed")]
        group = parts[0] if parts else ""
        metric = parts[-1] if parts else ""
        return group.strip(), metric.strip()
    return str(col).strip(), str(col).strip()


def _tables(html: str) -> list[pd.DataFrame]:
    return pd.read_html(io.StringIO(html))


def national_candidates(html: str, column_labels: list[str] | None = None) -> list[Candidate]:
    """Candidates and parties from the article's national results table.

    General-election articles also carry Senate/House tables (with even more votes),
    so when the by-state column labels are known, the table whose candidates match
    the most of them wins; ties go to the table with more votes.
    """
    best: list[Candidate] = []
    best_key: tuple[int, int] = (-1, -1)
    for t in _tables(html):
        cols = [(_label(c)[0].lower(), c) for c in t.columns]
        names = [c for lbl, c in cols if lbl.startswith("candidate")]
        party = next((c for lbl, c in cols if lbl.startswith("party")), None)
        votes = next((c for lbl, c in cols if lbl.startswith("votes")), None)
        if not names or party is None or votes is None:
            continue
        name_col = names[-1]  # the text column (the first is often a colour swatch)
        found: list[Candidate] = []
        for _, row in t.iterrows():
            name = str(row[name_col]).strip()
            v = _num(row[votes])
            if not name or name.lower() in {"nan", "total", "invalid/blank votes", "registered voters/turnout"} or v is None:
                continue
            if re.match(r"(invalid|registered|total|source)", name, re.I):
                continue
            found.append(
                Candidate(name=re.sub(r"\[[^\]]*\]", "", name).strip(), party=normalise_party(row[party]), national_votes=v)
            )
        matched = sum(1 for lab in (column_labels or []) if _match(lab, found)) if column_labels else 0
        key = (matched, sum(c.national_votes or 0 for c in found))
        if found and key > best_key:
            best, best_key = found, key
    return best


def _tokens(s: str) -> set[str]:
    return {t for t in re.split(r"[^a-z]+", s.lower()) if len(t) > 2}


def _match(label: str, cands: list[Candidate]) -> Candidate | None:
    """Match a column label ("Bola Tinubu APC", "Obasanjo") to one candidate, by whole words."""
    lab = _tokens(re.sub(r"\[[^\]]*\]", "", label))
    scored = [(len(lab & _tokens(c.name)), c) for c in cands]
    scored = [(n, c) for n, c in scored if n]
    if not scored:
        return None
    top = max(n for n, _ in scored)
    hits = [c for n, c in scored if n == top]
    if len(hits) == 1:
        return hits[0]
    # Tie: prefer a unique surname match
    hits = [c for c in hits if c.name.lower().split()[-1] in lab]
    return hits[0] if len(hits) == 1 else None


@dataclass
class Extracted:
    year: int
    votes: pd.DataFrame  # year, state_code, candidate, party, lineage, votes
    states: pd.DataFrame  # year, state_code, valid_votes, rejected_votes, total_votes, registered, candidate_sum
    total_row: dict[str, int]  # the table's own "Total" row, per candidate label
    candidates: list[Candidate]


def extract(html: str, year: int) -> Extracted:
    # The by-state results table: most rows that are states, then most "Votes" columns
    # (articles also carry pollster/prediction tables listed by state).
    best: pd.DataFrame | None = None
    best_key = (False, 0, 0)
    for t in _tables(html):
        n = int(t.iloc[:, 0].map(normalise_state).notna().sum())
        vote_cols = sum(1 for c in t.columns if _label(c)[1].lower() == "votes")
        key = (vote_cols > 0, min(n, 37), vote_cols)
        if n >= 30 and key > best_key:
            best, best_key = t, key
    best_n = best_key[1]
    if best is None or best_n < 30:
        raise ValueError(f"{year}: no by-state table found (best matched {best_n} states)")

    groups: dict[str, dict[str, object]] = {}
    for col in best.columns:
        g, m = _label(col)
        groups.setdefault(g, {})[m.lower()] = col
    labels = [g for g in groups if g and not NON_CANDIDATE.match(g)]
    cands = national_candidates(html, labels)

    vote_rows, state_rows, total_row = [], [], {}
    for _, row in best.iterrows():
        code = normalise_state(row.iloc[0])
        is_total = str(row.iloc[0]).strip().lower().startswith("total")
        if not code and not is_total:
            continue
        cand_sum = 0
        summary: dict[str, int | None] = {"valid_votes": None, "rejected_votes": None, "total_votes": None, "registered": None}
        for g, metrics in groups.items():
            gl = g.lower()
            if not gl:  # empty trailing columns some tables carry
                continue
            vote_col = metrics.get("votes") or (metrics.get(gl) if len(metrics) == 1 else None)
            if vote_col is None:
                continue
            v = _num(row[vote_col])
            if gl.startswith(("valid", "total valid")):
                summary["valid_votes"] = v
            elif gl.startswith(("invalid", "rejected")):
                summary["rejected_votes"] = v
            elif gl.startswith("registered"):
                summary["registered"] = v
            elif gl == "total" or gl.startswith("votes cast"):
                summary["total_votes"] = v
            elif NON_CANDIDATE.match(g) and not gl.startswith("other"):
                continue
            else:
                is_other = gl.startswith("other")
                c = None if is_other else _match(g, cands)
                if not is_other and c is None:
                    raise ValueError(f"{year}: column '{g}' matches no candidate in the national table")
                name, party = ("Others", "OTH") if is_other else (c.name, c.party)
                if is_total:
                    total_row[name] = v or 0
                elif v is not None:
                    vote_rows.append(
                        {
                            "year": year,
                            "state_code": code,
                            "candidate": name,
                            "party": party,
                            "lineage": lineage(party),
                            "votes": v,
                        }
                    )
                    cand_sum += v
        if code:
            state_rows.append({"year": year, "state_code": code, **summary, "candidate_sum": cand_sum})

    votes = pd.DataFrame(vote_rows)
    states = pd.DataFrame(state_rows)
    missing = set(STATES) - set(states["state_code"])
    if missing:
        raise ValueError(f"{year}: states missing from table: {sorted(missing)}")
    return Extracted(year=year, votes=votes, states=states, total_row=total_row, candidates=cands)
