# Goldfish Paradise — Ecosystem Lab

A free, browser-based ecosystem laboratory for high-school biology. Students run a fish-tank ecosystem and a "Waste-to-Plate" aquaponics system, trace nitrogen and carbon, follow energy to heat, design a nutrient-recovery solution, and compare their model with **real** water-quality observations, clearly labelled as such.

* Runs entirely in the browser. It works on low-cost Chromebooks, with no installs, accounts, cookies, servers or paid APIs.
* About 210 kB of HTML/CSS/JavaScript with **no external libraries or fonts**, so it keeps working when CDNs are blocked.
* Hosted free on **GitHub Pages**. Teachers share one URL.
* **Two levels.** **Basic** (default, built for 9th grade) has five choices, traffic-light status cards, four charts, a "What happened?" story and three missions that match a **printable PDF worksheet**. **Advanced** has every setting, eight charts, matter and energy diagrams, six investigations and a digital lab report.
* Aligned to NGSS **HS-LS2-1, HS-LS2-4, HS-LS2-5, HS-LS2-7**, with an activity mapped to each one ([docs/NGSS_ALIGNMENT.md](docs/NGSS_ALIGNMENT.md)).

> **Scientific honesty.** This is a simplified classroom model. Its process equations are *informed by* published aquatic-ecosystem modelling, especially the US EPA AQUATOX technical documentation, but it is **not** AQUATOX. Most parameter values are illustrative teaching values. The model is numerically verified (it conserves matter exactly; 39 automated tests) but **not empirically validated** against a real tank. Do not use it for animal-care decisions. See the [model card](docs/MODEL_CARD.md) and [validation report](docs/VALIDATION.md).

## What's inside

| | |
|---|---|
| **Lab (Basic)** | Tank, fish, food, light and air pump; status cards; a day-by-day story; 4 charts; quick check. Missions tab + `docs/lab-worksheet.pdf` |
| **Lab (Advanced)** | Scenario A (unmanaged tank), B (aquaponics) or both under identical conditions. Controls: duration, fish, feeding, extra nutrient loading, light, crop density, aeration, and more. Live metrics, a tank picture, 8 time-series charts with units (hover, keyboard and table views), nitrogen and carbon flow diagrams, an energy budget, a mass-balance check, a knowledge check, and CSV export |
| **Investigations** | 1 algal blooms · 2 why fish die · 3 can aquaponics help? · 4 where does the energy go? · 5 where does the matter go? · 6 real-world water quality. Each has a prediction, procedure, recorded results, evidence, explanation and reflection, plus a downloadable or printable lab report |
| **Real Water Data** | Load teacher-prepared datasets or import a Water Quality Portal CSV. Shows provenance, quality flags and non-detects, and puts observations **side by side** with the model, never merged |
| **Science & Sources** | Equations, simplifications compared with AQUATOX, carbon cycling vs. energy flow, NGSS map, citations |
| **Teacher** | Data preparation, classroom tips, troubleshooting |

