# Data dictionary

The app works with three clearly separated kinds of data:

| Kind | Label in the app | Visual cue | Where it comes from |
|---|---|---|---|
| Observed | ◆ **OBSERVED DATA** (purple, dashed badge) | diamond markers, never joined by lines; separate chart panel | real measurements at a named monitoring location |
| Simulated | — **SIMULATED DATA** (teal badge) | solid lines; grey thin line = baseline | the classroom model with default settings |
| Student experiment | ✎ **STUDENT EXPERIMENT** (orange, double border) | solid lines, with the grey baseline for comparison | the classroom model after a student changed settings |

Observed and simulated values are **never plotted on the same axes**. The comparison view puts them side by side, with a summary table in the model's unit.

## 1. Classroom observation CSV (`data/datasets/*.csv`)

Produced by `scripts/fetch_wqp.py` or `scripts/fetch_usgs.py`. One row = one result as reported by the data provider. Values are copied unchanged. Nothing is filled in, averaged or corrected.

| Column | Required | Meaning | Example |
|---|---|---|---|
| `data_category` | yes | always `OBSERVED` | OBSERVED |
| `source_name` | | name of the data service | Water Quality Portal (USGS, US EPA, …) |
| `source_url` | yes | home page of the original source | https://www.waterqualitydata.us/ |
| `query_url` | | exact web-service request used | https://www.waterqualitydata.us/data/Result/search?siteid=… |
| `retrieved_utc` | yes | when the data were downloaded (UTC, ISO 8601) | 2026-11-12T15:04:00Z |
| `provider` | | database behind the portal (e.g. NWIS, STORET) | NWIS |
| `organization_id` | | monitoring organization | USGS-MI |
| `monitoring_location_id` | yes | portal location ID (agency prefix + number) | USGS-04157065 |
| `monitoring_location_name` | | location name | SAGINAW RIVER AT WEADOCK ROAD AT ESSEXVILLE, MI |
| `monitoring_location_type` | | stream, lake, well … | Stream |
| `latitude`, `longitude` | | decimal degrees, as reported | 43.628…, −83.836… |
| `activity_start_date` | yes | sampling date (YYYY-MM-DD, local date) | |
| `activity_start_time` | | sampling time, as reported | |
| `characteristic_name` | yes | WQX characteristic (case-sensitive) | Dissolved oxygen (DO) |
| `sample_fraction` | | Dissolved / Total / … | Dissolved |
| `result_value` | | value as reported; blank for non-detects | |
| `result_unit` | yes | unit as reported (keep the basis, e.g. "as N") | mg/l as N |
| `result_status` | | provider status (Accepted, Preliminary, Rejected …) or USGS approval status | |
| `result_value_type` | | Actual, Estimated, daily statistic … | |
| `result_qualifier` | | measure qualifier code(s) | |
| `detection_condition` | | e.g. "Not Detected" | |
| `detection_limit_value`, `detection_limit_unit` | | detection/quantitation limit, if given | |
| `usgs_pcode` | | USGS parameter code, if given | 00300 |

Each CSV has a **provenance file** `<name>.provenance.json` with: `data_category`, `source_name`, `source_url`, `documentation_url`, `query_url`, `profile`, `retrieved_utc`, the request (site, characteristics, dates), the script used, notes, and a summary (rows, date range, characteristics, locations). `data/datasets/index.json` lists the datasets the app offers to students.

The browser importer also reads raw Water Quality Portal "Sample Results" CSVs: legacy columns such as `MonitoringLocationIdentifier`, `ActivityStartDate`, `CharacteristicName`, `ResultMeasureValue`, `ResultMeasure/MeasureUnitCode`, and common WQX 3.0 equivalents such as `Location_Identifier`, `Result_Measure`. Raw files carry no download date, so the provenance panel says so.

## 2. Mapping observations to model variables

Only unambiguous conversions are made. The original value and unit are always shown next to the converted value.

| Characteristic (examples) | Model variable | Model unit | Conversions accepted |
|---|---|---|---|
| Dissolved oxygen (DO) | `doMean` | mg/L | mg/l. **Not** % saturation (needs temperature and pressure) |
| Nitrate; Inorganic nitrogen (nitrate and nitrite) | `no3` | mg N/L | "as N"; "as NO3" × 14.007/62.004; µg/l × 0.001 |
| Ammonia; Ammonia and ammonium | `nh4` | mg N/L | "as N"; "as NH4" × 14.007/18.038; "as NH3" × 14.007/17.031 |
| Orthophosphate | `po4` | mg P/L | "as P"; "as PO4" × 30.974/94.971. Plain "mg/l" is **not** converted (basis unknown) |
| Phosphorus (Total) | `waterTotalP` | mg P/L | as P (by convention) |
| Total Nitrogen, mixed forms; Nitrogen | `waterTotalN` | mg N/L | as N (by convention) |
| Chlorophyll a | `chlEstimate` | µg/L | ug/l, mg/m3, mg/l × 1000 |
| Temperature, water; pH | — | — | displayed only (constant settings in the model) |

`waterTotalN` and `waterTotalP` are what a *water sample* from the model tank would contain: dissolved forms + algae + detritus + free bacteria. Fish, crops and attached nitrifier biofilm are excluded.

## 3. Model output CSV (Lab → Export CSV)

The first lines start with `#` and give the data category (SIMULATED DATA or STUDENT EXPERIMENT), the export time and the settings. Then one row per scenario per day:

| Column | Unit | Meaning |
|---|---|---|
| `data_category` | | SIMULATED DATA, STUDENT EXPERIMENT, or "SIMULATED DATA (baseline)" |
| `scenario` | | A or B |
| `day` | day | 0 = start |
| `fish_wet_g_total` | g wet mass | all fish in the system |
| `algae_mg_dry_L`, `crop_mg_dry_L`, `decomposers_mg_dry_L`, `nitrifiers_mg_dry_L` | mg dry mass per L of system water | |
| `chlorophyll_a_est_ug_L` | µg/L | algal C ÷ 28 |
| `detritus_mg_C_L` | mg C/L | |
| `ammonium_mg_N_L`, `nitrate_mg_N_L`, `phosphate_mg_P_L` | mg/L as N or P | |
| `do_daily_mean_mg_L`, `do_daily_min_mg_L`, `do_daily_max_mg_L` | mg O₂/L | over the 24 hourly steps of the day |
| `dic_mg_C_L` | mg C/L | dissolved inorganic carbon |
| `total_system_N_mg_L`, `total_system_P_mg_L`, `total_system_C_mg_L` | mg/L | everything in the system, including organisms |
| `algae_limiting_factor` | | light, N, P or C (most frequent during daylight hours) |
| `harvested_mg_dry_L_this_day` | mg dry/L | crop removed on harvest days |

## 4. Student lab report (Investigations → Download lab report)

A self-contained HTML file: student name and class, each investigation's recorded results (with data-category badges and run settings), the prediction, results, evidence, explanation and reflection text, and images of the current charts. Use the browser's Print → Save as PDF to make a PDF.
