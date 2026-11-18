"""Anyanwụ: model mechanics, backtest quality bar, and the published output."""

import json

import numpy as np
import pytest

from anyanwu import governorship as G
from anyanwu import live
from anyanwu import presidential as P
from anyanwu.backtest import presidential_backtest
from anyanwu.data import CODES, Contestant, family, presidential, same_person
from anyanwu.run import OUT


@pytest.fixture(scope="module")
def races():
    return presidential()


def test_family_is_year_aware():
    assert family("ANPP", 2003) == "APC"
    assert family("APP", 1999) == "APC"
    assert family("APP", 2019) == "APP"  # Action Peoples Party, unrelated
    assert family("NDC", 2027) == "NDC"


def test_same_person():
    assert same_person("Charles Soludo", "Charles Chukwuma Soludo")
    assert same_person("Babajide Sanwoolu", "Babajide Sanwo-Olu")  # via Wikipedia links
    assert not same_person("Atiku Abubakar", "Abubakar Audu")


def test_shares_are_distributions(races):
    s = P.base_shares(races[2019], races[2023].contestants, P.Params())
    assert s.shape == (len(CODES), len(races[2023].contestants))
    assert np.allclose(s.sum(1), 1) and (s > 0).all()


def test_candidate_vote_follows_the_candidate(races):
    """Obi's 2023 Labour vote should follow him to the NDC in 2027."""
    obi = Contestant("Peter Obi", "NDC", "AN", "Rabiu Kwankwaso", "KN", 2027)
    lp = Contestant("LP candidate", "LP", year=2027)
    cons = [obi, lp, Contestant("Others", "OTH", year=2027)]
    s = P.base_shares(races[2023], cons, P.Params(w_c=2.0))
    an = CODES.index("AN")
    assert s[an, 0] > 0.5 and s[an, 0] > s[an, 1]


def test_backtest_beats_baseline(races):
    bt = presidential_backtest(races)
    a, b = bt["summary"]["anyanwu"], bt["summary"]["baseline"]
    assert a["brier"] < b["brier"] and a["log_loss"] < b["log_loss"]
    assert a["winner_accuracy"] >= b["winner_accuracy"]


def test_live_model_converges(races):
    fc = P.forecast(races[2019], races[2023].contestants, P.Params(), P.Sigma(), n=2000)
    obs = {i: (races[2023].shares[i], 1.0) for i in range(len(CODES))}
    u = live.update(fc, obs, n=500)
    assert u["first_prob"][0] == pytest.approx(1.0)  # Tinubu, once every state is in


def test_governorship_groups_minor_candidates():
    cons = [Contestant(f"C{i}", f"P{i}") for i in range(5)]
    X = np.zeros((5, len(G.FEATURES)))
    X[0, 0] = X[1, 0] = 0.4
    _cons2, X2, _y, keep = G.group_minor(cons, X, None)
    assert keep == [0, 1] and len(X2) == 3 and X2[-1, 6] == 1


def test_published_output():
    p = json.loads(OUT.read_text())
    pres = p["presidential"]
    assert sum(c["first_prob"] for c in pres["contestants"]) == pytest.approx(1, abs=0.01)
    assert 0 <= pres["runoff_prob"] <= 1 and len(pres["states"]) == 37
    assert len(p["governorship"]) >= 20
    for g in p["governorship"]:
        assert sum(c["win_prob"] for c in g["contestants"]) == pytest.approx(1, abs=0.01)
        assert all(c["share_lo"] <= c["share_mean"] + 1e-9 <= c["share_hi"] + 2e-9 for c in g["contestants"])
