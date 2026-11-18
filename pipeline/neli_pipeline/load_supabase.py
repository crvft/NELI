"""Load the validated data into Supabase in one atomic transaction.

    uv run python -m neli_pipeline.load_supabase [--dry-run]

Calls public.neli_reload(payload) over PostgREST. That function only accepts the
service role, so the request must carry the project's secret key. In the cloud
build environment the network proxy injects it (saved as a network credential for
the project host); elsewhere set SUPABASE_SECRET_KEY. The key is never stored in
the repository.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys

import requests

from . import export_sql

PROJECT_URL = os.environ.get("SUPABASE_URL", "https://vlorfizyvsirjhgrrfrt.supabase.co")


def _clean(o):
    """JSON-safe: NaN -> null, numpy ints -> int."""
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, list):
        return [_clean(v) for v in o]
    if isinstance(o, float):
        return None if math.isnan(o) else (int(o) if o.is_integer() else o)
    if hasattr(o, "item"):
        return _clean(o.item())
    return o


def main(dry_run: bool = False) -> int:
    export_sql.build()
    payload = _clean(export_sql.LAST_PAYLOAD)
    body = json.dumps({"payload": payload})
    print(f"payload {len(body):,} bytes")
    if dry_run:
        return 0
    key = os.environ.get("SUPABASE_SECRET_KEY", "proxy-injects-the-real-key")
    r = requests.post(
        f"{PROJECT_URL}/rest/v1/rpc/neli_reload",
        data=body,
        headers={"apikey": key, "Content-Type": "application/json"},
        timeout=120,
    )
    if r.status_code >= 400:
        print(f"load failed: HTTP {r.status_code} {r.text[:500]}")
        return 1
    print("loaded:", r.json())
    return 0


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true")
    sys.exit(main(p.parse_args().dry_run))
