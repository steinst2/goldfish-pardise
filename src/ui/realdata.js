/**
 * realdata.js — the Real Water Data tab: load bundled or imported OBSERVED data, inspect its
 * provenance and quality flags, and view it NEXT TO (never merged with) the model output.
 */
import { importObservations, summarize, ImportError } from '../data/import.js';
import { provenanceFor, citation, DATA_KINDS } from '../data/provenance.js';
import { LineChart, formatNumber } from '../visualization/charts.js';
import { esc } from './investigations.js';

const MODEL_FIELD = {
  do: { key: 'doMean', label: 'Dissolved oxygen (daily mean)', unit: 'mg/L' },
  no3: { key: 'no3', label: 'Nitrate-N', unit: 'mg N/L' },
  nh4: { key: 'nh4', label: 'Ammonium-N', unit: 'mg N/L' },
  po4: { key: 'po4', label: 'Phosphate-P', unit: 'mg P/L' },
  dissolvedP: { key: 'dissolvedP', label: 'Dissolved phosphate-P', unit: 'mg P/L' },
  waterTotalP: { key: 'waterTotalP', label: 'Total P in a water sample', unit: 'mg P/L' },
  waterTotalN: { key: 'waterTotalN', label: 'Total N in a water sample', unit: 'mg N/L' },
  chl: { key: 'chlEstimate', label: 'Chlorophyll-a (estimated from algae)', unit: 'µg/L' },
  tempC: null, pH: null,
};

export class RealDataView {
  constructor(root, { getResult }) {
    this.root = root;
    this.getResult = getResult;
    this.dataset = null;
    this.prov = null;
    this.selection = null;
  }

