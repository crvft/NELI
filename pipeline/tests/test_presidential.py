"""Checks on the committed presidential dataset (runs offline)."""

import pandas as pd
import pytest

from neli_pipeline.parties import lineage, normalise_party
from neli_pipeline.paths import PROCESSED
from neli_pipeline.states import STATES, normalise_state

# keep_default_na=False: "NA" is Nasarawa's state code, not a missing value
VOTES = pd.read_csv(PROCESSED / "presidential_state_votes.csv", keep_default_na=False)
NATIONAL = pd.read_csv(PROCESSED / "presidential_national.csv", keep_default_na=False, na_values=[""])


@pytest.mark.parametrize("year", [1999, 2003, 2015, 2019, 2023])
def test_every_state_present(year):
    assert set(VOTES[VOTES.year == year].state_code) == set(STATES)


def test_votes_are_non_negative_integers():
    assert (VOTES.votes >= 0).all()
    assert VOTES.votes.dtype.kind == "i"


@pytest.mark.parametrize(
    ("year", "candidate", "declared"),
    [
        (2023, "Bola Tinubu", 8_794_726),
        (2023, "Atiku Abubakar", 6_984_520),
        (2023, "Peter Obi", 6_101_533),
        (2023, "Rabiu Kwankwaso", 1_496_687),
        (2019, "Muhammadu Buhari", 15_191_847),
        (2019, "Atiku Abubakar", 11_262_978),
        (2015, "Muhammadu Buhari", 15_424_921),
        (2015, "Goodluck Jonathan", 12_853_162),
        (2003, "Olusegun Obasanjo", 24_456_140),
        (2003, "Muhammadu Buhari", 12_710_022),
        (1999, "Olusegun Obasanjo", 18_738_154),
        (1999, "Olu Falae", 11_110_287),
    ],
)
def test_declared_totals_match_inec(year, candidate, declared):
    row = NATIONAL[(NATIONAL.year == year) & (NATIONAL.candidate == candidate)].iloc[0]
    assert row.declared == declared


@pytest.mark.parametrize("year", [1999, 2003, 2015, 2019])
def test_states_sum_exactly(year):
    n = NATIONAL[(NATIONAL.year == year) & NATIONAL.declared.notna()]
    assert (n.difference == 0).all()


def test_2023_gap_is_small_and_recorded():
    n = NATIONAL[(NATIONAL.year == 2023) & NATIONAL.declared.notna()]
    gap = n.difference.abs() / n.declared
    assert gap[n.candidate != "Others"].max() < 0.005  # main candidates within 0.5%
    assert gap.max() < 0.01  # minor-party bucket within 1%


def test_state_and_party_normalisation():
    assert normalise_state("F.C.T.[652]") == "FC"
    assert normalise_state("Akwa Ibom[634][635]") == "AK"
    assert normalise_state("Nassarawa") == "NA"
    assert normalise_party("Bola Tinubu APC") == "APC"
    assert normalise_party("AD–APP") == "AD-APP"
    assert lineage("ANPP") == lineage("CPC") == lineage("ACN") == "APC"
