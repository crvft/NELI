"""Results by local government area (LGA), from Wikipedia.

    uv run python -m neli_pipeline.build_lga [--offline]

- 2023 presidential: "2023 Nigerian presidential election in <State>" (all 37 areas)
- Governorship: every cached governorship article that has an LGA results table

Each LGA name is matched to the map's GRID3 LGA (public/geo/lga/<STATE>.json) within
its state (exact after normalising, then closest spelling). Every election's LGA rows
are checked against its state-level result.

Writes data/processed/lga_results.csv and data/processed/VALIDATION_lga.md.
"""

from __future__ import annotations

import difflib
import json
import re
import sys
from functools import cache

import pandas as pd
from bs4 import BeautifulSoup

from .extract.results_table import _int, _text
from .parties import normalise_party
from .paths import MANIFEST, PROCESSED, ROOT
from .sources import wikipedia
from .states import STATES

GEO = ROOT / "public" / "geo" / "lga"
ALIASES = {
    "somolu": "shomolu",
    "egbado north": "yewa north",
    "egbado south": "yewa south",
    "municipal area council": "abuja municipal",
}


def norm(s: str) -> str:
    s = re.sub(r"\[[^\]]*\]", "", s).lower()
    s = re.sub(r",.*$", "", s)  # "Okobo, Akwa Ibom" -> "okobo"
    s = re.sub(r"\b(local government area|local government|lga|area council)\b", "", s)
    s = re.sub(r"[^a-z0-9]+", " ", s).strip()
    return ALIASES.get(s, s)


@cache
def lgas(state: str) -> list[dict]:
    path = GEO / f"{state}.json"
    return json.loads(path.read_text())["lgas"] if path.exists() else []


def match_lgas(state: str, names: list[str]) -> dict[str, str | None]:
    """Source LGA name -> GRID3 LGA id, one-to-one, best matches first."""
    targets = {norm(x["name"]): x["id"] for x in lgas(state)}
    pairs = []
    for n in names:
        a = norm(n)
        for t, tid in targets.items():
            if a == t:
                score = 1.0
            elif a.split()[0] == t.split()[0] and (a in t or t in a):
                score = 0.9  # "ado" / "ado ekiti", "ijero ekiti" / "ijero"
            elif a.split()[-1] == t.split()[-1] and (a in t or t in a):
                score = 0.88  # "eggon" / "nasarawa eggon"
            else:
                score = difflib.SequenceMatcher(None, a.replace(" ", ""), t.replace(" ", "")).ratio()
            pairs.append((score, n, tid))
    out: dict[str, str | None] = dict.fromkeys(names)
    used = set()
    for score, n, tid in sorted(pairs, reverse=True):
        if score < 0.72 or out[n] is not None or tid in used:
            continue
        out[n] = tid
        used.add(tid)
    return out


def parse_lga_table(tb) -> tuple[list[tuple[str, str]], list[tuple[str, list[int]]]] | None:
    """Candidate columns [(candidate, party)] and rows [(lga, votes per column)]."""
    rows = tb.find_all("tr")
    if not rows:
        return None
    head = [_text(c) for c in rows[0].find_all(["th", "td"])]
    if not head or not re.match(r"(local government|lga|area council)", head[0], re.I):
        return None
    cols = []
    for h in head[1:]:
        if re.match(r"(total|turnout|registered|valid|rejected)", h, re.I):
            break
        if h.lower().startswith("others"):
            cols.append(("Others", "OTH"))
            continue
        m = re.match(r"(.+?)\s+([A-Z][A-Za-z0-9]{0,6}(?:-[A-Z]+)?)$", h)  # "Bola Tinubu APC"
        m2 = re.match(r"([A-Z][A-Za-z0-9]{0,6})\s+(.+)$", h)  # "APC Bola Tinubu"
        if m and normalise_party(m.group(2)):
            cols.append((m.group(1), normalise_party(m.group(2))))
        elif m2 and normalise_party(m2.group(1)):
            cols.append((m2.group(2), normalise_party(m2.group(1))))
        else:
            cols.append((h, normalise_party(h) or h))
    if len(cols) < 2:
        return None
    data = []
    for tr in rows[1:]:
        cells = [_text(c) for c in tr.find_all(["th", "td"])]
        if not cells or not cells[0] or re.match(r"(total|votes|%)", cells[0], re.I):
            continue
        nums = [c for c in cells[1:]]
        votes = []
        i = 0
        # Each candidate: a vote count, usually followed by a percentage
        while i < len(nums) and len(votes) < len(cols):
            v = _int(nums[i])
            if v is not None:
                votes.append(v)
                i += 2 if i + 1 < len(nums) and "%" in nums[i + 1] else 1
            else:
                i += 1
        if len(votes) == len(cols):
            data.append((cells[0], votes))
    return (cols, data) if len(data) >= 3 else None


