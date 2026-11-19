"""Senate/House of Reps races and LGA results (data/processed)."""

import json

import pandas as pd
import pytest

from neli_pipeline.build_legislative import norm_district
from neli_pipeline.build_lga import match_lgas, norm
from neli_pipeline.paths import PROCESSED, ROOT


@pytest.fixture(scope="module")
def leg():
    return pd.read_csv(PROCESSED / "legislative_summary.csv", keep_default_na=False)


def test_senate_every_year(leg):
    sen = leg[leg.chamber == "senate"].groupby("year").size()
    assert list(sen.index) == [1999, 2003, 2007, 2011, 2015, 2019, 2023]
    assert (sen >= 100).all()  # 109 seats; a few districts are missing in the source


def test_reps_years(leg):
    reps = leg[leg.chamber == "reps"].groupby("year").size()
    assert reps[2019] > 250 and reps[2023] > 300


def test_races_are_well_formed(leg):
    assert leg.election_id.is_unique
    assert set(leg.coverage) <= {"all candidates", "top candidates only", "winner only"}
    assert (leg.winner != "").mean() > 0.98
    # A contradictory source is kept as winner-only, never with its unreliable figures
    assert (leg[leg.conflict.astype(str) == "True"].coverage == "winner only").all()


def test_lga_results_add_up():
    lga = pd.read_csv(PROCESSED / "lga_results.csv", keep_default_na=False)
    names = json.loads((ROOT / "lib" / "lga-names.json").read_text())
    assert set(lga.lga_id) <= set(names)
    gov = pd.read_csv(PROCESSED / "governorship_results.csv", keep_default_na=False)
    for eid, g in lga[lga.election_id.str.startswith("gov-")].groupby("election_id"):
        state_total = gov[gov.election_id == eid].votes.sum()
        assert abs(g.votes.sum() / state_total - 1) <= 0.03, eid


def test_name_helpers():
    assert norm_district("Lagos Central Senatorial District") == "lagos central"
    assert norm("Okobo, Akwa Ibom") == "okobo"
    ids = match_lgas("EK", ["Ado", "Ijero Ekiti", "Ikere-Ekiti"])
    assert all(ids.values()) and len(set(ids.values())) == 3
