/**
 * app.js — entry point. Wires tabs, controls, the lab, investigations, real data and quiz.
 * No network requests are needed for the simulation; data/ files are only fetched when the
 * Real Water Data tab lists bundled datasets.
 */
import { LabView, runExperiment, defaultsFor, experimentCSV, download, NUTRIENT_LEVELS } from './src/ui/lab.js';
import { Investigations } from './src/ui/investigations.js';
import { RealDataView } from './src/ui/realdata.js';
import { renderQuiz } from './src/ui/quiz.js';
import { NGSS, NGSS_MAP } from './src/ui/content.js';
import { AERATION_PRESETS } from './src/model/oxygen.js';

const $ = (s, r = document) => r.querySelector(s);
const form = $('#controls');
let lastResult = null;

/* ------------------------------------------------------------------ tabs */
const tabs = [...document.querySelectorAll('.tabs [role=tab]')];
function selectTab(tab, focus = false) {
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
  }
  if (focus) tab.focus();
  if (tab.id === 'tab-data' && realData) realData.renderComparison();
  try { history.replaceState(null, '', '#' + tab.id.slice(4)); } catch { /* file:// */ }
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowLeft' || k === 'Home' || k === 'End') {
      e.preventDefault();
      const j = k === 'Home' ? 0 : k === 'End' ? tabs.length - 1 : (i + (k === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      selectTab(tabs[j], true);
    }
  });
});

/* ------------------------------------------------------------------ controls */
const FMT = {
  fishCount: (v) => `${v} fish`,
  feedPct: (v) => `${(+v).toFixed(2)} %/day`,
  nutrientLevel: (v) => NUTRIENT_LEVELS[+v].label,
  light: (v) => `${v} %`,
  cropDensity: (v) => `${v} %`,
  tempC: (v) => `${v} °C`,
  photoperiodH: (v) => `${v} h`,
  waterChangePct: (v) => `${v} %`,
  doStress: (v) => `${(+v).toFixed(1)} mg/L`,
  pH: (v) => (+v).toFixed(1),
};

function readSettings() {
  const fd = new FormData(form);
  const s = {};
  for (const [k, v] of fd.entries()) s[k] = v;
  // read numeric controls directly (disabled controls are omitted from FormData)
  for (const k of ['days', 'fishCount', 'feedPct', 'nutrientLevel', 'light', 'cropDensity', 'tempC', 'photoperiodH', 'waterChangePct', 'harvestEvery', 'doStress', 'nitrMaturity', 'pH']) s[k] = Number(form.elements[k].value);
  return s;
}

function writeSettings(s) {
  for (const [k, v] of Object.entries(s)) {
    const els = form.elements[k];
    if (!els) continue;
    if (els instanceof RadioNodeList) { for (const r of els) r.checked = r.value === String(v); }
    else els.value = String(v);
  }
  refreshOutputs();
}

function refreshOutputs() {
  for (const out of form.querySelectorAll('output[data-for]')) {
    const name = out.dataset.for;
    const el = form.elements[name];
    if (el) out.textContent = FMT[name] ? FMT[name](el.value) : el.value;
    const input = form.elements[name];
    if (input?.type === 'range') input.setAttribute('aria-valuetext', out.textContent);
  }
  const scn = new FormData(form).get('scenario');
  const crop = $('#crop-ctl');
  const disabled = scn === 'A';
  crop.classList.toggle('is-disabled', disabled);
  form.elements.cropDensity.disabled = disabled;
  form.elements.harvestEvery.disabled = disabled;
  for (const r of form.elements.aeration) r.parentElement.title = AERATION_PRESETS[r.value].label;
}

form.addEventListener('input', refreshOutputs);
form.addEventListener('change', (e) => {
  // switching scenario loads that scenario's default aeration only if the user hasn't run yet
  if (e.target.name === 'scenario' && !form.dataset.touchedAeration) {
    const d = defaultsFor(e.target.value);
    writeSettings({ aeration: d.aeration });
  }
  if (e.target.name === 'aeration') form.dataset.touchedAeration = '1';
  refreshOutputs();
});

/* ------------------------------------------------------------------ lab */
const lab = new LabView($('#view-lab'));
lab.mountCharts();

function run() {
  const s = readSettings();
  const btn = $('#run');
  btn.disabled = true;
  btn.textContent = 'Running…';
  // let the browser paint the "Running…" state before the (synchronous) model runs
  requestAnimationFrame(() => setTimeout(() => {
    const t0 = performance.now();
    try {
      lastResult = runExperiment(s);
      lab.render(lastResult);
      const ms = performance.now() - t0;
      $('#run-time').textContent = `Simulated ${s.days} days${s.scenario === 'compare' ? ' × 2 scenarios' : ''} in ${ms < 1000 ? Math.round(ms) + ' ms' : (ms / 1000).toFixed(1) + ' s'}.`;
    } catch (err) {
      console.error(err);
      $('#run-time').textContent = `Something went wrong: ${err.message}`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Run experiment';
    }
  }, 0));
}

form.addEventListener('submit', (e) => { e.preventDefault(); run(); });
$('#reset').addEventListener('click', () => {
  delete form.dataset.touchedAeration;
  writeSettings(defaultsFor('A'));
  run();
});
$('#export').addEventListener('click', () => {
  if (!lastResult) return;
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  download(`goldfish-paradise-${lastResult.kind === 'EXPERIMENT' ? 'experiment' : 'simulated'}-${stamp}.csv`, experimentCSV(lastResult));
});
$('#inspect-day').addEventListener('input', (e) => lab.setInspectDay(+e.target.value));

/* ------------------------------------------------------------------ other views */
const realData = new RealDataView($('#view-data'), { getResult: () => lastResult });
realData.init();

const inv = new Investigations($('#investigations'), {
  applySetup: (setup) => {
    const base = defaultsFor(setup.scenario);
    writeSettings({ ...base, ...setup });
    form.dataset.touchedAeration = '1';
    selectTab($('#tab-lab'), true);
    run();
    $('#run').focus();
  },
  getResult: () => lastResult,
  getObservationSummary: () => realData.summaryForRecord(),
});
inv.render();
renderQuiz($('#quiz'));

$('#ngss-map').innerHTML = `<table class="records-table"><thead><tr><th scope="col">Standard</th><th scope="col">Where students do it in this app</th></tr></thead><tbody>${NGSS_MAP.map((r) => `<tr><th scope="row"><abbr title="${NGSS[r.std]}">${r.std}</abbr><br><small>${NGSS[r.std]}</small></th><td><ul>${r.activities.map((a) => `<li>${a}</li>`).join('')}</ul></td></tr>`).join('')}</tbody></table>`;

/* ------------------------------------------------------------------ start */
writeSettings(defaultsFor('A'));
const hash = location.hash.slice(1);
const startTab = tabs.find((t) => t.id === 'tab-' + hash);
if (startTab) selectTab(startTab);
run();
