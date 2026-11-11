# Stage 1 — technical assessment of the original Python project

The original project is preserved unchanged in `legacy-python/` (`main.py`, `model.py`, `scenarios.py`, `visualization.py`, `quiz.py`, `README.md`, `requirements.txt`).

## 1. Architecture
* `Organism` (dataclass: name, biomass, `clamp()`), `Ecosystem` (state + `step(day)` + `snapshot()`), `Simulation` (runs N daily steps and stores snapshots).
* `scenarios.py` builds two `Ecosystem` presets. `visualization.py` makes Matplotlib 2×2 plots. `quiz.py` is a 4-question CLI quiz. `main.py` is a menu-driven CLI.
* **Kept:** the object roles (organisms, ecosystem, simulation), the two-scenario design, the Liebig-minimum idea, the 10 % energy illustration, the quiz questions (all four are in the new knowledge check) and the learning goals.

## 2. State variables
Fish, algae, bacteria and crop biomass ("model units"); ammonia-N, nitrate-N, phosphorus, dissolved O₂, CO₂ and organic carbon ("mg/L-equivalent"); cumulative energy counters.

## 3. Process equations (original)
Daily step: fish excretion ∝ biomass, with no food input. Nitrification = min(NH₄, 0.10 × bacteria). Producer growth = rate × biomass × light × min(N/(N+0.8), P/(P+0.18)), capped by N/0.11 and P/0.025. "Bloom" mortality +30 %/day when total nutrients ≥ 2.4 and light > 0.65. Detritus → organic carbon × 0.16. Decomposition = min(OC, 0.2 × bacteria). Mineralization 0.045 N and 0.010 P per unit. O₂ += 0.42 × growth × light − respiration terms, clipped to [0, 12]. CO₂ floor 0.05. Denitrification 2.5 %/day. Fish mortality when O₂ < 3.0.

## 4. Parameters
All illustrative, as the original README honestly says. Light was overwritten every step by a sine wave (0.82 + 0.12 sin(day/5)).

## 5. Scenario differences
A: 18 fish units, more algae and nutrients, light 0.95. B: 12 fish units, crops 7, less algae and nutrients, light 0.82. **The two scenarios differ in many starting conditions at once, so a comparison cannot isolate the effect of crops.**

## 6. NGSS alignment
The README table maps HS-LS2-1, -4, -5 and -7 in general terms. There were no activities tied to each standard.

## 7. Scientific inaccuracies or oversimplifications
1. **Matter not conserved.** Fish excrete N and P without eating. Producer N uptake (0.11 per unit) does not match what mineralization returns (0.045 per unit decomposed). Dead algae enter "organic carbon" at 0.16, and fish carcasses at 0.20. In a 60-day run, dissolved N in Scenario A rose from 1.2 to ~19.7.
2. **O₂ clipped at 12 mg/L.** Scenario B sat at the cap from about day 40, which silently deletes oxygen. There is no reaeration and no temperature-dependent saturation.
3. **CO₂ floor of 0.05** creates carbon. Scenario B reached the floor.
4. **Crop photosynthesis added O₂ to the water.** In aquaponics, leaf O₂ goes to the air.
5. **Bloom logic reversed.** The bloom flag fired every day in A (60/60) and on 58/60 days in B, killing 30 %/day of algae *because* nutrients were high. Aquaponics then multiplied algal mortality by 0.8, which *protected* algae.
6. **Unbounded crops** (7 → 83 units in 60 days): no space limit, death or harvest.
7. Decomposers and nitrifiers were one pool. Denitrification ran in fully oxygenated water.
8. A universal fish O₂ threshold (3.0 mg/L) was hard-coded in three files.
9. Plots mixed concentrations and biomass on one axis.

## 8. Bugs and inconsistencies
* The scenario `light` value was ignored (overwritten every step).
* `fish_energy_support` was computed but never used. Fish never grew and never ate algae.
* `atmospheric_carbon_exchange` recorded internal respiration minus uptake, not exchange with the air.
* `crop_growth * 0.006` sent part of the growth *increment*, not the crop biomass, to detritus.
* The "days below 3.0 mg/L" summary was hard-coded, separately from the model threshold.

## What the rewrite changed (summary)
Carbon-based stoichiometric reactions with exact C/N/P ledgers. Fish that eat (food + algae) and excrete stoichiometrically. Separate decomposer and nitrifier groups. Oxygen-dependent nitrification and denitrification. Benson–Krause O₂ saturation with AQUATOX-form reaeration. Hourly day/night cycle. Crops that take nutrients from the water but O₂ and CO₂ from the air, with grow-bed capacity and harvests. Stress thresholds set by the student. An identical-conditions comparison mode. Separate energy accounting. 28 + 8 automated tests. See `docs/MODEL_CARD.md`.
