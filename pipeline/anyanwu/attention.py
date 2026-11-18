"""Online attention: Wikipedia page views for each candidate (free, public data).

Low-weight by design. It measures attention, not support. Data exist from July 2015,
so only the 2019 and 2023 elections can test it. Cached in data/raw/pageviews.
"""

from __future__ import annotations

import json
import time
from datetime import date, timedelta

import requests

from neli_pipeline.paths import RAW
from neli_pipeline.sources.wikipedia import USER_AGENT

API = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/{title}/daily/{start}/{end}"
CACHE = RAW / "pageviews"


def views(title: str, end: date, days: int = 60, retries: int = 6) -> int | None:
    start = end - timedelta(days=days)
    s, e = start.strftime("%Y%m%d"), end.strftime("%Y%m%d")
    path = CACHE / f"{title}_{s}_{e}.json"
    if path.exists():
        return json.loads(path.read_text())["total"]
    for attempt in range(retries):
        r = requests.get(API.format(title=title, start=s, end=e), headers={"User-Agent": USER_AGENT}, timeout=30)
        if r.status_code == 200:
            total = sum(i["views"] for i in r.json().get("items", []))
            CACHE.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps({"title": title, "start": s, "end": e, "total": total}))
            time.sleep(2)
            return total
        if r.status_code == 404:
            return None
        time.sleep(8 * (attempt + 1))
    return None


def shares(titles: list[str | None], end: date) -> list[float | None]:
    """Each candidate's share of the page views among those with an article."""
    v = [views(t, end) if t else None for t in titles]
    tot = sum(x for x in v if x)
    return [x / tot if x and tot else None for x in v]
