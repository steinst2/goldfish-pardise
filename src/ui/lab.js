/**
 * lab.js — the main laboratory screen: controls → parameters → simulation → charts & metrics.
 */
import { simulate, elementTotals, netExternal } from '../model/ecosystem.js';
import { unmanagedTankParameters, UNMANAGED_TANK } from '../scenarios/unmanaged-tank.js';
import { aquaponicsParameters, AQUAPONICS } from '../scenarios/aquaponics.js';
import { AERATION_PRESETS } from '../model/oxygen.js';
import { FISH_DRY_FRACTION } from '../model/organisms.js';
import { energyBudget } from '../model/energy.js';
import { LineChart, renderBars, formatNumber } from '../visualization/charts.js';
import { nitrogenDiagram, carbonDiagram } from '../visualization/diagrams.js';
import { DATA_KINDS } from '../data/provenance.js';
import { EXPLAIN } from './content.js';

/** Extra nutrient loading steps (fertilizer / runoff). N added at a Redfield-like N:P mass ratio of 7.2. */
export const NUTRIENT_LEVELS = [
  { label: 'None', p: 0 },
  { label: 'Low', p: 0.002 },
  { label: 'Moderate', p: 0.005 },
  { label: 'High', p: 0.01 },
  { label: 'Very high', p: 0.05 },
];
const N_TO_P = 7.2;

export const DEFAULT_SETTINGS = {
  scenario: 'A', days: 90, fishCount: 8, feedPct: 1.5, nutrientLevel: 0, light: 80,
  cropDensity: 60, aeration: 'gentle', tempC: 22, photoperiodH: 14, waterChangePct: 0,
  harvestEvery: 14, doStress: 2.0, nitrMaturity: 0.7, pH: 7.5,
};
/** Aeration differs by scenario in the defaults (aquaponics systems normally run an air pump). */
export function defaultsFor(scenario) {
  return { ...DEFAULT_SETTINGS, scenario, aeration: scenario === 'A' ? 'gentle' : 'strong' };
}

export function settingsToParams(st, scenarioId) {
  const lvl = NUTRIENT_LEVELS[st.nutrientLevel] || NUTRIENT_LEVELS[0];
  const extra = {
    fishCount: +st.fishCount,
    feedPct: +st.feedPct,
    light: +st.light / 100,
    photoperiodH: +st.photoperiodH,
    tempC: +st.tempC,
    pH: +st.pH,
    aeration: st.aeration,
    kReaer: AERATION_PRESETS[st.aeration].k,
    waterChangePct: +st.waterChangePct,
    doStress: +st.doStress,
    nitrMaturity: +st.nitrMaturity,
    fertP: lvl.p,
    fertN: lvl.p * N_TO_P,
  };
  if (scenarioId === 'B') return aquaponicsParameters({ ...extra, cropDensity: +st.cropDensity / 100, harvestEvery: +st.harvestEvery });
  return unmanagedTankParameters(extra);
}

/** Convert fish mg dry/L → grams wet mass in the whole system. */
export const fishWetGrams = (mgDryPerL, V) => (mgDryPerL * V) / 1000 / FISH_DRY_FRACTION;
const grams = (mgPerL, V) => (mgPerL * V) / 1000;

function sameSettings(a, b) {
  return Object.keys(DEFAULT_SETTINGS).every((k) => k === 'scenario' || String(a[k]) === String(b[k]));
}

/** Run the scenario(s) for the current settings and their baselines. */
export function runExperiment(st) {
  const ids = st.scenario === 'compare' ? ['A', 'B'] : [st.scenario];
  const out = { settings: { ...st }, runs: {}, baselines: {}, kind: 'SIMULATED' };
  for (const id of ids) {
    const p = settingsToParams(st, id);
    out.runs[id] = simulate(p, +st.days, { scenario: id });
    const base = defaultsFor(st.scenario === 'compare' ? 'A' : id);
    base.days = st.days;
    if (st.scenario === 'compare') base.aeration = st.aeration; // compare baseline keeps the chosen aeration
    if (!sameSettings(st, base)) {
      out.kind = 'EXPERIMENT';
      out.baselines[id] = simulate(settingsToParams(base, id), +st.days, { scenario: id, baseline: true });
    }
  }
  return out;
}

