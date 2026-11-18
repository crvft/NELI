"""Wikipedia source: fetch article HTML politely, cache it, and record provenance.

Wikipedia's election articles transcribe INEC's declared results with citations. We
always record the exact revision used, so any number can be traced back (and the
revision re-fetched via ?oldid=<revision>).
"""

from __future__ import annotations

import hashlib
import json
import re
import time
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path

import requests

from ..paths import MANIFEST, RAW

USER_AGENT = "NELI-data-research/0.1 (https://neli-interface.vercel.app)"
LICENSE = "CC BY-SA 4.0 (Wikipedia contributors); figures cite INEC"


@dataclass
class SourceRecord:
    key: str
    title: str
    url: str
    revision: str | None
    retrieved_at: str
    sha256: str
    license: str


def _cache_path(title: str) -> Path:
    return RAW / "wikipedia" / f"{title}.html"


def revision_of(html: str) -> str | None:
    m = re.search(r"Special:Redirect/revision/(\d+)", html) or re.search(r'"wgRevisionId":(\d+)', html)
    return m.group(1) if m else None


def fetch(title: str, *, refresh: bool = False, retries: int = 6) -> str:
    """Return article HTML, from cache unless refresh=True. Backs off on HTTP 429."""
    path = _cache_path(title)
    if path.exists() and not refresh:
        return path.read_text(encoding="utf-8")
    # The regular article page (follows redirects, embeds wgRevisionId). The REST API
    # is rate-limited much harder from shared cloud egress.
    url = f"https://en.wikipedia.org/wiki/{title}"
    for attempt in range(retries):
        r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=60, allow_redirects=True)
        if r.status_code == 200:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(r.text, encoding="utf-8")
            return r.text
        if r.status_code == 429:
            time.sleep(10 * (attempt + 1))
            continue
        r.raise_for_status()
    raise RuntimeError(f"Wikipedia kept rate-limiting {title}")


def record(key: str, title: str, html: str) -> SourceRecord:
    """Add or update this source in data/sources/manifest.json."""
    rev = revision_of(html)
    rec = SourceRecord(
        key=key,
        title=title,
        url=f"https://en.wikipedia.org/w/index.php?title={title}&oldid={rev}"
        if rev
        else f"https://en.wikipedia.org/wiki/{title}",
        revision=rev,
        retrieved_at=datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        sha256=hashlib.sha256(html.encode()).hexdigest(),
        license=LICENSE,
    )
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    prev = manifest.get(key)
    if prev and prev.get("sha256") == rec.sha256:
        rec.retrieved_at = prev["retrieved_at"]  # unchanged content keeps its original date
    manifest[key] = asdict(rec)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(dict(sorted(manifest.items())), indent=2) + "\n")
    return rec
