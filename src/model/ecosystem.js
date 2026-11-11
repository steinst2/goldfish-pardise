/**
 * ecosystem.js — the Goldfish Paradise classroom ecosystem engine.
 *
 * DESIGN
 *  • Every living and non-living pool is a concentration in the system water:
 *      organisms   mg dry mass / L     (fish, algae, crop, bact, nitr)
 *      detritus    mg C, mg N, mg P / L (detC, detN, detP — tracked separately so that
 *                                         dead material keeps the composition of its source)
 *      dissolved   nh4 (mg N/L, total ammonia N), no3 (mg N/L), po4 (mg P/L),
 *                  do (mg O2/L), dic (mg C/L, dissolved inorganic carbon: CO2 + bicarbonate)
 *  • Every process is written as a stoichiometric "reaction": what it removes from and adds to
 *    pools. Because each reaction conserves C, N and P by construction (with explicit
 *    accounting pools for inputs and exports such as feed, N2 gas, harvest, water changes),
 *    the model's nutrient mass balance can be checked to round-off error.
 *  • Time stepping: explicit Euler, hourly by default (stepsPerDay = 24), so that light, and
 *    therefore dissolved oxygen, swings between day and night.
 *  • Non-negativity: before fluxes are applied, any process that would remove more of a pool
 *    than exists is scaled down (a "flux limiter"). No pool can become negative, and no mass
 *    is created or destroyed by the limiter.
 *
 * This is a simplified TEACHING model informed by AQUATOX (US EPA) process formulations. It is
 * NOT an implementation of AQUATOX and it is NOT calibrated to any real tank or water body.
 */

import { STOICH, O2_PER_C, O2_PER_N_NITRIFIED, C_PER_N_DENITRIFIED, KJ_PER_MG_DRY, ORGANISM_POOLS, FISH_DRY_FRACTION, CARBON_FRACTION } from './organisms.js';
import { oxygenSaturation, reaerationRate, oxygenLimitation } from './oxygen.js';
import { monod, nutrientLimitation, unionizedAmmoniaFraction, ammoniumShare } from './nutrients.js';

export const STATE_POOLS = ['fish', 'algae', 'crop', 'bact', 'nitr', 'detC', 'detN', 'detP', 'nh4', 'no3', 'po4', 'do', 'dic'];

const ACC_KEYS = [
  'inFeedC', 'inFeedN', 'inFeedP', 'inFertN', 'inFertP',
  'atmC', 'cropAirC', 'outN2', 'harvC', 'harvN', 'harvP',
  'wcOutC', 'wcOutN', 'wcOutP', 'wcInC', 'wcO2',
  'o2Reaer', 'o2Photo', 'o2AlgaeResp', 'o2FishResp', 'o2BactResp', 'o2Nitrif', 'o2Root',
  'deathHypoxia', 'deathAmmonia',
  'eFoodOffered', 'eFishIngest', 'eFishFromAlgae', 'eFishProd', 'eGPPalgae', 'eNPPcrop',
  'eHeatFish', 'eHeatAlgae', 'eHeatBact', 'eHeatCropRoot', 'eHarvest',
  'nitrified', 'denitrified', 'mineralizedN', 'algaeUptakeN', 'cropUptakeN', 'fishExcretedN',
  'algaeUptakeP', 'cropUptakeP', 'gppC', 'respC', 'decompC',
  'toDetN', 'toDetC', 'toDetN_fish', 'toDetN_algae', 'toDetN_microbe', 'toDetN_crop', 'algaeLossC', 'fishGrowN',
  'clampResidual',
];

/** Build the initial state from parameters. */
export function initialState(p) {
  const fishDryG = p.fishCount * p.fishWetG * FISH_DRY_FRACTION;
  const fish = (fishDryG * 1000) / p.volumeL; // mg dry / L
  const cropCap = p.cropCapacity * p.cropDensity;
  const s = {
    fish,
    algae: p.algae0,
    crop: cropCap > 0 ? cropCap * p.cropStart : 0,
    bact: p.bact0,
    nitr: p.nitrMax * p.nitrMaturity,
    detC: p.detritusC0,
    detN: p.detritusC0 * (STOICH.food.n / STOICH.food.c),
    detP: p.detritusC0 * (STOICH.food.p / STOICH.food.c),
    nh4: p.nh40,
    no3: p.no30,
    po4: p.po40,
    do: oxygenSaturation(p.tempC),
    dic: p.dicEq,
  };
  return s;
}

