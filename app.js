/**
 * app.js — entry point. Wires tabs, controls, the lab, investigations, real data and quiz.
 * No network requests are needed for the simulation; data/ files are only fetched when the
 * Real Water Data tab lists bundled datasets.
 */
import { LabView, runExperiment, defaultsFor, experimentCSV, download, NUTRIENT_LEVELS } from './src/ui/lab.js';
import { Investigations } from './src/ui/investigations.js';
import { RealDataView } from './src/ui/realdata.js';
import { renderQuiz } from './src/ui/quiz.js';
import { NGSS, NGSS_MAP, MISSIONS } from './src/ui/content.js';
import { BasicView, BASIC_DEFAULTS, basicToSettings, isBasicDefault } from './src/ui/basic.js';
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
renderQuiz($('#basic-quiz'), { basic: true });

$('#ngss-map').innerHTML = `<table class="records-table"><thead><tr><th scope="col">Standard</th><th scope="col">Where students do it in this app</th></tr></thead><tbody>${NGSS_MAP.map((r) => `<tr><th scope="row"><abbr title="${NGSS[r.std]}">${r.std}</abbr><br><small>${NGSS[r.std]}</small></th><td><ul>${r.activities.map((a) => `<li>${a}</li>`).join('')}</ul></td></tr>`).join('')}</tbody></table>`;

/* ------------------------------------------------------------------ Basic mode */
const bform = $('#basic-controls');
const basic = new BasicView($('#view-lab'));
basic.mount();

function readBasic() {
  const fd = new FormData(bform);
  return { scenario: fd.get('scenario'), fishCount: +bform.elements.fishCount.value, food: fd.get('food'), light: fd.get('light'), pump: fd.get('pump'), days: +fd.get('days') };
}
function writeBasic(b) {
  for (const [k, v] of Object.entries(b)) {
    const el = bform.elements[k];
    if (!el) continue;
    if (el instanceof RadioNodeList) { for (const r of el) r.checked = r.value === String(v); } else el.value = String(v);
  }
  bform.querySelector('output[data-for=fishCount]').textContent = bform.elements.fishCount.value;
}
function runBasic() {
  const b = readBasic();
  const st = basicToSettings(b);
  lastResult = runExperiment(st, { baseline: false, changed: !isBasicDefault(b) });
  basic.render(lastResult);
  writeSettings(st); // keep Advanced controls in step, so switching modes shows the same tank
}
bform.addEventListener('input', () => { bform.querySelector('output[data-for=fishCount]').textContent = bform.elements.fishCount.value; bform.elements.fishCount.setAttribute('aria-valuetext', bform.elements.fishCount.value + ' fish'); });
bform.addEventListener('submit', (e) => { e.preventDefault(); runBasic(); });
$('#basic-reset').addEventListener('click', () => { writeBasic(BASIC_DEFAULTS); runBasic(); });

function renderMissions() {
  const box = $('#missions');
  box.innerHTML = `<h2>Missions</h2>
    <p>Work through these with the <a href="docs/lab-worksheet.pdf" target="_blank" rel="noopener">paper lab worksheet (PDF)</a>. Write your predictions and answers on the worksheet.</p>` +
    MISSIONS.map((m) => `<section class="inv-panel mission">
      <h3>${m.title}</h3>
      <p class="ngss-row">${m.ngss.map((k) => `<abbr class="ngss-tag" title="${NGSS[k]}">${k}</abbr>`).join(' ')} · <span class="muted">${m.pages}</span></p>
      <p><strong>Goal:</strong> ${m.goal}</p>
      <ol>${m.steps.map((x) => `<li>${x}</li>`).join('')}</ol>
      <p><button type="button" class="btn" data-mission="${m.id}">${m.setup.scenario === 'compare' ? 'Load the comparison' : 'Load the starting tank'}</button></p>
    </section>`).join('');
  box.querySelectorAll('[data-mission]').forEach((b) => b.addEventListener('click', () => {
    const m = MISSIONS.find((x) => x.id === b.dataset.mission);
    writeBasic(m.setup);
    selectTab($('#tab-lab'), true);
    runBasic();
    bform.querySelector('button[type=submit]').focus();
  }));
}
renderMissions();

/* ------------------------------------------------------------------ mode switch */
let mode = 'basic';
function setMode(m, { rerun = true } = {}) {
  mode = m;
  document.body.classList.toggle('mode-basic', m === 'basic');
  document.body.classList.toggle('mode-advanced', m === 'advanced');
  $('#mode-basic').setAttribute('aria-pressed', String(m === 'basic'));
  $('#mode-advanced').setAttribute('aria-pressed', String(m === 'advanced'));
  try { localStorage.setItem('gp-mode', m); } catch { /* storage unavailable */ }
  if (rerun) (m === 'basic' ? runBasic : run)();
}
$('#mode-basic').addEventListener('click', () => setMode('basic'));
$('#mode-advanced').addEventListener('click', () => setMode('advanced'));

/* ------------------------------------------------------------------ start */
writeSettings(defaultsFor('A'));
writeBasic(BASIC_DEFAULTS);
let saved = null;
try { saved = localStorage.getItem('gp-mode'); } catch { /* ignore */ }
const params = new URLSearchParams(location.search);
setMode(params.get('mode') === 'advanced' || (!params.get('mode') && saved === 'advanced') ? 'advanced' : 'basic');
const hash = location.hash.slice(1);
const startTab = tabs.find((t) => t.id === 'tab-' + hash);
if (startTab) selectTab(startTab);
