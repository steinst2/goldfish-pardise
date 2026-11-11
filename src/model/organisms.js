/**
 * organisms.js — fixed stoichiometry (elemental composition) of every organic pool.
 *
 * All organisms are tracked as DRY MASS (mg dry weight per litre of system water).
 * Each organism type has a fixed fraction of carbon (C), nitrogen (N) and phosphorus (P)
 * by dry weight. Fixed ("Redfield-style") stoichiometry is a simplification: real organisms
 * vary their N and P content (see Droop quota models, docs/MODEL_CARD.md §Future work).
 *
 * Sources / status of each value are documented in docs/MODEL_CARD.md (Parameter table).
 *   - Algae N 0.059 and P 0.007: AQUATOX Release 3.2 Technical Documentation, Table 13
 *     (default phytoplankton dry-weight fractions), Park & Clough 2018, EPA/600/B-18/241.
 *   - Carbon fraction 0.50 for all organic matter: ILLUSTRATIVE round value
 *     (organic matter is typically ~45–53 % carbon by dry mass).
 *   - Fish, crop, bacteria and food fractions: ILLUSTRATIVE teaching values chosen to be
 *     biologically plausible (protein-rich fish and bacteria, N-rich fish food).
 */

export const CARBON_FRACTION = 0.5; // g C per g dry mass (illustrative, all organic pools)

/** Oxygen used per gram of organic carbon respired (O2 : C mass ratio, 32/12).
 * Equivalent to a respiratory/photosynthetic quotient of 1.0 (CH2O + O2 -> CO2 + H2O). */
export const O2_PER_C = 32 / 12;

/** Oxygen consumed per gram of ammonium-N oxidized to nitrate (NH4+ + 2 O2 -> NO3- + 2H+ + H2O).
 * 64/14 = 4.57 g O2 per g N — standard nitrification stoichiometry. */
export const O2_PER_N_NITRIFIED = 64 / 14;

/** Organic carbon consumed per gram nitrate-N denitrified
 * (5 CH2O + 4 NO3- -> 2 N2 + 5 CO2 ...: 60 g C per 56 g N ≈ 1.07). */
export const C_PER_N_DENITRIFIED = 60 / 56;

/** Chemical energy content of organic dry matter (kJ per mg dry mass).
 * ~20 kJ per gram dry mass is a commonly used approximate value for biomass. ILLUSTRATIVE. */
export const KJ_PER_MG_DRY = 0.020;

export const STOICH = {
  fish:     { c: CARBON_FRACTION, n: 0.100, p: 0.025, label: 'Goldfish' },
  algae:    { c: CARBON_FRACTION, n: 0.059, p: 0.007, label: 'Algae (phytoplankton)' },
  crop:     { c: CARBON_FRACTION, n: 0.045, p: 0.007, label: 'Crop plants' },
  bact:     { c: CARBON_FRACTION, n: 0.100, p: 0.020, label: 'Decomposer bacteria' },
  nitr:     { c: CARBON_FRACTION, n: 0.100, p: 0.020, label: 'Nitrifying bacteria' },
  food:     { c: CARBON_FRACTION, n: 0.070, p: 0.012, label: 'Fish food pellets' },
};

export const ORGANISM_POOLS = ['fish', 'algae', 'crop', 'bact', 'nitr'];

/** Wet-to-dry mass ratio used ONLY to convert the student's "number of fish" into dry mass
 * (fish are roughly 75 % water). ILLUSTRATIVE. */
export const FISH_DRY_FRACTION = 0.25;
