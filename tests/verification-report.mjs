// Prints the measured numbers quoted in docs/VALIDATION.md.  Run:  node tests/verification-report.mjs
import { simulate, elementTotals, netExternal } from '../src/model/ecosystem.js';
import { oxygenSaturation } from '../src/model/oxygen.js';
import { unionizedAmmoniaFraction } from '../src/model/nutrients.js';
import { unmanagedTankParameters as A } from '../src/scenarios/unmanaged-tank.js';
import { aquaponicsParameters as B } from '../src/scenarios/aquaponics.js';
import { energyBudget } from '../src/model/energy.js';

const fmt = (x, d = 3) => (Math.abs(x) < 1e-3 && x !== 0 ? x.toExponential(1) : x.toFixed(d));
const closure = (r) => { const f = elementTotals(r.final), e = netExternal(r.acc), i = r.initialTotals; return [f.N - i.N - e.N, f.P - i.P - e.P, f.C - i.C - e.C]; };

console.log('## Conservation (mg/L, 365 days)');
for (const [n, p] of [['A default', A()], ['B default', B()], ['B, water changes 25 %/wk + fertilizer', B({ waterChangePct: 25, fertP: 0.01, fertN: 0.072 })]]) {
  const r = simulate(p, 365); const [N, P, C] = closure(r);
  console.log(`| ${n} | ${fmt(N)} | ${fmt(P)} | ${fmt(C)} |`);
}
console.log('\n## O2 saturation (mg/L)'); for (const t of [0, 10, 20, 25, 30]) console.log(`| ${t} °C | ${oxygenSaturation(t).toFixed(2)} |`);
console.log('\n## NH3 fraction (%)'); for (const [t, ph] of [[25, 7], [20, 8], [25, 8.5]]) console.log(`| ${t} °C pH ${ph} | ${(unionizedAmmoniaFraction(t, ph) * 100).toFixed(3)} |`);
const nf = { fishCount: 0, feedPct: 0, nh40: 0, no30: 0.02, po40: 0.002, detritusC0: 0.2 };
console.log('\n## Sensitivity (algae mg dry/L at day 40, no fish)');
for (const L of [0.2, 0.5, 0.9]) console.log(`| light ${L} (fertile) | ${fmt(simulate(A({ ...nf, fertN: 0.4, fertP: 0.05, light: L }), 40).final.algae, 2)} |`);
for (const fn of [0, 0.09, 0.36]) { const r = simulate(A({ ...nf, fertP: 0.05, fertN: fn }), 40); console.log(`| fertN ${fn} (P ample) | ${fmt(r.final.algae, 2)} | limiting ${r.days[40].limiting} |`); }
for (const fp of [0, 0.0125, 0.05]) { const r = simulate(A({ ...nf, fertN: 0.36, fertP: fp }), 40); console.log(`| fertP ${fp} (N ample) | ${fmt(r.final.algae, 2)} | limiting ${r.days[40].limiting} |`); }
console.log('\n## Crop density (B, 90 d)');
for (const d of [0, 0.3, 0.6, 1]) { const r = simulate(B({ cropDensity: d }), 90); console.log(`| ${d * 100} % | DIN ${fmt(r.final.nh4 + r.final.no3, 2)} | PO4 ${fmt(r.final.po4, 2)} | algae ${fmt(r.final.algae, 1)} | harvest N ${fmt(r.acc.harvN * 200 / 1000, 2)} g |`); }
console.log('\n## Time-step convergence (day 30, strong aeration): hourly vs 15-min, relative difference');
for (const [n, mk] of [['A', A], ['B', B]]) { const h = simulate(mk({ aeration: 'strong', kReaer: 12 }), 30).final; const q = simulate(mk({ aeration: 'strong', kReaer: 12, stepsPerDay: 96 }), 30).final;
  console.log(`| ${n} | ` + ['fish', 'algae', 'crop', 'no3', 'po4', 'do'].map((k) => `${k} ${(Math.abs(h[k] - q[k]) / Math.max(1e-9, Math.abs(q[k])) * 100).toFixed(2)}%`).join(' | ') + ' |'); }
console.log('\n## Energy (B default 90 d)'); { const r = simulate(B(), 90); const e = energyBudget(r); console.log(`fish transfer efficiency ${(e.fishTransferEfficiency * 100).toFixed(1)} %`); }
{ const r = simulate(A({ fishCount: 4, feedPct: 0, aeration: 'strong', kReaer: 12 }), 60); const e = energyBudget(r); console.log(`A grazing only: eaten ${e.fishIngested.toFixed(1)} kJ, efficiency ${(e.fishTransferEfficiency * 100).toFixed(1)} % (negative growth gives 0)`); }
console.log('\n## Run time (this machine)');
for (const d of [90, 365]) { const t = performance.now(); simulate(B(), d); console.log(`| ${d} days | ${(performance.now() - t).toFixed(0)} ms |`); }
