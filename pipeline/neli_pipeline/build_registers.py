"""Registered voters by state, per election year.

    uv run python -m neli_pipeline.build_registers

Sources so far:
  2023  per-state Wikipedia articles ("2023 Nigerian presidential election in <State>"),
        whose infoboxes give INEC's register figure; checked against the national total.
  2003  the national article's by-state table (registered voters appear under "Turnout").
Writes data/processed/registered_voters.csv (year, state_code, registered, source).
"""

from __future__ import annotations

import re
import sys
import time

import pandas as pd

from .extract.presidential import _label, _num, _tables
from .paths import PROCESSED
from .sources import wikipedia as wp
from .states import STATES, normalise_state

YEARS_WITH_NATIONAL = [1999, 2003, 2015, 2019, 2023]


def national_registers() -> dict[int, int]:
    """INEC's national register per year, from each national article's infobox."""
    out = {}
    for year in YEARS_WITH_NATIONAL:
        html = wp.fetch(f"{year}_Nigerian_presidential_election")
        m = re.search(r"Registered\s+([\d,]+)", re.sub(r"<[^>]+>", " ", html))
        if m:
            out[year] = int(m.group(1).replace(",", ""))
    return out


def _state_title(code: str) -> str:
    if code == "FC":
        return "2023_Nigerian_presidential_election_in_the_Federal_Capital_Territory"
    return f"2023_Nigerian_presidential_election_in_{STATES[code][0].replace(' ', '_')}_State"


def registers_2023() -> list[dict]:
    rows = []
    for code in STATES:
        title = _state_title(code)
        html = wp.fetch(title)
        src = wp.record(f"wikipedia:presidential:2023:{code}", title, html)
        text = re.sub(r"<[^>]+>", " ", html)
        m = re.search(r"Registered\s+([\d,]+)", text)
        if not m:
            raise ValueError(f"2023 {code}: no 'Registered' figure in {title}")
        rows.append({"year": 2023, "state_code": code, "registered": int(m.group(1).replace(",", "")), "source": src.key})
        time.sleep(2)  # be polite to Wikipedia
    return rows


def registers_2003() -> list[dict]:
    title = "2003_Nigerian_presidential_election"
    html = wp.fetch(title)
    src = wp.record("wikipedia:presidential:2003", title, html)
    for t in _tables(html):
        if int(t.iloc[:, 0].map(normalise_state).notna().sum()) < 30:
            continue
        col = next((c for c in t.columns if _label(c) == ("Turnout", "Votes")), None)
        if col is None:
            continue
        rows = []
        for _, r in t.iterrows():
            code = normalise_state(r.iloc[0])
            v = _num(r[col])
            if code and v:
                rows.append({"year": 2003, "state_code": code, "registered": v, "source": src.key})
        return rows
    raise ValueError("2003: no registered-voters column found")


def _reconcile(df: pd.DataFrame, year: int, total: int, code: str, why: str) -> pd.DataFrame:
    """Replace one state's figure with INEC's national total minus the other states (both sourced)."""
    others = int(df[(df.year == year) & (df.state_code != code)].registered.sum())
    mask = (df.year == year) & (df.state_code == code)
    df.loc[mask, "note"] = (
        f"derived: INEC national register {total:,} minus the other 36 states; {why} (article says {int(df.loc[mask, 'registered'].iloc[0]):,})"
    )
    df.loc[mask, "registered"] = total - others
    return df


def build() -> int:
    NATIONAL_REGISTER = national_registers()
    pd.DataFrame(
        [{"year": y, "registered": v, "source": f"wikipedia:presidential:{y}"} for y, v in sorted(NATIONAL_REGISTER.items())]
    ).to_csv(PROCESSED / "registered_voters_national.csv", index=False)
    df = pd.DataFrame(registers_2003() + registers_2023())
    df["note"] = ""
    # Anambra's 2023 article quotes a figure 120,281 below the one that reconciles with
    # INEC's national register; every other state matches.
    df = _reconcile(df, 2023, NATIONAL_REGISTER[2023], "AN", "the per-state article's figure does not reconcile")
    problems = []
    for year, total in NATIONAL_REGISTER.items():
        got = df[df.year == year]
        if got.empty:
            continue  # national figure only for this year
        if set(got.state_code) != set(STATES):
            problems.append(f"{year}: missing states {sorted(set(STATES) - set(got.state_code))}")
        s = int(got.registered.sum())
        if s != total:
            problems.append(f"{year}: states sum to {s:,}, INEC national register is {total:,} ({(s - total) / total:+.3%})")
    PROCESSED.mkdir(parents=True, exist_ok=True)
    df.to_csv(PROCESSED / "registered_voters.csv", index=False)
    print(f"wrote {len(df)} rows for {sorted(df.year.unique())}")
    for p in problems:
        print("CHECK:", p)
    return 0


if __name__ == "__main__":
    sys.exit(build())
