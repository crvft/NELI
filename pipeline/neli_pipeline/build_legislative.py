"""Senate and House of Representatives results by district, from Wikipedia.

    uv run python -m neli_pipeline.build_legislative [--offline]

Sources:
- Senate: "<year> Nigerian Senate elections in <State> State" (1999–2023, per state)
- House of Reps: "<year> Nigerian House of Representatives elections in <State> State"
  (2015, 2019, per state) and the national "2023 Nigerian House of Representatives
  election" article (2023, every constituency).

For each district we take the winner from the article's summary table (complete),
then attach vote counts from that district's results table where one exists. Every
race gets a coverage label (all candidates / top candidates only / winner only) and a
`conflict` flag when the votes disagree with the declared winner (the source has a
few such errors; the declared winner is kept).

Writes data/processed/legislative_results.csv and legislative_summary.csv.
"""

from __future__ import annotations

import re
import sys
import time

import pandas as pd
from bs4 import BeautifulSoup, Tag

from .extract.results_table import CandidateResult, _int, _parse_table, _text
from .parties import lineage, normalise_party
from .paths import PROCESSED, RAW
from .sources import wikipedia
from .states import STATES

SENATE_YEARS = [1999, 2003, 2007, 2011, 2015, 2019, 2023]
REPS_STATE_YEARS = [2015, 2019]
REPS_NATIONAL = {2023: "2023_Nigerian_House_of_Representatives_election"}


def state_title(code: str) -> str:
    name = STATES[code][0]
    return "Federal_Capital_Territory" if code == "FC" else f"{name.replace(' ', '_')}_State"


def norm_district(s: str) -> str:
    s = re.sub(r"\[[^\]]*\]", "", s)
    s = re.sub(r"\b(senatorial district|senatorial zone|federal constituency|district|constituency)\b", "", s, flags=re.I)
    s = re.sub(r"[^a-z0-9]+", " ", s.lower())
    return re.sub(r"\s+", " ", s).strip()


WINNER_MARK = re.compile(r"▌\s*Y\s+(.+?)\s*\(([^()]+)\)\s*$")


def _party_code(label: str) -> str:
    return normalise_party(label) or label


def heading_state(tb: Tag) -> str | None:
    """State named by the section heading above a table (national articles)."""
    h = tb.find_previous(["h2", "h3", "h4"])
    text = h.get_text(" ", strip=True).lower() if h else ""
    if "capital territory" in text or text.startswith("fct"):
        return "FC"
    hits = [c for c, (n, _z) in STATES.items() if c != "FC" and re.search(rf"\b{re.escape(n.lower())}\b", text)]
    return max(hits, key=lambda c: len(STATES[c][0])) if hits else None


def summary_rows(soup: BeautifulSoup, national: bool = False) -> list[dict]:
    """District, winner and party from the article's summary tables (both formats)."""
    out = []
    for tb in soup.select("table.wikitable"):
        rows = tb.find_all("tr")
        if not rows:
            continue
        head = [_text(c).lower() for c in rows[0].find_all(["th", "td"])]
        if not head or not re.match(r"(district|constituency)", head[0]):
            continue
        head2 = [_text(c).lower() for c in rows[1].find_all(["th", "td"])] if len(rows) > 1 else []
        new_format = any("candidates" in h for h in head + head2)
        old_format = any(h.startswith("elected") for h in head)
        if not (new_format or old_format):
            continue
        for tr in rows[1:]:
            cells = tr.find_all(["td", "th"])
            if not cells or all(c.name == "th" for c in cells):
                continue  # header rows
            district = _text(cells[0])
            if not district:
                continue
            winner = party = None
            if new_format:
                for seg in _text(cells[-1]).split("▌"):
                    seg = seg.strip()
                    m = re.match(r"Y\s+(.+?)\s*\(([^()]+)\)", seg)
                    if m:
                        winner, party = m.group(1).strip(), _party_code(m.group(2).strip())
                        break
            else:
                texts = [t for t in (_text(c) for c in cells[1:]) if t]
                if len(texts) >= 2:
                    winner, party = texts[-2], _party_code(texts[-1])
            if winner and re.search(r"\bTBD\b|vacant", winner, re.I):
                winner = None
            row = {"district": district, "winner": winner, "party": party}
            if national:
                row["state"] = heading_state(tb)
            out.append(row)
    return out


def results_tables(soup: BeautifulSoup) -> list[tuple[str, Tag]]:
    """(district hint, table) for each general-election results table."""
    out = []
    for tb in soup.select("table.wikitable"):
        cap = _text(tb.find("caption")) if tb.find("caption") else _text(tb.find("tr")) if tb.find("tr") else ""
        if re.search(r"primary", cap, re.I) or not re.search(r"election", cap, re.I):
            continue
        heading = tb.find_previous(["h2", "h3", "h4"])
        out.append((f"{cap} || {heading.get_text(' ', strip=True) if heading else ''}", tb))
    return out


def match_district(hint: str, districts: list[str]) -> str | None:
    cap, _, heading = hint.partition(" || ")
    for text in (cap, heading):
        n = norm_district(text)
        best = None
        for d in districts:
            nd = norm_district(d)
            if nd and re.search(rf"\b{re.escape(nd)}\b", n) and (best is None or len(nd) > len(norm_district(best))):
                best = d
        if best:
            return best
    return None


