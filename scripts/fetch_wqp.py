#!/usr/bin/env python3
"""Teacher data-preparation script: Water Quality Portal (WQP) → classroom CSV + provenance.

Standard library only. Students never need to run this.

Examples
--------
  # 1. Which monitoring locations in Bay County, MI have each characteristic?
  python scripts/fetch_wqp.py list-sites --county US:26:017

  # 2. Download observations for one location (legacy WQX 2.2 profile)
  python scripts/fetch_wqp.py download --site USGS-04157065 --start 2005-01-01 --end 2013-12-31

  # 3. Newer USGS discrete data are only in the WQX 3.0 profile
  python scripts/fetch_wqp.py download --site USGS-04157065 --start 2020-01-01 --profile wqx3

  # 4. Normalise a CSV you already downloaded from https://www.waterqualitydata.us/ by hand
  python scripts/fetch_wqp.py normalize --input ~/Downloads/resultphyschem.csv --query-url "<the URL the portal showed>"

  # Print the URLs without downloading anything
  python scripts/fetch_wqp.py download --site USGS-04157065 --dry-run

Notes
-----
* Legacy profile URL: https://www.waterqualitydata.us/data/Result/search  (WQX 2.2 columns).
  The portal notes that legacy WQX 2.2 profiles do not contain USGS data added after
  March 11, 2024. Use --profile wqx3 (https://www.waterqualitydata.us/wqx3/Result/search,
  dataProfile=basicPhysChem) for newer USGS data; WQX 3.0 services are still being developed.
* Characteristic names are case-sensitive; several can be requested at once (separated by ';').
* The script never fills in missing values. Non-detects are kept and labelled.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gp_common import (DATASETS, DEFAULT_CHARACTERISTICS, die, first, http_get, normalize_date,  # noqa: E402
                       read_csv_text, register_dataset, slug, summarize_rows, utc_now, validate_rows,
                       write_classroom)

BASE = "https://www.waterqualitydata.us"
LEGACY = {"station": f"{BASE}/data/Station/search", "result": f"{BASE}/data/Result/search"}
WQX3 = {"station": f"{BASE}/wqx3/Station/search", "result": f"{BASE}/wqx3/Result/search"}

# Column aliases: legacy WQX 2.2 names first, then WQX 3.0 names. If a required column is not
# found, the script stops and prints the column names it DID find, so the alias list can be fixed.
ALIASES = {
    "provider": ["ProviderName"],
    "organization_id": ["OrganizationIdentifier", "Org_Identifier"],
    "monitoring_location_id": ["MonitoringLocationIdentifier", "Location_Identifier"],
    "monitoring_location_name": ["MonitoringLocationName", "Location_Name"],
    "monitoring_location_type": ["MonitoringLocationTypeName", "Location_Type"],
    "latitude": ["LatitudeMeasure", "Location_Latitude"],
    "longitude": ["LongitudeMeasure", "Location_Longitude"],
    "activity_start_date": ["ActivityStartDate", "Activity_StartDate"],
    "activity_start_time": ["ActivityStartTime/Time", "Activity_StartTime"],
    "characteristic_name": ["CharacteristicName", "Result_Characteristic"],
    "sample_fraction": ["ResultSampleFractionText", "Result_SampleFraction"],
    "result_value": ["ResultMeasureValue", "Result_Measure"],
    "result_unit": ["ResultMeasure/MeasureUnitCode", "Result_MeasureUnit"],
    "result_status": ["ResultStatusIdentifier", "Result_MeasureStatusIdentifier"],
    "result_value_type": ["ResultValueTypeName", "Result_MeasureType"],
    "result_qualifier": ["MeasureQualifierCode", "Result_MeasureQualifierCode"],
    "detection_condition": ["ResultDetectionConditionText", "Result_ResultDetectionCondition"],
    "detection_limit_value": ["DetectionQuantitationLimitMeasure/MeasureValue", "DetectionLimit_MeasureA"],
    "detection_limit_unit": ["DetectionQuantitationLimitMeasure/MeasureUnitCode", "DetectionLimit_MeasureUnitA"],
    "usgs_pcode": ["USGSPCode", "USGSpcode"],
}
NEEDED = ["monitoring_location_id", "activity_start_date", "characteristic_name", "result_value", "result_unit"]


def iso_to_wqp(d: str) -> str:
    """WQP startDateLo/startDateHi use MM-DD-YYYY."""
    n = normalize_date(d)
    if not n:
        die(f"date {d!r} must be YYYY-MM-DD")
    y, m, dd = n.split("-")
    return f"{m}-{dd}-{y}"


def build_url(base: str, params: list[tuple[str, str]]) -> str:
    return base + "?" + urllib.parse.urlencode(params, safe=":;")


def cmd_list_sites(a):
    """For each characteristic, ask the Station service which sites have it; print a table."""
    ep = WQX3 if a.profile == "wqx3" else LEGACY
    geo = []
    if a.county:
        geo += [("statecode", ":".join(a.county.split(":")[:2])), ("countycode", a.county)]
    if a.state:
        geo += [("statecode", a.state)]
    if a.bbox:
        geo += [("bBox", a.bbox)]
    if a.site:
        geo += [("siteid", a.site)]
    if not geo:
        die("give --county (e.g. US:26:017), --state (e.g. US:26), --bbox (W,S,E,N) or --site")
    chars = a.characteristic or DEFAULT_CHARACTERISTICS
    table: dict[str, dict] = {}
    for c in chars:
        url = build_url(ep["station"], geo + [("characteristicName", c), ("mimeType", "csv")])
        if a.dry_run:
            print(url)
            continue
        print(f"… {c}", file=sys.stderr)
        header, rows = read_csv_text(http_get(url).decode("utf-8", "replace"))
        for r in rows:
            sid = first(r, "MonitoringLocationIdentifier", "Location_Identifier")
            if not sid:
                continue
            t = table.setdefault(sid, {"name": first(r, "MonitoringLocationName", "Location_Name"),
                                       "type": first(r, "MonitoringLocationTypeName", "Location_Type"),
                                       "org": first(r, "OrganizationIdentifier", "Org_Identifier"),
                                       "chars": []})
            t["chars"].append(c)
    if a.dry_run:
        return
    if not table:
        print("No monitoring locations found with these characteristics. Try a larger area (--state or --bbox) "
              "or a nearby county, e.g. Saginaw County is US:26:145.")
        return
    print(f"\n{len(table)} monitoring location(s). Columns: ID | type | name | characteristics with data\n")
    for sid, t in sorted(table.items(), key=lambda kv: -len(kv[1]["chars"])):
        print(f"{sid:28s} | {t['type'][:14]:14s} | {t['name'][:50]:50s} | {'; '.join(t['chars'])}")
    if a.json:
        Path(a.json).write_text(json.dumps({"query_utc": utc_now(), "profile": a.profile, "geography": geo,
                                            "locations": table}, indent=2), encoding="utf-8")
        print(f"\nwrote {a.json}")
    print("\nNext: python scripts/fetch_wqp.py download --site <ID> --start YYYY-MM-DD --end YYYY-MM-DD")


def to_classroom(header, rows, *, query_url, retrieved, source_url):
    idx = {}
    for key, names in ALIASES.items():
        idx[key] = next((n for n in names if n in header), None)
    missing = [k for k in NEEDED if not idx[k]]
    if missing:
        die("the downloaded CSV does not have the expected columns: " + ", ".join(missing) +
            "\nColumns found: " + ", ".join(header[:60]) +
            "\nIf the portal changed its column names, add the new names to ALIASES in scripts/fetch_wqp.py.")
    out = []
    for r in rows:
        row = {k: (r.get(n, "") or "").strip() if n else "" for k, n in idx.items()}
        row["activity_start_date"] = normalize_date(row["activity_start_date"]) or row["activity_start_date"]
        row.update({
            "data_category": "OBSERVED",
            "source_name": "Water Quality Portal (USGS, US EPA, National Water Quality Monitoring Council)",
            "source_url": source_url,
            "query_url": query_url,
            "retrieved_utc": retrieved,
        })
        out.append(row)
    return out


def finish(rows, out_csv: Path, title: str, provenance: dict, register: bool):
    if not rows:
        die("the query returned no results. Check the site ID, dates and characteristic names "
            "(run list-sites first). No file was written.")
    errors, warnings = validate_rows(rows)
    for w in warnings[:20]:
        print("warning:", w)
    if errors:
        for e in errors[:20]:
            print("error:", e, file=sys.stderr)
        die(f"{len(errors)} validation error(s); no file written.")
    provenance["summary"] = summarize_rows(rows)
    write_classroom(rows, out_csv, provenance)
    if register:
        register_dataset(out_csv, title, provenance)
    s = provenance["summary"]
    print(f"\n{s['n_rows']} observations, {s['first_date']} to {s['last_date']}")
    for k, n in sorted(s["characteristics"].items(), key=lambda kv: -kv[1]):
        print(f"  {n:6d}  {k}")


def cmd_download(a):
    ep = WQX3 if a.profile == "wqx3" else LEGACY
    params = [("siteid", a.site), ("mimeType", "csv")]
    chars = a.characteristic or DEFAULT_CHARACTERISTICS
    params.append(("characteristicName", ";".join(chars)))
    if a.start:
        params.append(("startDateLo", iso_to_wqp(a.start)))
    if a.end:
        params.append(("startDateHi", iso_to_wqp(a.end)))
    if a.profile == "wqx3":
        params.append(("dataProfile", "basicPhysChem"))
    url = build_url(ep["result"], params)
    if a.dry_run:
        print(url)
        return
    print(f"downloading {url}", file=sys.stderr)
    retrieved = utc_now()
    text = http_get(url, timeout=600).decode("utf-8", "replace")
    if text.lstrip().startswith("<"):
        die("the portal returned a web page instead of CSV (it may be busy). Try again later.")
    header, rows = read_csv_text(text)
    out = to_classroom(header, rows, query_url=url, retrieved=retrieved, source_url=BASE + "/")
    name = a.output or f"wqp-{slug(a.site)}-{(a.start or 'all')[:4]}-{(a.end or 'now')[:4]}.csv"
    title = a.title or f"{a.site} water-quality observations (Water Quality Portal)"
    provenance = {
        "data_category": "OBSERVED",
        "source_name": "Water Quality Portal",
        "source_url": BASE + "/",
        "documentation_url": BASE + "/webservices_documentation/",
        "query_url": url,
        "profile": "WQX 3.0 (basicPhysChem)" if a.profile == "wqx3" else "legacy WQX 2.2 (default Result profile)",
        "retrieved_utc": retrieved,
        "requested": {"site": a.site, "characteristics": chars, "start": a.start, "end": a.end},
        "script": "scripts/fetch_wqp.py",
        "notes": ["Values, units, qualifiers and detection conditions are copied unchanged from the portal.",
                  "Legacy WQX 2.2 profiles exclude USGS data added after 2024-03-11."] if a.profile != "wqx3" else
                 ["WQX 3.0 services are marked as in development by the portal; check column mappings."],
    }
    finish(out, DATASETS / name, title, provenance, not a.no_register)


def cmd_normalize(a):
    p = Path(a.input).expanduser()
    if not p.exists():
        die(f"{p} not found")
    header, rows = read_csv_text(p.read_text(encoding="utf-8", errors="replace"))
    retrieved = a.retrieved or utc_now()
    if not a.retrieved:
        print("warning: --retrieved not given; using today's date as the download date. "
              "Give the real download date if you know it.", file=sys.stderr)
    out = to_classroom(header, rows, query_url=a.query_url or "(downloaded manually from the portal web form)",
                       retrieved=retrieved, source_url=BASE + "/")
    name = a.output or f"wqp-{slug(p.stem)}.csv"
    provenance = {
        "data_category": "OBSERVED", "source_name": "Water Quality Portal", "source_url": BASE + "/",
        "query_url": a.query_url or "(downloaded manually from the portal web form)",
        "retrieved_utc": retrieved, "original_file": p.name, "script": "scripts/fetch_wqp.py normalize",
    }
    finish(out, DATASETS / name, a.title or f"Water Quality Portal observations ({p.name})", provenance, not a.no_register)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s1 = sub.add_parser("list-sites", help="find monitoring locations and which characteristics they have")
    s1.add_argument("--county", help="WQP county code, e.g. US:26:017 (Bay County, MI)")
    s1.add_argument("--state", help="WQP state code, e.g. US:26")
    s1.add_argument("--bbox", help="west,south,east,north in decimal degrees; write it as --bbox=W,S,E,N")
    s1.add_argument("--site", help="one monitoring location ID")
    s1.add_argument("--characteristic", action="append", help="characteristic name (repeatable)")
    s1.add_argument("--profile", choices=["legacy", "wqx3"], default="legacy")
    s1.add_argument("--json", help="also save the table as JSON to this path")
    s1.add_argument("--dry-run", action="store_true")
    s1.set_defaults(func=cmd_list_sites)
    s2 = sub.add_parser("download", help="download observations for one site into data/datasets/")
    s2.add_argument("--site", required=True)
    s2.add_argument("--start")
    s2.add_argument("--end")
    s2.add_argument("--characteristic", action="append")
    s2.add_argument("--profile", choices=["legacy", "wqx3"], default="legacy")
    s2.add_argument("--output")
    s2.add_argument("--title")
    s2.add_argument("--no-register", action="store_true", help="do not add to data/datasets/index.json")
    s2.add_argument("--dry-run", action="store_true")
    s2.set_defaults(func=cmd_download)
    s3 = sub.add_parser("normalize", help="convert a CSV already downloaded from the portal website")
    s3.add_argument("--input", required=True)
    s3.add_argument("--query-url")
    s3.add_argument("--retrieved", help="when you downloaded it (UTC ISO date-time)")
    s3.add_argument("--output")
    s3.add_argument("--title")
    s3.add_argument("--no-register", action="store_true")
    s3.set_defaults(func=cmd_normalize)
    a = ap.parse_args(argv)
    try:
        a.func(a)
    except RuntimeError as e:
        die(str(e))


if __name__ == "__main__":
    main()
