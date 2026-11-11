/**
 * oxygen.js — dissolved-oxygen physics.
 *
 * Saturation: Benson & Krause (1980, 1984) freshwater equation at 1 atm, the method adopted by
 * USGS (Office of Water Quality Technical Memorandum 2011.03; DOTABLES) and cited by Standard Methods.
 *   ln C* = -139.34411 + 1.575701e5/T - 6.642308e7/T^2 + 1.243800e10/T^3 - 8.621949e11/T^4
 *   (C* in mg/L, T in kelvin, salinity 0, pressure 1 atm)
 *
 * Reaeration (atmospheric exchange): first-order relaxation toward saturation,
 *   flux = K_reaer * theta^(T-20) * (C* - DO)      [AQUATOX 3.2 Tech. Doc. eq. 191, p.186]
 * with temperature coefficient theta = 1.024 [AQUATOX 3.2 Tech. Doc. eq. 198, p.188].
 * K_reaer values for the "aeration" setting are ILLUSTRATIVE, not measured for any real tank.
 */

export function oxygenSaturation(tempC) {
  const T = tempC + 273.15;
  const lnC = -139.34411 + 1.575701e5 / T - 6.642308e7 / T ** 2 + 1.2438e10 / T ** 3 - 8.621949e11 / T ** 4;
  return Math.exp(lnC);
}

export const REAERATION_THETA = 1.024;

export function reaerationRate(kReaer20, tempC) {
  return kReaer20 * Math.pow(REAERATION_THETA, tempC - 20);
}

/** Monod-style oxygen limitation of aerobic respiration (0..1). AQUATOX uses a similar
 * Michaelis-Menten DO term with a half-saturation of 0.5 g/m3 in the water column. */
export function oxygenLimitation(doMgL, halfSat) {
  const d = Math.max(0, doMgL);
  return d / (halfSat + d);
}

/** Aeration presets (per day at 20 °C). ILLUSTRATIVE. */
export const AERATION_PRESETS = {
  none:   { k: 0.8,  label: 'None — still water surface' },
  gentle: { k: 3.0,  label: 'Gentle — filter outflow ripples the surface' },
  strong: { k: 12.0, label: 'Strong — air pump and air stone' },
};
