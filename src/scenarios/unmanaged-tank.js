/**
 * Scenario A — Unmanaged Goldfish Tank ("Goldfish Paradise").
 * A crowded tank with daily feeding, gravel as the only surface for nitrifying bacteria,
 * no plants harvested out of the system, and no water changes. Nutrients that enter as food
 * stay in the water unless algae take them up or bacteria denitrify them.
 */
import { defaultParameters } from '../model/parameters.js';
import { AERATION_PRESETS } from '../model/oxygen.js';

export const UNMANAGED_TANK = {
  id: 'A',
  name: 'Scenario A — Unmanaged goldfish tank',
  short: 'Unmanaged tank',
  description: 'Fish are fed every day, but nothing removes nutrients from the water. Only gravel hosts nitrifying bacteria.',
  overrides: {
    aeration: 'gentle',
    cropDensity: 0,
    nitrMax: 4.0, // gravel + a basic filter sponge (illustrative)
    harvestEvery: 0,
    waterChangePct: 0,
  },
};

export function unmanagedTankParameters(extra = {}) {
  const p = { ...defaultParameters(), ...UNMANAGED_TANK.overrides, ...extra };
  p.kReaer = AERATION_PRESETS[p.aeration]?.k ?? p.kReaer;
  p.cropDensity = 0; // no crops in Scenario A
  return p;
}