/** Run-level metrics for one run (used by metrics panel, investigations and report). */
export function runMetrics(run, dayIndex = run.days.length - 1) {
  const V = run.params.volumeL;
  const d = run.days[dayIndex];
  const last = run.days[run.days.length - 1];
  const a = last.acc;
  const days = run.days.slice(1);
  const doMinRun = days.length ? Math.min(...days.map((x) => x.doMin)) : d.do;
  const low = days.find((x) => x.doMin < run.params.doStress);
  const fin = elementTotals(run.final), ext = netExternal(a), i0 = run.initialTotals;
  const eb = energyBudget(run);
  return {
    day: d.day,
    fishWetG: fishWetGrams(d.fish, V),
    fishStartWetG: fishWetGrams(run.days[0].fish, V),
    algae: d.algae, chl: d.chlEstimate, crop: d.crop, bact: d.bact, nitr: d.nitr,
    nh4: d.nh4, no3: d.no3, din: d.din, po4: d.po4, dic: d.dic, detC: d.detC,
    do: d.doMean ?? d.do, doMin: d.doMin ?? d.do, doMax: d.doMax ?? d.do, doSat: run.doSat,
    nh3: d.nh4 * unionizedFraction(run.params), // mg NH3-N/L
    limiting: d.limiting || '—', fL: d.fL, fN: d.fN, fP: d.fP, fC: d.fC,
    doMinRun, firstLowDODay: low ? low.day : null,
    deathHypoxiaG: fishWetGrams(a.deathHypoxia, V), deathAmmoniaG: fishWetGrams(a.deathAmmonia, V),
    harvestN: grams(a.harvN, V), harvestP: grams(a.harvP, V), harvestDryG: grams(a.harvC / 0.5, V),
    feedN: grams(a.inFeedN, V), nitrified: grams(a.nitrified, V), denitrified: grams(a.denitrified, V),
    gppC: grams(a.gppC, V), respC: grams(a.respC, V),
    nBalance: grams(fin.N - i0.N - ext.N, V), pBalance: grams(fin.P - i0.P - ext.P, V), cBalance: grams(fin.C - i0.C - ext.C, V),
    nStoredChange: grams(fin.N - i0.N, V), nNetInput: grams(ext.N, V),
    eFishIngest: eb.fishIngested, eFishProd: eb.fishProduction, eHeatFish: eb.heat.fish, eff: eb.fishTransferEfficiency * 100, eGPP: eb.producerGross,
    eb,
  };
}

function unionizedFraction(p) {
  const pKa = 0.09018 + 2729.92 / (p.tempC + 273.15);
  return 1 / (1 + Math.pow(10, pKa - p.pH));
}

const LIMIT_LABEL = { light: 'Light', N: 'Nitrogen', P: 'Phosphorus', C: 'Inorganic carbon', '—': '—' };

/* ------------------------------------------------------------------ rendering */

export class LabView {
  constructor(root) {
    this.root = root;
    this.charts = {};
    this.result = null;
    this.inspectDay = null;
    this.onRun = null;
  }

  mountCharts() {
    const grid = this.root.querySelector('#charts');
    const defs = [
      ['nitrogen', 'Dissolved nitrogen'], ['phosphorus', 'Dissolved phosphate'],
      ['algae', 'Algae biomass'], ['crops', 'Crop biomass'],
      ['fish', 'Fish biomass'], ['bacteria', 'Bacteria biomass'],
      ['oxygen', 'Dissolved oxygen'], ['carbon', 'Carbon storage'],
    ];
    grid.innerHTML = '';
    for (const [id, title] of defs) {
      const card = document.createElement('section');
      card.className = 'chart-card';
      card.id = `chart-${id}`;
      const holder = document.createElement('div');
      const ex = document.createElement('details');
      ex.className = 'explain';
      ex.innerHTML = `<summary>What am I seeing?</summary><p>${EXPLAIN[id]}</p>`;
      card.append(holder, ex);
      grid.append(card);
      this.charts[id] = new LineChart(holder, { title, series: [] });
    }
  }

