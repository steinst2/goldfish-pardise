# Validation report

This report keeps two very different things apart:

* **Numerical verification**: does the code do what the model card says? (conservation of mass, correct signs, stable numerics, expected direction of response). **Done; automated; results below.**
* **Empirical validation**: do the model's outputs match measurements from real aquaria or aquaponics systems? **Not done.** No calibration or validation dataset was used, and the model makes no claim of empirical accuracy. A model that runs, conserves mass and responds in the expected direction can still be quantitatively wrong.

Reproduce everything here with:

```bash
node --test tests/*.test.mjs                             # 28 JavaScript tests (model + CSV importer)
python -m unittest discover -s tests -p "test_*.py"     # 8 Python tests (teacher scripts)
node tests/verification-report.mjs                      # prints the numbers quoted below
```

Both suites run in GitHub Actions before every deployment (`.github/workflows/pages.yml`). A failing test blocks publication.

## Results (measured 2026-11-10, Node 22, Python 3.13)

### 1. Nutrient mass conservation

Closure = (final stored − initial stored) − (inputs − exports), in mg/L, after 365 days. Every case also passes over 120 days, and over 90 days in 40 randomised parameter sets.

| Case | N | P | C |
|---|---|---|---|
| A default | 5.5e-14 | 2.7e-14 | 5.8e-13 |
| B default | −1.0e-11 | −1.7e-12 | 1.8e-10 |
| B + 25 %/week water changes + fertilizer | −1.0e-11 | −1.8e-12 | 1.5e-10 |

These residuals are floating-point round-off (total system C is about 10³ mg/L). Test tolerance: 1e-9 mg/L for N and P; 1e-8 relative for C.

### 2. Nitrogen transformation

With fish, algae, detritus and denitrification switched off, 20 days of nitrification lowered ammonium and raised nitrate. Total N changed by < 1e-10 mg/L and N₂ loss was exactly 0. **Nitrification changes the form of nitrogen; it does not remove it.** Separately, N₂ loss was > 5× larger in an anoxic tank than in a strongly aerated one, and N₂ loss always equals the denitrified N.

### 3. Nutrient uptake

Monod factor = 0.5 exactly at the half-saturation constant; the Liebig factor equals the smallest individual factor; growing algae draw down phosphate and record matching N and P uptake.

### 4. Oxygen balance

Final DO = initial DO + reaeration + algal photosynthesis + water-change O₂ − (algal, fish, bacterial and root respiration) − nitrification demand, to within 1e-8 mg/L (Scenarios A and B, 60 days).
In the water, photosynthetic O₂ equals (32/12) × the carbon fixed by *algae* only, which confirms that crop photosynthesis does not add O₂ to the water.

Oxygen saturation (Benson & Krause equation, as adopted by USGS) compared with standard freshwater table values at 1 atm:

| T | model (mg/L) | reference table |
|---|---|---|
| 0 °C | 14.62 | 14.62 |
| 10 °C | 11.29 | 11.29 |
| 20 °C | 9.09 | 9.09 |
| 25 °C | 8.26 | 8.26 |
| 30 °C | 7.56 | 7.56 |

Un-ionized ammonia (Emerson et al. 1975): 0.564 % at 25 °C and pH 7.0 (published tables based on Emerson et al. give about 0.57 %); 3.81 % at 20 °C and pH 8.0.

### 5. Carbon balance

See the C column in §1. Carbon enters as food and as CO₂ from the air (dissolving into the water, and fixed by crop leaves). It leaves in harvests, drained water and outgassing. All of these are in the ledger.

### 6. Non-negative state variables

40 randomised parameter sets over the full slider ranges (fish 0–16, feeding 0–3 %, light 0–1, temperature 12–30 °C, all aeration levels, pH 6.5–8.5, random water changes, fertilizer, crop density and harvest intervals), each run for 90 days: every state variable was finite and ≥ 0 on every day, and N closure held in every set. Round-off clamping total < 1e-9 mg/L.

### 7–9. Sensitivity to light, nitrogen and phosphorus

No fish; low starting nutrients; algae biomass (mg dry/L) after 40 days:

