// Automated NUMERICAL VERIFICATION tests for the simulation engine.
// Run with:  node --test tests/
// These tests check that the code does what the model card says (conservation, signs,
// expected directions of response). They are NOT empirical validation against real tanks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, elementTotals, netExternal, STATE_POOLS } from '../src/model/ecosystem.js';
import { oxygenSaturation } from '../src/model/oxygen.js';
import { monod, nutrientLimitation, unionizedAmmoniaFraction } from '../src/model/nutrients.js';
import { unmanagedTankParameters } from '../src/scenarios/unmanaged-tank.js';
import { aquaponicsParameters } from '../src/scenarios/aquaponics.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);

function closure(run) {
  const fin = elementTotals(run.final), ext = netExternal(run.acc), i0 = run.initialTotals;
  return { N: fin.N - i0.N - ext.N, P: fin.P - i0.P - ext.P, C: fin.C - i0.C - ext.C, scale: Math.max(1, i0.C) };
}

const CASES = {
  'A default': unmanagedTankParameters(),
  'B default': aquaponicsParameters(),
  'A water changes + fertilizer': unmanagedTankParameters({ waterChangePct: 25, fertN: 0.07, fertP: 0.01 }),
  'B crops 100 % weekly harvest, no aeration': aquaponicsParameters({ cropDensity: 1, harvestEvery: 7, aeration: 'none', kReaer: 0.8 }),
  'A brand-new tank, warm, 16 fish': unmanagedTankParameters({ nitrMaturity: 0.05, tempC: 30, fishCount: 16 }),
};

// 1. Nutrient mass conservation (N, P) and 5. carbon balance
for (const [name, p] of Object.entries(CASES)) {
  test(`mass balance closes for N, P and C — ${name}`, () => {
    const r = simulate(p, 120);
    const c = closure(r);
    close(c.N, 0, 1e-9, 'N closure');
    close(c.P, 0, 1e-9, 'P closure');
    close(c.C, 0, 1e-8 * c.scale, 'C closure');
    assert.ok(r.acc.clampResidual < 1e-9, `round-off clamp residual ${r.acc.clampResidual}`);
  });
}

// 2. Nitrogen transformation: nitrification changes form, does not remove N
test('nitrification moves N from ammonium to nitrate without changing total N', () => {
  const p = unmanagedTankParameters({ fishCount: 0, feedPct: 0, light: 0, nh40: 5, no30: 0.5, denitRate: 0, anoxicFraction: 0, algae0: 0, bact0: 0, detritusC0: 0 });
  const r = simulate(p, 20);
  const t0 = elementTotals(r.days[0]), t1 = elementTotals(r.final);
  assert.ok(r.final.nh4 < 5, 'ammonium decreased');
  assert.ok(r.final.no3 > 0.5, 'nitrate increased');
  assert.ok(r.acc.nitrified > 1, 'nitrification occurred');
  assert.equal(r.acc.outN2, 0, 'no N2 lost when denitrification is off');
  close(t1.N, t0.N, 1e-10, 'total N unchanged');
});

test('denitrification is the only gaseous N loss and needs low oxygen', () => {
  const base = { fishCount: 0, feedPct: 0, light: 0, nh40: 0, no30: 10, detritusC0: 20, anoxicFraction: 0 };
  const oxic = simulate(unmanagedTankParameters({ ...base, aeration: 'strong', kReaer: 12 }), 10);
  const anoxic = simulate(unmanagedTankParameters({ ...base, kReaer: 0, bact0: 20, detritusC0: 200 }), 10);
  assert.ok(anoxic.acc.outN2 > 5 * oxic.acc.outN2, `anoxic N2 loss ${anoxic.acc.outN2} >> oxic ${oxic.acc.outN2}`);
  close(anoxic.acc.outN2, anoxic.acc.denitrified, 1e-12, 'N2 loss equals denitrified N');
});

// 3. Nutrient uptake (Monod + Liebig)
test('Monod factor is 0.5 at the half-saturation constant; Liebig takes the minimum', () => {
  close(monod(0.05, 0.05), 0.5, 1e-12, 'monod at K');
  assert.equal(monod(-1, 0.05), 0);
  const l = nutrientLimitation(10, 0.001, 0, 0.05, 0.01, 0);
  assert.equal(l.limiting, 'P');
  close(l.lim, Math.min(l.fN, l.fP), 1e-15, 'lim = min');
});

