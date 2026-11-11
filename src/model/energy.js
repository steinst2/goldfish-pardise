/**
 * energy.js — energy accounting (kJ), deliberately separate from nutrient mass balance.
 *
 * Energy enters the ecosystem as LIGHT captured by producers (and, in a fish tank, as the
 * chemical energy in fish food bought from outside). At every transfer most of it is used
 * for life processes and released as HEAT by respiration. Heat cannot be captured again by
 * organisms, so energy flows THROUGH the system rather than cycling like N, P or C.
 *
 * The approximate "10 % rule": on average roughly 10 % of the energy at one trophic level
 * becomes biomass at the next level (Lindeman 1942; Pauly & Christensen 1995 report a mean
 * transfer efficiency near 10 % in aquatic food webs). Real values vary widely (≈ 2–25 %).
 * Our model does NOT force 10 %: the fish's efficiency emerges from assimilation, digestion
 * cost and respiration parameters, so students can compare it with the rule.
 *
 * Energy content is approximated as 20 kJ per gram of dry organic matter for all pools
 * (illustrative). Values are converted here from kJ per litre to kJ for the whole system.
 */

export function energyBudget(run, rec = run.days[run.days.length - 1]) {
  const a = rec.acc;
  const V = run.params.volumeL;
  const k = (x) => x * V; // kJ/L -> kJ whole system
  const producerGross = k(a.eGPPalgae + a.eNPPcrop);
  const fishIngest = k(a.eFishIngest);
  const fishProd = k(Math.max(0, a.eFishProd));
  const efficiency = fishIngest > 0 ? fishProd / fishIngest : 0;
  return {
    lightCapturedAlgae: k(a.eGPPalgae),
    cropNetProduction: k(a.eNPPcrop),
    producerGross,
    foodSubsidy: k(a.eFoodOffered),
    fishIngested: fishIngest,
    fishIngestedFromAlgae: k(a.eFishFromAlgae),
    fishProduction: fishProd,
    fishTransferEfficiency: efficiency,
    heat: {
      fish: k(a.eHeatFish), algae: k(a.eHeatAlgae), decomposers: k(a.eHeatBact), cropRoots: k(a.eHeatCropRoot),
    },
    harvestExport: k(a.eHarvest),
  };
}

/** A simple illustration of the 10 % rule starting from a producer energy amount. */
export function tenPercentPyramid(producerKJ, efficiency = 0.1, levels = 4) {
  const out = [];
  let e = producerKJ;
  for (let i = 0; i < levels; i++) { out.push(e); e *= efficiency; }
  return out;
}
