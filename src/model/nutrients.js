/**
 * nutrients.js — nutrient limitation and ammonia chemistry.
 *
 * Producer growth uses Monod (Michaelis–Menten) saturation for each resource and Liebig's law
 * of the minimum to combine them:
 *     f_N = N / (K_N + N),  f_P = P / (K_P + P),  f_C = C / (K_C + C)
 *     f_limitation = min(f_N, f_P, f_C)
 * This is the same structure AQUATOX 3.2 uses for algae (Tech. Doc. eqs. 52–56: NutrLimit =
 * min(PLimit, NLimit, CLimit)). Legović & Cruzado (1997, Ecol. Model. 99:19–31,
 * doi:10.1016/S0304-3800(96)01919-9) combine Monod UPTAKE with Droop growth on internal
 * quotas and Liebig's law; our teaching model drops the internal quota (growth responds
 * directly to dissolved nutrients). The half-saturation constants are ILLUSTRATIVE.
 */

export function monod(x, k) {
  const v = Math.max(0, x);
  return v / (k + v);
}

/**
 * @returns {{fN:number,fP:number,fC:number,lim:number,limiting:'N'|'P'|'C'}}
 */
export function nutrientLimitation(din, srp, dic, kN, kP, kC = 0) {
  const fN = monod(din, kN);
  const fP = monod(srp, kP);
  const fC = kC > 0 ? monod(dic, kC) : 1;
  let lim = fN, limiting = 'N';
  if (fP < lim) { lim = fP; limiting = 'P'; }
  if (fC < lim) { lim = fC; limiting = 'C'; }
  return { fN, fP, fC, lim, limiting };
}

/**
 * Fraction of total ammonia nitrogen present as un-ionized NH3 (the form most toxic to fish).
 * Emerson, Russo, Lund & Thurston (1975) J. Fish. Res. Board Can. 32:2379–2383:
 *    pKa = 0.09018 + 2729.92 / T(K);   f = 1 / (1 + 10^(pKa - pH))
 */
export function unionizedAmmoniaFraction(tempC, pH) {
  const pKa = 0.09018 + 2729.92 / (tempC + 273.15);
  return 1 / (1 + Math.pow(10, pKa - pH));
}

/** Split an N uptake demand between ammonium and nitrate with a preference for ammonium. */
export function ammoniumShare(nh4, no3, preference = 2) {
  const a = Math.max(0, nh4) * preference;
  const b = Math.max(0, no3);
  return a + b > 0 ? a / (a + b) : 0.5;
}
