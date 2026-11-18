"""Politician profiles from Wikipedia.

    uv run python -m neli_pipeline.build_people [--offline]

1. Link every candidate in the results to their Wikipedia article. The link comes
   from the election article itself (its results table and infobox), so we never
   guess a person from a name alone. Spelling variants of one person across
   elections ("Bola Tinubu" / "Bola Ahmed Tinubu") resolve to the same article and
   so to one person id.
2. Read each article: opening paragraph (bio), infobox birth date and place, death
   date, offices held with terms, party, education and occupation.

Writes data/processed/people.csv and data/processed/candidate_people.csv.
Text is from Wikipedia (CC BY-SA 4.0); every person keeps a source key for attribution.
--offline uses only cached pages (no network).
"""

from __future__ import annotations

import json
import re
import sys
import time
import unicodedata
from dataclasses import asdict, dataclass, field
from urllib.parse import unquote

import pandas as pd
from bs4 import BeautifulSoup, Tag

from .paths import MANIFEST, PROCESSED, RAW
from .sources import wikipedia
from .states import STATES, normalise_state

HONORIFICS = {
    "dr", "chief", "prince", "princess", "alhaji", "alhaja", "senator", "sen", "engr", "mrs", "mr", "sir",
    "prof", "professor", "barr", "barrister", "hon", "rt", "gen", "general", "col", "rtd", "retd", "otunba",
    "arc", "pastor", "rev", "mallam", "malam", "hajia", "lady", "high", "his", "excellency", "jr", "sr", "ph", "d",
}  # fmt: skip

PERSON_WORDS = re.compile(
    r"\b(politician|businessman|businesswoman|lawyer|economist|engineer|soldier|army officer|general|academic|"
    r"banker|activist|physician|diplomat|accountant|journalist|professor|administrator|technocrat|pharmacist|"
    r"architect|surveyor|educationist|teacher|entrepreneur|industrialist|broadcaster|cleric|chemist|scientist)\b",
    re.I,
)


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def tokens(s: str) -> set[str]:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return {t for t in re.findall(r"[a-z]+", s) if t not in HONORIFICS and len(t) > 1}


def _title_from_href(href: str) -> str | None:
    m = re.match(r"(?:https://en\.wikipedia\.org)?/wiki/([^?#]+)$", href)
    if not m:
        return None
    t = unquote(m.group(1))
    if ":" in t:  # File:, Category:, Help: ...
        return None
    return t


def candidate_links(html: str) -> list[tuple[str, str]]:
    """(link text, article title) for internal links inside tables (results + infobox)."""
    soup = BeautifulSoup(html, "lxml")
    out = []
    for a in soup.select("table a[href]"):
        if "new" in (a.get("class") or []):  # red link: no article
            continue
        t = _title_from_href(a["href"])
        if not t or re.search(r"(election|Party|State$|Congress|Alliance|Movement|Nigeria$)", t):
            continue
        out.append((a.get_text(" ", strip=True), t))
    return out


def match_link(candidate: str, links: list[tuple[str, str]]) -> str | None:
    """The article whose link text or title shares the most name tokens (at least two)."""
    c = tokens(candidate)
    if len(c) < 2:
        return None
    best, best_score = None, 1
    for text, title in links:
        score = len(c & (tokens(text) | tokens(title.replace("_", " "))))
        if score > best_score:
            best, best_score = title, score
    return best


# ---------------------------------------------------------------------------
# Article parsing
# ---------------------------------------------------------------------------


@dataclass
class Profile:
    wiki_title: str
    name: str
    summary: str = ""
    born: str | None = None
    died: str | None = None
    birth_place: str | None = None
    birth_state: str | None = None
    gender: str | None = None
    party: str | None = None
    education: str | None = None
    occupation: str | None = None
    offices: list[dict] = field(default_factory=list)


def _clean(el: Tag) -> str:
    for junk in el.select("sup, .reference, .noprint, style, .IPA, .rt-commentedText"):
        junk.decompose()
    text = el.get_text(" ", strip=True)
    text = re.sub(r"\s+([,.;:)])", r"\1", text)
    text = re.sub(r"\"\s+([^\"]+?)\s+\"", r"\"\1\"", text)
    text = re.sub(r"\(\s+", "(", text)
    return re.sub(r"\s+", " ", text).strip()