| Changed factor | Value | Algae | Limiting factor at day 40 |
|---|---|---|---|
| Light (N, P ample) | 0.2 / 0.5 / 0.9 | 7.3 / 32.7 / 61.5 | light |
| N loading (P ample), mg N/L/day | 0 / 0.09 / 0.36 | 3.2 / 37.4 / 54.3 | N → light → light |
| P loading (N ample), mg P/L/day | 0 / 0.0125 / 0.05 | 4.2 / 35.2 / 54.3 | P → light → light |

The responses go the expected way and show the switch between limiting factors that Liebig's law predicts. Adding a non-limiting nutrient beyond a point has a diminishing effect.

### 10. Sensitivity to crop density (Scenario B, 90 days)

| Crop density | Dissolved N (mg N/L) | Phosphate (mg P/L) | Algae (mg dry/L) | N harvested (g) |
|---|---|---|---|---|
| 0 % | 50.5 | 9.51 | 52.7 | 0 |
| 30 % | 33.7 | 6.43 | 44.2 | 2.94 |
| 60 % | 18.5 | 3.65 | 35.5 | 5.60 |
| 100 % | 5.4 | 1.22 | 23.3 | 8.17 |

Crops reduce dissolved nutrients and algae with no sudden jumps, but **do not eliminate algae**: algae have higher nutrient affinity, and nutrients stay above algal half-saturation levels.

### 11. Stability across simulation durations and time steps

* The first 30 days of a 365-day run are bit-for-bit identical to a 30-day run (the model is deterministic). Mass balance closes at 365 days.
* Time-step convergence after 30 days (strong aeration), hourly vs 15-minute steps:

| Scenario | fish | algae | crop | nitrate | phosphate | DO |
|---|---|---|---|---|---|---|
| A | 0.00 % | 0.37 % | – | 0.19 % | 0.09 % | 0.46 % |
| B | 0.00 % | 0.36 % | 0.57 % | 0.77 % | 0.77 % | 0.10 % |

### Outcome dependence

The default crowded, gently aerated unmanaged tank collapses (fish < 10 % of start by day 90). Four fish with strong aeration survive (> 80 %). The model does not force collapse.

### Data-import verification

The CSV importer tests check quoting, date validation (impossible dates rejected), exact molar-mass conversions (e.g. NO₃ → N basis × 14.007/62.004), refusal to guess ambiguous units (phosphate "mg/l" with no basis, DO in % saturation), non-detects kept but not plotted, helpful errors for HTML or incomplete files, and **refusal of rows labelled synthetic**. The Python tests check that the scripts keep original values, units and detection conditions, reject future dates, non-numeric values and synthetic rows, and build URLs for the modern APIs only (no `waterservices.usgs.gov`).

## Chromebook and network performance

* Download size of the whole app (HTML, CSS, JavaScript): about 210 kB uncompressed (about 67 kB gzip-compressed, which is how GitHub Pages serves it), with no external libraries, fonts or CDNs. It still works when Google Fonts or other third-party hosts are blocked, because it uses none.
* Run time measured on the development machine: 90 days ≈ 30 ms; 365 days ≈ 115 ms (Scenario B). A low-cost Chromebook is commonly 3–6× slower, which should still be well under a second. **We have not timed a physical Chromebook.** Teachers should try one before class.
* Rendering: charts redraw only after a run, when the window is resized, or on hover. There is no animation loop and no background network activity. The simulation itself makes no network requests. `data/` files are fetched only from the Real Water Data tab.
* Checked in headless Chrome at 1366 × 768 (a common Chromebook resolution): no console errors; all tabs render.

## What would empirical validation need?

Time series of fish biomass, feeding, NH₄⁺, NO₃⁻, PO₄³⁻, DO (with diel range), chlorophyll-a and crop harvest mass, all from one aquarium or aquaponics unit with known volume, temperature, aeration and stocking. Those data could be used to calibrate the illustrative parameters and test predictions out-of-sample. **River or lake observations from the Water Quality Portal are not suitable for calibrating this aquarium model** (Investigation 6 asks students to explain why).
