"""Politician profiles (data/processed/people.csv) and candidate → person links."""

import json

import pandas as pd
import pytest

from neli_pipeline.build_people import match_link, slug, state_in
from neli_pipeline.paths import PROCESSED


@pytest.fixture(scope="module")
def people():
    return pd.read_csv(PROCESSED / "people.csv", keep_default_na=False).set_index("id")


@pytest.fixture(scope="module")
def links():
    return pd.read_csv(PROCESSED / "candidate_people.csv", keep_default_na=False)


def test_known_profiles(people):
    t = people.loc["bola-tinubu"]
    assert t.born == "1952-03-29" and t.birth_state == "LA" and t.gender == "male"
    assert "president of Nigeria" in t.summary
    offices = json.loads(t.offices)
    assert any("Governor of Lagos" in o["title"] for o in offices)
    a = people.loc["rotimi-akeredolu"]
    assert a.died == "2023-12-27" and a.birth_state == "ON"


def test_summaries_are_clean(people):
    assert not people.summary.str.contains(r"\blisten\b", case=False).any()
    assert not people.summary.str.contains(r"\[\d+\]").any()  # no citation markers
    assert (people.summary.str.len() > 40).all()


def test_spelling_variants_merge(links):
    ids = links.groupby("person_id").candidate.unique()
    assert {"Babajide Sanwoolu", "Babajide Sanwo-Olu"} <= set(ids["babajide-sanwo-olu"])


def test_births_are_plausible(people):
    years = pd.to_numeric(people.born.str[:4], errors="coerce").dropna()
    assert years.between(1900, 1995).all()


def test_helpers():
    assert slug("Seriake Dickson") == "seriake-dickson"
    assert state_in("Okene, Kwara State (now in Kogi State), Nigeria") == "KO"
    assert state_in("Jada, Adamawa State, Nigeria") == "AD"
    links = [("Charles Soludo", "Charles_Chukwuma_Soludo"), ("Willie Obiano", "Willie_Obiano")]
    assert match_link("Charles Chukwuma Soludo", links) == "Charles_Chukwuma_Soludo"
    assert match_link("Obiora Okonkwo", links) is None
