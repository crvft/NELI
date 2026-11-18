"""Canonical states (codes match lib/geo.ts in the web app) and the name variants sources use."""

from __future__ import annotations

import re

# code -> (canonical name, geopolitical zone)
STATES: dict[str, tuple[str, str]] = {
    "AB": ("Abia", "SE"),
    "AD": ("Adamawa", "NE"),
    "AK": ("Akwa Ibom", "SS"),
    "AN": ("Anambra", "SE"),
    "BA": ("Bauchi", "NE"),
    "BY": ("Bayelsa", "SS"),
    "BE": ("Benue", "NC"),
    "BO": ("Borno", "NE"),
    "CR": ("Cross River", "SS"),
    "DE": ("Delta", "SS"),
    "EB": ("Ebonyi", "SE"),
    "ED": ("Edo", "SS"),
    "EK": ("Ekiti", "SW"),
    "EN": ("Enugu", "SE"),
    "FC": ("FCT", "NC"),
    "GO": ("Gombe", "NE"),
    "IM": ("Imo", "SE"),
    "JI": ("Jigawa", "NW"),
    "KD": ("Kaduna", "NW"),
    "KN": ("Kano", "NW"),
    "KT": ("Katsina", "NW"),
    "KE": ("Kebbi", "NW"),
    "KO": ("Kogi", "NC"),
    "KW": ("Kwara", "NC"),
    "LA": ("Lagos", "SW"),
    "NA": ("Nasarawa", "NC"),
    "NI": ("Niger", "NC"),
    "OG": ("Ogun", "SW"),
    "ON": ("Ondo", "SW"),
    "OS": ("Osun", "SW"),
    "OY": ("Oyo", "SW"),
    "PL": ("Plateau", "NC"),
    "RI": ("Rivers", "SS"),
    "SO": ("Sokoto", "NW"),
    "TA": ("Taraba", "NE"),
    "YO": ("Yobe", "NE"),
    "ZA": ("Zamfara", "NW"),
}

_ALIASES = {
    "fct": "FC",
    "fct abuja": "FC",
    "abuja": "FC",
    "federal capital territory": "FC",
    "abuja federal capital territory": "FC",
    "nassarawa": "NA",
    "akwa-ibom": "AK",
    "akwaibom": "AK",
    "cross-river": "CR",
}
_BY_NAME = {name.lower(): code for code, (name, _) in STATES.items()}


def normalise_state(raw: object) -> str | None:
    """Map a source's state label (with footnote markers, odd spellings) to a state code."""
    if raw is None:
        return None
    s = str(raw)
    s = re.sub(r"\[[^\]]*\]", "", s)  # strip [12] footnotes
    s = re.sub(r"\s+state$", "", s.strip(), flags=re.I)
    key = re.sub(r"\s+", " ", s.replace(".", "")).strip().lower()
    return _ALIASES.get(key) or _BY_NAME.get(key)
