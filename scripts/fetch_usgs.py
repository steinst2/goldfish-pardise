#!/usr/bin/env python3
"""Teacher data-preparation script: modern USGS Water Data APIs (OGC API, v1) → classroom CSV.

Uses https://api.waterdata.usgs.gov/ogcapi/v1/ — NOT the legacy waterservices.usgs.gov APIs,
which USGS has announced will be decommissioned in early 2027.

Standard library only. An API key is optional (higher rate limits); get one at
https://api.waterdata.usgs.gov/signup/ and set it as an environment variable:
    export USGS_API_KEY=your_key        (Windows PowerShell:  $env:USGS_API_KEY="your_key")

Examples
--------
  # What collections does the API offer right now?
  python scripts/fetch_usgs.py collections

  # Monitoring locations inside a bounding box around Bay County, MI (west,south,east,north)
  python scripts/fetch_usgs.py sites --bbox=-84.17,43.47,-83.69,44.02

  # Which time series (parameters) exist at a location?
  python scripts/fetch_usgs.py series --site USGS-04157005

  # Daily mean values (statistic 00003) for one parameter, e.g. 00300 dissolved oxygen
  # (example only: confirm with `series` that the location actually has this time series)
  python scripts/fetch_usgs.py daily --site USGS-04157005 --parameter 00300 --start 2024-05-01 --end 2024-09-30

Common USGS parameter codes (verify for your site with the `series` command):
  00010 water temperature (°C) · 00300 dissolved oxygen (mg/L) · 00400 pH · 00060 discharge (ft³/s)
  00065 gage height (ft) · 99133 nitrate + nitrite as N, sensor (mg/L)

Notes
-----
* Field names in the API responses are read defensively. If USGS renames a property, the script
  stops and prints the property names it received so this file can be updated. All original
  properties are also saved to a raw JSON file next to the classroom CSV.
* Discrete (lab) water-quality samples are served by the USGS Samples API and are also in the
  Water Quality Portal's WQX 3.0 profiles — use scripts/fetch_wqp.py --profile wqx3 for those.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gp_common import DATASETS, die, env_api_key, http_get, register_dataset, slug, summarize_rows, utc_now, validate_rows, write_classroom  # noqa: E402

API = "https://api.waterdata.usgs.gov/ogcapi/v1"
PCODE_NAMES = {"00010": "Temperature, water", "00300": "Dissolved oxygen (DO)", "00400": "pH",
               "00060": "Discharge", "00065": "Gage height", "99133": "Inorganic nitrogen (nitrate and nitrite)"}


def get_json(url):
    headers = {"Accept": "application/geo+json, application/json"}
    key = env_api_key()
    if key:
        headers["X-Api-Key"] = key
    return json.loads(http_get(url, headers=headers).decode("utf-8"))


def items(collection, params, limit_pages=200, dry_run=False):
    """Yield features from /collections/{collection}/items, following 'next' links."""
    url = f"{API}/collections/{collection}/items?" + urllib.parse.urlencode({**params, "f": "json"})
    if dry_run:
        print(url)
        return
    pages = 0
    while url and pages < limit_pages:
        print(f"… {url}", file=sys.stderr)
        doc = get_json(url)
        for f in doc.get("features", []):
            yield f
        url = next((l.get("href") for l in doc.get("links", []) if l.get("rel") == "next"), None)
        pages += 1


def pick(props, *names):
    for n in names:
        if n in props and props[n] not in (None, ""):
            return props[n]
    return None


def cmd_collections(a):
    if a.dry_run:
        print(f"{API}/collections?f=json"); return
    doc = get_json(f"{API}/collections?f=json")
    for c in doc.get("collections", []):
        print(f"{c.get('id'):32s} {c.get('title', '')}")


def cmd_sites(a):
    params = {"limit": 500}
    if a.bbox:
        params["bbox"] = a.bbox
    if a.site:
        params["id"] = a.site
    feats = list(items("monitoring-locations", params, dry_run=a.dry_run))
    if a.dry_run:
        return
    if not feats:
        print("No monitoring locations returned. Check the bounding box order: west,south,east,north.")
        return
    for f in feats:
        p = f.get("properties", {})
        sid = f.get("id") or pick(p, "id", "monitoring_location_id")
        print(f"{str(sid):24s} {str(pick(p, 'site_type', 'site_type_code') or ''):18s} {pick(p, 'monitoring_location_name', 'name') or ''}")
    print(f"\n{len(feats)} location(s). Next: python scripts/fetch_usgs.py series --site <ID>")


def cmd_series(a):
    feats = list(items("time-series-metadata", {"monitoring_location_id": a.site, "limit": 500}, dry_run=a.dry_run))
    if a.dry_run:
        return
    if not feats:
        print("No time series found for that location (it may only have discrete samples — try fetch_wqp.py).")
        return
    for f in feats:
        p = f.get("properties", {})
        print(f"pcode {pick(p, 'parameter_code')} · stat {pick(p, 'statistic_id') or '-':6s} · "
              f"{pick(p, 'parameter_name', 'parameter_description') or ''} · "
              f"{pick(p, 'begin', 'begin_utc', 'period_start') or '?'} → {pick(p, 'end', 'end_utc', 'period_end') or '?'} · "
              f"{pick(p, 'unit_of_measure') or ''}")


def cmd_values(a, collection):
    params = {"monitoring_location_id": a.site, "parameter_code": a.parameter, "limit": 10000}
    if collection == "daily":
        params["statistic_id"] = a.statistic
    if a.start or a.end:
        params["datetime"] = f"{a.start or '..'}/{a.end or '..'}"
    retrieved = utc_now()
    feats = list(items(collection, params, dry_run=a.dry_run))
    if a.dry_run:
        return
    if not feats:
        die("no values returned. Check the parameter code and dates with the `series` command. No file written.")
    query_url = f"{API}/collections/{collection}/items?" + urllib.parse.urlencode({**params, "f": "json"})
    rows = []
    for f in feats:
        p = f.get("properties", {})
        t, v, u = pick(p, "time", "datetime"), pick(p, "value"), pick(p, "unit_of_measure", "unit")
        if t is None or u is None:
            die("unexpected response format. Properties received: " + ", ".join(sorted(p)) +
                "\nUpdate the field names in cmd_values() in scripts/fetch_usgs.py.")
        t = str(t)
        rows.append({
            "data_category": "OBSERVED",
            "source_name": "USGS Water Data APIs (OGC API v1)",
            "source_url": "https://api.waterdata.usgs.gov/",
            "query_url": query_url,
            "retrieved_utc": retrieved,
            "provider": "USGS",
            "organization_id": "USGS",
            "monitoring_location_id": pick(p, "monitoring_location_id") or a.site,
            "monitoring_location_name": a.site_name or "",
            "activity_start_date": t[:10],
            "activity_start_time": t[11:19] if len(t) > 10 else "",
            "characteristic_name": PCODE_NAMES.get(a.parameter, f"USGS parameter {a.parameter}"),
            "sample_fraction": "",
            "result_value": "" if v is None else str(v),
            "result_unit": str(u),
            "result_status": str(pick(p, "approval_status") or ""),
            "result_value_type": f"daily statistic {a.statistic}" if collection == "daily" else "continuous sensor value",
            "result_qualifier": json.dumps(pick(p, "qualifier")) if isinstance(pick(p, "qualifier"), (list, dict)) else str(pick(p, "qualifier") or ""),
            "usgs_pcode": a.parameter,
        })
    name = a.output or f"usgs-{collection}-{slug(a.site)}-{a.parameter}.csv"
    out = DATASETS / name
    errors, warnings = validate_rows(rows)
    for w in warnings[:10]:
        print("warning:", w)
    if errors:
        for e in errors[:20]:
            print("error:", e, file=sys.stderr)
        die("validation failed; no file written.")
    provenance = {
        "data_category": "OBSERVED", "source_name": "USGS Water Data APIs (OGC API v1)",
        "source_url": "https://api.waterdata.usgs.gov/", "documentation_url": "https://api.waterdata.usgs.gov/docs/ogcapi/",
        "query_url": query_url, "retrieved_utc": retrieved, "collection": collection,
        "requested": {"site": a.site, "parameter_code": a.parameter, "statistic_id": a.statistic if collection == "daily" else None,
                      "start": a.start, "end": a.end},
        "script": "scripts/fetch_usgs.py", "api_key_used": bool(env_api_key()),
        "notes": ["Provisional USGS data may be revised; see result_status (approval status) for each value."],
        "summary": summarize_rows(rows),
    }
    write_classroom(rows, out, provenance)
    raw = out.with_suffix(".raw.json")
    raw.write_text(json.dumps([f.get("properties", {}) for f in feats], indent=1), encoding="utf-8")
    print(f"wrote {raw.name} (all original properties)")
    if not a.no_register:
        register_dataset(out, a.title or f"{a.site} {PCODE_NAMES.get(a.parameter, a.parameter)} ({collection})", provenance)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("collections"); c.add_argument("--dry-run", action="store_true"); c.set_defaults(func=cmd_collections)
    s = sub.add_parser("sites"); s.add_argument("--bbox"); s.add_argument("--site"); s.add_argument("--dry-run", action="store_true"); s.set_defaults(func=cmd_sites)
    t = sub.add_parser("series"); t.add_argument("--site", required=True); t.add_argument("--dry-run", action="store_true"); t.set_defaults(func=cmd_series)
    for name in ("daily", "continuous"):
        v = sub.add_parser(name)
        v.add_argument("--site", required=True); v.add_argument("--parameter", required=True)
        v.add_argument("--statistic", default="00003", help="daily statistic code (00003 = mean)")
        v.add_argument("--start"); v.add_argument("--end"); v.add_argument("--site-name", dest="site_name")
        v.add_argument("--output"); v.add_argument("--title"); v.add_argument("--no-register", action="store_true")
        v.add_argument("--dry-run", action="store_true")
        v.set_defaults(func=lambda a, n=name: cmd_values(a, n))
    a = ap.parse_args(argv)
    try:
        a.func(a)
    except RuntimeError as e:
        die(str(e))


if __name__ == "__main__":
    main()
