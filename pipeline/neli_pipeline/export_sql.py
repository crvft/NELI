"""Turn the validated CSVs in data/processed into a SQL seed for Supabase.

    uv run python -m neli_pipeline.export_sql

Writes supabase/seed/real_data.sql: one transaction that clears and reloads every
data table, so re-running it is safe (idempotent). Apply it with the Supabase MCP
tool / SQL editor, or `psql "$DATABASE_URL" -f supabase/seed/real_data.sql`.
"""

from __future__ import annotations

import json
import math
import re
import sys
from collections import Counter

import pandas as pd

from .parties import lineage
from .paths import MANIFEST, PROCESSED, ROOT
from .states import STATES

ZONES = {
    "NW": "North West",
    "NE": "North East",
    "NC": "North Central",
    "SW": "South West",
    "SE": "South East",
    "SS": "South South",
}
SEED = ROOT / "supabase" / "seed" / "real_data.sql"
LAST_PAYLOAD: dict = {}


def q(v) -> str:
    if v is None or (isinstance(v, float) and math.isnan(v)) or v == "":
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int | float) and not isinstance(v, bool):
        return str(int(v)) if float(v).is_integer() else repr(float(v))
    return "'" + str(v).replace("'", "''") + "'"


def insert(table: str, cols: list[str], rows: list[tuple], chunk: int = 500) -> list[str]:
    out = []
    for i in range(0, len(rows), chunk):
        vals = ",\n".join("(" + ", ".join(q(v) for v in r) + ")" for r in rows[i : i + chunk])
        out.append(f"insert into public.{table} ({', '.join(cols)}) values\n{vals};")
    return out


def read(name: str) -> pd.DataFrame:
    # keep_default_na=False: "NA" is Nasarawa, not missing
    return pd.read_csv(PROCESSED / name, keep_default_na=False, na_values=[""])