  render(result) {
    this.result = result;
    const ids = Object.keys(result.runs);
    const main = result.runs[ids[0]];
    this.inspectDay = main.days.length - 1;
    const slider = this.root.querySelector('#inspect-day');
    slider.max = main.days.length - 1;
    slider.value = this.inspectDay;
    this.root.querySelector('#inspect-day-out').textContent = `Day ${this.inspectDay}`;
    this.renderKind();
    this.renderCharts();
    this.renderMetrics();
    this.renderTank();
    this.renderCycles();
    this.renderBalance();
  }

  renderKind() {
    const k = DATA_KINDS[this.result.kind];
    const el = this.root.querySelector('#run-kind');
    el.className = `kind-badge ${k.className}`;
    el.textContent = k.label;
    el.title = k.description;
    const note = this.root.querySelector('#run-kind-note');
    const cmp = this.result.settings.scenario === 'compare';
    note.textContent = (this.result.kind === 'EXPERIMENT'
      ? 'You changed the settings. Grey lines show the baseline run with default settings.'
      : 'Default settings. Change any control and run again to make it your own experiment.')
      + (cmp ? ' Compare mode: both scenarios use the same fish, food, light, temperature and aeration. Scenario B adds crops, grow-bed media for nitrifying bacteria, and partial shade from the rafts.' : '');
  }

  seriesFor(key, opt = {}) {
    // build series across runs + baselines for one variable
    const res = this.result;
    const ids = Object.keys(res.runs);
    const cmp = ids.length > 1;
    const out = [];
    ids.forEach((id, j) => {
      const run = res.runs[id];
      const V = run.params.volumeL;
      const x = run.days.map((d) => d.day);
      const vals = (d) => (opt.transform ? opt.transform(d, V) : d[key]);
      const name = (cmp ? `${id}: ` : '') + (opt.name || key);
      out.push({ name, short: (cmp ? id + ' ' : '') + (opt.short || opt.name || key), x, y: run.days.map(vals), colorIndex: cmp ? j : (opt.colorIndex ?? 0), dash: opt.dash, kind: 'sim' });
      const b = res.baselines[id];
      if (b && !opt.noBaseline) out.push({ name: (cmp ? `${id}: ` : '') + `${opt.name || key} — baseline`, x: b.days.map((d) => d.day), y: b.days.map((d) => (opt.transform ? opt.transform(d, b.params.volumeL) : d[key])), kind: 'baseline' });
    });
    return out;
  }

