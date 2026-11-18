"""Repository paths used by the pipeline."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
RAW = DATA / "raw"  # cached source downloads (git-ignored; re-fetchable from the manifest)
PROCESSED = DATA / "processed"  # clean, validated tables (committed)
MANIFEST = DATA / "sources" / "manifest.json"  # provenance of every source used
