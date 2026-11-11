/**
 * carbon.js — carbon accounting helpers.
 *
 * CARBON CYCLES; ENERGY FLOWS. Carbon atoms move from dissolved CO2 into biomass by
 * photosynthesis, into other organisms by eating, into detritus by death, and back to CO2 by
 * respiration and decomposition — the same atoms can be used again. Energy does not cycle:
 * see energy.js.
 */
import { STOICH, ORGANISM_POOLS } from './organisms.js';

/** Where the system's carbon is stored at one moment (mg C/L). */
export function carbonPools(rec) {
  const out = { dic: rec.dic, detritus: rec.detC };
  for (const k of ORGANISM_POOLS) out[k] = rec[k] * STOICH[k].c;
  out.organic = out.detritus + ORGANISM_POOLS.reduce((a, k) => a + out[k], 0);
  out.total = out.organic + out.dic;
  return out;
}

/** Cumulative carbon budget between the start and a record (mg C/L). */
export function carbonBudget(run, rec = run.days[run.days.length - 1]) {
  const a = rec.acc;
  const start = carbonPools(run.days[0]);
  const end = carbonPools(rec);
  const inputs = a.inFeedC + a.cropAirC + a.wcInC + a.atmC;
  const exports = a.harvC + a.wcOutC;
  return {
    start, end,
    fixedByPhotosynthesis: a.gppC + a.cropAirC,
    respiredToCO2: a.respC,
    decomposed: a.decompC,
    feedIn: a.inFeedC,
    netFromAir: a.atmC,
    cropFromAir: a.cropAirC,
    harvested: a.harvC,
    waterChangeNet: a.wcInC - a.wcOutC,
    closureError: (end.total - start.total) - (inputs - exports),
  };
}
