"""Generic extractor for a Wikipedia election "Results" table (candidate, party, votes).

Used for governorship articles, whose tables vary a lot across 25 years: columns in
different orders, colour-swatch cells, rows where the candidate's name is missing
(so a grid reader shifts every cell left), joint tickets listed twice, and footer
rows for totals, invalid votes and turnout. We read each row's cells directly and
classify them by content, which survives all of those layouts.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from bs4 import BeautifulSoup, Tag

from ..parties import lineage, normalise_party

PARTY_ABBR = re.compile(r"\(([A-Z][A-Za-z0-9]*(?:[–\-/][A-Z][A-Za-z0-9]*)*)\)\)?\s*$")
NOT_PARTY = re.compile(r"\((esq|jnr|jr|snr|sr|rtd|phd|dr|mrs|mni|san|con|ofr)\)\s*$", re.I)
FOOTER = {
    "total": "total_votes",
    "valid votes": "valid_votes",
    "valid": "valid_votes",
    "invalid": "rejected_votes",
    "invalid/blank votes": "rejected_votes",
    "rejected": "rejected_votes",
    "rejected votes": "rejected_votes",
    "registered voters/turnout": "registered",
    "registered voters": "registered",
    "accredited voters": "accredited",
}
KNOWN_PARTY_WORDS = re.compile(
    r"\b(party|congress|alliance|movement|democrat|democratic|progressive|people'?s?|union|front|coalition)\b", re.I
)


def _text(td: Tag) -> str:
    for sup in td.find_all("sup"):
        sup.decompose()
    return re.sub(r"\s+", " ", td.get_text(" ", strip=True)).strip()


def _int(s: str) -> int | None:
    s = s.replace(",", "").replace("−", "-").strip()
    return int(s) if re.fullmatch(r"\d+", s) else None


@dataclass
class CandidateResult:
    candidate: str
    party: str
    lineage: str
    votes: int
    party_label: str


@dataclass
class ResultsTable:
    rows: list[CandidateResult]
    summary: dict[str, int] = field(default_factory=dict)
    # "table" = the article's full results table; "infobox" = top candidates only
    origin: str = "table"

    @property
    def candidate_total(self) -> int:
        return sum(r.votes for r in self.rows)


def _parse_table(table: Tag) -> ResultsTable | None:
    rows: list[CandidateResult] = []
    summary: dict[str, int] = {}
    for tr in table.find_all("tr"):
        cells = [_text(td) for td in tr.find_all(["td", "th"])]
        cells = [c for c in cells if c]
        if not cells:
            continue
        head = cells[0].lower().rstrip(":")
        nums = [n for n in (_int(c) for c in cells) if n is not None]
        if head in FOOTER or any(head.startswith(k) for k in ("registered", "total", "invalid", "rejected", "valid")):
            key = FOOTER.get(head) or next((v for k, v in FOOTER.items() if head.startswith(k)), None)
            if key and nums:
                summary[key] = nums[0]
            continue
        if not nums:
            continue
        # Text cells before the first number: [candidate?, party]
        first_num = next(i for i, c in enumerate(cells) if _int(c) is not None)
        texts = [c for c in cells[:first_num] if not re.fullmatch(r"[\d.%–\-]+", c)]
        if not texts:
            continue
        party_idx = next(
            (
                i
                for i, c in enumerate(texts)
                if not NOT_PARTY.search(c)
                and (PARTY_ABBR.search(c) or KNOWN_PARTY_WORDS.search(c) or re.fullmatch(r"[A-Z][A-Z0-9]{0,5}|Accord", c))
            ),
            None,
        )
        if party_idx is None:
            continue  # not a candidate row (e.g. an LGA results row)
        party_label = texts[party_idx]
        candidate = next((t for i, t in enumerate(texts) if i != party_idx), "")
        party = normalise_party(party_label)
        rows.append(
            CandidateResult(
                candidate=candidate,
                party=party,
                lineage=lineage(party),
                votes=_int(cells[first_num]) or 0,
                party_label=party_label,
            )
        )
    if not rows:
        return None
    if len(rows) >= 2 and len({r.party for r in rows}) < 2:
        return None  # a party primary (every row the same party), not the general election
    if len(rows) == 1:
        # Only the winner has a figure (common for 2003): usable for who won, never for shares
        return ResultsTable(rows=rows, summary=summary, origin="winner only")
    return ResultsTable(rows=rows, summary=summary)


def _parse_infobox(soup: BeautifulSoup) -> ResultsTable | None:
    """Election infoboxes lay results out sideways: a 'Nominee' row, a 'Party' row and a
    'Popular vote' (or 'Electoral vote') row, one column per candidate. They usually
    show only the leading two or three candidates."""
    rows: dict[str, list[str]] = {}
    for tr in soup.find_all("tr"):
        if tr.find("table"):
            continue  # outer layout rows wrap inner tables; read only the innermost rows
        th = tr.find("th")
        tds = tr.find_all("td")
        label = _text(th).lower() if th else (_text(tds[0]).lower() if tds else "")
        if th is None and tds:
            tds = tds[1:]
        for key in ("nominee", "candidate", "party", "popular vote", "electoral vote", "votes"):
            if label == key and key not in rows:
                rows[key] = [_text(td) for td in tds]
    parties = rows.get("party")
    votes = rows.get("popular vote") or rows.get("electoral vote") or rows.get("votes")
    if not (parties and votes):
        return None
    names = rows.get("nominee") or rows.get("candidate") or [""] * len(parties)  # some infoboxes list parties only
    out = []
    for name, party_label, v in zip(names, parties, votes, strict=False):
        n = _int(v)
        if n is None:
            continue
        party = normalise_party(party_label)
        out.append(CandidateResult(candidate=name, party=party, lineage=lineage(party), votes=n, party_label=party_label))
    return ResultsTable(rows=out, origin="infobox") if len(out) >= 2 else None


def extract_results(html: str) -> ResultsTable | None:
    """The general-election results table: the candidate table with the most votes
    (primaries in the same article count delegates, so they are far smaller). Falls
    back to the infobox when the article has no full results table."""
    soup = BeautifulSoup(html, "lxml")
    best: ResultsTable | None = None
    for table in soup.find_all("table"):
        if "infobox" in (table.get("class") or []):
            continue
        parsed = _parse_table(table)
        if parsed is None:
            continue
        full = parsed.origin == "table"
        if best is None or (full, parsed.candidate_total) > (best.origin == "table", best.candidate_total):
            best = parsed
    if best is None or best.origin != "table":
        box = _parse_infobox(BeautifulSoup(html, "lxml"))
        if box and (best is None or len(box.rows) > len(best.rows)):
            box.summary = {**(best.summary if best else {}), **box.summary}
            best = box
    return best
