"""Upcoming elections (2027) and their nominees, read from Wikipedia's articles."""

from __future__ import annotations

import re
from urllib.parse import unquote

from bs4 import BeautifulSoup

from neli_pipeline.parties import normalise_party
from neli_pipeline.sources import wikipedia
from neli_pipeline.states import STATES

PRESIDENTIAL_DATE = "2027-01-16"
GOVERNORSHIP_DATE = "2027-02-06"
# States whose governorship elections run on the general-election cycle (not off-cycle)
OFF_CYCLE = {"AN", "ED", "ON", "EK", "OS", "KO", "BY", "IM"}
GENERAL_CYCLE = [c for c in STATES if c not in OFF_CYCLE and c != "FC"]


def nominees(html: str) -> list[tuple[str, str]]:
    """(candidate, party code) pairs from an election infobox's Nominee/Party rows."""
    return [(n, p) for n, p, _ in nominees_with_links(html)]


def nominees_with_links(html: str) -> list[tuple[str, str, str | None]]:
    """(candidate, party code, Wikipedia title of the candidate's article or None)."""
    soup = BeautifulSoup(html, "lxml")
    box = soup.select_one("table.infobox")
    if box is None:
        return []
    out: list[tuple[str, str, str | None]] = []
    links: list[str | None] = []
    names: list[str] | None = None
    for tr in box.select("tr"):
        th = tr.find("th")
        if th is None:
            continue
        label = th.get_text(" ", strip=True)
        cells = [re.sub(r"\[[^\]]*\]", "", td.get_text(" ", strip=True)).strip() for td in tr.find_all("td", recursive=False)]
        cells = [c for c in cells if c]
        if label == "Nominee" and 0 < len(cells) <= 4:
            names = cells
            tds = [td for td in tr.find_all("td", recursive=False) if td.get_text(strip=True)]
            links = []
            for td in tds:
                a = td.find("a", href=True)
                href = a["href"] if a and "new" not in (a.get("class") or []) else ""
                m = re.search(r"/wiki/([^?#]+)$", href)
                links.append(unquote(m.group(1)) if m and ":" not in m.group(1) else None)
        elif label == "Party" and names and 0 < len(cells) <= 4:
            for n, p, ln in zip(names, cells, links, strict=False):
                code = normalise_party(p) or p
                out.append((re.sub(r"\s+", " ", n), code, ln))
            names = None
    seen, uniq = set(), []
    for n, p, ln in out:
        if n not in seen:
            seen.add(n)
            uniq.append((n, p, ln))
    return uniq


def governorship_2027() -> dict[str, dict]:
    """state -> {title, date, nominees, source_key} for 2027 general-cycle races."""
    out = {}
    for code in GENERAL_CYCLE:
        name = STATES[code][0]
        title = f"2027_{name.replace(' ', '_')}_State_gubernatorial_election"
        try:
            html = wikipedia.fetch(title)
        except Exception:  # noqa: BLE001 - article may not exist yet
            continue
        rec = wikipedia.record(f"wikipedia:governorship:2027:{code}", title, html)
        noms = nominees_with_links(html)
        out[code] = {
            "title": title,
            "date": GOVERNORSHIP_DATE,
            "nominees": [(n, p) for n, p, _ in noms],
            "links": {n: ln for n, _, ln in noms},
            "source_key": rec.key,
        }
    return out


def presidential_2027_source() -> str:
    title = "2027_Nigerian_presidential_election"
    html = wikipedia.fetch(title)
    return wikipedia.record("wikipedia:presidential:2027", title, html).key