def _body(soup: BeautifulSoup) -> Tag | None:
    return soup.select_one("div.mw-content-ltr.mw-parser-output") or soup.select_one("div.mw-parser-output")


def _paragraphs(body: Tag) -> list[Tag]:
    """Article paragraphs in order (newer HTML wraps them in <section>), skipping tables and boxes."""
    return [
        p for p in body.find_all("p") if not p.find_parent(["table", "figure"]) and "mw-empty-elt" not in (p.get("class") or [])
    ]


def _lead(soup: BeautifulSoup) -> str:
    body = _body(soup)
    if body is None:
        return ""
    for p in _paragraphs(body):
        if "mw-empty-elt" in (p.get("class") or []):
            continue
        text = _clean(p)
        if len(text) < 60:
            continue
        # Drop pronunciation guides and the birth-date parenthetical (shown separately)
        text = re.sub(r"\s*\((?:[^()]|\([^()]*\))*\b(?:born|né|née|listen|pronounced)\b(?:[^()]|\([^()]*\))*\)", "", text)
        text = re.sub(r"\s*\(\s*;?\s*\)", "", text)
        # Life-span parentheses, e.g. "(21 July 1956 – 27 December 2023)"
        text = re.sub(r"\s*\((?:[^()]|\([^()]*\))*\b1[89]\d\d\b(?:[^()]|\([^()]*\))*\)", "", text)
        text = re.sub(r"\(+\s*listen\s*\)+;?", "", text, flags=re.I)
        text = re.sub(r"\s*\blisten\b", "", text, flags=re.I)
        text = re.sub(r"\s*\(\s*[;,]?\s*\)", "", text)
        text = re.sub(r"\s{2,}", " ", text).strip()
        if len(text) > 700:  # cut at a sentence boundary
            cut = text[:700].rfind(". ")
            text = text[: cut + 1] if cut > 200 else text[:700].rstrip() + "…"
        return text
    return ""


def _gender(soup: BeautifulSoup) -> str | None:
    body = _body(soup)
    if body is None:
        return None
    text = " ".join(p.get_text(" ") for p in _paragraphs(body)[:6]).lower()
    he = len(re.findall(r"\b(he|his|him)\b", text))
    she = len(re.findall(r"\b(she|her|hers)\b", text))
    if he >= 3 and he > 3 * she:
        return "male"
    if she >= 3 and she > 3 * he:
        return "female"
    return None


def _row_value(box: Tag, *labels: str) -> Tag | None:
    for tr in box.select("tr"):
        th = tr.find("th", class_="infobox-label")
        td = tr.find("td", class_="infobox-data")
        if th and td and th.get_text(" ", strip=True).lower() in labels:
            return td
    return None


def _first_line(td: Tag | None, limit: int = 160) -> str | None:
    if td is None:
        return None
    for br in td.find_all("br"):
        br.replace_with("\n")
    for li in td.find_all("li"):
        li.insert_after("\n")
    text = td.get_text("", strip=False)
    text = re.sub(r"\[[^\]]*\]", "", text)
    lines = [re.sub(r"\s+", " ", ln).strip(" ,") for ln in text.split("\n")]
    lines = [ln for ln in lines if ln]
    if not lines:
        return None
    out = lines[0] if len(lines) == 1 else "; ".join(lines[:3])
    return out[:limit].rstrip()


def _offices(box: Tag) -> list[dict]:
    """Offices from the infobox: a header row (e.g. "Governor of Lagos State") followed
    by "In office" / "Assumed office" with the term."""
    offices: list[dict] = []
    current: dict | None = None
    for tr in box.select("tr"):
        th = tr.find("th")
        if th is not None and "infobox-header" in (th.get("class") or []):
            title = _clean(th)
            if title and not re.match(r"(personal details|military service|signature)", title, re.I):
                current = {"title": title, "term": None}
                offices.append(current)
            continue
        label = tr.find(["th", "td"], class_="infobox-label") or tr.find("th")
        data = tr.find("td", class_="infobox-data")
        if current and label is not None and current["term"] is None:
            lab = label.get_text(" ", strip=True)
            if re.match(r"(in office|assumed office)", lab, re.I):
                term = _clean(data) if data else ""
                current["term"] = f"Since {term}" if lab.lower().startswith("assumed") else term or None
        # Some infoboxes put "In office" inside a full-width cell
        full = tr.find("td", class_="infobox-full-data")
        if current and full is not None and current["term"] is None:
            m = re.match(r"(In office|Assumed office)\s*(.+)", _clean(full))
            if m:
                current["term"] = ("Since " if m.group(1).startswith("Assumed") else "") + m.group(2)
    return [o for o in offices if o["term"]][:8]