  renderCharts() {
    const res = this.result;
    const ids = Object.keys(res.runs);
    const cmp = ids.length > 1;
    const C = this.charts;
    const dash2 = [6, 4];
    // nitrogen: two forms; in compare mode, colour = scenario, dash = form
    const nSeries = [
      ...this.seriesFor('nh4', { name: 'Ammonium-N', short: 'NH₄⁺', colorIndex: 0, noBaseline: cmp }),
      ...this.seriesFor('no3', { name: 'Nitrate-N', short: 'NO₃⁻', colorIndex: 1, dash: cmp ? dash2 : undefined, noBaseline: cmp }),
    ];
    C.nitrogen.update({ title: 'Dissolved nitrogen', unit: 'mg N/L', series: nSeries, yMin: 0,
      note: cmp ? 'Colour = scenario (A blue, B orange). Solid = ammonium, dashed = nitrate.' : '' });
    C.phosphorus.update({ title: 'Dissolved phosphate', unit: 'mg P/L', series: this.seriesFor('po4', { name: 'Phosphate-P', short: 'PO₄³⁻' }), yMin: 0 });
    C.algae.update({ title: 'Algae biomass', unit: 'mg dry mass/L', series: this.seriesFor('algae', { name: 'Algae', short: 'Algae' }), yMin: 0 });
    const hasCrops = ids.some((id) => res.runs[id].params.cropDensity > 0);
    C.crops.update({ title: 'Crop biomass', unit: 'mg dry mass/L', series: hasCrops ? this.seriesFor('crop', { name: 'Crops', short: 'Crops', colorIndex: cmp ? 0 : 2 }) : [], yMin: 0,
      note: hasCrops ? 'Saw-tooth drops are harvests: crop biomass (and its nutrients) leaves the system as food.' : 'No crops in Scenario A. Choose Scenario B or Compare to grow crops.' });
    C.fish.update({ title: 'Fish biomass (all fish)', unit: 'g wet mass', series: this.seriesFor('fish', { name: 'Goldfish', short: 'Fish', transform: (d, V) => fishWetGrams(d.fish, V) }), yMin: 0 });
    C.bacteria.update({ title: 'Bacteria biomass', unit: 'mg dry mass/L', yMin: 0, series: [
      ...this.seriesFor('bact', { name: 'Decomposers', short: 'Decomp.', colorIndex: 0, noBaseline: true }),
      ...this.seriesFor('nitr', { name: 'Nitrifiers', short: 'Nitrif.', colorIndex: 1, dash: cmp ? dash2 : undefined, noBaseline: true }),
    ], note: cmp ? 'Colour = scenario. Solid = decomposers, dashed = nitrifiers.' : '' });
    const first = res.runs[ids[0]];
    const doSeries = this.seriesFor('doMean', { name: 'Daily mean DO', short: 'DO' });
    C.oxygen.update({ title: 'Dissolved oxygen', unit: 'mg O₂/L', yMin: 0, series: doSeries,
      band: cmp ? null : { name: 'Daily low–high', x: first.days.map((d) => d.day), lo: first.days.map((d) => d.doMin ?? d.do), hi: first.days.map((d) => d.doMax ?? d.do) },
      thresholds: [
        { y: first.params.doStress, label: `Fish-stress threshold (${first.params.doStress} mg/L, your setting)`, short: 'stress' },
        { y: first.doSat, label: `Saturation at ${first.params.tempC} °C (${first.doSat.toFixed(2)} mg/L)`, short: 'sat.', color: '#898781' },
      ] });
    C.carbon.update({ title: 'Carbon storage', unit: 'mg C/L', yMin: 0, series: [
      ...this.seriesFor('dic', { name: 'Dissolved inorganic C', short: 'DIC', colorIndex: 0, noBaseline: true }),
      ...this.seriesFor('orgC', { name: 'Organic C (living + dead)', short: 'Organic', colorIndex: 1, dash: cmp ? dash2 : undefined, noBaseline: true,
        transform: (d) => d.totalC - d.dic }),
    ], note: 'Organic carbon includes fish, algae, crops, bacteria and detritus.' + (cmp ? ' Colour = scenario; dashed = organic carbon.' : '') });
  }

  setInspectDay(i) {
    this.inspectDay = i;
    this.root.querySelector('#inspect-day-out').textContent = `Day ${i}`;
    this.renderMetrics();
    this.renderTank();
  }