test('algal growth draws down dissolved nutrients', () => {
  const p = unmanagedTankParameters({ fishCount: 0, feedPct: 0, light: 0.9, nh40: 0.5, no30: 2, po40: 0.3 });
  const r = simulate(p, 15);
  assert.ok(r.acc.algaeUptakeN > 0 && r.acc.algaeUptakeP > 0);
  assert.ok(r.days[15].algae > r.days[0].algae, 'algae grew');
  assert.ok(r.days[15].po4 < 0.3, 'phosphate drawn down');
});

// 4. Oxygen balance
test('dissolved-oxygen budget: change = sources − sinks', () => {
  for (const p of [unmanagedTankParameters(), aquaponicsParameters({ waterChangePct: 20 })]) {
    const r = simulate(p, 60);
    const a = r.acc;
    const expected = r.days[0].do + a.o2Reaer + a.o2Photo + a.wcO2 - a.o2AlgaeResp - a.o2FishResp - a.o2BactResp - a.o2Nitrif - a.o2Root;
    close(r.final.do, expected, 1e-8, 'O2 budget');
  }
});

test('oxygen saturation matches Benson & Krause / USGS tables', () => {
  close(oxygenSaturation(0), 14.62, 0.02, '0 °C');
  close(oxygenSaturation(20), 9.09, 0.02, '20 °C');
  close(oxygenSaturation(25), 8.26, 0.02, '25 °C');
  assert.ok(oxygenSaturation(30) < oxygenSaturation(10), 'warmer water holds less oxygen');
});

test('un-ionized ammonia fraction follows Emerson et al. (1975)', () => {
  close(unionizedAmmoniaFraction(25, 7.0) * 100, 0.566, 0.02, '25 °C, pH 7');
  assert.ok(unionizedAmmoniaFraction(25, 8.5) > 10 * unionizedAmmoniaFraction(25, 7.0) * 0.9, 'rises ~10x per pH unit');
});

test('crops do not add oxygen to the water (leaf O2 goes to the air)', () => {
  const r = simulate(aquaponicsParameters({ cropDensity: 1 }), 30);
  assert.ok(r.acc.o2Root > 0, 'roots use water oxygen');
  // all photosynthetic O2 in the water comes from algae
  close(r.acc.o2Photo, (32 / 12) * r.acc.gppC, 1e-9, 'water O2 from algal photosynthesis only');
});

// 6. Non-negative state variables across a randomised parameter sweep
test('no state variable ever becomes negative or NaN (random sweep)', () => {
  let seed = 42;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const aer = ['none', 'gentle', 'strong'];
  const k = { none: 0.8, gentle: 3, strong: 12 };
  for (let i = 0; i < 40; i++) {
    const a = aer[Math.floor(rnd() * 3)];
    const extra = {
      fishCount: Math.floor(rnd() * 17), feedPct: rnd() * 3, light: rnd(), tempC: 12 + rnd() * 18,
      aeration: a, kReaer: k[a], waterChangePct: rnd() < 0.3 ? rnd() * 50 : 0, fertP: rnd() < 0.3 ? rnd() * 0.05 : 0,
      nitrMaturity: rnd(), pH: 6.5 + rnd() * 2, photoperiodH: 6 + rnd() * 12,
    };
    const p = rnd() < 0.5 ? unmanagedTankParameters(extra) : aquaponicsParameters({ ...extra, cropDensity: rnd(), harvestEvery: [0, 7, 14, 28][Math.floor(rnd() * 4)] });
    const r = simulate(p, 90);
    for (const d of r.days) for (const key of STATE_POOLS) {
      assert.ok(Number.isFinite(d[key]), `case ${i} day ${d.day} ${key} is ${d[key]}`);
      assert.ok(d[key] >= 0, `case ${i} day ${d.day} ${key} = ${d[key]}`);
    }
    const c = closure(r);
    close(c.N, 0, 1e-9, `case ${i} N closure`);
  }
});