export function zeroAccounts() {
  const a = {};
  for (const k of ACC_KEYS) a[k] = 0;
  return a;
}

/** Total C, N, P held inside the system (all pools). mg per L. */
export function elementTotals(s) {
  let C = s.detC + s.dic, N = s.detN + s.nh4 + s.no3, P = s.detP + s.po4;
  for (const k of ORGANISM_POOLS) {
    C += s[k] * STOICH[k].c;
    N += s[k] * STOICH[k].n;
    P += s[k] * STOICH[k].p;
  }
  return { C, N, P };
}

/** Net external input minus export so far, per element (mg/L). */
export function netExternal(acc) {
  return {
    N: acc.inFeedN + acc.inFertN - acc.outN2 - acc.harvN - acc.wcOutN,
    P: acc.inFeedP + acc.inFertP - acc.harvP - acc.wcOutP,
    C: acc.inFeedC + acc.atmC + acc.cropAirC + acc.wcInC - acc.harvC - acc.wcOutC,
  };
}

/** Relative light at the water surface for hour h (0..24) of a day. */
export function surfaceLight(h, p) {
  const sunrise = 12 - p.photoperiodH / 2;
  const t = (h - sunrise) / p.photoperiodH;
  if (t <= 0 || t >= 1) return 0;
  return p.light * Math.sin(Math.PI * t);
}

function lightResponse(I, K) {
  // saturating response normalised so that f(1) = 1
  return I <= 0 ? 0 : (I * (1 + K)) / (I + K);
}

/** Mean algal light factor on a clear, unshaded day at full light (reference for stress). */
function referenceLightFactor(p) {
  let sum = 0;
  const n = 96;
  const pp = { ...p, light: 1 };
  for (let i = 0; i < n; i++) sum += lightResponse(surfaceLight((i + 0.5) * 24 / n, pp), p.algaeKI);
  return sum / n;
}

const DETRITUS_SOURCE = {
  uneatenFood: 'fish', fishMetabolism: 'fish', fishMortality: 'fish',
  algaeMortality: 'algae', cropSenescence: 'crop',
  bacteriaMortality: 'microbe', nitrifierLoss: 'microbe',
};

/** Apply a list of reactions with a mass-conserving flux limiter. */
function applyReactions(state, acc, reactions) {
  const demand = {};
  for (const r of reactions) {
    for (const k in r.d) if (r.d[k] < 0) demand[k] = (demand[k] || 0) - r.d[k];
  }
  const poolScale = {};
  for (const k in demand) {
    const avail = Math.max(0, state[k]);
    poolScale[k] = demand[k] > avail ? avail / demand[k] : 1;
  }
  for (const r of reactions) {
    let s = 1;
    for (const k in r.d) if (r.d[k] < 0 && poolScale[k] < s) s = poolScale[k];
    r.scale = s;
  }
  for (const r of reactions) {
    const s = r.scale;
    if (s === 0) continue;
    for (const k in r.d) state[k] += r.d[k] * s;
    if (r.acc) for (const k in r.acc) acc[k] += r.acc[k] * s;
    // generic flow tracking for the matter-cycle diagrams
    if (r.d.detN > 0) {
      acc.toDetN += r.d.detN * s;
      acc['toDetN_' + (DETRITUS_SOURCE[r.name] || 'microbe')] += r.d.detN * s;
    }
    if (r.d.detC > 0) acc.toDetC += r.d.detC * s;
    if (r.d.algae < 0 && r.name !== 'algaeRespiration') acc.algaeLossC += -r.d.algae * STOICH.algae.c * s;
  }
  // Round-off guard: tiny negatives (≈1e-15) are set to zero and recorded so closure is exact.
  for (const k of STATE_POOLS) {
    if (state[k] < 0) { acc.clampResidual += -state[k]; state[k] = 0; }
  }
}