def extract(html: str, chamber: str, year: int, state: str | None, key: str) -> list[dict]:
    soup = BeautifulSoup(html, "lxml")
    summ = summary_rows(soup, national=state is None)
    districts = [r["district"] for r in summ]
    tables: dict[str, list] = {}
    for hint, tb in results_tables(soup):
        d = match_district(hint, districts)
        parsed = _parse_table(tb)
        if d and parsed and parsed.rows and d not in tables:
            tables[d] = parsed.rows + _others_row(tb)
    races = []
    for r in summ:
        st = r.get("state") or state
        if st is None:
            continue
        rows = tables.get(r["district"])
        has_votes = bool(rows) and sum(x.votes for x in rows) > 0
        if has_votes:
            others = any(x.candidate.lower() == "others" for x in rows)
            coverage = "top candidates only" if others or len(rows) <= 2 else "all candidates"
        else:
            coverage = "winner only"
        conflict = False
        if has_votes and r["winner"]:
            top = max((x for x in rows if x.candidate != "Others"), key=lambda x: x.votes)
            conflict = not _same(top.candidate, r["winner"]) and top.party != r["party"]
        if conflict:  # unreliable figures: keep the declared winner only, and flag it
            has_votes, coverage = False, "winner only"
        races.append({**r, "state": st, "rows": rows if has_votes else None, "coverage": coverage, "conflict": conflict})
    return [_race_record(chamber, year, key, x) for x in races if x["winner"] or x["rows"]]


def _others_row(tb: Tag) -> list:
    """The "Others" line (minor candidates combined), which the shared parser skips."""
    for tr in tb.find_all("tr"):
        cells = [_text(c) for c in tr.find_all(["td", "th"])]
        texts = [c for c in cells if c]
        if texts and texts[0].lower() == "others":
            v = next((_int(c) for c in texts[1:] if _int(c) is not None), None)
            if v:
                return [CandidateResult(candidate="Others", party="OTH", lineage="OTHER", votes=v, party_label="Others")]
    return []


def _same(a: str, b: str) -> bool:
    ta = set(re.findall(r"[a-z]{3,}", a.lower()))
    tb = set(re.findall(r"[a-z]{3,}", b.lower()))
    return len(ta & tb) >= 1


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def _race_record(chamber: str, year: int, key: str, x: dict) -> dict:
    prefix = "sen" if chamber == "senate" else "reps"
    eid = f"{prefix}-{year}-{x['state'].lower()}-{_slug(norm_district(x['district']))[:60]}"
    return {
        "election_id": eid,
        "chamber": chamber,
        "year": year,
        "state_code": x["state"],
        "district": re.sub(r"\s*\[[^\]]*\]", "", x["district"]).strip(),
        "winner": x["winner"],
        "winner_party": x["party"],
        "coverage": x["coverage"],
        "conflict": x["conflict"],
        "source": key,
        "rows": x["rows"],
    }


def build(offline: bool = False) -> int:
    jobs = []
    for y in SENATE_YEARS:
        for c in STATES:
            jobs.append(("senate", y, c, f"{y}_Nigerian_Senate_elections_in_{state_title(c)}"))
    for y in REPS_STATE_YEARS:
        for c in STATES:
            jobs.append(("reps", y, c, f"{y}_Nigerian_House_of_Representatives_elections_in_{state_title(c)}"))
    for y, t in REPS_NATIONAL.items():
        jobs.append(("reps", y, None, t))

    records, missing = [], []
    for i, (chamber, year, state, title) in enumerate(jobs):
        cached = (RAW / "wikipedia" / f"{title}.html").exists()
        if offline and not cached:
            continue
        try:
            html = wikipedia.fetch(title)
        except Exception:  # noqa: BLE001 - not every state/year has an article
            missing.append(title)
            continue
        if not cached:
            time.sleep(0.3)
        key = f"wikipedia:{chamber}:{year}:{state or 'NG'}"
        wikipedia.record(key, title, html)
        records.extend(extract(html, chamber, year, state, key))
        if (i + 1) % 50 == 0:
            print(f"  {i + 1}/{len(jobs)} articles")

    # De-duplicate ids (rare: two districts normalising to the same slug)
    seen: dict[str, int] = {}
    for r in records:
        n = seen.get(r["election_id"], 0)
        seen[r["election_id"]] = n + 1
        if n:
            r["election_id"] += f"-{n + 1}"

    results = []
    for r in records:
        if r["rows"]:
            for x in r["rows"]:
                results.append(
                    {
                        "election_id": r["election_id"],
                        "candidate": x.candidate,
                        "party": x.party,
                        "lineage": lineage(x.party),
                        "votes": x.votes,
                        "source": r["source"],
                    }
                )
        elif r["winner"]:
            results.append(
                {
                    "election_id": r["election_id"],
                    "candidate": r["winner"],
                    "party": r["winner_party"] or "",
                    "lineage": lineage(r["winner_party"] or ""),
                    "votes": 0,  # winner only: no figure on record
                    "source": r["source"],
                }
            )
    summary = pd.DataFrame([{k: v for k, v in r.items() if k != "rows"} for r in records])
    pd.DataFrame(results).to_csv(PROCESSED / "legislative_results.csv", index=False)
    summary.to_csv(PROCESSED / "legislative_summary.csv", index=False)

    print(f"{len(summary)} races ({len(missing)} articles missing)")
    if len(summary):
        print(summary.groupby(["chamber", "year"]).size().to_string())
        print(summary.groupby("coverage").size().to_string())
        print(f"conflicts: {int(summary.conflict.sum())}")
    return 0


if __name__ == "__main__":
    sys.exit(build(offline="--offline" in sys.argv))