def collect() -> list[tuple[str, str, str, str]]:
    """(election_id, state, article title, source key) for every source with LGA tables."""
    manifest = json.loads(MANIFEST.read_text())
    jobs = []
    for code, (name, _z) in STATES.items():
        place = "the Federal Capital Territory" if code == "FC" else f"{name} State"
        jobs.append(
            (
                "pres-2023",
                code,
                f"2023_Nigerian_presidential_election_in_{place.replace(' ', '_')}",
                f"wikipedia:presidential:2023:{code}",
            )
        )
    for key, v in manifest.items():
        m = re.match(r"wikipedia:governorship:(\d{4}):([A-Z]{2})$", key)
        if m and m.group(1) != "2027":
            jobs.append((f"gov-{m.group(2).lower()}-{m.group(1)}", m.group(2), v["title"], key))
    return jobs


def build(offline: bool = False) -> int:
    state_votes = _state_totals()
    out, report = [], []
    for eid, state, title, key in collect():
        try:
            html = wikipedia.fetch(title) if not offline else (ROOT / "data" / "raw" / "wikipedia" / f"{title}.html").read_text()
        except Exception:  # noqa: BLE001
            continue
        soup = BeautifulSoup(html, "lxml")
        parsed = None
        for tb in soup.select("table.wikitable"):
            parsed = parse_lga_table(tb)
            if parsed:
                break
        if not parsed:
            continue
        if eid.startswith("pres-"):
            wikipedia.record(key, title, html)
        cols, data = parsed
        ids = match_lgas(state, [n for n, _ in data])
        unmatched = [n for n, i in ids.items() if i is None]
        lga_sum = sum(sum(v) for _, v in data)
        ref = state_votes.get((eid, state))
        diff = (lga_sum - ref) / ref if ref else None
        n_map = len(lgas(state))
        matched = sum(1 for i in ids.values() if i)
        # Quality gate: nearly every LGA present and the LGA rows add up to the state result
        accept = bool(ref) and n_map and matched >= 0.9 * n_map and abs(diff) <= 0.03
        report.append((eid, state, len(data), n_map, unmatched, lga_sum, ref, diff, accept))
        if not accept:
            continue
        for n, votes in data:
            if ids[n] is None:
                continue
            for (cand, party), v in zip(cols, votes, strict=True):
                out.append(
                    {
                        "election_id": eid,
                        "state_code": state,
                        "lga_id": ids[n],
                        "lga_name": n,
                        "candidate": cand,
                        "party": party,
                        "votes": v,
                        "source": key,
                    }
                )
    df = pd.DataFrame(out)
    df.to_csv(PROCESSED / "lga_results.csv", index=False)
    _write_report(report)
    print(f"lga_results.csv: {df.election_id.nunique() if len(df) else 0} elections, {len(df)} rows")
    return 0


def _state_totals() -> dict[tuple[str, str], int]:
    out = {}
    pres = pd.read_csv(PROCESSED / "presidential_state_votes.csv", keep_default_na=False)
    for (y, st), g in pres.groupby(["year", "state_code"]):
        out[(f"pres-{y}", st)] = int(g.votes.sum())
    gov = pd.read_csv(PROCESSED / "governorship_results.csv", keep_default_na=False)
    for (eid, st), g in gov.groupby(["election_id", "state_code"]):
        out[(eid, st)] = int(g.votes.sum())
    return out


def _write_report(rows) -> None:
    ok = [r for r in rows if r[8]]
    lines = [
        "# LGA results: validation",
        "",
        f"{len(rows)} elections with LGA tables; **{len(ok)} accepted** (at least 90% of the state's LGAs matched to the map,",
        "and the LGA rows sum to within 3% of the state-level result). The rest are left out; most 2023 presidential",
        "state articles have LGA tables whose cells are still 'TBD'.",
        "",
        "| Election | State | LGAs in table | LGAs on map | Unmatched names | LGA total | State total | Difference | Used |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for eid, st, n, nmap, un, s, ref, d, acc in sorted(rows):
        diff = "–" if d is None else f"{d * 100:+.2f}%"
        lines.append(
            f"| {eid} | {st} | {n} | {nmap} | {', '.join(un) or '–'} | {s:,} | {f'{ref:,}' if ref else '–'} | {diff} | {'yes' if acc else 'no'} |"
        )
    (PROCESSED / "VALIDATION_lga.md").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    sys.exit(build(offline="--offline" in sys.argv))
