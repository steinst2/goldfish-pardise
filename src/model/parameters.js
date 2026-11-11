/**
 * parameters.js — every numerical parameter of the classroom model, with units and provenance.
 *
 * status:
 *   'literature'    value (or equation) taken from a cited source
 *   'stoichiometric' follows from chemical formulas
 *   'illustrative'  a plausible TEACHING value chosen by the developers; NOT calibrated,
 *                   NOT taken from a paper. Change it and see what happens!
 *
 * Rates are per day at 20 °C unless noted; they are adjusted by theta^(T-20).
 */

export const PARAMETER_INFO = {
  // ---- environment ----
  volumeL:        { value: 200,  unit: 'L', label: 'System water volume', status: 'illustrative' },
  depthM:         { value: 0.4,  unit: 'm', label: 'Water depth (for light attenuation)', status: 'illustrative' },
  tempC:          { value: 22,   unit: '°C', label: 'Water temperature (constant)', status: 'illustrative' },
  pH:             { value: 7.5,  unit: 'pH', label: 'pH (constant; used only for un-ionized ammonia)', status: 'illustrative' },
  photoperiodH:   { value: 14,   unit: 'h', label: 'Hours of light per day', status: 'illustrative' },
  light:          { value: 0.8,  unit: 'fraction', label: 'Light availability (peak, 0–1)', status: 'illustrative' },
  kReaer:         { value: 3.0,  unit: '1/day', label: 'Reaeration coefficient (set by aeration choice)', status: 'illustrative', source: 'AQUATOX eq.191 form' },
  thetaBio:       { value: 1.07, unit: '–', label: 'Temperature coefficient for biological rates (≈ Q10 of 2)', status: 'illustrative' },
  dicEq:          { value: 20,   unit: 'mg C/L', label: 'Dissolved inorganic carbon in equilibrium with air (tap-water alkalinity)', status: 'illustrative' },
  co2FreeFraction:{ value: 0.10, unit: 'fraction', label: 'Fraction of DIC that is free CO2 (exchanges with air)', status: 'illustrative' },

  // ---- fish ----
  fishCount:      { value: 8,    unit: 'fish', label: 'Number of goldfish', status: 'illustrative' },
  fishWetG:       { value: 20,   unit: 'g wet', label: 'Starting wet mass of each fish', status: 'illustrative' },
  feedPct:        { value: 1.5,  unit: '% of starting fish wet mass per day', label: 'Daily food (nutrient loading)', status: 'illustrative' },
  fishMaxIngest:  { value: 0.10, unit: 'mg/mg dry/day', label: 'Maximum food a fish can eat per day', status: 'illustrative' },
  fishAEfood:     { value: 0.70, unit: 'fraction', label: 'Assimilation efficiency, food pellets', status: 'illustrative' },
  fishAEalgae:    { value: 0.50, unit: 'fraction', label: 'Assimilation efficiency, algae', status: 'illustrative' },
  fishGraze:      { value: 0.002, unit: '1/day', label: 'Maximum grazing on algae', status: 'illustrative' },
  fishGrazeK:     { value: 5,    unit: 'mg dry/L', label: 'Half-saturation algae density for grazing', status: 'illustrative' },
  fishSDA:        { value: 0.20, unit: 'fraction', label: 'Share of assimilated food spent digesting it (specific dynamic action)', status: 'illustrative' },
  fishResp:       { value: 0.02, unit: '1/day', label: 'Routine respiration (fraction of fish dry mass per day)', status: 'illustrative' },
  fishKO2:        { value: 0.5,  unit: 'mg O2/L', label: 'Half-saturation DO for fish respiration', status: 'literature', source: 'AQUATOX HalfSatO = 0.5 g/m3 (water column)' },
  fishKO2feed:    { value: 1.0,  unit: 'mg O2/L', label: 'DO at which fish appetite is halved', status: 'illustrative' },
  doStress:       { value: 2.0,  unit: 'mg O2/L', label: 'Low-oxygen stress threshold (scenario parameter — species-specific in reality)', status: 'illustrative' },
  hypoxiaMort:    { value: 0.5,  unit: '1/day', label: 'Maximum low-oxygen mortality (reached at DO = 0)', status: 'illustrative' },
  nh3Stress:      { value: 0.10, unit: 'mg NH3-N/L', label: 'Un-ionized ammonia stress threshold', status: 'illustrative' },
  nh3Mort:        { value: 0.30, unit: '1/day', label: 'Maximum ammonia-toxicity mortality', status: 'illustrative' },

  // ---- algae ----
  algae0:         { value: 1.0,  unit: 'mg dry/L', label: 'Starting algae', status: 'illustrative' },
  algaeMu:        { value: 1.6,  unit: '1/day', label: 'Maximum algal photosynthesis rate', status: 'illustrative' },
  algaeKN:        { value: 0.05, unit: 'mg N/L', label: 'Half-saturation, nitrogen (algae)', status: 'illustrative' },
  algaeKP:        { value: 0.01, unit: 'mg P/L', label: 'Half-saturation, phosphorus (algae)', status: 'illustrative' },
  algaeKC:        { value: 0.5,  unit: 'mg C/L', label: 'Half-saturation, inorganic carbon (algae)', status: 'illustrative' },
  algaeKI:        { value: 0.2,  unit: 'relative light', label: 'Half-saturation light (algae)', status: 'illustrative' },
  algaeResp:      { value: 0.08, unit: '1/day', label: 'Algal respiration', status: 'illustrative' },
  algaeMort0:     { value: 0.05, unit: '1/day', label: 'Algal background mortality', status: 'illustrative' },
  algaeMortStress:{ value: 0.30, unit: '1/day', label: 'Extra algal mortality when starved of light or nutrients', status: 'illustrative' },
  lightKw:        { value: 0.5,  unit: '1/m', label: 'Light attenuation by water', status: 'illustrative' },
  lightKa:        { value: 0.3, unit: '(1/m) per mg dry/L', label: 'Light attenuation (self-shading) by algae', status: 'illustrative' },
  nh4Preference:  { value: 2,    unit: '–', label: 'Preference for ammonium over nitrate', status: 'illustrative' },

  // ---- crops (aquaponics) ----
  cropDensity:    { value: 0,    unit: 'fraction of grow bed planted', label: 'Crop planting density', status: 'illustrative' },
  cropCapacity:   { value: 800,  unit: 'mg dry/L at 100 % density', label: 'Maximum crop biomass the grow beds can hold', status: 'illustrative' },
  cropStart:      { value: 0.1,  unit: 'fraction of capacity', label: 'Transplant (starting) biomass', status: 'illustrative' },
  cropMu:         { value: 0.25, unit: '1/day', label: 'Maximum crop net growth rate', status: 'illustrative' },
  cropKN:         { value: 2.0,  unit: 'mg N/L', label: 'Half-saturation, nitrogen (crops)', status: 'illustrative' },
  cropKP:         { value: 0.3,  unit: 'mg P/L', label: 'Half-saturation, phosphorus (crops)', status: 'illustrative' },
  cropKI:         { value: 0.3,  unit: 'relative light', label: 'Half-saturation light (crops)', status: 'illustrative' },
  cropRootResp:   { value: 0.01, unit: '1/day', label: 'Root respiration drawing on water oxygen', status: 'illustrative' },
  cropMort:       { value: 0.003,unit: '1/day', label: 'Root and leaf loss to the water (senescence)', status: 'illustrative' },
  harvestEvery:   { value: 14,   unit: 'days', label: 'Harvest interval (0 = never)', status: 'illustrative' },
  harvestFrac:    { value: 0.40, unit: 'fraction', label: 'Fraction of crop biomass removed at harvest', status: 'illustrative' },
  raftShade:      { value: 0.5,  unit: 'fraction', label: 'Fraction of system water shaded by rafts at 100 % density', status: 'illustrative' },

  // ---- decomposers ----
  bact0:          { value: 2.0,  unit: 'mg dry/L', label: 'Starting decomposer bacteria', status: 'illustrative' },
  bactUptake:     { value: 1.5,  unit: 'mg C per mg dry per day', label: 'Maximum detritus uptake by bacteria', status: 'illustrative' },
  bactKD:         { value: 2.0,  unit: 'mg C/L', label: 'Half-saturation detritus for bacteria', status: 'illustrative' },
  bactBGE:        { value: 0.30, unit: 'fraction', label: 'Bacterial growth efficiency', status: 'illustrative' },
  bactKO2:        { value: 0.5,  unit: 'mg O2/L', label: 'Half-saturation DO for aerobic decomposition', status: 'literature', source: 'AQUATOX HalfSatO = 0.5 g/m3' },
  bactAnaerobic:  { value: 0.25, unit: 'fraction', label: 'Relative speed of decomposition without oxygen', status: 'illustrative' },
  bactResp:       { value: 0.05, unit: '1/day', label: 'Bacterial maintenance respiration', status: 'illustrative' },
  bactMort:       { value: 0.15, unit: '1/day', label: 'Bacterial death / grazing loss', status: 'illustrative' },
  detritusC0:     { value: 3.0,  unit: 'mg C/L', label: 'Starting organic detritus (as carbon)', status: 'illustrative' },

  // ---- nitrogen chemistry / nitrifiers ----
  nh40:           { value: 0.2,  unit: 'mg N/L', label: 'Starting total ammonia nitrogen', status: 'illustrative' },
  no30:           { value: 1.0,  unit: 'mg N/L', label: 'Starting nitrate nitrogen', status: 'illustrative' },
  po40:           { value: 0.05, unit: 'mg P/L', label: 'Starting phosphate phosphorus', status: 'illustrative' },
  nitrMax:        { value: 2.0,  unit: 'mg dry/L', label: 'Maximum nitrifier biofilm (set by surface area of gravel / media)', status: 'illustrative' },
  nitrMaturity:   { value: 0.7,  unit: 'fraction of maximum', label: 'Starting nitrifier biofilm (0.05 = brand-new tank)', status: 'illustrative' },
  nitrRate:       { value: 0.6,  unit: 'mg N per mg dry per day', label: 'Maximum nitrification rate per nitrifier mass', status: 'illustrative' },
  nitrKNH4:       { value: 0.5,  unit: 'mg N/L', label: 'Half-saturation ammonia for nitrification', status: 'illustrative' },
  nitrKO2:        { value: 1.0,  unit: 'mg O2/L', label: 'Half-saturation DO for nitrification (nitrifiers need oxygen)', status: 'illustrative' },
  nitrYield:      { value: 0.15, unit: 'mg dry per mg N', label: 'Nitrifier growth yield (very low)', status: 'illustrative' },
  nitrMort:       { value: 0.02, unit: '1/day', label: 'Nitrifier loss', status: 'illustrative' },
  denitRate:      { value: 0.3,  unit: '1/day', label: 'Maximum denitrification rate', status: 'illustrative' },
  denitKO2:       { value: 0.5,  unit: 'mg O2/L', label: 'DO that halves denitrification', status: 'illustrative' },
  anoxicFraction: { value: 0.03, unit: 'fraction', label: 'Anoxic micro-sites in gravel/media (allow some denitrification)', status: 'illustrative' },

  // ---- management ----
  waterChangePct: { value: 0,    unit: '% per week', label: 'Weekly partial water change', status: 'illustrative' },
  fertN:          { value: 0,    unit: 'mg N/L/day', label: 'Extra nitrate fertilizer input', status: 'illustrative' },
  fertP:          { value: 0,    unit: 'mg P/L/day', label: 'Extra phosphate fertilizer input', status: 'illustrative' },
  stepsPerDay:    { value: 24,   unit: 'steps', label: 'Numerical time steps per day (hourly)', status: 'illustrative' },
};

export function defaultParameters() {
  const p = {};
  for (const [k, v] of Object.entries(PARAMETER_INFO)) p[k] = v.value;
  return p;
}