def build() -> int:
    pres_votes = read("presidential_state_votes.csv")
    pres_sum = read("presidential_state_summary.csv")
    pres_nat = read("presidential_national.csv")
    gov_res = read("governorship_results.csv")
    gov_res["candidate"] = gov_res["candidate"].fillna("")  # unnamed candidate (e.g. joint tickets) is '', not missing
    gov_sum = read("governorship_summary.csv")
    reg = read("registered_voters.csv")
    reg["note"] = reg["note"].fillna("")
    reg_nat = read("registered_voters_national.csv")
    leg_sum = read("legislative_summary.csv") if (PROCESSED / "legislative_summary.csv").exists() else pd.DataFrame()
    leg_res = read("legislative_results.csv") if (PROCESSED / "legislative_results.csv").exists() else pd.DataFrame()
    lga_res = read("lga_results.csv") if (PROCESSED / "lga_results.csv").exists() else pd.DataFrame()
    for df in (leg_sum, leg_res, lga_res):
        if len(df):
            df.fillna("", inplace=True)
    manifest = json.loads(MANIFEST.read_text())
    people_df = read("people.csv").fillna("")
    links = read("candidate_people.csv")
    pid = {(r.election_id, r.candidate): r.person_id for r in links.itertuples()}
    people = [
        (
            r.id,
            r.name,
            r.wiki_title,
            r.summary,
            r.born or None,
            r.died or None,
            r.birth_place or None,
            r.birth_state or None,
            r.gender or None,
            r.party or None,
            r.education or None,
            r.occupation or None,
            r.offices or "[]",
            r.source if r.source in manifest else None,
        )
        for r in people_df.itertuples()
    ]
    PEOPLE_COLS = ["id", "name", "wiki_title", "summary", "born", "died", "birth_place", "birth_state", "gender", "party"]
    PEOPLE_COLS += ["education", "occupation", "offices", "source_key"]

    # Parties: every code used, with the most common full name seen in labels
    names: dict[str, Counter] = {}
    for label, code in zip(gov_res.party_label, gov_res.party, strict=True):
        m = re.match(r"(.+?)\s*\(([^)]+)\)\s*$", str(label))
        if m and len(m.group(1)) > 3:
            names.setdefault(code, Counter())[m.group(1).strip()] += 1
    codes = sorted(
        (set(pres_votes.party) | set(gov_res.party) | set(leg_res.get("party", [])) | set(lga_res.get("party", []))) - {""}
    )
    parties = [(c, (names[c].most_common(1)[0][0] if c in names else None), lineage(c)) for c in codes]

    sources = [
        (k, v["title"], v["url"], v["revision"], v["retrieved_at"], v["sha256"], v["license"]) for k, v in manifest.items()
    ]

    elections = []
    nat_reg = dict(zip(reg_nat.year, reg_nat.registered, strict=True))
    for year, g in pres_nat.groupby("year"):
        declared = g.declared.dropna()
        valid = int(declared.sum()) if len(declared) == len(g) else None
        elections.append(
            (
                f"pres-{year}",
                "presidential",
                int(year),
                None,
                False,
                "all candidates",
                nat_reg.get(year),
                valid,
                None,
                None,
                None,
                f"wikipedia:presidential:{year}",
                None,
                False,
            )
        )
    for r in gov_sum.itertuples():
        elections.append(
            (
                r.election_id,
                "governorship",
                int(r.year),
                r.state_code,
                str(r.off_cycle) == "True",
                r.coverage,
                r.registered,
                r.valid_votes,
                r.rejected_votes,
                r.total_votes,
                r.sum_check,
                r.source,
                None,
                False,
            )
        )
    for r in leg_sum.itertuples():
        elections.append(
            (
                r.election_id,
                r.chamber,
                int(r.year),
                r.state_code,
                False,
                r.coverage,
                None,
                None,
                None,
                None,
                None,
                r.source,
                r.district,
                str(r.conflict) == "True",
            )
        )

    results = [
        (
            f"pres-{r.year}",
            "state",
            r.state_code,
            r.candidate,
            r.party,
            r.party,
            int(r.votes),
            r.source,
            pid.get((f"pres-{r.year}", r.candidate)),
        )
        for r in pres_votes.itertuples()
    ] + [
        (
            r.election_id,
            "state",
            r.state_code,
            r.candidate,
            r.party,
            r.party_label,
            int(r.votes),
            r.source,
            pid.get((r.election_id, r.candidate)),
        )
        for r in gov_res.itertuples()
    ]
    # Senate / House of Reps (winner-only races carry the winner with no vote figure)
    results += [
        (
            r.election_id,
            "state",
            r.election_id.split("-")[2].upper(),
            r.candidate,
            r.party or "OTH",
            r.party or "",
            int(r.votes),
            r.source,
            None,
        )
        for r in leg_res.itertuples()
    ]
    # LGA rows (area_code = the map's GRID3 LGA id)
    results += [
        (
            r.election_id,
            "lga",
            r.lga_id,
            r.candidate,
            r.party,
            r.party,
            int(r.votes),
            r.source,
            pid.get((r.election_id, r.candidate)),
        )
        for r in lga_res.itertuples()
    ]

    area_totals = [
        (f"pres-{r.year}", "state", r.state_code, r.valid_votes, r.rejected_votes, r.total_votes, r.registered)
        for r in pres_sum.itertuples()
    ]
    registers = [(int(r.year), r.state_code, int(r.registered), r.note, r.source) for r in reg.itertuples()] + [
        (int(r.year), None, int(r.registered), "", r.source) for r in reg_nat.itertuples()
    ]

    global LAST_PAYLOAD
    LAST_PAYLOAD = {
        "zones": [{"code": c, "name": n} for c, n in ZONES.items()],
        "states": [{"code": c, "name": n, "zone": z} for c, (n, z) in STATES.items()],
        "parties": [dict(zip(["code", "name", "lineage"], r, strict=True)) for r in parties],
        "sources": [
            dict(zip(["key", "title", "url", "revision", "retrieved_at", "sha256", "license"], r, strict=True)) for r in sources
        ],
        "people": [{**dict(zip(PEOPLE_COLS, r, strict=True)), "offices": json.loads(r[12])} for r in people],
        "elections": [
            dict(
                zip(
                    [
                        "id",
                        "type",
                        "year",
                        "state_code",
                        "off_cycle",
                        "coverage",
                        "registered",
                        "valid_votes",
                        "rejected_votes",
                        "total_votes",
                        "sum_check",
                        "source_key",
                        "constituency",
                        "conflict",
                    ],
                    r,
                    strict=True,
                )
            )
            for r in elections
        ],
        "results": [
            dict(
                zip(
                    [
                        "election_id",
                        "area_type",
                        "area_code",
                        "candidate",
                        "party",
                        "party_label",
                        "votes",
                        "source_key",
                        "person_id",
                    ],
                    r,
                    strict=True,
                )
            )
            for r in results
        ],
        "area_totals": [
            dict(
                zip(
                    ["election_id", "area_type", "area_code", "valid_votes", "rejected_votes", "total_votes", "registered"],
                    r,
                    strict=True,
                )
            )
            for r in area_totals
        ],
        "registered_voters": [
            dict(zip(["year", "state_code", "registered", "note", "source_key"], r, strict=True)) for r in registers
        ],
    }

    sql = [
        "-- Generated by neli_pipeline.export_sql from data/processed. Do not edit by hand.",
        "begin;",
        "truncate public.results, public.area_totals, public.registered_voters, public.elections, public.people, public.parties, public.sources, public.states, public.zones restart identity cascade;",
        *insert("zones", ["code", "name"], list(ZONES.items())),
        *insert("states", ["code", "name", "zone"], [(c, n, z) for c, (n, z) in STATES.items()]),
        *insert("parties", ["code", "name", "lineage"], parties),
        *insert("sources", ["key", "title", "url", "revision", "retrieved_at", "sha256", "license"], sources),
        *insert("people", PEOPLE_COLS, people),
        *insert(
            "elections",
            [
                "id",
                "type",
                "year",
                "state_code",
                "off_cycle",
                "coverage",
                "registered",
                "valid_votes",
                "rejected_votes",
                "total_votes",
                "sum_check",
                "source_key",
                "constituency",
                "conflict",
            ],
            elections,
        ),
        *insert(
            "results",
            ["election_id", "area_type", "area_code", "candidate", "party", "party_label", "votes", "source_key", "person_id"],
            results,
        ),
        *insert(
            "area_totals",
            ["election_id", "area_type", "area_code", "valid_votes", "rejected_votes", "total_votes", "registered"],
            area_totals,
        ),
        *insert("registered_voters", ["year", "state_code", "registered", "note", "source_key"], registers),
        "commit;",
    ]
    # Party registry for the web app (names + family), so the UI can label all 100+ parties
    (ROOT / "lib" / "party-registry.json").write_text(
        json.dumps({c: {"name": n, "lineage": lin} for c, n, lin in parties}, indent=1, ensure_ascii=False) + "\n"
    )
    SEED.parent.mkdir(parents=True, exist_ok=True)
    SEED.write_text("\n".join(sql) + "\n")
    print(
        f"{SEED.relative_to(ROOT)}: {len(parties)} parties, {len(sources)} sources, {len(elections)} elections, "
        f"{len(results)} results, {len(area_totals)} area totals, {len(registers)} registers ({SEED.stat().st_size:,} bytes)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(build())
