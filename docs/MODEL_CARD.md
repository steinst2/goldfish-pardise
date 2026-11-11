# Model card — Goldfish Paradise classroom ecosystem model

**Version:** 2.0 (browser rewrite of the original Python model; the original is preserved in `legacy-python/`)
**Code:** `src/model/` · **Tests:** `tests/` · **Validation report:** [VALIDATION.md](VALIDATION.md)

## 1. Purpose

A transparent, computational model that high-school biology students can run in a browser, built
to support explanations of matter cycling, energy flow, photosynthesis and respiration, carrying
capacity, and engineering a nutrient-recovery solution (NGSS HS-LS2-1, -4, -5, -7).

**Intended use:** classroom reasoning about *mechanisms and directions of change* ("what happens to
oxygen when algae die?").
**Not intended for:** aquarium or aquaculture management, animal-care decisions, predicting any real
water body, or regulatory use. It is **not** an implementation of EPA AQUATOX. Some of its process
equations follow AQUATOX's published formulations, in simplified form.

## 2. Structure

* **Spatial:** one well-mixed water volume (200 L default) with a grow bed (Scenario B). No sediment layer, stratification or flow.
* **Time:** explicit Euler integration, 24 steps per day (hourly), so light and dissolved oxygen follow a day/night cycle. Outputs are recorded once per simulated day: daily min, max and mean O₂, and end-of-day state for everything else.
* **Mass bookkeeping:** every process is written as a stoichiometric reaction that removes mass from some pools and adds the same mass of C, N and P to others. External inputs (food, fertilizer, crop CO₂ from air, atmospheric CO₂ exchange, water changes) and exports (N₂ gas, harvest, drained water) are tallied in ledgers. A *flux limiter* scales down any reaction that would draw a pool below zero, so pools stay non-negative without creating or destroying mass.

### State variables

| Variable | Unit | Notes |
|---|---|---|
| `fish` | mg dry mass / L | goldfish (displayed as g wet mass using dry:wet = 0.25, illustrative) |
| `algae` | mg dry mass / L | one phytoplankton group; chlorophyll-a estimated with C:chl = 28 (AQUATOX 3.1) |
| `crop` | mg dry mass / L | crop plants in the grow beds (Scenario B) |
| `bact` | mg dry mass / L | heterotrophic decomposer bacteria |
| `nitr` | mg dry mass / L | nitrifying bacteria (biofilm on gravel/media; capped by surface area) |
| `detC`, `detN`, `detP` | mg C, N, P / L | detritus: dead organisms, feces, uneaten food. Composition is tracked separately because each source has a different composition |
| `nh4` | mg N / L | total ammonia nitrogen (NH₄⁺ + NH₃) |
| `no3` | mg N / L | nitrate (+ nitrite) nitrogen |
| `po4` | mg P / L | dissolved phosphate |
| `do` | mg O₂ / L | dissolved oxygen |
| `dic` | mg C / L | dissolved inorganic carbon (CO₂ + bicarbonate, one pool) |

Elemental composition (fraction of dry mass) — `src/model/organisms.js`:

| Pool | C | N | P | Source |
|---|---|---|---|---|
| Algae | 0.50 | 0.059 | 0.007 | N, P: AQUATOX 3.2 Tech. Doc. Table 13 (Sterner & Elser 2002). C: illustrative |
| Fish | 0.50 | 0.100 | 0.025 | illustrative (protein- and bone-rich) |
| Crops | 0.50 | 0.045 | 0.007 | illustrative |
| Bacteria (both groups) | 0.50 | 0.100 | 0.020 | illustrative |
| Fish food | 0.50 | 0.070 | 0.012 | illustrative (≈ 44 % protein pellet) |

## 3. Process equations

Rates are per day at 20 °C, multiplied by θ^(T−20) with θ = 1.07 (`thetaBio`, illustrative, ≈ Q10 of 2), and by the time step Δt = 1/24 day.

**Light.** Surface light I(h) = `light` × sin(π (h − sunrise)/photoperiod) during daylight, 0 at night. Mean light in the water column is I × (1 − e^(−kz))/(kz), with k = k_w + k_a × algae (Beer–Lambert). Floating rafts shade a fraction `raftShade × cropDensity` of the water. Light response: f_L = I(1+K_I)/(I+K_I), so f_L(1) = 1.

**Algal photosynthesis (Monod + Liebig).**
`GPP = μmax × f_L × min(f_N, f_P, f_C) × θ^(T−20) × algae`, where f_X = X/(K_X + X).
This combination is the one used by AQUATOX 3.2 (eqs. 52–54, 56: NutrLimit = min(PLimit, NLimit, CLimit)).
Legović & Cruzado (1997, doi:10.1016/S0304-3800(96)01919-9) model phytoplankton with Monod *uptake*,
Droop growth on *internal* nutrient quotas, and Liebig's law. **Our model leaves out the internal quota:** growth responds directly to dissolved
concentrations, and algae have fixed composition. None of our constants are taken from that paper.
Uptake takes N from ammonium and nitrate in proportion to `nh4Preference × NH₄ : NO₃`. O₂ produced = (32/12) × C fixed.

**Algal respiration and death.** Respiration = r × f(O₂) × algae (CO₂, NH₄⁺ and PO₄ released; O₂ used).
Mortality = (m₀ + m_s × S) × algae, where S = 1 − min(1, NutrLimit × light ratio) is a stress factor of the same form as AQUATOX's
nutrient-and-light stress mortality (3.2 eq. 69), written here in a simpler linear version. Dead algae become detritus.

**Fish.** Food is offered during daylight at `feedPct` % of the *starting* fish wet mass per day (reduced if the fish population shrinks). Fish eat
up to `fishMaxIngest` × appetite(O₂); uneaten food becomes detritus. Fish also graze algae (Monod in algal density).
Assimilated mass = AE_food × food + AE_algae × algae eaten; the rest is feces (detritus).
Growth = assimilated − digestion cost (`fishSDA` × assimilated) − routine respiration, capped so that the tissue's N and P never exceed the N and P assimilated.
All assimilated mass not built into tissue is respired (CO₂ out, O₂ used). Excess N is excreted as NH₄⁺, and excess P as PO₄.
Starving fish catabolize tissue, which releases its N and P.

**Fish mortality.** Low oxygen: rate = `hypoxiaMort` × (1 − O₂/`doStress`) when O₂ < `doStress`.
Ammonia: rate = `nh3Mort` × min(1, NH₃/`nh3Stress` − 1) when un-ionized NH₃-N > `nh3Stress`.
NH₃ fraction = 1/(1 + 10^(pKa − pH)), with pKa = 0.09018 + 2729.92/T(K) (Emerson et al. 1975).
**Both thresholds are scenario parameters.** Low-oxygen tolerance differs a great deal between species, life stages and acclimation
(goldfish are unusually tolerant). There is no single "fish death" oxygen level, and these simple rules do not reproduce AQUATOX's time-to-death relationships (AQUATOX 3.1 Tech. Doc. eqs. 199–204).

**Crops (Scenario B).** Net growth = μ_c × f_L(surface light) × min(f_N, f_P) × (1 − crop/capacity) × crop, where capacity = `cropCapacity` × `cropDensity`.
Roots take N and P from the water. **Carbon comes from the air and photosynthetic O₂ goes to the air.** Root respiration
uses water O₂ and releases CO₂ to the water (its carbon came from the air). Senescence sends crop material to detritus.
Every `harvestEvery` days, `harvestFrac` of the crop is removed. Its C, N and P are exported "to the plate".

**Decomposition.** Uptake = v × θ × bact × detC/(K_D + detC) × [f_O₂ + a(1 − f_O₂)], with f_O₂ = O₂/(0.5 + O₂)
(half-saturation 0.5 g/m³ = AQUATOX 3.2 HalfSatO for the water column, p. 160) and `bactAnaerobic` = a for slower anaerobic decay.
Growth efficiency 0.30. Mineralized N and P = detritus N and P consumed − bacterial demand; can be negative (immobilization).
O₂ is used only by the aerobic share. Bacterial respiration and death are also included.

**Nitrification.** `Nitrify = vₙ × θ × nitr × NH₄/(K_NH₄ + NH₄) × O₂/(K_O₂ + O₂)`. Same structure as AQUATOX 3.2 eq. 175
(rate × DOCorrection × TCorr × Ammonia), but limited by nitrifier biomass. Uses 4.57 g O₂ per g N (NH₄⁺ + 2 O₂ → NO₃⁻ + 2 H⁺ + H₂O).
Nitrifier growth (yield 0.15) uses CO₂ (they are chemoautotrophs) and is capped by biofilm area `nitrMax`.
**Nitrification transforms nitrogen; it does not remove it** (tested).

**Denitrification.** `Denit = k_d × θ × NO₃ × max(1 − f_O₂,den, anoxicFraction) × detC/(K_D + detC)`. Same oxygen logic as
AQUATOX 3.2 eq. 176 (rate × (1 − DOCorrection)), plus a small anoxic micro-site fraction in gravel. Consumes 60/56 g organic C per g N.
**N₂ leaves the system: a true nitrogen removal.**

**Oxygen.** `dO₂/dt = reaeration + photosynthesis − respiration (algae, fish, bacteria, roots) − decomposition − nitrification`.
Reaeration = K_reaer × 1.024^(T−20) × (O₂sat − O₂) (AQUATOX 3.2 eqs. 191 and 198). O₂sat from the Benson & Krause (1980, 1984)
freshwater equation used by USGS (OWQ Tech. Memo. 2011.03). K_reaer presets (none 0.8, gentle 3, strong 12 per day) are **illustrative**.
There is no cap on O₂: it can rise above saturation in daylight and relaxes back through reaeration (the original Python model clipped O₂ at 12 mg/L).

**Inorganic carbon.** One DIC pool. Exchange with air = 0.9 × K_reaer × `co2FreeFraction` × (DIC_eq − DIC).
This is a strong simplification: real CO₂ exchange depends on the carbonate equilibrium, alkalinity and pH. The factor 0.9 approximates
AQUATOX's scaling of K_reaer by (32/44)^0.25 ≈ 0.92 (3.1 eq. 212). pH is held constant and does not respond to CO₂.

**Energy (separate from mass).** 20 kJ per g dry biomass (illustrative). Tracked: light energy fixed by algae, crop net production,
food energy added, energy eaten by fish, fish production, and heat released by fish, algae, decomposers and roots.
Energy is a *flow*: heat leaves and is not recycled. The fish's growth efficiency (production ÷ ingestion) **emerges** from the
parameters. The ~10 % rule is not imposed.

**Management.** Optional weekly water change (removes a fraction of dissolved and detrital pools and replaces it with clean, oxygen-saturated water at DIC_eq). Optional fertilizer/runoff input of nitrate and phosphate at a mass N:P of 7.2 (≈ Redfield 16:1 molar).

## 4. Parameters

Status meanings: **literature** = value taken from a cited source; **illustrative** = a plausible teaching value chosen by the
developers that is *not* calibrated or measured. Stoichiometric constants (O₂:C = 32/12, O₂:N = 64/14, C:N for denitrification = 60/56,
molar masses) follow from chemical formulas.

| Name | Value | Unit | Meaning | Status / source |
|---|---|---|---|---|
| `volumeL` | 200 | L | System water volume | illustrative |
| `depthM` | 0.4 | m | Water depth (for light attenuation) | illustrative |
| `tempC` | 22 | °C | Water temperature (constant) | illustrative |
| `pH` | 7.5 | pH | pH (constant; used only for un-ionized ammonia) | illustrative |
| `photoperiodH` | 14 | h | Hours of light per day | illustrative |
| `light` | 0.8 | fraction | Light availability (peak, 0–1) | illustrative |
| `kReaer` | 3 | 1/day | Reaeration coefficient (set by aeration choice) | illustrative — AQUATOX eq.191 form |
| `thetaBio` | 1.07 | – | Temperature coefficient for biological rates (≈ Q10 of 2) | illustrative |
| `dicEq` | 20 | mg C/L | Dissolved inorganic carbon in equilibrium with air (tap-water alkalinity) | illustrative |
| `co2FreeFraction` | 0.1 | fraction | Fraction of DIC that is free CO2 (exchanges with air) | illustrative |
| `fishCount` | 8 | fish | Number of goldfish | illustrative |
| `fishWetG` | 20 | g wet | Starting wet mass of each fish | illustrative |
| `feedPct` | 1.5 | % of starting fish wet mass per day | Daily food (nutrient loading) | illustrative |
| `fishMaxIngest` | 0.1 | mg/mg dry/day | Maximum food a fish can eat per day | illustrative |
| `fishAEfood` | 0.7 | fraction | Assimilation efficiency, food pellets | illustrative |
| `fishAEalgae` | 0.5 | fraction | Assimilation efficiency, algae | illustrative |
| `fishGraze` | 0.002 | 1/day | Maximum grazing on algae | illustrative |
| `fishGrazeK` | 5 | mg dry/L | Half-saturation algae density for grazing | illustrative |
| `fishSDA` | 0.2 | fraction | Share of assimilated food spent digesting it (specific dynamic action) | illustrative |
| `fishResp` | 0.02 | 1/day | Routine respiration (fraction of fish dry mass per day) | illustrative |
| `fishKO2` | 0.5 | mg O2/L | Half-saturation DO for fish respiration | literature — AQUATOX HalfSatO = 0.5 g/m3 (water column) |
| `fishKO2feed` | 1 | mg O2/L | DO at which fish appetite is halved | illustrative |
| `doStress` | 2 | mg O2/L | Low-oxygen stress threshold (scenario parameter — species-specific in reality) | illustrative |
| `hypoxiaMort` | 0.5 | 1/day | Maximum low-oxygen mortality (reached at DO = 0) | illustrative |
| `nh3Stress` | 0.1 | mg NH3-N/L | Un-ionized ammonia stress threshold | illustrative |
| `nh3Mort` | 0.3 | 1/day | Maximum ammonia-toxicity mortality | illustrative |
| `algae0` | 1 | mg dry/L | Starting algae | illustrative |
| `algaeMu` | 1.6 | 1/day | Maximum algal photosynthesis rate | illustrative |
| `algaeKN` | 0.05 | mg N/L | Half-saturation, nitrogen (algae) | illustrative |
| `algaeKP` | 0.01 | mg P/L | Half-saturation, phosphorus (algae) | illustrative |
| `algaeKC` | 0.5 | mg C/L | Half-saturation, inorganic carbon (algae) | illustrative |
| `algaeKI` | 0.2 | relative light | Half-saturation light (algae) | illustrative |
| `algaeResp` | 0.08 | 1/day | Algal respiration | illustrative |
| `algaeMort0` | 0.05 | 1/day | Algal background mortality | illustrative |
| `algaeMortStress` | 0.3 | 1/day | Extra algal mortality when starved of light or nutrients | illustrative |
| `lightKw` | 0.5 | 1/m | Light attenuation by water | illustrative |
| `lightKa` | 0.3 | (1/m) per mg dry/L | Light attenuation (self-shading) by algae | illustrative |
| `nh4Preference` | 2 | – | Preference for ammonium over nitrate | illustrative |
| `cropDensity` | 0 | fraction of grow bed planted | Crop planting density | illustrative |
| `cropCapacity` | 800 | mg dry/L at 100 % density | Maximum crop biomass the grow beds can hold | illustrative |
| `cropStart` | 0.1 | fraction of capacity | Transplant (starting) biomass | illustrative |
| `cropMu` | 0.25 | 1/day | Maximum crop net growth rate | illustrative |
| `cropKN` | 2 | mg N/L | Half-saturation, nitrogen (crops) | illustrative |
| `cropKP` | 0.3 | mg P/L | Half-saturation, phosphorus (crops) | illustrative |
| `cropKI` | 0.3 | relative light | Half-saturation light (crops) | illustrative |
| `cropRootResp` | 0.01 | 1/day | Root respiration drawing on water oxygen | illustrative |
| `cropMort` | 0.003 | 1/day | Root and leaf loss to the water (senescence) | illustrative |
| `harvestEvery` | 14 | days | Harvest interval (0 = never) | illustrative |
| `harvestFrac` | 0.4 | fraction | Fraction of crop biomass removed at harvest | illustrative |
| `raftShade` | 0.5 | fraction | Fraction of system water shaded by rafts at 100 % density | illustrative |
| `bact0` | 2 | mg dry/L | Starting decomposer bacteria | illustrative |
| `bactUptake` | 1.5 | mg C per mg dry per day | Maximum detritus uptake by bacteria | illustrative |
| `bactKD` | 2 | mg C/L | Half-saturation detritus for bacteria | illustrative |
| `bactBGE` | 0.3 | fraction | Bacterial growth efficiency | illustrative |
| `bactKO2` | 0.5 | mg O2/L | Half-saturation DO for aerobic decomposition | literature — AQUATOX HalfSatO = 0.5 g/m3 |
| `bactAnaerobic` | 0.25 | fraction | Relative speed of decomposition without oxygen | illustrative |
| `bactResp` | 0.05 | 1/day | Bacterial maintenance respiration | illustrative |
| `bactMort` | 0.15 | 1/day | Bacterial death / grazing loss | illustrative |
| `detritusC0` | 3 | mg C/L | Starting organic detritus (as carbon) | illustrative |
| `nh40` | 0.2 | mg N/L | Starting total ammonia nitrogen | illustrative |
| `no30` | 1 | mg N/L | Starting nitrate nitrogen | illustrative |
| `po40` | 0.05 | mg P/L | Starting phosphate phosphorus | illustrative |
| `nitrMax` | 2 | mg dry/L | Maximum nitrifier biofilm (set by surface area of gravel / media) | illustrative |
| `nitrMaturity` | 0.7 | fraction of maximum | Starting nitrifier biofilm (0.05 = brand-new tank) | illustrative |
| `nitrRate` | 0.6 | mg N per mg dry per day | Maximum nitrification rate per nitrifier mass | illustrative |
| `nitrKNH4` | 0.5 | mg N/L | Half-saturation ammonia for nitrification | illustrative |
| `nitrKO2` | 1 | mg O2/L | Half-saturation DO for nitrification (nitrifiers need oxygen) | illustrative |
| `nitrYield` | 0.15 | mg dry per mg N | Nitrifier growth yield (very low) | illustrative |
| `nitrMort` | 0.02 | 1/day | Nitrifier loss | illustrative |
| `denitRate` | 0.3 | 1/day | Maximum denitrification rate | illustrative |
| `denitKO2` | 0.5 | mg O2/L | DO that halves denitrification | illustrative |
| `anoxicFraction` | 0.03 | fraction | Anoxic micro-sites in gravel/media (allow some denitrification) | illustrative |
| `waterChangePct` | 0 | % per week | Weekly partial water change | illustrative |
| `fertN` | 0 | mg N/L/day | Extra nitrate fertilizer input | illustrative |
| `fertP` | 0 | mg P/L/day | Extra phosphate fertilizer input | illustrative |
| `stepsPerDay` | 24 | steps | Numerical time steps per day (hourly) | illustrative |

Scenario overrides: A — gentle aeration, no crops, no harvest, `nitrMax` 4.0. B — strong aeration, `cropDensity` 0.6, harvest every 14 days, `nitrMax` 6.0 (grow-bed media).

**Comparison with AQUATOX values we did not adopt:** AQUATOX's default light-extinction coefficient for phytoplankton is 0.14 (1/m)/(g/m³);
we use 0.3 (illustrative). AQUATOX's O₂ per unit photosynthesis is 1.6 g O₂ per g organic matter (O2Photo, 3.2 p. 185); our RQ = 1 stoichiometry gives 1.33 g O₂ per g dry mass.

## 5. Assumptions

1. Water is well mixed; temperature and pH are constant during a run.
2. Every organism has a fixed elemental composition.
3. One species per functional group; no zooplankton, snails, plants rooted in the tank, pathogens or reproduction.
4. Food is the only organic input. Clean replacement water contains no nutrients.
5. Phosphorus does not bind to sediments or precipitate.
6. Crops are not limited by anything other than light, N, P and grow-bed space (no micronutrient, pH or root-oxygen limits).

## 6. Limitations

* **Not calibrated or empirically validated.** Numbers have the right units and magnitudes for teaching, but they do not forecast a real tank.
* Algae reach a light-limited ceiling (self-shading) of roughly 50 mg dry/L (~900 µg chl-a/L): hypereutrophic "green water".
* The DIC/pH simplification means CO₂ values are qualitative.
* Fish toxicity and hypoxia responses are threshold rules, not species-specific dose–response curves.
* With fish present, the tank is usually nutrient-saturated and light-limited. Nutrient limitation is easiest to see without fish (Investigation 1). This matches heavily fed aquaria, but not oligotrophic lakes.
* Comparing with river or lake observations is meaningful only for scale and pattern. The model must not be tuned to field data from a different system.

## 7. Numerical method and known failure conditions

* Explicit Euler with hourly steps. Measured difference from 15-minute steps after 30 days: < 1 % for the main state variables (see VALIDATION.md).
* Very large rates combined with coarse steps (e.g. `stepsPerDay` < 6 together with strong aeration, K_reaer·Δt > 1) can overshoot O₂ saturation. Keep `stepsPerDay` ≥ 24.
* The flux limiter prevents negative pools. When it is active, processes are slowed in proportion. This is a numerical safeguard, not biology.
* `cropDensity` > 0 with `harvestEvery` = 0 lets crops fill the grow bed and stop absorbing nutrients. This is intended, but students may not expect it.
* Temperatures far outside 12–30 °C push θ^(T−20) outside the range these illustrative parameters were chosen for.

## 8. Future work

* Droop internal-quota growth (Legović & Cruzado 1997) so algal N:P can vary.
* Carbonate chemistry with alkalinity and a pH that responds to CO₂.
* Sediment phosphorus binding and release.
* Species-specific hypoxia and ammonia tolerance curves.
* Temperature time series instead of a constant temperature.