MONTHS = {
    m: i
    for i, m in enumerate(
        [
            "january",
            "february",
            "march",
            "april",
            "may",
            "june",
            "july",
            "august",
            "september",
            "october",
            "november",
            "december",
        ],
        1,
    )
}


def _date_in(text: str | None) -> str | None:
    """First "27 December 2023" or "December 27, 2023" in the text, as an ISO date."""
    if not text:
        return None
    m = re.search(r"(\d{1,2}) ([A-Z][a-z]+),? (\d{4})", text)
    if m and m.group(2).lower() in MONTHS:
        return f"{m.group(3)}-{MONTHS[m.group(2).lower()]:02d}-{int(m.group(1)):02d}"
    m = re.search(r"([A-Z][a-z]+) (\d{1,2}), (\d{4})", text)
    if m and m.group(1).lower() in MONTHS:
        return f"{m.group(3)}-{MONTHS[m.group(1).lower()]:02d}-{int(m.group(2)):02d}"
    return None


def parse_person(html: str, title: str) -> Profile | None:
    soup = BeautifulSoup(html, "lxml")
    h1 = soup.select_one("h1#firstHeading")
    name = re.sub(r"\s*\([^)]*\)$", "", h1.get_text(" ", strip=True) if h1 else title.replace("_", " "))
    summary = _lead(soup)
    box = soup.select_one("table.infobox")
    prof = Profile(wiki_title=title, name=name, summary=summary, gender=_gender(soup))
    if box is not None:
        bday = box.select_one("span.bday")
        prof.born = bday.get_text(strip=True) if bday else None
        if prof.born and not re.match(r"\d{4}-\d{2}-\d{2}$", prof.born):
            prof.born = prof.born[:4] if re.match(r"\d{4}", prof.born) else None
        dday = box.select_one("span.dday")
        prof.died = dday.get_text(strip=True) if dday else _date_in(_first_line(_row_value(box, "died"), 200))
        bp = box.select_one(".birthplace")
        if bp is not None:
            prof.birth_place = _clean(bp)
        else:
            born_td = _row_value(box, "born")
            if born_td is not None:
                txt = _first_line(born_td, 300) or ""
                m = re.search(r"\(aged?\s*\d+\)\s*;?\s*(.+)$", txt) or re.search(r"\b\d{4}\)?\s*;\s*(.+)$", txt)
                prof.birth_place = m.group(1).strip(" ;") if m else None
        party = _first_line(_row_value(box, "political party", "party"), 160)
        if party:  # current/first party only, without years
            party = re.sub(r"\s*\(.*$", "", party.split(";")[0]).strip(" ,")
        prof.party = party or None
        prof.education = _first_line(_row_value(box, "alma mater", "education"), 200)
        prof.occupation = _first_line(_row_value(box, "occupation", "profession", "occupations"), 120)
        prof.offices = _offices(box)
    if prof.birth_place:
        prof.birth_place = re.sub(r"\s*\(now [^)]*\)", lambda m: m.group(0), prof.birth_place)[:160]
        prof.birth_state = state_in(prof.birth_place)
    # Must be a Nigerian person, not a place or a disambiguation page
    is_person = bool(prof.born) or bool(PERSON_WORDS.search(summary[:300]))
    if not is_person or "may refer to" in summary:
        return None
    return prof


def state_in(place: str) -> str | None:
    """The Nigerian state named in a birthplace like "Jada, Adamawa State, Nigeria"."""
    now = re.search(r"now in ([A-Z][A-Za-z ]+?) State", place)
    if now and normalise_state(now.group(1)):
        return normalise_state(now.group(1))
    for part in reversed([p.strip() for p in re.split(r"[,;]", place)]):
        part = re.sub(r"\(.*?\)", "", part).strip()
        code = normalise_state(part)
        if code:
            return code
    m = re.search(r"\b([A-Z][a-z]+(?: [A-Z][a-z]+)?) State\b", place)
    return normalise_state(m.group(1)) if m else None