// 7–9. Sensitivity to light, nitrogen and phosphorus (direction of response)
const noFish = { fishCount: 0, feedPct: 0, nh40: 0, no30: 0.02, po40: 0.002, detritusC0: 0.2 };
test('sensitivity: more light → more algae when nutrients are plentiful', () => {
  const lo = simulate(unmanagedTankParameters({ ...noFish, fertN: 0.4, fertP: 0.05, light: 0.2 }), 40).final.algae;
  const hi = simulate(unmanagedTankParameters({ ...noFish, fertN: 0.4, fertP: 0.05, light: 0.9 }), 40).final.algae;
  assert.ok(hi > 1.5 * lo, `light 0.9 → ${hi}, light 0.2 → ${lo}`);
});
test('sensitivity: adding nitrogen raises algae when N is limiting', () => {
  const lo = simulate(unmanagedTankParameters({ ...noFish, fertP: 0.05, fertN: 0 }), 40);
  const hi = simulate(unmanagedTankParameters({ ...noFish, fertP: 0.05, fertN: 0.36 }), 40);
  assert.equal(lo.days[40].limiting, 'N');
  assert.ok(hi.final.algae > 1.5 * lo.final.algae, `with N ${hi.final.algae} vs without ${lo.final.algae}`);
});
test('sensitivity: adding phosphorus raises algae when P is limiting', () => {
  const lo = simulate(unmanagedTankParameters({ ...noFish, fertN: 0.36, fertP: 0 }), 40);
  const hi = simulate(unmanagedTankParameters({ ...noFish, fertN: 0.36, fertP: 0.05 }), 40);
  assert.equal(lo.days[40].limiting, 'P');
  assert.ok(hi.final.algae > 1.5 * lo.final.algae, `with P ${hi.final.algae} vs without ${lo.final.algae}`);
});

// 10. Sensitivity to crop density
test('sensitivity: higher crop density → lower dissolved N and more N harvested', () => {
  const out = [0, 0.3, 0.6, 1].map((d) => simulate(aquaponicsParameters({ cropDensity: d }), 90));
  for (let i = 1; i < out.length; i++) {
    assert.ok(out[i].final.nh4 + out[i].final.no3 < out[i - 1].final.nh4 + out[i - 1].final.no3, `DIN decreases at density step ${i}`);
    assert.ok(out[i].acc.harvN > out[i - 1].acc.harvN, `harvest N increases at step ${i}`);
  }
  assert.ok(out[3].final.algae > 0, 'crops reduce but do not eliminate algae');
});

// 11. Stability across durations and time steps
test('deterministic prefix: a 365-day run starts exactly like a 30-day run', () => {
  const a = simulate(aquaponicsParameters(), 30), b = simulate(aquaponicsParameters(), 365);
  for (const key of STATE_POOLS) assert.equal(a.days[30][key], b.days[30][key], key);
  const c = closure(b);
  close(c.N, 0, 1e-9, '365-day N closure');
});
test('time-step convergence: hourly vs 15-minute steps agree within 5 % at day 30', () => {
  for (const mk of [unmanagedTankParameters, aquaponicsParameters]) {
    const h = simulate(mk({ aeration: 'strong', kReaer: 12 }), 30).final;
    const q = simulate(mk({ aeration: 'strong', kReaer: 12, stepsPerDay: 96 }), 30).final;
    for (const key of ['fish', 'algae', 'crop', 'no3', 'po4', 'do']) {
      const ref = Math.max(1e-6, Math.abs(q[key]));
      assert.ok(Math.abs(h[key] - q[key]) / ref < 0.05 || Math.abs(h[key] - q[key]) < 1e-3, `${mk.name} ${key}: hourly ${h[key]} vs 15-min ${q[key]}`);
    }
  }
});

test('outcomes depend on settings: the unmanaged tank does not always collapse', () => {
  const crash = simulate(unmanagedTankParameters(), 90);
  const ok = simulate(unmanagedTankParameters({ fishCount: 4, aeration: 'strong', kReaer: 12 }), 90);
  assert.ok(crash.final.fish < 0.1 * crash.days[0].fish, 'default crowded tank collapses');
  assert.ok(ok.final.fish > 0.8 * ok.days[0].fish, 'fewer fish + aeration survives');
});