  renderMetrics() {
    const res = this.result;
    const box = this.root.querySelector('#metrics');
    const ids = Object.keys(res.runs);
    let html = '';
    for (const id of ids) {
      const run = res.runs[id];
      const i = Math.min(this.inspectDay, run.days.length - 1);
      const m = runMetrics(run, i);
      const status = (v, warn, bad, higherBad = true) => {
        if (higherBad ? v >= bad : v <= bad) return 'bad';
        if (higherBad ? v >= warn : v <= warn) return 'warn';
        return 'good';
      };
      const doState = status(m.doMin, run.params.doStress * 1.5, run.params.doStress, false);
      const nh3State = status(m.nh3, run.params.nh3Stress * 0.5, run.params.nh3Stress);
      const icon = { good: '●', warn: '▲', bad: '✖' };
      const word = { good: 'OK', warn: 'Watch', bad: 'Stress' };
      html += `<div class="metric-group"><h3>${id === 'A' ? UNMANAGED_TANK.name : AQUAPONICS.name} <span class="muted">· day ${m.day}</span></h3><dl class="metric-grid">
        <div><dt>Fish (all)</dt><dd>${formatNumber(m.fishWetG)} g <small>${m.fishStartWetG ? Math.round((m.fishWetG / m.fishStartWetG) * 100) : 0}% of start</small></dd></div>
        <div><dt>Algae</dt><dd>${formatNumber(m.algae)} mg/L <small>≈ ${formatNumber(m.chl)} µg chl-a/L</small></dd></div>
        <div><dt>Crops</dt><dd>${formatNumber(m.crop)} mg/L</dd></div>
        <div class="st-${doState}"><dt>Oxygen (low–high)</dt><dd><span class="st-icon" aria-hidden="true">${icon[doState]}</span> ${formatNumber(m.doMin)}–${formatNumber(m.doMax)} mg/L <small>${word[doState]}</small></dd></div>
        <div><dt>Ammonium-N</dt><dd>${formatNumber(m.nh4)} mg/L</dd></div>
        <div class="st-${nh3State}"><dt>Toxic NH₃-N</dt><dd><span class="st-icon" aria-hidden="true">${icon[nh3State]}</span> ${formatNumber(m.nh3)} mg/L <small>${word[nh3State]}</small></dd></div>
        <div><dt>Nitrate-N</dt><dd>${formatNumber(m.no3)} mg/L</dd></div>
        <div><dt>Phosphate-P</dt><dd>${formatNumber(m.po4)} mg/L</dd></div>
        <div><dt>Algae limited by</dt><dd>${LIMIT_LABEL[m.limiting] || m.limiting} <small>f<sub>light</sub> ${formatNumber(m.fL)} · f<sub>N</sub> ${formatNumber(m.fN)} · f<sub>P</sub> ${formatNumber(m.fP)}</small></dd></div>
        <div><dt>Fish deaths (whole run)</dt><dd>${formatNumber(m.deathHypoxiaG)} g low O₂ · ${formatNumber(m.deathAmmoniaG)} g ammonia</dd></div>
        ${run.params.cropDensity > 0 ? `<div><dt>Harvested (whole run)</dt><dd>${formatNumber(m.harvestDryG)} g dry crop <small>${formatNumber(m.harvestN)} g N</small></dd></div>` : ''}
      </dl></div>`;
    }
    box.innerHTML = html;
  }

  renderTank() {
    const res = this.result;
    const ids = Object.keys(res.runs);
    const holder = this.root.querySelector('#tank');
    holder.innerHTML = ids.map((id) => tankSVG(res.runs[id], Math.min(this.inspectDay, res.runs[id].days.length - 1), id)).join('');
  }

  renderCycles() {
    const res = this.result;
    const ids = Object.keys(res.runs);
    const sel = this.root.querySelector('#cycle-scenario');
    sel.innerHTML = ids.map((id) => `<option value="${id}">${id === 'A' ? 'Scenario A' : 'Scenario B'}</option>`).join('');
    sel.hidden = ids.length < 2;
    const draw = () => {
      const run = res.runs[sel.value || ids[0]];
      nitrogenDiagram(this.root.querySelector('#n-diagram'), run);
      carbonDiagram(this.root.querySelector('#c-diagram'), run);
      const eb = energyBudget(run);
      renderBars(this.root.querySelector('#energy'), {
        title: 'Energy budget for the whole run', unit: 'kJ',
        bars: [
          { label: 'Light energy captured by algae', value: eb.lightCapturedAlgae, group: 'Energy in' },
          ...(run.params.cropDensity > 0 ? [{ label: 'Stored by crops (net growth)', value: eb.cropNetProduction, group: 'Energy in' }] : []),
          { label: 'Fish food added (from outside)', value: eb.foodSubsidy, group: 'Energy in' },
          { label: 'Eaten by fish', value: eb.fishIngested, group: 'Fish' },
          { label: 'Stored as new fish tissue', value: eb.fishProduction, group: 'Fish' },
          { label: 'Heat — fish respiration', value: eb.heat.fish, group: 'Released as heat' },
          { label: 'Heat — algae respiration', value: eb.heat.algae, group: 'Released as heat' },
          { label: 'Heat — decomposers', value: eb.heat.decomposers, group: 'Released as heat' },
        ],
        note: `Fish growth efficiency in this run: ${formatNumber(eb.fishTransferEfficiency * 100)} % (energy stored as new fish ÷ energy eaten; zero if the fish lost weight). This is one part of a trophic-level transfer efficiency, which the ~10 % rule describes for whole food webs. Energy content is approximated as 20 kJ per gram of dry biomass (illustrative). Heat leaves the system and cannot be reused — energy flows, matter cycles.`,
      });
    };
    sel.onchange = draw;
    draw();
  }

