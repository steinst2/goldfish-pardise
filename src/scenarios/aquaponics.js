/**
 * Scenario B — Waste-to-Plate aquaponics-inspired system.
 * The same fish tank is connected to grow beds. Crop roots take up dissolved nitrogen and
 * phosphorus; harvesting removes those nutrients from the system as food. The grow-bed media
 * adds surface area for nitrifying bacteria, and floating rafts shade part of the water.
 * Crops do NOT eliminate algae or guarantee stability: oxygen still depends on aeration,
 * and crops can only absorb nutrients as fast as they grow.
 */
import { defaultParameters } from '../model/parameters.js';
import { AERATION_PRESETS } from '../model/oxygen.js';

export const AQUAPONICS = {
  id: 'B',
  name: 'Scenario B — Waste-to-Plate aquaponics',
  short: 'Aquaponics',
  description: 'Fish water flows through grow beds where crops absorb nutrients. Harvests remove nutrients as food.',
  overrides: {
    aeration: 'strong',
    cropDensity: 0.6,
    nitrMax: 6.0, // grow-bed media adds biofilm surface (illustrative)
    harvestEvery: 14,
    waterChangePct: 0,
  },
};

export function aquaponicsParameters(extra = {}) {
  const p = { ...defaultParameters(), ...AQUAPONICS.overrides, ...extra };
  p.kReaer = AERATION_PRESETS[p.aeration]?.k ?? p.kReaer;
  return p;
}
