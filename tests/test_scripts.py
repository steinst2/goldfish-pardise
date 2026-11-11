"""Offline tests for the teacher data scripts:  python -m unittest discover -s tests -p "test_*.py"."""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import gp_common  # noqa: E402
import fetch_wqp  # noqa: E402

FIXTURE = ROOT / "tests" / "fixtures" / "SYNTHETIC_wqp_legacy_fixture.csv"


class TestCommon(unittest.TestCase):
    def test_dates(self):
        self.assertEqual(gp_common.normalize_date("2010-05-04"), "2010-05-04")
        self.assertEqual(gp_common.normalize_date("5/4/2010"), "2010-05-04")
        self.assertIsNone(gp_common.normalize_date("2010-02-30"))

    def test_wqp_date_format(self):
        self.assertEqual(fetch_wqp.iso_to_wqp("2005-01-31"), "01-31-2005")

    def test_mapping_keeps_original_values(self):
        header, rows = gp_common.read_csv_text(FIXTURE.read_text())
        out = fetch_wqp.to_classroom(header, rows, query_url="q", retrieved="2026-01-01T00:00:00Z", source_url="s")
        self.assertEqual(len(out), len(rows))
        self.assertEqual(out[2]["result_value"], "4.43")
        self.assertEqual(out[2]["result_unit"], "mg/l asNO3")
        self.assertEqual(out[6]["result_value"], "")           # non-detect kept as blank
        self.assertEqual(out[6]["detection_condition"], "Not Detected")
        self.assertTrue(all(r["data_category"] == "OBSERVED" for r in out))

    def test_synthetic_rows_rejected(self):
        header, rows = gp_common.read_csv_text(FIXTURE.read_text())
        out = fetch_wqp.to_classroom(header, rows, query_url="q", retrieved="2026-01-01T00:00:00Z", source_url="s")
        errors, _ = gp_common.validate_rows(out)
        self.assertTrue(any("synthetic" in e for e in errors))

    def test_future_and_bad_values(self):
        row = {k: "" for k in gp_common.SCHEMA}
        row.update(data_category="OBSERVED", source_url="s", retrieved_utc="t", monitoring_location_id="X",
                   activity_start_date="2999-01-01", characteristic_name="pH", result_unit="std units", result_value="abc")
        errors, _ = gp_common.validate_rows([row])
        self.assertTrue(any("future" in e for e in errors))
        self.assertTrue(any("not a number" in e for e in errors))

    def test_cli_refuses_fixture_and_writes_nothing(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "x.csv"
            p = subprocess.run([sys.executable, "-I", str(ROOT / "scripts" / "fetch_wqp.py"), "normalize", "--input", str(FIXTURE),
                                "--output", str(out), "--no-register", "--retrieved", "2026-01-01T00:00:00Z"], capture_output=True, text=True)
            self.assertNotEqual(p.returncode, 0)
            self.assertFalse(out.exists())

    def test_dry_run_urls(self):
        p = subprocess.run([sys.executable, "-I", str(ROOT / "scripts" / "fetch_wqp.py"), "download", "--site", "USGS-04157065",
                            "--start", "2005-01-01", "--end", "2013-12-31", "--dry-run"], capture_output=True, text=True)
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertIn("https://www.waterqualitydata.us/data/Result/search?siteid=USGS-04157065", p.stdout)
        self.assertIn("startDateLo=01-01-2005", p.stdout)
        p = subprocess.run([sys.executable, "-I", str(ROOT / "scripts" / "fetch_usgs.py"), "daily", "--site", "USGS-04157005",
                            "--parameter", "00300", "--dry-run"], capture_output=True, text=True)
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertIn("api.waterdata.usgs.gov/ogcapi/v1/collections/daily/items", p.stdout)
        self.assertNotIn("waterservices.usgs.gov", p.stdout)

    def test_published_datasets_valid(self):
        p = subprocess.run([sys.executable, "-I", str(ROOT / "scripts" / "validate_data.py")], capture_output=True, text=True)
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)


if __name__ == "__main__":
    unittest.main()