Data are always labelled: ◆ **OBSERVED DATA** (real measurements) · — **SIMULATED DATA** (model, default settings) · ✎ **STUDENT EXPERIMENT** (model after a student's change).

## Publish on GitHub Pages (about 10 minutes, free)

1. **Create the repository.** Sign in at github.com → **New repository** → name it, e.g., `goldfish-paradise` → **Public** → *Create repository*. Free accounts can only publish Pages from public repositories.
2. **Upload the project.** On the new repository's page choose **uploading an existing file**. Drag in *everything inside* the unzipped `goldfish-paradise` folder, including the hidden `.github` folder (on a Mac press ⌘⇧. in Finder to show it). Commit to the `main` branch.
   *Or with git:* `git init && git add . && git commit -m "Goldfish Paradise" && git branch -M main && git remote add origin https://github.com/<you>/goldfish-paradise.git && git push -u origin main`
3. **Turn on GitHub Actions deployment.** Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. **Wait for the workflow.** Open the **Actions** tab: "Test and deploy to GitHub Pages" runs the tests, then publishes (1–2 minutes). If a test fails, nothing is published, and the log says why.
5. **Open the URL** shown in Settings → Pages (usually `https://<you>.github.io/goldfish-paradise/`) and **share it with students**, e.g., in Google Classroom.

Every later push to `main` (for example, adding a dataset) re-runs the tests and redeploys automatically.

*Run it locally:* `python -m http.server 8000` in this folder, then open <http://localhost:8000>. Opening `index.html` directly from disk will not work, because browsers block JavaScript modules on `file://`.

## Real environmental data

No observation values are bundled yet. The build environment could not reach the data services, and the project never ships unverified numbers. A teacher creates datasets with the standard-library-only scripts:

```bash
python scripts/fetch_wqp.py list-sites --county US:26:017            # Bay County, MI: which sites measure what
python scripts/fetch_wqp.py download --site USGS-04157065 --start 1998-01-01 --end 2013-12-31
python scripts/fetch_usgs.py series --site USGS-XXXXXXXX              # modern USGS Water Data APIs (not legacy WaterServices)
python scripts/validate_data.py
```

Candidate Bay County monitoring locations (metadata checked on Water Quality Portal site pages, no values) are in `data/metadata/`. Details: [Teacher guide](docs/TEACHER_GUIDE.md) · [Data dictionary](docs/DATA_DICTIONARY.md).

## Repository layout

```
index.html  styles.css  app.js          the student app (static)
src/model/        ecosystem.js (engine), organisms.js, nutrients.js, oxygen.js, carbon.js, energy.js, parameters.js
src/scenarios/    unmanaged-tank.js, aquaponics.js
src/data/         import.js, validation.js, provenance.js       (browser CSV import, unit checks, provenance)
src/visualization/charts.js (canvas charts), diagrams.js (SVG flow diagrams)
src/ui/           basic.js (Basic mode), lab.js, investigations.js, realdata.js, quiz.js, content.js (all student-facing text)
data/             datasets/ (classroom CSVs + provenance), metadata/, templates/
scripts/          fetch_wqp.py, fetch_usgs.py, validate_data.py, gp_common.py   (teacher-side, Python stdlib)
                  make_worksheet.py (rebuilds the worksheet PDFs; needs reportlab)
tests/            model.test.mjs, import.test.mjs (Node), test_scripts.py (Python), fixtures/ (SYNTHETIC test inputs)
docs/             MODEL_CARD, VALIDATION, SCIENTIFIC_SOURCES, DATA_DICTIONARY, TEACHER_GUIDE, STUDENT_GUIDE,
                  NGSS_ALIGNMENT, TECHNICAL_ASSESSMENT (review of the original), view.html (in-app doc viewer)
teacher/          lab-worksheet-teacher-key.pdf (NOT published on the site)
legacy-python/    the original Python project, unchanged
.github/workflows/pages.yml   test → deploy to GitHub Pages
```

## Developing

```bash
node --test tests/*.test.mjs                            # needs Node 18+; no npm install
python -m unittest discover -s tests -p "test_*.py"
node tests/verification-report.mjs                      # numbers used in docs/VALIDATION.md
```

Student-facing wording (missions, investigations, quiz, explanations) lives in `src/ui/content.js`. The worksheet text is in `scripts/make_worksheet.py` (`pip install reportlab`, then `python scripts/make_worksheet.py`). `tests/basic.test.mjs` fails if a model change would make the teacher key wrong. Every parameter, with its unit and source status, is in `src/model/parameters.js`.

## Credits and licence

MIT licence (see `LICENSE`). Builds on the original *Goldfish Paradise* Python simulation (`legacy-python/`). Scientific sources are listed in [docs/SCIENTIFIC_SOURCES.md](docs/SCIENTIFIC_SOURCES.md). Observation data remain subject to their providers' terms.