# ---------------------------------------------------------------------------


def _source_titles() -> dict[str, str]:
    return {k: v["title"] for k, v in json.loads(MANIFEST.read_text()).items()}


def build(offline: bool = False) -> int:
    pres = pd.read_csv(PROCESSED / "presidential_state_votes.csv", keep_default_na=False)
    gov = pd.read_csv(PROCESSED / "governorship_results.csv", keep_default_na=False)
    rows = [(f"pres-{r.year}", r.candidate, r.source) for r in pres.drop_duplicates(["year", "candidate"]).itertuples()]
    rows += [(r.election_id, r.candidate, r.source) for r in gov.itertuples()]
    titles = _source_titles()

    # 1. candidate -> article, using the election article's own links
    link_cache: dict[str, list[tuple[str, str]]] = {}
    matched: dict[tuple[str, str], str] = {}
    for eid, cand, src in rows:
        if not cand or cand == "Others" or src not in titles:
            continue
        page = titles[src]
        if page not in link_cache:
            link_cache[page] = candidate_links(wikipedia.fetch(page))
        t = match_link(cand, link_cache[page])
        if t:
            matched[(eid, cand)] = t

    # 2. read each linked article (canonical title after redirects)
    profiles: dict[str, Profile] = {}
    canonical: dict[str, str] = {}
    targets = sorted(set(matched.values()))
    print(f"{len(matched)} candidate entries link to {len(targets)} articles")
    for i, t in enumerate(targets):
        safe = t.replace("/", "_")
        cached = (RAW / "wikipedia" / f"{safe}.html").exists()
        if offline and not cached:
            continue
        try:
            html = wikipedia.fetch(safe)
        except Exception as exc:  # noqa: BLE001 - keep going; report at the end
            print(f"  ! {t}: {exc}")
            continue
        if not cached:
            time.sleep(0.4)
        m = re.search(r'"wgPageName":"([^"]+)"', html)
        canon = json.loads(f'"{m.group(1)}"') if m else safe
        canonical[t] = canon
        if canon in profiles:
            continue
        p = parse_person(html, canon)
        if p:
            profiles[canon] = p
            wikipedia.record(f"wikipedia:person:{canon}", canon, html)
        if (i + 1) % 50 == 0:
            print(f"  {i + 1}/{len(targets)}")

    # 3. person ids: one per article; unique slug from the article title
    ids: dict[str, str] = {}
    used: dict[str, str] = {}
    for canon in sorted(profiles):
        base = slug(re.sub(r"_\([^)]*\)$", "", canon).replace("_", " "))
        pid = base if base not in used else slug(canon.replace("_", " "))
        used[pid] = canon
        ids[canon] = pid

    links = []
    for (eid, cand), t in sorted(matched.items()):
        canon = canonical.get(t)
        if canon in ids:
            links.append({"election_id": eid, "candidate": cand, "person_id": ids[canon]})
    pd.DataFrame(links).to_csv(PROCESSED / "candidate_people.csv", index=False)

    people = []
    for canon, p in sorted(profiles.items()):
        d = asdict(p)
        d["id"] = ids[canon]
        d["offices"] = json.dumps(p.offices, ensure_ascii=False)
        d["source"] = f"wikipedia:person:{canon}"
        people.append(d)
    cols = ["id", "name", "wiki_title", "summary", "born", "died", "birth_place", "birth_state", "gender", "party"]
    cols += ["education", "occupation", "offices", "source"]
    pd.DataFrame(people, columns=cols).to_csv(PROCESSED / "people.csv", index=False)

    with_born = sum(1 for p in profiles.values() if p.born)
    with_state = sum(1 for p in profiles.values() if p.birth_state)
    named = {(e, c) for e, c, _ in rows if c and c != "Others"}
    print(
        f"people.csv: {len(people)} profiles ({with_born} with birth date, {with_state} with birth state); "
        f"{len(links)} of {len(named)} named candidate entries linked"
    )
    return 0


if __name__ == "__main__":
    assert len(STATES) == 37
    sys.exit(build(offline="--offline" in sys.argv))
