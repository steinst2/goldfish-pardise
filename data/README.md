# data/

| Path | Contents |
|---|---|
| `datasets/index.json` | List of classroom datasets offered to students. **Empty until a teacher downloads verified data.** |
| `datasets/*.csv` | Classroom CSVs of REAL observations (schema: `docs/DATA_DICTIONARY.md`), written by `scripts/fetch_wqp.py` / `scripts/fetch_usgs.py` |
| `datasets/*.provenance.json` | Where each CSV came from: source, exact query URL, download time, summary |
| `metadata/bay-county-candidate-locations.json` | Monitoring-location metadata (IDs, names, coordinates, characteristic groups) for Bay County, MI, read from Water Quality Portal and USGS site pages. **No observation values.** |
| `templates/classroom-observations-template.csv` | Header row of the classroom schema, for teachers entering their own class field measurements |

## Rules

1. Never invent or edit observation values. Copy them from the source.
2. Every dataset has a source URL, a download date, location IDs, dates, characteristic names, original values and units, and the provider's qualifiers.
3. Model output is never stored here.
4. Run `python scripts/validate_data.py` before committing. GitHub Actions runs it too, and refuses to publish if it fails.

## Why no sample data are included

The build environment for this version could not reach the Water Quality Portal or the USGS APIs, so no observations could be downloaded and checked. Rather than include unverified numbers, the project ships with the tools and the verified list of candidate locations. A teacher can create the first dataset in a few minutes (`docs/TEACHER_GUIDE.md`).

## Your own class measurements

If your class measures water quality itself (for example with a dissolved-oxygen meter or test kits), you can enter the results in `templates/classroom-observations-template.csv`. Fill in your own location ID and name, the date, the instrument in `result_value_type`, and your school as `organization_id`. Set `data_category` to `OBSERVED` and `source_name` to your class. Then import the file in the Real Water Data tab.