/** Build the hourly reactions. Returns {reactions, diag}. */
function buildReactions(s, p, env) {
  const dt = env.dt;
  const tf = env.tf;
  const R = [];
  const A = STOICH.algae, F = STOICH.fish, Cr = STOICH.crop, B = STOICH.bact, Nb = STOICH.nitr, Fd = STOICH.food;
  const din = s.nh4 + s.no3;
  const shareNH4 = ammoniumShare(s.nh4, s.no3, p.nh4Preference);
  const diag = {};

  // ---------- ALGAE: photosynthesis (Monod + Liebig), respiration, mortality ----------
  const kz = (p.lightKw + p.lightKa * s.algae) * p.depthM;
  const selfShade = kz > 1e-9 ? (1 - Math.exp(-kz)) / kz : 1;
  const raftShade = p.raftShade * p.cropDensity;
  const Iw = env.I * (1 - raftShade) * selfShade;
  const fL = lightResponse(Iw, p.algaeKI);
  const nl = nutrientLimitation(din, s.po4, s.dic, p.algaeKN, p.algaeKP, p.algaeKC);
  const gpp = p.algaeMu * tf * fL * nl.lim * s.algae * dt; // mg dry / L this step
  diag.fL = fL; diag.fN = nl.fN; diag.fP = nl.fP; diag.fC = nl.fC; diag.limiting = nl.limiting;
  if (gpp > 0) {
    const nUp = A.n * gpp;
    R.push({ name: 'algaePhotosynthesis',
      d: { algae: gpp, dic: -A.c * gpp, nh4: -nUp * shareNH4, no3: -nUp * (1 - shareNH4), po4: -A.p * gpp, do: O2_PER_C * A.c * gpp },
      acc: { o2Photo: O2_PER_C * A.c * gpp, eGPPalgae: KJ_PER_MG_DRY * gpp, algaeUptakeN: nUp, algaeUptakeP: A.p * gpp, gppC: A.c * gpp } });
  }
  const fO2 = oxygenLimitation(s.do, p.fishKO2);
  const ra = p.algaeResp * tf * s.algae * fO2 * dt;
  if (ra > 0) R.push({ name: 'algaeRespiration',
    d: { algae: -ra, dic: A.c * ra, do: -O2_PER_C * A.c * ra, nh4: A.n * ra, po4: A.p * ra },
    acc: { o2AlgaeResp: O2_PER_C * A.c * ra, eHeatAlgae: KJ_PER_MG_DRY * ra, respC: A.c * ra, mineralizedN: A.n * ra } });
  const lightRatio = env.refFL > 0 ? Math.min(1, env.emaFL / env.refFL) : 1;
  const stress = 1 - Math.min(1, nl.lim * lightRatio);
  const ma = (p.algaeMort0 + p.algaeMortStress * stress) * s.algae * dt;
  if (ma > 0) R.push({ name: 'algaeMortality', d: { algae: -ma, detC: A.c * ma, detN: A.n * ma, detP: A.p * ma } });

  // ---------- CROPS (aquaponics): net growth from water nutrients, CO2 from the air ----------
  const cap = p.cropCapacity * p.cropDensity;
  if (cap > 0 && s.crop > 0) {
    const fLc = lightResponse(env.I, p.cropKI);
    const cl = nutrientLimitation(din, s.po4, 0, p.cropKN, p.cropKP, 0);
    const space = Math.max(0, 1 - s.crop / cap);
    const npp = p.cropMu * tf * fLc * cl.lim * s.crop * space * dt;
    diag.cropLim = cl.limiting; diag.cropFN = cl.fN; diag.cropFP = cl.fP;
    if (npp > 0) {
      const nUp = Cr.n * npp;
      R.push({ name: 'cropGrowth',
        d: { crop: npp, nh4: -nUp * shareNH4, no3: -nUp * (1 - shareNH4), po4: -Cr.p * npp },
        acc: { cropAirC: Cr.c * npp, eNPPcrop: KJ_PER_MG_DRY * npp, cropUptakeN: nUp, cropUptakeP: Cr.p * npp } });
    }
    const rr = p.cropRootResp * tf * s.crop * fO2 * dt; // carbohydrate burned by roots (fixed from air)
    if (rr > 0) R.push({ name: 'cropRootRespiration',
      d: { dic: Cr.c * rr, do: -O2_PER_C * Cr.c * rr },
      acc: { cropAirC: Cr.c * rr, o2Root: O2_PER_C * Cr.c * rr, eHeatCropRoot: KJ_PER_MG_DRY * rr } });
    const mc = p.cropMort * s.crop * dt;
    if (mc > 0) R.push({ name: 'cropSenescence', d: { crop: -mc, detC: Cr.c * mc, detN: Cr.n * mc, detP: Cr.p * mc } });
  }

  // ---------- FISH: feeding, grazing, assimilation, growth, excretion, respiration ----------
  // The owner feeds a fixed daily ration based on the starting fish mass, but stops feeding
  // fish that are no longer there: ration scales down if fish biomass falls below the start.
  const offered = env.feedRate * Math.min(1, s.fish / env.fish0) * dt; // mg dry food / L this step
  if (offered > 0) {
    const appetite = oxygenLimitation(s.do, p.fishKO2feed);
    const eatCap = p.fishMaxIngest * s.fish * appetite * dt;
    const eaten = Math.min(offered, eatCap);
    const uneaten = offered - eaten;
    // Uneaten food sinks as detritus.
    R.push({ name: 'uneatenFood',
      d: { detC: Fd.c * uneaten, detN: Fd.n * uneaten, detP: Fd.p * uneaten },
      acc: { inFeedC: Fd.c * uneaten, inFeedN: Fd.n * uneaten, inFeedP: Fd.p * uneaten, eFoodOffered: KJ_PER_MG_DRY * uneaten } });
    env.eaten = eaten;
  } else env.eaten = 0;
  if (s.fish > 0) {
    const eaten = env.eaten;
    const graze = p.fishGraze * tf * s.fish * (s.algae / (p.fishGrazeK + s.algae)) * fO2 * dt;
    const Xa = p.fishAEfood * eaten + p.fishAEalgae * graze;
    const Na = p.fishAEfood * Fd.n * eaten + p.fishAEalgae * A.n * graze;
    const Pa = p.fishAEfood * Fd.p * eaten + p.fishAEalgae * A.p * graze;
    const feces = { C: (1 - p.fishAEfood) * Fd.c * eaten + (1 - p.fishAEalgae) * A.c * graze,
                    N: (1 - p.fishAEfood) * Fd.n * eaten + (1 - p.fishAEalgae) * A.n * graze,
                    P: (1 - p.fishAEfood) * Fd.p * eaten + (1 - p.fishAEalgae) * A.p * graze };
    const basal = p.fishResp * tf * s.fish * fO2 * dt;
    const carbonLimited = Xa - p.fishSDA * Xa - basal;
    let growth = carbonLimited;
    if (carbonLimited > 0) growth = Math.min(carbonLimited, Na / F.n, Pa / F.p);
    const respired = Xa - growth; // all assimilated matter not built into tissue is respired
    const exN = Na - F.n * growth, exP = Pa - F.p * growth;
    R.push({ name: 'fishMetabolism',
      d: { fish: growth, algae: -graze, dic: F.c * respired, do: -O2_PER_C * F.c * respired,
           nh4: exN, po4: exP, detC: feces.C, detN: feces.N, detP: feces.P },
      acc: { inFeedC: Fd.c * eaten, inFeedN: Fd.n * eaten, inFeedP: Fd.p * eaten,
             eFoodOffered: KJ_PER_MG_DRY * eaten, eFishIngest: KJ_PER_MG_DRY * (eaten + graze),
             eFishFromAlgae: KJ_PER_MG_DRY * graze, eFishProd: KJ_PER_MG_DRY * growth,
             eHeatFish: KJ_PER_MG_DRY * respired, o2FishResp: O2_PER_C * F.c * respired,
             fishExcretedN: exN, respC: F.c * respired, fishGrowN: F.n * growth } });
    // Mortality from low oxygen and un-ionized ammonia.
    const nh3 = s.nh4 * env.fNH3;
    let mh = 0, mt = 0;
    if (s.do < p.doStress && p.doStress > 0) mh = p.hypoxiaMort * (1 - s.do / p.doStress);
    if (nh3 > p.nh3Stress && p.nh3Stress > 0) mt = p.nh3Mort * Math.min(1, nh3 / p.nh3Stress - 1);
    const deadH = mh * s.fish * dt, deadT = mt * s.fish * dt;
    const dead = deadH + deadT;
    if (dead > 0) R.push({ name: 'fishMortality',
      d: { fish: -dead, detC: F.c * dead, detN: F.n * dead, detP: F.p * dead },
      acc: { deathHypoxia: deadH, deathAmmonia: deadT } });
  }

  // ---------- DECOMPOSERS: detritus -> bacteria + CO2 + mineral N, P ----------
  if (s.bact > 0 && s.detC > 0) {
    const aer = oxygenLimitation(s.do, p.bactKO2);
    const speed = aer + p.bactAnaerobic * (1 - aer);
    const U = p.bactUptake * tf * s.bact * monod(s.detC, p.bactKD) * speed * dt; // mg C
    const rN = s.detN / s.detC, rP = s.detP / s.detC;
    const growth = (p.bactBGE * U) / B.c;
    const respC = U - B.c * growth;
    const aerShare = speed > 0 ? aer / speed : 0;
    const minN = U * rN - B.n * growth, minP = U * rP - B.p * growth;
    R.push({ name: 'decomposition',
      d: { detC: -U, detN: -U * rN, detP: -U * rP, bact: growth, dic: respC, do: -O2_PER_C * respC * aerShare, nh4: minN, po4: minP },
      acc: { o2BactResp: O2_PER_C * respC * aerShare, eHeatBact: (KJ_PER_MG_DRY / CARBON_FRACTION) * respC, mineralizedN: minN, decompC: U, respC } });
  }
  if (s.bact > 0) {
    const aer = oxygenLimitation(s.do, p.bactKO2);
    const rb = p.bactResp * tf * s.bact * aer * dt;
    if (rb > 0) R.push({ name: 'bacteriaRespiration',
      d: { bact: -rb, dic: B.c * rb, do: -O2_PER_C * B.c * rb, nh4: B.n * rb, po4: B.p * rb },
      acc: { o2BactResp: O2_PER_C * B.c * rb, eHeatBact: KJ_PER_MG_DRY * rb, mineralizedN: B.n * rb, respC: B.c * rb } });
    const mb = p.bactMort * s.bact * dt;
    if (mb > 0) R.push({ name: 'bacteriaMortality', d: { bact: -mb, detC: B.c * mb, detN: B.n * mb, detP: B.p * mb } });
  }

  // ---------- NITRIFICATION: NH4+ -> NO3- (a transformation, NOT a removal) ----------
  if (s.nitr > 0 && s.nh4 > 0) {
    const nit = p.nitrRate * tf * s.nitr * monod(s.nh4, p.nitrKNH4) * oxygenLimitation(s.do, p.nitrKO2) * dt; // mg N oxidized
    const gN = p.nitrYield * nit * Math.max(0, 1 - s.nitr / Math.max(1e-9, p.nitrMax));
    R.push({ name: 'nitrification',
      d: { nh4: -nit - Nb.n * gN, no3: nit, do: -O2_PER_N_NITRIFIED * nit, nitr: gN, dic: -Nb.c * gN, po4: -Nb.p * gN },
      acc: { o2Nitrif: O2_PER_N_NITRIFIED * nit, nitrified: nit } });
  }
  if (s.nitr > 0) {
    const mn = p.nitrMort * s.nitr * dt;
    R.push({ name: 'nitrifierLoss', d: { nitr: -mn, detC: Nb.c * mn, detN: Nb.n * mn, detP: Nb.p * mn } });
  }

  // ---------- DENITRIFICATION: NO3- -> N2 gas (a true removal), needs low O2 + organic C ----------
  if (s.no3 > 0 && s.detC > 0) {
    const anox = Math.max(1 - oxygenLimitation(s.do, p.denitKO2), p.anoxicFraction);
    const dn = p.denitRate * tf * s.no3 * anox * monod(s.detC, p.bactKD) * dt; // mg N
    const cUse = C_PER_N_DENITRIFIED * dn;
    const rN = s.detN / s.detC, rP = s.detP / s.detC;
    R.push({ name: 'denitrification',
      d: { no3: -dn, detC: -cUse, detN: -cUse * rN, detP: -cUse * rP, nh4: cUse * rN, po4: cUse * rP, dic: cUse },
      acc: { outN2: dn, denitrified: dn, mineralizedN: cUse * rN, decompC: cUse, respC: cUse } });
  }

  // ---------- ATMOSPHERIC EXCHANGE: O2 reaeration and CO2 exchange ----------
  const reaer = env.kReaer * (env.doSat - s.do) * dt;
  R.push({ name: 'reaeration', d: { do: reaer }, acc: { o2Reaer: reaer } });
  const co2x = env.kReaer * 0.9 * p.co2FreeFraction * (p.dicEq - s.dic) * dt;
  R.push({ name: 'co2Exchange', d: { dic: co2x }, acc: { atmC: co2x } });

  // ---------- OPTIONAL FERTILIZER INPUT ----------
  if (p.fertN > 0 || p.fertP > 0) R.push({ name: 'fertilizer', d: { no3: p.fertN * dt, po4: p.fertP * dt }, acc: { inFertN: p.fertN * dt, inFertP: p.fertP * dt } });

  diag.nh3 = s.nh4 * env.fNH3;
  return { reactions: R, diag };
}