  async init() {
    const fileInput = this.root.querySelector('#obs-file');
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) this.readFile(fileInput.files[0]); });
    const drop = this.root.querySelector('#obs-drop');
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('drag'); const f = e.dataTransfer.files[0]; if (f) this.readFile(f); });
    this.obsChart = new LineChart(this.root.querySelector('#obs-chart'), { title: 'Observed', series: [], xLabel: 'Days since first sample' });
    this.simChart = new LineChart(this.root.querySelector('#sim-chart'), { title: 'Simulated', series: [] });
    this.root.querySelector('#obs-loc').addEventListener('change', () => this.renderSelection());
    this.root.querySelector('#obs-char').addEventListener('change', () => this.renderSelection());
    await this.loadCatalog();
  }

  async loadCatalog() {
    const box = this.root.querySelector('#bundled');
    try {
      const res = await fetch('data/datasets/index.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(String(res.status));
      const cat = await res.json();
      const list = (cat.datasets || []);
      if (!list.length) {
        box.innerHTML = `<p class="muted">No classroom datasets have been bundled yet. Your teacher can create one with <code>scripts/fetch_wqp.py</code> (see the Teacher tab), or you can import a CSV below.</p>`;
      } else {
        box.innerHTML = '<ul class="dataset-list">' + list.map((d, i) => `<li><button type="button" class="btn ghost" data-ds="${i}">Load</button> <strong>${esc(d.title)}</strong><br><small>${esc(d.location_name || '')} (${esc(d.location_id || '')}) · ${esc(d.date_range || '')} · retrieved ${esc(d.retrieved_utc || '?')}</small></li>`).join('') + '</ul>';
        box.querySelectorAll('[data-ds]').forEach((b) => b.addEventListener('click', async () => {
          const d = list[+b.dataset.ds];
          try {
            const r = await fetch(`data/datasets/${d.file}`, { cache: 'no-cache' });
            if (!r.ok) throw new Error(`could not download ${d.file} (HTTP ${r.status})`);
            this.load(await r.text(), d.file);
          } catch (e) { this.showError(`Could not load the bundled dataset: ${e.message}`); }
        }));
      }
    } catch {
      box.innerHTML = '<p class="muted">The bundled-dataset list could not be read (this is normal when the app is opened directly from a file). Import a CSV below instead.</p>';
    }
    // candidate monitoring locations (metadata only — no values)
    const cbox = this.root.querySelector('#candidates');
    try {
      const r = await fetch('data/metadata/bay-county-candidate-locations.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error();
      const c = await r.json();
      cbox.innerHTML = `<p class="small">${esc(c.note)}</p><ul class="cand-list">${c.locations.map((l) => `<li><strong>${esc(l.name)}</strong> — <code>${esc(l.id)}</code> (${esc(l.organization)})<br><small>${esc(l.availability)} · <a href="${esc(l.source_url)}" target="_blank" rel="noopener noreferrer">site page<span class="sr-only"> (opens in a new tab)</span></a></small></li>`).join('')}</ul>`;
    } catch {
      cbox.textContent = 'Candidate-location list unavailable.';
    }
  }

  readFile(file) {
    if (file.size > 25 * 1024 * 1024) { this.showError('That file is larger than 25 MB. Ask your teacher to filter it with scripts/fetch_wqp.py (fewer characteristics or a shorter date range).'); return; }
    const reader = new FileReader();
    reader.onload = () => this.load(String(reader.result), file.name);
    reader.onerror = () => this.showError('The file could not be read by the browser.');
    reader.readAsText(file);
  }

  showError(msg) {
    const el = this.root.querySelector('#obs-messages');
    el.innerHTML = `<div class="msg msg-error" role="alert"><strong>Import problem:</strong> ${esc(msg)}</div>`;
  }

  load(text, name) {
    let ds;
    try { ds = importObservations(text, name); }
    catch (e) { this.showError(e instanceof ImportError ? e.message : `Unexpected problem reading the file (${e.message}).`); return; }
    this.dataset = ds;
    this.prov = provenanceFor(ds);
    const msgs = this.root.querySelector('#obs-messages');
    msgs.innerHTML = [
      `<div class="msg msg-ok" role="status">Imported <strong>${ds.report.validRows}</strong> usable observations of ${ds.report.total} rows from <code>${esc(name)}</code>. ${ds.report.comparable} can be compared with the model.</div>`,
      ...ds.report.errors.map((e) => `<div class="msg msg-error">${esc(e.message)}</div>`),
      ...ds.report.warnings.map((w) => `<div class="msg msg-warn">${esc(w.message)}</div>`),
    ].join('');
    const loc = this.root.querySelector('#obs-loc');
    loc.innerHTML = [...ds.locations.entries()].map(([id, rows]) => `<option value="${esc(id)}">${esc(rows[0].locationName || id)} — ${esc(id)} (${rows.length})</option>`).join('');
    this.fillCharacteristics();
    loc.onchange = () => { this.fillCharacteristics(); this.renderSelection(); };
    this.root.querySelector('#obs-view').hidden = false;
    this.renderProvenance();
    this.renderSelection();
  }

  fillCharacteristics() {
    const ds = this.dataset;
    const locId = this.root.querySelector('#obs-loc').value;
    const rows = ds.locations.get(locId) || [];
    const groups = new Map();
    for (const r of rows) {
      const k = `${r.characteristic}${r.fraction ? ' (' + r.fraction + ')' : ''} [${r.unit}]`;
      if (!groups.has(k)) groups.set(k, 0);
      groups.set(k, groups.get(k) + 1);
    }
    const sel = this.root.querySelector('#obs-char');
    sel.innerHTML = [...groups.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `<option value="${esc(k)}">${esc(k)} — ${n} results</option>`).join('');
  }

  renderProvenance() {
    const p = this.prov;
    this.root.querySelector('#obs-prov').innerHTML = `
      <p><span class="kind-badge ${DATA_KINDS.OBSERVED.className}">${DATA_KINDS.OBSERVED.label}</span></p>
      <dl class="prov">
        <dt>Original source</dt><dd>${esc(p.source_name)} — <a href="${esc(p.source_url)}" target="_blank" rel="noopener noreferrer">${esc(p.source_url)}<span class="sr-only"> (opens in a new tab)</span></a></dd>
        <dt>Query</dt><dd class="wrap">${esc(p.query_url)}</dd>
        <dt>Downloaded</dt><dd>${esc(p.retrieved_utc)}</dd>
        <dt>Data provider(s)</dt><dd>${esc(p.providers.join(', ') || 'not listed')}</dd>
        <dt>Monitoring organization(s)</dt><dd>${esc(p.organizations.join(', ') || 'not listed')}</dd>
        <dt>Collection dates</dt><dd>${p.collection_dates ? `${p.collection_dates.first} to ${p.collection_dates.last}` : '—'}</dd>
      </dl>
      <p class="small"><strong>Cite as:</strong> ${esc(citation(p))}</p>`;
  }

  currentRows() {
    const ds = this.dataset;
    if (!ds) return [];
    const locId = this.root.querySelector('#obs-loc').value;
    const key = this.root.querySelector('#obs-char').value;
    return (ds.locations.get(locId) || []).filter((r) => `${r.characteristic}${r.fraction ? ' (' + r.fraction + ')' : ''} [${r.unit}]` === key)
      .sort((a, b) => (a.isoDate + a.time < b.isoDate + b.time ? -1 : 1));
  }

  renderSelection() {
    const rows = this.currentRows();
    if (!rows.length) return;
    const r0 = rows[0];
    const t0 = Date.parse(rows[0].isoDate + 'T00:00:00Z');
    const xs = rows.map((r) => Math.round((Date.parse(r.isoDate + 'T00:00:00Z') - t0) / 86400000));
    const ys = rows.map((r) => r.value);
    this.obsChart.update({
      title: `OBSERVED — ${r0.characteristic}`, unit: `${r0.unit} (original units)`, xLabel: `Days since ${rows[0].isoDate}`,
      series: [{ name: `${r0.locationName || r0.locationId}`, x: xs, y: ys, kind: 'obs', colorIndex: 0, labels: rows.map((r) => r.isoDate) }],
      note: `Each diamond is one sample. Values are shown exactly as reported (${r0.unit}). Samples are not connected because nothing was measured between them.`,
    });
    // details table with qualifiers
    const st = summarize(ys);
    const table = rows.slice(0, 400).map((r) => `<tr><td>${r.isoDate}${r.time ? ' ' + esc(r.time) : ''}</td><td>${esc(r.rawValue)}</td><td>${esc(r.unit)}</td><td>${Number.isFinite(r.modelValue) ? formatNumber(r.modelValue) + ' ' + esc(r.modelUnit) : '<span class="muted">not converted</span>'}</td><td>${esc([r.status, r.qualifier, r.detection].filter(Boolean).join(' · ') || '—')}</td><td>${r.flag ? `<span class="flag">⚠ ${esc(r.flag)}</span>` : ''}${r.conversionNote ? `<small>${esc(r.conversionNote)}</small>` : ''}</td></tr>`).join('');
    this.root.querySelector('#obs-table').innerHTML = `
      <p class="small">n = ${st.n} · min ${formatNumber(st.min)} · median ${formatNumber(st.median)} · max ${formatNumber(st.max)} ${esc(r0.unit)}</p>
      <details><summary>All samples with quality information (${rows.length})</summary><div class="table-scroll"><table class="records-table"><thead><tr><th>Date</th><th>Original value</th><th>Original unit</th><th>Model-unit value</th><th>Status · qualifier · detection</th><th>Notes</th></tr></thead><tbody>${table}</tbody></table></div></details>`;
    this.selection = { rows, stats: st };
    this.renderComparison();
  }

  renderComparison() {
    const sel = this.selection;
    const box = this.root.querySelector('#compare-note');
    if (!sel) return;
    const r0 = sel.rows[0];
    const mf = r0.variable ? MODEL_FIELD[r0.variable] : null;
    const res = this.getResult();
    if (!mf) {
      box.innerHTML = `<p class="msg msg-warn">The classroom model does not simulate “${esc(r0.characteristic)}” as a changing quantity (temperature and pH are fixed settings in the model), so there is nothing to compare side by side. You can still describe the pattern.</p>`;
      this.simChart.update({ title: 'SIMULATED — not available for this characteristic', series: [] });
      return;
    }
    if (!res) {
      box.innerHTML = '<p class="msg msg-warn">Run an experiment in the Lab first, then return here to see the model output beside the observations.</p>';
      return;
    }
    const conv = sel.rows.map((r) => r.modelValue).filter(Number.isFinite);
    const series = Object.entries(res.runs).map(([id, run], j) => ({ name: `Scenario ${id}`, x: run.days.map((d) => d.day), y: run.days.map((d) => d[mf.key]), colorIndex: j + 1, kind: 'sim' }));
    const kind = DATA_KINDS[res.kind];
    this.simChart.update({ title: `${kind.label} — ${mf.label}`, unit: mf.unit, series, yMin: 0, note: 'Model tank output. Separate axis on purpose: a river or lake is not an aquarium.' });
    const cs = summarize(conv);
    const simVals = Object.values(res.runs)[0].days.map((d) => d[mf.key]);
    const ss = summarize(simVals);
    box.innerHTML = `
      <table class="records-table"><caption>Side-by-side summary in the model's unit (${esc(mf.unit)})</caption>
      <thead><tr><th></th><th>n</th><th>Min</th><th>Median</th><th>Max</th></tr></thead><tbody>
      <tr><th scope="row"><span class="kind kind-observed">OBSERVED</span> ${esc(r0.locationId)}</th><td>${cs.n}</td><td>${formatNumber(cs.min)}</td><td>${formatNumber(cs.median)}</td><td>${formatNumber(cs.max)}</td></tr>
      <tr><th scope="row"><span class="kind ${kind.className}">${kind.label}</span> scenario ${Object.keys(res.runs)[0]}, daily values</th><td>${ss.n}</td><td>${formatNumber(ss.min)}</td><td>${formatNumber(ss.median)}</td><td>${formatNumber(ss.max)}</td></tr>
      </tbody></table>
      ${cs.n < sel.rows.length ? `<p class="small muted">${sel.rows.length - cs.n} observation(s) could not be converted to ${esc(mf.unit)} and are left out of this summary (see the notes column).</p>` : ''}
      <p class="small"><strong>Think about it:</strong> the model was not calibrated to this site and should not be. A ${esc(r0.locationName ? 'river or lake' : 'water body')} has flowing water, sediments, seasons, storms and a whole watershed of nutrient sources; the model is one closed tank with a fixed temperature. Use the comparison to discuss scale and patterns, not to judge whether the model is “right”.</p>`;
  }

  /** For Investigation 6 "Record my results". */
  summaryForRecord() {
    const sel = this.selection;
    if (!sel) return null;
    const r0 = sel.rows[0];
    const dates = sel.rows.map((r) => r.isoDate);
    return {
      label: `${r0.locationName || ''} (${r0.locationId}) — ${r0.characteristic}`,
      values: { obsLocation: `${r0.locationName || ''} ${r0.locationId}`, obsCharacteristic: r0.characteristic, obsUnits: r0.unit, obsDates: `${dates[0]} to ${dates[dates.length - 1]}`, obsN: sel.stats.n, obsMedian: sel.stats.median },
    };
  }
}
