#!/usr/bin/env python3
"""Check every classroom dataset in data/datasets/ before publishing.

Checks: the classroom schema, OBSERVED labelling, valid dates, numeric values, a provenance JSON
beside each CSV with a source URL and download date, and that index.json lists only files that exist.
Exit code 0 = OK, 1 = problems found. Runs automatically in the GitHub Actions workflow.

  python scripts/validate_data.py            # check data/datasets/
  python scripts/validate_data.py path.csv   # check one file
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gp_common import DATASETS, INDEX, SCHEMA, read_csv_text, validate_rows  # noqa: E402


def check_csv(p: Path) -> list[str]:
    problems = []
    header, rows = read_csv_text(p.read_text(encoding="utf-8", errors="replace"))
    missing = [c for c in SCHEMA if c not in header]
    if missing:
        problems.append(f"{p.name}: missing columns {missing}")
        return problems
    errors, warnings = validate_rows(rows)
    problems += [f"{p.name}: {e}" for e in errors[:50]]
    for w in warnings[:10]:
        print(f"  warning {p.name}: {w}")
    prov = p.with_suffix(".provenance.json")
    if not prov.exists():
        problems.append(f"{p.name}: no provenance file {prov.name}")
    else:
        d = json.loads(prov.read_text(encoding="utf-8"))
        for k in ("data_category", "source_url", "retrieved_utc", "query_url"):
            if not d.get(k):
                problems.append(f"{prov.name}: missing {k}")
        if d.get("data_category") != "OBSERVED":
            problems.append(f"{prov.name}: data_category must be OBSERVED")
    print(f"checked {p.name}: {len(rows)} rows, {len(errors)} errors, {len(warnings)} warnings")
    return problems


def main(argv):
    files = [Path(x) for x in argv] or sorted(p for p in DATASETS.glob("*.csv"))
    problems = []
    for f in files:
        problems += check_csv(f)
    if not argv and INDEX.exists():
        idx = json.loads(INDEX.read_text(encoding="utf-8"))
        listed = {d["file"] for d in idx.get("datasets", [])}
        for name in listed:
            if not (DATASETS / name).exists():
                problems.append(f"index.json lists {name}, which does not exist")
        for f in files:
            if f.name not in listed:
                print(f"  note: {f.name} is not listed in index.json (students will not see it)")
    if not files:
        print("No classroom datasets yet (data/datasets/*.csv). Nothing to check.")
    if problems:
        print("\nPROBLEMS:")
        for p in problems:
            print(" -", p)
        return 1
    print("\nAll datasets OK.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
