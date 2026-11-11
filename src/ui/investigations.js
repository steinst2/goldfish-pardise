/**
 * investigations.js — guided investigations with prediction → procedure → results → evidence →
 * explanation → reflection, plus an exportable lab report.
 *
 * Student writing is kept in memory and, where the browser allows it, in localStorage on this
 * device only (no accounts, no cookies, nothing sent anywhere). Storage failures are ignored.
 */
import { INVESTIGATIONS, NGSS } from './content.js';
import { runMetrics, download } from './lab.js';
import { formatNumber } from '../visualization/charts.js';
import { DATA_KINDS } from '../data/provenance.js';

const STORE_KEY = 'goldfish-paradise-lab-v1';
const FIELDS = [
  ['prediction', 'My prediction (before running)'],
  ['results', 'Results (what happened — numbers from your runs)'],
  ['evidence', 'Evidence (which data support your claim?)'],
  ['explanation', 'Scientific explanation (claim + reasoning)'],
  ['reflection', 'Reflection (model limitations; what would you test next?)'],
];

const CAPTURE_LABELS = {
  algae: ['Algae', 'mg/L'], chl: ['Chlorophyll-a (est.)', 'µg/L'], limiting: ['Algae limited by', ''], fL: ['f_light', ''], fN: ['f_N', ''], fP: ['f_P', ''],
  po4: ['Phosphate-P', 'mg/L'], din: ['Dissolved N', 'mg N/L'], doMinRun: ['Lowest DO in run', 'mg/L'], fishWetG: ['Fish (all)', 'g wet'],
  firstLowDODay: ['First day DO below stress line', ''], deathHypoxiaG: ['Fish lost to low O₂', 'g'], deathAmmoniaG: ['Fish lost to ammonia', 'g'],
  bact: ['Decomposers', 'mg/L'], nh3: ['Un-ionized NH₃-N', 'mg/L'], crop: ['Crops', 'mg/L'], harvestN: ['N removed by harvest', 'g N'],
  eFishIngest: ['Energy eaten by fish', 'kJ'], eFishProd: ['Energy stored in new fish', 'kJ'], eHeatFish: ['Heat from fish respiration', 'kJ'], eff: ['Fish growth efficiency', '%'], eGPP: ['Producer energy captured', 'kJ'],
  feedN: ['N added in food', 'g N'], nitrified: ['N nitrified (NH₄⁺→NO₃⁻)', 'g N'], denitrified: ['N lost as N₂ gas', 'g N'], nBalance: ['N mass-balance error', 'g'], gppC: ['C fixed by algae', 'g C'], respC: ['C respired to CO₂', 'g C'],
};

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch { return {}; }
}
function save(state) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* storage unavailable: keep in memory */ }
}

export class Investigations {
  constructor(root, { applySetup, getResult, getObservationSummary }) {
    this.root = root;
    this.applySetup = applySetup;
    this.getResult = getResult;
    this.getObservationSummary = getObservationSummary;
    this.state = load();
    this.state.student = this.state.student || { name: '', period: '' };
    this.state.inv = this.state.inv || {};
  }

