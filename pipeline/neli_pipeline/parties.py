"""Party codes and lineage.

Nigerian parties merge and split, so a model needs to know which historical party a
modern one descends from. `LINEAGE` maps a party as it appeared on the ballot to the
lineage group used for continuity across elections. The original label is always
kept too; lineage is an analytical layer, never a rewrite of history.
"""

from __future__ import annotations

import re

# Ballot label variants -> party code
_PARTY_ALIASES = {
    "apc": "APC",
    "all progressives congress": "APC",
    "pdp": "PDP",
    "peoples democratic party": "PDP",
    "people's democratic party": "PDP",
    "lp": "LP",
    "labour party": "LP",
    "nnpp": "NNPP",
    "new nigeria peoples party": "NNPP",
    "apga": "APGA",
    "all progressives grand alliance": "APGA",
    "adc": "ADC",
    "african democratic congress": "ADC",
    "sdp": "SDP",
    "social democratic party": "SDP",
    "cpc": "CPC",
    "congress for progressive change": "CPC",
    "acn": "ACN",
    "action congress of nigeria": "ACN",
    "ac": "AC",
    "action congress": "AC",
    "anpp": "ANPP",
    "all nigeria peoples party": "ANPP",
    "app": "APP",
    "all people's party": "APP",
    "all peoples party": "APP",
    "ad": "AD",
    "alliance for democracy": "AD",
    "ppa": "PPA",
    "progressive peoples alliance": "PPA",
    "ypp": "YPP",
    "aac": "AAC",
    "accord": "A",
    "a": "A",
    "c4c": "C4C",
    "coalition for change": "C4C",
    "ad–app": "AD-APP",
    "ad-app": "AD-APP",
    "app–ad": "AD-APP",
}

# Party -> lineage group (who it became / descends from)
LINEAGE = {
    # APC (2013 merger of ACN, CPC, ANPP and part of APGA)
    "APC": "APC",
    "ACN": "APC",  # AD -> AC (2006) -> ACN (2010) -> APC (2013)
    "AC": "APC",
    "AD": "APC",
    "CPC": "APC",
    "ANPP": "APC",  # APP -> ANPP (2003) -> APC
    "APP": "APC",
    "AD-APP": "APC",  # 1999 joint ticket (Falae)
    "PDP": "PDP",
    "LP": "LP",
    "NNPP": "NNPP",
    "APGA": "APGA",
    "ADC": "ADC",
    "SDP": "SDP",
}


HONORIFICS = {"esq", "jnr", "jr", "snr", "sr", "rtd", "phd", "dr", "mrs", "mni", "san", "con", "ofr"}


def normalise_party(raw: object) -> str:
    s = re.sub(r"\[[^\]]*\]", "", str(raw)).strip()
    s = re.sub(r"\s*\(Nigeria\)\s*$", "", s)  # Wikipedia disambiguation, e.g. "Labour Party (Nigeria)"
    s = re.sub(r"\)+", ")", s)
    m = re.search(r"\(([A-Za-z0-9][A-Za-z0-9\-–/]*)\)\s*$", s)
    if m and m.group(1).lower() not in HONORIFICS:
        inner = m.group(1)
        return _PARTY_ALIASES.get(inner.lower(), inner.upper())
    key = s.lower()
    if key in _PARTY_ALIASES:
        return _PARTY_ALIASES[key]
    # Labels like "Bola Tinubu APC" -> last token
    tail = s.split()[-1] if s.split() else s
    if tail.lower() in _PARTY_ALIASES:
        return _PARTY_ALIASES[tail.lower()]
    if tail.isupper() and 2 <= len(tail) <= 6:
        return tail
    # Full names of minor parties -> initials ("National Democratic Party" -> "NDP")
    words = [w for w in re.split(r"[\s-]+", s) if w and w[0].isalpha() and w.lower() not in {"of", "for", "and", "the"}]
    return "".join(w[0].upper() for w in words) or s.upper()


def lineage(party: str) -> str:
    return LINEAGE.get(party, "OTHER")
