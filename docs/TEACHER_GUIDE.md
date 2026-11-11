# Teacher guide

## What students need

A web browser and the class link (your GitHub Pages URL). Nothing else: no accounts, installs, extensions, Python or Node. The app works on school Chromebooks, uses no cookies, and keeps student writing on the student's own device until they download a report.

## Basic mode and the paper worksheet (9th grade)

The lab opens in **Basic** mode. Students choose the tank (fish tank / with plants / both), number of fish, food (a little / normal / a lot), light (low / medium / high) and air pump (off / on). They read four traffic-light cards (Fish, Oxygen, Toxic ammonia, Water), a "What happened?" day-by-day story, and four charts.

Print **`docs/lab-worksheet.pdf`** (5 pages, black-and-white friendly). It follows the three Missions in the Missions tab:

| Mission | Time | Standard | Students… |
|---|---|---|---|
| 1 Keep the fish alive | 1 period | HS-LS2-1 | change one variable at a time; find which changes save the fish (air pump, low light, very few fish) |
| 2 Why did the fish die? | ½ period | HS-LS2-1, -4 | record event days from the story; order the cause-and-effect chain; explain day/night oxygen |
| 3 Waste to Plate | 1 period | HS-LS2-7, -5 | compare a plain tank with an aquaponics tank in 3 runs; write a CER |

The answer key with the model's actual results is **`teacher/lab-worksheet-teacher-key.pdf`** in the repository. It is not published on the website. Note that a public GitHub repository is visible to anyone, so students *could* find it there. To change the worksheet wording, edit `scripts/make_worksheet.py` and run it (`pip install reportlab` first).

Switch to **Advanced** (top right) for honors or dual-enrollment students, or link them straight to it with `?mode=advanced` after the site URL.

## Suggested sequence for Advanced mode (five to seven 50-minute periods)

| Day | Activity | Standard |
|---|---|---|
| 1 | Tour the Lab with the default unmanaged tank. Predict, then run. Use "Inspect a day" and the Knowledge check. | HS-LS2-1 |
| 2 | Investigation 1: limiting factors and algal blooms | HS-LS2-1 |
| 3 | Investigation 2: why the fish die (oxygen, decomposition, ammonia) | HS-LS2-1, HS-LS2-4 |
| 4 | Investigation 5: trace nitrogen and carbon (mass balance, carbon cycle) | HS-LS2-4, HS-LS2-5 |
| 5 | Investigation 4: energy budget and the 10 % rule | HS-LS2-4 |
| 6 | Investigation 3: design a Waste-to-Plate system (engineering design, trade-offs) | HS-LS2-7 |
| 7 | Investigation 6: real water-quality data from the Saginaw River / Saginaw Bay; download and submit lab reports | HS-LS2-7 |

### NGSS mapping in detail

* **HS-LS2-1 (computational representations of carrying capacity):** students change the number of fish, feeding and aeration, and find the stocking level the tank can support. The Metrics panel names the factor that killed the fish (low O₂ or ammonia) and the factor limiting algae (light, N or P).
* **HS-LS2-4 (math of matter cycling and energy flow):** the nitrogen and carbon diagrams give grams moved by each process. The mass-balance table shows change in storage = inputs − exports. The energy budget gives kJ eaten, stored and lost as heat, so students calculate efficiencies.
* **HS-LS2-5 (photosynthesis and respiration in the carbon cycle):** the carbon diagram (CO₂ → algae → fish/decomposers → CO₂, with exchange with the air) and the day/night oxygen band.
* **HS-LS2-7 (design a solution to reduce human impacts):** students design and refine an aquaponics configuration (crop density, harvest interval, aeration, feeding), evaluate trade-offs, and connect to nutrient pollution in a real watershed.

## Key misconceptions to listen for

* "Nitrification removes nitrogen." It changes NH₄⁺ to NO₃⁻; the nitrogen stays (Investigation 5).
* "Algae always add oxygen." Algae respire at night, and decomposing algae consume oxygen (Investigation 2).
* "Plants in aquaponics oxygenate the water." Leaf oxygen goes to the air; roots use water oxygen (Investigation 3).
* "Energy is recycled like carbon." Heat leaves the system (Investigation 4).
* "The model is wrong because it doesn't match the river." The two are different systems (Investigation 6).

## Honest framing for students

Tell students explicitly: *this is a model, and most of its numbers are teaching values, not measurements*. Its equations are informed by EPA's AQUATOX research model. It conserves matter exactly (they can check). But nobody has tested its predictions against a real fish tank. The Science & Sources tab and `docs/MODEL_CARD.md` list every simplification. A good extension question: *what experiment would we need to run to test the model?* (See the end of `docs/VALIDATION.md`.)

