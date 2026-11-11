"""Shared helpers for the Goldfish Paradise teacher data scripts.

Standard library only (Python 3.9+). Nothing here invents, edits or fills in observation values:
rows are copied from the source, original values and units are kept, and provenance is recorded.
"""
from __future__ import annotations

import csv
import datetime as _dt
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATASETS = REPO / "data" / "datasets"
INDEX = DATASETS / "index.json"
USER_AGENT = "GoldfishParadiseEcosystemLab/1.0 (classroom data preparation script)"

# Classroom CSV schema (documented in docs/DATA_DICTIONARY.md). Order matters.
SCHEMA = [
    "data_category", "source_name", "source_url", "query_url", "retrieved_utc", "provider",
    "organization_id", "monitoring_location_id", "monitoring_location_name", "monitoring_location_type",
    "latitude", "longitude", "activity_start_date", "activity_start_time", "characteristic_name",
    "sample_fraction", "result_value", "result_unit", "result_status", "result_value_type",
    "result_qualifier", "detection_condition", "detection_limit_value", "detection_limit_unit", "usgs_pcode",
]
REQUIRED = ["data_category", "source_url", "retrieved_utc", "monitoring_location_id", "activity_start_date",
            "characteristic_name", "result_unit"]

# Characteristic names (Water Quality Portal / WQX) relevant to the classroom model.
# Confirm what is actually measured at a site with `fetch_wqp.py list-sites` before teaching.
DEFAULT_CHARACTERISTICS = [
    "Dissolved oxygen (DO)",
    "Temperature, water",
    "pH",
    "Inorganic nitrogen (nitrate and nitrite)",
    "Nitrate",
    "Ammonia and ammonium",
    "Ammonia",
    "Total Nitrogen, mixed forms",
    "Nitrogen",
    "Phosphorus",
    "Orthophosphate",
    "Chlorophyll a",
]


def utc_now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def http_get(url: str, headers: dict | None = None, retries: int = 3, timeout: int = 120) -> bytes:
    """GET with polite retries. Raises a RuntimeError with an actionable message on failure."""
    h = {"User-Agent": USER_AGENT}
    h.update(headers or {})
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=h)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:  # server answered
            body = e.read()[:500].decode("utf-8", "replace")
            last = f"HTTP {e.code} from {urllib.parse.urlsplit(url).netloc}: {body.strip()}"
            if e.code in (400, 401, 403, 404):
                break
        except urllib.error.URLError as e:
            last = f"could not reach {urllib.parse.urlsplit(url).netloc}: {e.reason}"
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"Download failed — {last}\nURL: {url}\n"
                       "Check your internet connection or school firewall. If the service is down, try again later.")


def read_csv_text(text: str) -> tuple[list[str], list[dict]]:
    if text.startswith("﻿"):
        text = text[1:]
    rdr = csv.DictReader(io.StringIO(text))
    rows = list(rdr)
    return (rdr.fieldnames or []), rows


def first(row: dict, *names: str) -> str:
    for n in names:
        if n in row and row[n] is not None:
            v = str(row[n]).strip()
            if v != "":
                return v
    return ""


ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def normalize_date(s: str) -> str | None:
    s = (s or "").strip()[:10]
    if not ISO.match(s):
        m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", s)
        if not m:
            return None
        s = f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
    try:
        _dt.date.fromisoformat(s)
    except ValueError:
        return None
    return s


