"""Publish the latest Anyanwụ run (data/model/anyanwu.json) to Supabase.

    SUPABASE_SECRET_KEY=... uv run python -m anyanwu.publish

Calls public.anyanwu_publish(payload), which only the service role may run. In the
cloud environment the network proxy injects the key; it is never stored in the repo.
"""

from __future__ import annotations

import json
import os
import sys

import requests

from neli_pipeline.load_supabase import PROJECT_URL, _clean

from .run import OUT


def main() -> int:
    payload = _clean(json.loads(OUT.read_text()))
    key = os.environ.get("SUPABASE_SECRET_KEY", "proxy-injects-the-real-key")
    r = requests.post(
        f"{PROJECT_URL}/rest/v1/rpc/anyanwu_publish",
        data=json.dumps({"payload": payload}),
        headers={"apikey": key, "Content-Type": "application/json"},
        timeout=120,
    )
    if r.status_code >= 400:
        print(f"publish failed: HTTP {r.status_code} {r.text[:500]}")
        return 1
    print(f"published model run {r.json()} ({payload['model']} {payload['version']}, generated {payload['generated_at']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