  render() {
    const nav = INVESTIGATIONS.map((inv, i) => `<button type="button" class="inv-tab" role="tab" aria-selected="${i === 0}" aria-controls="panel-${inv.id}" id="tab-${inv.id}" data-inv="${inv.id}">${i + 1}</button>`).join('');
    const panels = INVESTIGATIONS.map((inv, i) => this.panel(inv, i)).join('');
    this.root.innerHTML = `
      <div class="student-id">
        <label>Name <input id="stu-name" type="text" autocomplete="name" value="${esc(this.state.student.name)}"></label>
        <label>Class / period <input id="stu-period" type="text" value="${esc(this.state.student.period)}"></label>
        <button type="button" class="btn" id="report-html">Download lab report</button>
        <button type="button" class="btn ghost" id="report-print">Print / save as PDF</button>
        <button type="button" class="btn ghost" id="report-clear">Clear my answers</button>
      </div>
      <p class="muted small">Your answers stay on this device only. Nothing is uploaded.</p>
      <p class="inv-status" id="inv-status" role="status" aria-live="polite"></p>
      <div class="inv-nav" role="tablist" aria-label="Investigations">${nav}</div>
      ${panels}`;
    this.root.querySelectorAll('.inv-tab').forEach((b) => b.addEventListener('click', () => this.select(b.dataset.inv)));
    this.root.querySelector('.inv-nav').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const tabs = [...this.root.querySelectorAll('.inv-tab')];
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[j].focus(); this.select(tabs[j].dataset.inv);
    });
    this.root.querySelectorAll('textarea[data-field]').forEach((ta) => ta.addEventListener('input', () => {
      const s = (this.state.inv[ta.dataset.inv] ||= { answers: {}, records: [] });
      s.answers[ta.dataset.field] = ta.value; save(this.state);
    }));
    this.root.querySelector('#stu-name').addEventListener('input', (e) => { this.state.student.name = e.target.value; save(this.state); });
    this.root.querySelector('#stu-period').addEventListener('input', (e) => { this.state.student.period = e.target.value; save(this.state); });
    this.root.querySelectorAll('[data-setup]').forEach((b) => b.addEventListener('click', () => {
      const inv = INVESTIGATIONS.find((x) => x.id === b.dataset.setup);
      this.applySetup(inv.setup);
    }));
    this.root.querySelectorAll('[data-record]').forEach((b) => b.addEventListener('click', () => this.record(b.dataset.record)));
    this.root.querySelectorAll('[data-clearrec]').forEach((b) => b.addEventListener('click', () => {
      const s = this.state.inv[b.dataset.clearrec]; if (s) { s.records = []; save(this.state); this.renderRecords(b.dataset.clearrec); }
    }));
    this.root.querySelector('#report-html').addEventListener('click', () => download(`lab-report-${slug(this.state.student.name || 'student')}.html`, this.reportHTML(), 'text/html'));
    this.root.querySelector('#report-print').addEventListener('click', () => {
      const w = window.open('', '_blank');
      if (!w) { this.notify('Your browser blocked the print window. Use "Download lab report" instead, open the file, and print it.'); return; }
      w.document.write(this.reportHTML()); w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
    });
    this.root.querySelector('#report-clear').addEventListener('click', () => {
      const btn = this.root.querySelector('#report-clear');
      if (btn.dataset.armed !== '1') { btn.dataset.armed = '1'; btn.textContent = 'Click again to delete everything'; this.notify('This deletes all your answers and recorded results on this device. Click the button again to confirm.'); setTimeout(() => { btn.dataset.armed = ''; btn.textContent = 'Clear my answers'; }, 5000); return; }
      this.state = { student: { name: '', period: '' }, inv: {} }; save(this.state); this.render();
    });
    for (const inv of INVESTIGATIONS) this.renderRecords(inv.id);
    this.select(INVESTIGATIONS[0].id);
  }

  select(id) {
    this.root.querySelectorAll('.inv-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.inv === id)));
    this.root.querySelectorAll('.inv-panel').forEach((p) => { p.hidden = p.id !== `panel-${id}`; });
  }

  panel(inv, i) {
    const s = this.state.inv[inv.id] || { answers: {} };
    const tags = inv.ngss.map((k) => `<abbr class="ngss-tag" title="${esc(NGSS[k])}">${k}</abbr>`).join(' ');
    return `<section class="inv-panel" id="panel-${inv.id}" role="tabpanel" aria-labelledby="tab-${inv.id}" ${i ? 'hidden' : ''}>
      <h2>${inv.title}</h2>
      <p class="ngss-row">Standards: ${tags}</p>
      <p class="inv-question"><strong>Question:</strong> ${inv.question}</p>
      <details open class="inv-bg"><summary>Background</summary><p>${inv.background}</p></details>
      <h3>Procedure</h3>
      <ol>${inv.procedure.map((x) => `<li>${x}</li>`).join('')}</ol>
      ${inv.setup ? `<p><button type="button" class="btn" data-setup="${inv.id}">Set up this investigation</button> <span class="muted small">${inv.setupNote || 'Loads the starting settings in the Lab. Then press Run experiment.'}</span></p>` : '<p class="muted small">This investigation uses the Real Water Data tab.</p>'}
      <h3>Recorded results</h3>
      <p><button type="button" class="btn ghost" data-record="${inv.id}">Record my results from the current run</button> <button type="button" class="btn ghost" data-clearrec="${inv.id}">Clear recorded results</button></p>
      <div class="records" id="records-${inv.id}"></div>
      <h3>Your lab write-up</h3>
      <p class="muted small">Claim prompt: ${inv.prompts.claim}<br>Reasoning prompt: ${inv.prompts.reasoning}</p>
      ${FIELDS.map(([f, label]) => `<label class="field">${label}<textarea rows="3" data-inv="${inv.id}" data-field="${f}">${esc(s.answers?.[f] || '')}</textarea></label>`).join('')}
    </section>`;
  }

  record(id) {
    const inv = INVESTIGATIONS.find((x) => x.id === id);
    const s = (this.state.inv[id] ||= { answers: {}, records: [] });
    s.records ||= [];
    if (id === 'inv6') {
      const o = this.getObservationSummary();
      if (!o) { this.notify('Load or import real observations in the Real Water Data tab first.'); return; }
      s.records.push({ kind: 'OBSERVED', label: o.label, when: new Date().toISOString(), values: o.values });
    } else {
      const res = this.getResult();
      if (!res) { this.notify('Run an experiment in the Lab first.'); return; }
      for (const [scn, run] of Object.entries(res.runs)) {
        const m = runMetrics(run);
        const values = {};
        for (const k of inv.capture) values[k] = m[k];
        const st = res.settings;
        s.records.push({ kind: res.kind, scenario: scn, when: new Date().toISOString(), label: `Scenario ${scn}, ${st.days} d, fish ${st.fishCount}, feed ${st.feedPct}%, nutrients level ${st.nutrientLevel}, light ${st.light}%, aeration ${st.aeration}${scn === 'B' ? `, crops ${st.cropDensity}%` : ''}`, values });
      }
    }
    save(this.state);
    this.renderRecords(id);
    this.notify(`Recorded ${s.records.length} result row(s) for this investigation.`);
  }

  notify(msg) {
    const el = this.root.querySelector('#inv-status');
    if (el) el.textContent = msg;
  }

  renderRecords(id) {
    const box = this.root.querySelector(`#records-${id}`);
    if (!box) return;
    box.innerHTML = recordsTable(id, this.state.inv[id]?.records || []);
  }

  reportHTML() {
    const st = this.state;
    const parts = INVESTIGATIONS.map((inv) => {
      const s = st.inv[inv.id];
      if (!s || (!s.records?.length && !Object.values(s.answers || {}).some((v) => v && v.trim()))) return '';
      return `<section><h2>${inv.title}</h2><p><em>${inv.question}</em></p><p>Standards: ${inv.ngss.join(', ')}</p>
        <h3>Recorded results</h3>${recordsTable(inv.id, s.records || [])}
        ${FIELDS.map(([f, label]) => `<h3>${label}</h3><p>${esc(s.answers?.[f] || '—').replace(/\n/g, '<br>')}</p>`).join('')}</section>`;
    }).join('');
    const charts = [...document.querySelectorAll('#charts canvas')].slice(0, 8).map((c) => {
      try { return `<img alt="${esc(c.getAttribute('aria-label') || 'chart')}" src="${c.toDataURL('image/png')}">`; } catch { return ''; }
    }).join('');
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Lab report — ${esc(st.student.name)}</title>
      <style>body{font:14px/1.5 system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;color:#111}h1{font-size:1.5rem}h2{border-top:2px solid #1d6f78;padding-top:.8rem;margin-top:2rem}table{border-collapse:collapse;font-size:12px;margin:.5rem 0}td,th{border:1px solid #bbb;padding:3px 6px;text-align:left}.kind{font-weight:700;font-size:11px;letter-spacing:.04em}.grid img{width:48%;margin:1%;border:1px solid #ddd}@media print{h2{break-before:auto}}</style></head><body>
      <h1>Goldfish Paradise Ecosystem Lab — Lab Report</h1>
      <p><strong>Name:</strong> ${esc(st.student.name || '—')} &nbsp; <strong>Class:</strong> ${esc(st.student.period || '—')} &nbsp; <strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
      <p><strong>About the data:</strong> rows marked ${DATA_KINDS.SIMULATED.label} or ${DATA_KINDS.EXPERIMENT.label} come from a simplified classroom model with illustrative parameters — they are not measurements. Rows marked ${DATA_KINDS.OBSERVED.label} are real measurements; their source is listed with them.</p>
      ${parts || '<p>No investigation answers yet.</p>'}
      <h2>Charts from the most recent run</h2><div class="grid">${charts}</div>
      </body></html>`;
  }
}

function recordsTable(id, records) {
  if (!records.length) return '<p class="muted small">No results recorded yet.</p>';
  const inv = INVESTIGATIONS.find((x) => x.id === id);
  const keys = id === 'inv6' ? Object.keys(records[0].values) : inv.capture;
  const head = keys.map((k) => { const [l, u] = CAPTURE_LABELS[k] || [k, '']; return `<th scope="col">${l}${u ? ` (${u})` : ''}</th>`; }).join('');
  const body = records.map((r, i) => {
    const kind = DATA_KINDS[r.kind] || DATA_KINDS.SIMULATED;
    return `<tr><th scope="row">${i + 1}</th><td><span class="kind ${kind.className}">${kind.label}</span><br><small>${esc(r.label)}</small></td>${keys.map((k) => `<td>${typeof r.values[k] === 'number' ? formatNumber(r.values[k]) : esc(r.values[k] ?? '—')}</td>`).join('')}</tr>`;
  }).join('');
  return `<div class="table-scroll"><table class="records-table"><thead><tr><th scope="col">#</th><th scope="col">Run</th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'student'; }