  renderBalance() {
    const res = this.result;
    const box = this.root.querySelector('#balance');
    const rows = Object.keys(res.runs).map((id) => {
      const m = runMetrics(res.runs[id]);
      const ok = (v) => Math.abs(v) < 1e-6;
      return `<tr><th scope="row">${id}</th><td>${formatNumber(m.nStoredChange)} g</td><td>${formatNumber(m.nNetInput)} g</td><td class="${ok(m.nBalance) ? 'ok' : 'bad'}">${m.nBalance.toExponential(1)} g ${ok(m.nBalance) ? '✓' : '✗'}</td><td class="${ok(m.pBalance) ? 'ok' : 'bad'}">${m.pBalance.toExponential(1)} g ${ok(m.pBalance) ? '✓' : '✗'}</td><td class="${ok(m.cBalance) ? 'ok' : 'bad'}">${m.cBalance.toExponential(1)} g ${ok(m.cBalance) ? '✓' : '✗'}</td></tr>`;
    }).join('');
    box.innerHTML = `<div class="table-scroll"><table class="balance-table"><caption>Mass-balance check: change in storage − (inputs − exports) should be zero</caption>
      <thead><tr><th scope="col">Scenario</th><th scope="col">Change in N stored</th><th scope="col">N inputs − exports</th><th scope="col">N error</th><th scope="col">P error</th><th scope="col">C error</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="chart-note">Errors near 10⁻¹² g are computer round-off. This verifies the model's bookkeeping (numerical verification) — it does not show the model matches a real tank (that would need empirical validation).</p>`;
  }
}

/* ----------------------------------------------------------------- tank illustration */
function tankSVG(run, i, id) {
  const d = run.days[i];
  const p = run.params;
  const chl = d.chlEstimate;
  // water tint: clear blue → green as chlorophyll rises (log scale)
  const t = Math.max(0, Math.min(1, Math.log10(1 + chl) / 3));
  const mix = (a, b) => Math.round(a + (b - a) * t);
  const water = `rgb(${mix(170, 96)},${mix(214, 150)},${mix(235, 70)})`;
  const startPer = run.days[0].fish / Math.max(1, p.fishCount);
  const alive = startPer > 0 ? Math.min(p.fishCount, Math.round(d.fish / startPer)) : 0;
  const shown = Math.min(12, Math.max(0, alive));
  let fish = '';
  for (let k = 0; k < shown; k++) {
    const x = 40 + ((k * 53) % 220), y = 70 + ((k * 37) % 70);
    const flip = k % 2 ? -1 : 1;
    fish += `<g transform="translate(${x},${y}) scale(${flip},1)"><ellipse cx="0" cy="0" rx="12" ry="7" fill="#f08a24"/><path d="M-11,0 L-21,-7 L-21,7 Z" fill="#e06a10"/><circle cx="6" cy="-2" r="1.6" fill="#222"/></g>`;
  }
  const crops = p.cropDensity > 0 ? (() => {
    const cap = p.cropCapacity * p.cropDensity;
    const h = 8 + 26 * Math.min(1, d.crop / Math.max(1, cap));
    let s = `<rect x="200" y="28" width="96" height="7" rx="2" fill="#d9c9a3" stroke="#a8956b"/>`;
    for (let k = 0; k < 5; k++) { const x = 210 + k * 19; s += `<path d="M${x},28 q-6,-${h} 0,-${h} q6,0 0,${h}" fill="#3f9b3a"/><path d="M${x},35 l0,${10 + k % 3 * 3}" stroke="#c9b98a" stroke-width="1.5"/>`; }
    return s;
  })() : '';
  const bubbles = p.aeration === 'strong' ? '<g fill="none" stroke="#ffffff" stroke-opacity=".8"><circle cx="24" cy="150" r="3"/><circle cx="27" cy="128" r="2.5"/><circle cx="22" cy="104" r="3.5"/><circle cx="26" cy="80" r="2"/><circle cx="23" cy="58" r="3"/></g>' : p.aeration === 'gentle' ? '<path d="M14,40 q10,-6 20,0" stroke="#fff" fill="none" stroke-opacity=".7"/>' : '';
  const label = id === 'A' ? 'Scenario A — unmanaged tank' : 'Scenario B — aquaponics';
  return `<figure class="tank-fig"><svg viewBox="0 0 310 190" role="img" aria-label="${label} on day ${d.day}: about ${alive} of ${p.fishCount} fish alive; water ${chl > 50 ? 'green with algae' : chl > 10 ? 'slightly green' : 'clear'}.">
    <rect x="5" y="35" width="300" height="145" rx="6" fill="${water}" stroke="#5b6b73" stroke-width="3"/>
    <rect x="8" y="160" width="294" height="17" fill="#c8b48a"/>
    ${bubbles}${fish}${crops}
    <text x="10" y="22" font-size="13" fill="currentColor">${label}</text>
  </svg><figcaption>Day ${d.day}: ~${alive}/${p.fishCount} fish · ${chl > 50 ? 'green water' : chl > 10 ? 'tinted water' : 'clear water'}</figcaption></figure>`;
}