## Preparing real data (one time, about 15 minutes)

You need a computer with Python 3.9+ and internet access. This can be your home computer if the school network blocks it. No packages need to be installed.

```bash
# 1. Which Bay County locations have which characteristics?
python scripts/fetch_wqp.py list-sites --county US:26:017

# 2. Download a location's observations (legacy profile: data up to March 2024 for USGS)
python scripts/fetch_wqp.py download --site USGS-04157065 --start 1998-01-01 --end 2013-12-31

# 3. For recent USGS data use the WQX 3.0 profile
python scripts/fetch_wqp.py download --site USGS-04157065 --start 2020-01-01 --profile wqx3

# 4. Continuous sensor or daily values from the modern USGS Water Data APIs
python scripts/fetch_usgs.py sites --bbox=-84.17,43.47,-83.69,44.02
python scripts/fetch_usgs.py series --site USGS-XXXXXXXX
python scripts/fetch_usgs.py daily --site USGS-XXXXXXXX --parameter 00300 --start 2024-05-01 --end 2024-09-30

# 5. Check everything, then commit and push (GitHub Actions redeploys the site)
python scripts/validate_data.py
```

Each download writes `data/datasets/<name>.csv`, a `<name>.provenance.json` (source, exact query URL, download time, summary), and registers the file in `data/datasets/index.json`, so it appears under "Classroom datasets".

**Downloaded from the portal's web form instead?** Run
`python scripts/fetch_wqp.py normalize --input path/to/resultphyschem.csv --query-url "<URL shown by the portal>" --retrieved 2026-11-12T15:00:00Z`.

**Students can also import a CSV themselves** (Real Water Data → Import a CSV). The file never leaves their computer.

### What we already know about Bay County locations

From Water Quality Portal site pages, checked 2026-11-10. This is metadata only; no values were downloaded.

* **USGS-04157065**, Saginaw River at Weadock Road at Essexville: Nutrient and Physical characteristic groups, 1998–2013. It is in Essexville, at the mouth of the Saginaw River.
* **21MICH-090177**, Saginaw River at Main St, Essexville (Michigan DEQ): Nutrient and Physical groups, 1998–2005.
* **21MICH_WRD-090250**, Saginaw Bay about 8 miles east of the Pinconning River (Michigan EGLE): a lake site; characteristics not yet checked.
* Other USGS sites in Bay County include USGS-04157061 (Saginaw River at Bay City), USGS-04157070 (Saginaw River at mouth near Alpine Beach) and USGS-04143600 (Kawkawlin River at Bay City). Check their characteristics with `list-sites`.

"Nutrient" and "Physical" are *groups*. Run `list-sites` to confirm whether dissolved oxygen, nitrate or phosphorus actually have results at a site, and for which years. If a needed characteristic is missing, try Saginaw County (`--county US:26:145`), for example USGS-04157005 (Saginaw River at Holland Avenue at Saginaw). Also check whether the Saginaw Bay Monitoring Consortium's tributary data (sampling since 2023) have reached the portal.

### Data notes

* Legacy WQP profiles do not include USGS data added after 2024-03-11. Use `--profile wqx3` for newer USGS discrete data.
* USGS legacy WaterServices will be decommissioned in early 2027. This project only uses `api.waterdata.usgs.gov`.
* Watch the units: nitrate can be reported "as N" or "as NO₃" (a factor of about 4.4 apart). The app converts only when the unit says which.
* Provisional USGS values can be revised. Keep the `result_status` column.

## Watershed-scale extension

EPA's [Nitrogen and Phosphorus Pollution Data Access Tool](https://www.epa.gov/waterdata/epa-nitrogen-and-phosphorus-pollution-data-access-tool) maps USGS SPARROW nitrogen and phosphorus yields, monitoring sites, facilities likely to discharge nutrients, and waters with nutrient TMDLs. The Saginaw River watershed is HUC 04080206. Students can compare watershed nutrient sources with what they learned in the tank: where does a real river's "fish food" come from?

## Deploying your own copy

See the README section "Publish on GitHub Pages". It is free and takes about 10 minutes.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Blank page when opening `index.html` by double-clicking | Browsers block JavaScript modules on `file://`. Use the GitHub Pages URL, or run `python -m http.server` in the folder and open http://localhost:8000 |
| "Classroom datasets" says the list could not be read | Same cause (file://), or `data/datasets/index.json` is missing |
| Import says a column is missing | Download "Sample Results (physical/chemical metadata)" as **CSV** from the portal, or use the script |
| Run seems slow | Use 90 days instead of 365. "Compare" runs two scenarios plus baselines |
