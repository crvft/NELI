"""Checks on the committed governorship dataset (runs offline)."""

import pandas as pd
import pytest

from neli_pipeline.paths import PROCESSED
from neli_pipeline.states import STATES

R = pd.read_csv(PROCESSED / "governorship_results.csv", keep_default_na=False)
S = pd.read_csv(PROCESSED / "governorship_summary.csv", keep_default_na=False)


def winner(eid):
    return R[R.election_id == eid].sort_values("votes", ascending=False).iloc[0]


@pytest.mark.parametrize(
    ("eid", "candidate", "party", "votes"),
    [
        ("gov-la-2023", "Babajide Sanwo-Olu", "APC", 762_134),
        ("gov-kn-2019", "Abdullahi Umar Ganduje", "APC", 1_033_695),
        ("gov-os-2022", "Ademola Adeleke", "PDP", 403_371),
        ("gov-an-2021", "Charles Chukwuma Soludo", "APGA", 112_229),
        ("gov-ed-2024", "Monday Okpebholo", "APC", 291_667),
        # Kaduna 2023's article has only an infobox; its APC primary (1,149 delegates) must not be used
        ("gov-kd-2023", "Uba Sani", "APC", 730_002),
    ],
)
def test_known_results(eid, candidate, party, votes):
    w = winner(eid)
    assert (w.candidate, w.party, w.votes) == (candidate, party, votes)


def test_general_election_not_a_primary():
    # Anambra 2021: the APC primary (Andy Uba 230,201) must not be mistaken for the election
    assert R[R.election_id == "gov-an-2021"].party.nunique() > 1


def test_every_governed_state_present():
    assert set(S.state_code) == set(STATES) - {"FC"}


def test_ids_unique_and_parties_well_formed():
    assert S.election_id.is_unique
    assert R.party.str.fullmatch(r"[A-Z][A-Z0-9\-]{0,9}").all()
    assert (R.votes >= 0).all()


def test_joint_ticket_counted_once():
    ab = R[R.election_id == "gov-ab-1999"]
    assert (ab.votes == 173_873).sum() == 1 and "AD-APP" in set(ab.party)


def test_coverage_labels():
    assert set(S.coverage) <= {"all candidates", "top candidates only", "winner only"}
    assert (S.coverage == "all candidates").sum() >= 170