/* ----------------------------------------------------------------- CSV export */
export function experimentCSV(result) {
  const cols = [
    ['day', 'day'], ['fish_wet_g_total', null], ['algae_mg_dry_L', 'algae'], ['chlorophyll_a_est_ug_L', 'chlEstimate'], ['crop_mg_dry_L', 'crop'],
    ['decomposers_mg_dry_L', 'bact'], ['nitrifiers_mg_dry_L', 'nitr'], ['detritus_mg_C_L', 'detC'],
    ['ammonium_mg_N_L', 'nh4'], ['nitrate_mg_N_L', 'no3'], ['phosphate_mg_P_L', 'po4'],
    ['do_daily_mean_mg_L', 'doMean'], ['do_daily_min_mg_L', 'doMin'], ['do_daily_max_mg_L', 'doMax'],
    ['dic_mg_C_L', 'dic'], ['total_system_N_mg_L', 'totalN'], ['total_system_P_mg_L', 'totalP'], ['total_system_C_mg_L', 'totalC'],
    ['algae_limiting_factor', 'limiting'], ['harvested_mg_dry_L_this_day', 'harvested'],
  ];
  const kind = DATA_KINDS[result.kind].label;
  const lines = [];
  lines.push(`# Goldfish Paradise Ecosystem Lab — model output (NOT field observations)`);
  lines.push(`# data_category,${kind}`);
  lines.push(`# exported_utc,${new Date().toISOString()}`);
  lines.push(`# settings,${Object.entries(result.settings).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  lines.push(['data_category', 'scenario', ...cols.map((c) => c[0])].join(','));
  for (const [id, run] of Object.entries(result.runs)) {
    const V = run.params.volumeL;
    for (const d of run.days) {
      const vals = cols.map(([name, key]) => {
        if (name === 'fish_wet_g_total') return fishWetGrams(d.fish, V).toFixed(4);
        const v = d[key];
        return typeof v === 'number' ? (Number.isInteger(v) ? v : v.toPrecision(6)) : (v ?? '');
      });
      lines.push([kind, id, ...vals].join(','));
    }
    const b = result.baselines[id];
    if (b) for (const d of b.days) {
      const vals = cols.map(([name, key]) => {
        if (name === 'fish_wet_g_total') return fishWetGrams(d.fish, b.params.volumeL).toFixed(4);
        const v = d[key];
        return typeof v === 'number' ? (Number.isInteger(v) ? v : v.toPrecision(6)) : (v ?? '');
      });
      lines.push(['SIMULATED DATA (baseline)', id, ...vals].join(','));
    }
  }
  return lines.join('\n');
}

export function download(name, text, type = 'text/csv') {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