function harvest(s, acc, p) {
  if (s.crop <= 0) return 0;
  const h = s.crop * p.harvestFrac;
  s.crop -= h;
  const C = STOICH.crop;
  acc.harvC += C.c * h; acc.harvN += C.n * h; acc.harvP += C.p * h;
  acc.eHarvest += KJ_PER_MG_DRY * h;
  return h;
}

function waterChange(s, acc, p, doSat) {
  const w = p.waterChangePct / 100;
  if (w <= 0) return;
  acc.wcOutN += w * (s.nh4 + s.no3 + s.detN);
  acc.wcOutP += w * (s.po4 + s.detP);
  acc.wcOutC += w * (s.dic + s.detC);
  acc.wcInC += w * p.dicEq;
  acc.wcO2 += w * (doSat - s.do);
  for (const k of ['nh4', 'no3', 'po4', 'detC', 'detN', 'detP']) s[k] *= (1 - w);
  s.dic = s.dic * (1 - w) + w * p.dicEq;
  s.do = s.do * (1 - w) + w * doSat;
}

/**
 * Run a simulation.
 * @param {object} p parameters (see parameters.js; scenario functions fill them in)
 * @param {number} days simulation length
 * @returns {{params, days:Array, final, acc, initialTotals, scenario}}
 */