def validate_rows(rows: list[dict]) -> tuple[list[str], list[str]]:
    """Return (errors, warnings) for classroom-schema rows. Rows are not modified."""
    errors, warnings = [], []
    today = _dt.date.today().isoformat()
    seen = set()
    nondetect = 0
    for i, r in enumerate(rows, start=2):
        for k in REQUIRED:
            if not (r.get(k) or "").strip():
                errors.append(f"line {i}: missing {k}")
        label = " ".join(str(r.get(k, "")) for k in ("monitoring_location_name", "source_name", "provider"))
        if re.search(r"synthetic|test fixture|not real data", label, re.I):
            errors.append(f"line {i}: row is labelled as synthetic/test data — only real observations may be published")
        if (r.get("data_category") or "").strip() != "OBSERVED":
            errors.append(f"line {i}: data_category must be OBSERVED (got {r.get('data_category')!r})")
        d = normalize_date(r.get("activity_start_date", ""))
        if not d:
            errors.append(f"line {i}: invalid date {r.get('activity_start_date')!r}")
        elif d > today:
            errors.append(f"line {i}: date {d} is in the future")
        v = (r.get("result_value") or "").strip()
        if v == "":
            if re.search(r"not detected|non-detect|below", r.get("detection_condition", ""), re.I):
                nondetect += 1
            else:
                warnings.append(f"line {i}: empty result_value with no detection condition")
        else:
            try:
                float(v)
            except ValueError:
                errors.append(f"line {i}: result_value {v!r} is not a number")
        key = (r.get("monitoring_location_id"), r.get("activity_start_date"), r.get("activity_start_time"),
               r.get("characteristic_name"), r.get("sample_fraction"), v, r.get("result_unit"))
        if key in seen:
            warnings.append(f"line {i}: exact duplicate of an earlier row")
        seen.add(key)
    if nondetect:
        warnings.append(f"{nondetect} non-detect rows (kept; the app shows them as non-detects)")
    return errors, warnings


def write_classroom(rows: list[dict], out_csv: Path, provenance: dict) -> None:
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=SCHEMA, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in SCHEMA})
    prov_path = out_csv.with_suffix(".provenance.json")
    with open(prov_path, "w", encoding="utf-8") as f:
        json.dump(provenance, f, indent=2)
    print(f"wrote {out_csv.relative_to(REPO) if out_csv.is_relative_to(REPO) else out_csv} ({len(rows)} rows)")
    print(f"wrote {prov_path.name}")


def summarize_rows(rows: list[dict]) -> dict:
    dates = sorted(d for d in (normalize_date(r.get("activity_start_date", "")) for r in rows) if d)
    chars: dict[str, int] = {}
    for r in rows:
        k = f"{r.get('characteristic_name')} [{r.get('result_unit')}]"
        chars[k] = chars.get(k, 0) + 1
    locs = {}
    for r in rows:
        locs.setdefault(r.get("monitoring_location_id"), r.get("monitoring_location_name"))
    return {"n_rows": len(rows), "first_date": dates[0] if dates else None, "last_date": dates[-1] if dates else None,
            "characteristics": chars, "locations": locs}


def register_dataset(out_csv: Path, title: str, provenance: dict) -> None:
    """Add (or replace) the dataset entry in data/datasets/index.json."""
    idx = {"datasets": []}
    if INDEX.exists():
        idx = json.loads(INDEX.read_text(encoding="utf-8"))
    s = provenance["summary"]
    entry = {
        "file": out_csv.name,
        "provenance": out_csv.with_suffix(".provenance.json").name,
        "title": title,
        "location_id": ", ".join(k for k in s["locations"] if k),
        "location_name": ", ".join(v for v in s["locations"].values() if v),
        "date_range": f"{s['first_date']} to {s['last_date']}",
        "retrieved_utc": provenance["retrieved_utc"],
        "source_name": provenance["source_name"],
        "n_rows": s["n_rows"],
    }
    idx["datasets"] = [d for d in idx.get("datasets", []) if d.get("file") != entry["file"]] + [entry]
    INDEX.write_text(json.dumps(idx, indent=2) + "\n", encoding="utf-8")
    print(f"registered in {INDEX.relative_to(REPO)}")


def die(msg: str, code: int = 1):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(code)


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "dataset"


def env_api_key() -> str | None:
    return os.environ.get("USGS_API_KEY") or None