export function simulate(p, days, meta = {}) {
  const s = initialState(p);
  const acc = zeroAccounts();
  const steps = Math.max(1, Math.round(p.stepsPerDay));
  const dt = 1 / steps;
  const doSat = oxygenSaturation(p.tempC);
  const env = {
    dt,
    tf: Math.pow(p.thetaBio, p.tempC - 20),
    kReaer: reaerationRate(p.kReaer, p.tempC),
    doSat,
    fNH3: unionizedAmmoniaFraction(p.tempC, p.pH),
    feedRate: (p.feedPct / 100) * p.fishCount * p.fishWetG * 1000 / p.volumeL, // mg dry food / L / day
    refFL: referenceLightFactor(p),
    fish0: Math.max(1e-9, s.fish),
    emaFL: 0,
    I: 0,
  };
  env.emaFL = env.refFL * p.light; // start the running light memory near typical conditions
  const totals0 = elementTotals(s);
  const records = [snapshot(0, s, acc, p, { doMin: s.do, doMax: s.do, doMean: s.do, harvested: 0 })];
  const photoSteps = [];
  let lastDiag = {};

  for (let day = 1; day <= days; day++) {
    let doMin = Infinity, doMax = -Infinity, doSum = 0;
    let fLs = 0, fNs = 0, fPs = 0, fCs = 0, nLight = 0;
    const limCount = { light: 0, N: 0, P: 0, C: 0 };
    for (let k = 0; k < steps; k++) {
      const h = (k + 0.5) * dt * 24;
      env.I = surfaceLight(h, p);
      // feed is given during daylight hours only (spread evenly)
      const sunrise = 12 - p.photoperiodH / 2;
      const daylight = h > sunrise && h < sunrise + p.photoperiodH;
      const feedSave = env.feedRate;
      env.feedRate = daylight ? feedSave * 24 / p.photoperiodH : 0;
      const { reactions, diag } = buildReactions(s, p, env);
      env.feedRate = feedSave;
      applyReactions(s, acc, reactions);
      // running mean of algal light factor (time constant ≈ 2 days)
      env.emaFL += (diag.fL - env.emaFL) * (dt / 2);
      lastDiag = diag;
      doMin = Math.min(doMin, s.do); doMax = Math.max(doMax, s.do); doSum += s.do;
      if (env.I > 0) {
        fLs += diag.fL; fNs += diag.fN; fPs += diag.fP; fCs += diag.fC; nLight++;
        const m = Math.min(diag.fL, diag.fN, diag.fP, diag.fC);
        if (m === diag.fL) limCount.light++; else if (m === diag.fN) limCount.N++; else if (m === diag.fP) limCount.P++; else limCount.C++;
      }
    }
    let harvested = 0;
    if (p.harvestEvery > 0 && day % p.harvestEvery === 0) harvested = harvest(s, acc, p);
    if (p.waterChangePct > 0 && day % 7 === 0) waterChange(s, acc, p, doSat);
    const lf = nLight ? { fL: fLs / nLight, fN: fNs / nLight, fP: fPs / nLight, fC: fCs / nLight } : { fL: 0, fN: 0, fP: 0, fC: 0 };
    let limiting = 'light', best = -1;
    for (const [k, v] of Object.entries(limCount)) if (v > best) { best = v; limiting = k; }
    records.push(snapshot(day, s, acc, p, { doMin, doMax, doMean: doSum / steps, harvested, ...lf, limiting, nh3: lastDiag.nh3 ?? 0, cropLim: lastDiag.cropLim }));
  }
  return { params: { ...p }, days: records, final: { ...s }, acc: { ...acc }, initialTotals: totals0, doSat, meta };
}

function snapshot(day, s, acc, p, extra) {
  const t = elementTotals(s);
  return {
    day, ...s, ...extra,
    din: s.nh4 + s.no3,
    totalN: t.N, totalP: t.P, totalC: t.C,
    // Chlorophyll-a estimate (µg/L) from algal carbon using the carbon : chlorophyll-a ratio of
    // 28 µg C per µg chl-a that AQUATOX 3.1 uses for non-cyanobacterial phytoplankton.
    chlEstimate: (s.algae * CARBON_FRACTION * 1000) / 28,
    // What a water SAMPLE would contain (fish, crops and attached nitrifier biofilm excluded):
    waterTotalN: s.nh4 + s.no3 + s.detN + s.algae * STOICH.algae.n + s.bact * STOICH.bact.n,
    waterTotalP: s.po4 + s.detP + s.algae * STOICH.algae.p + s.bact * STOICH.bact.p,
    dissolvedP: s.po4,
    acc: { ...acc },
  };
}

export const PROCESS_NOTES = {
  nitrification: 'Transforms ammonium into nitrate. Nitrogen stays in the water; only its chemical form changes.',
  denitrification: 'Converts nitrate to N2 gas, which leaves the water. This is a true nitrogen removal.',
};
