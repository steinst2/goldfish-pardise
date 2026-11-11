/**
 * charts.js — a small, dependency-free Canvas line-chart component.
 *
 * Design rules (kept deliberately strict for a science classroom):
 *  • ONE y-axis per chart, labelled with its unit. Quantities with different units are never
 *    drawn on the same axis; they get their own panel.
 *  • Series identity is never carried by colour alone: every chart with ≥ 2 series has a
 *    legend AND line-end labels, and series can also differ by dash pattern.
 *  • Data categories are visually distinct:
 *      SIMULATED  – solid line
 *      BASELINE   – thin grey line (the default-settings run, for comparison)
 *      OBSERVED   – diamond markers, never connected by a line (they are discrete samples)
 *  • Hover / keyboard crosshair with a tooltip, and a "table view" for screen readers.
 *  • Redraws only when data or size changes (no animation loop) — gentle on Chromebooks.
 */

export const PALETTE = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};

function isDark() {
  const t = document.documentElement.dataset.theme;
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function seriesColor(i) {
  const p = isDark() ? PALETTE.dark : PALETTE.light;
  return p[i % p.length];
}

function chrome() {
  const dark = isDark();
  return dark
    ? { surface: '#1a1a19', ink: '#f0efec', ink2: '#c3c2b7', muted: '#898781', grid: '#2c2c2a', axis: '#383835', baseline: '#6f6e69', obs: '#f0efec', band: 'rgba(57,135,229,0.18)', thresh: '#e66767' }
    : { surface: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7', baseline: '#a8a69f', obs: '#0b0b0b', band: 'rgba(42,120,214,0.14)', thresh: '#d03b3b' };
}

/** "Nice" tick values for an axis range. */
function niceTicks(min, max, count = 5) {
  if (!(max > min)) { max = min + 1; }
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const err = step0 / mag;
  const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step * 0.5; v += step) ticks.push(+v.toPrecision(12));
  return { ticks, lo, hi, step };
}

export function formatNumber(v, digits = 3) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return v.toFixed(1);
  if (a >= 1) return v.toFixed(2);
  if (a >= 0.01) return v.toFixed(Math.min(digits, 3));
  return v.toExponential(1);
}

/**
 * Create a chart inside `container`.
 * spec = {
 *   title, unit, xLabel, yMin (optional), series: [{name, x:[], y:[], dash, kind:'sim'|'baseline'|'obs', colorIndex}],
 *   band: {x:[], lo:[], hi:[], name}, thresholds: [{y, label}], note
 * }
 */
export class LineChart {
  constructor(container, spec = {}) {
    this.container = container;
    this.spec = spec;
    container.classList.add('chart');
    container.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'chart-head';
    this.titleEl = document.createElement('h4');
    this.titleEl.className = 'chart-title';
    this.unitEl = document.createElement('span');
    this.unitEl.className = 'chart-unit';
    this.tableBtn = document.createElement('button');
    this.tableBtn.type = 'button';
    this.tableBtn.className = 'chart-table-btn';
    this.tableBtn.textContent = 'Table';
    this.tableBtn.setAttribute('aria-pressed', 'false');
    this.tableBtn.addEventListener('click', () => this.toggleTable());
    head.append(this.titleEl, this.unitEl, this.tableBtn);
    this.legendEl = document.createElement('div');
    this.legendEl.className = 'chart-legend';
    this.wrap = document.createElement('div');
    this.wrap.className = 'chart-canvas-wrap';
    this.canvas = document.createElement('canvas');
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('role', 'img');
    this.tip = document.createElement('div');
    this.tip.className = 'chart-tip';
    this.tip.hidden = true;
    this.wrap.append(this.canvas, this.tip);
    this.noteEl = document.createElement('p');
    this.noteEl.className = 'chart-note';
    this.tableEl = document.createElement('div');
    this.tableEl.className = 'chart-table';
    this.tableEl.hidden = true;
    container.append(head, this.legendEl, this.wrap, this.noteEl, this.tableEl);
    this.hoverIndex = null;
    this.canvas.addEventListener('pointermove', (e) => this.onPointer(e));
    this.canvas.addEventListener('pointerleave', () => { this.hoverIndex = null; this.draw(); });
    this.canvas.addEventListener('keydown', (e) => this.onKey(e));
    this.canvas.addEventListener('blur', () => { this.hoverIndex = null; this.draw(); });
    if ('ResizeObserver' in window) {
      this.ro = new ResizeObserver(() => this.draw());
      this.ro.observe(this.wrap);
    } else {
      window.addEventListener('resize', () => this.draw());
    }
    this.update(spec);
  }

  update(spec) {
    this.spec = { ...this.spec, ...spec };
    const s = this.spec;
    this.titleEl.textContent = s.title || '';
    this.unitEl.textContent = s.unit ? `(${s.unit})` : '';
    this.noteEl.textContent = s.note || '';
    this.noteEl.hidden = !s.note;
    this.renderLegend();
    this.canvas.setAttribute('aria-label', this.describe());
    if (!this.tableEl.hidden) this.renderTable();
    this.draw();
  }

  allX() {
    // union x grid from the first non-observed series (charts share a day axis)
    const main = (this.spec.series || []).find((d) => d.kind !== 'obs' && d.x?.length);
    return main ? main.x : [];
  }

  describe() {
    const s = this.spec;
    const parts = [`${s.title || 'Chart'}${s.unit ? ' in ' + s.unit : ''}.`];
    for (const ser of s.series || []) {
      if (!ser.y?.length) continue;
      const first = ser.y[0], last = ser.y[ser.y.length - 1];
      const max = Math.max(...ser.y.filter(Number.isFinite));
      parts.push(`${ser.name}: starts ${formatNumber(first)}, ends ${formatNumber(last)}, maximum ${formatNumber(max)}.`);
    }
    parts.push('Use the left and right arrow keys to read values, or press the Table button.');
    return parts.join(' ');
  }

  renderLegend() {
    const s = this.spec;
    this.legendEl.innerHTML = '';
    const items = (s.series || []).filter((d) => d.y?.length || d.kind === 'obs');
    if (s.band) items.push({ name: s.band.name, kind: 'band' });
    for (const t of s.thresholds || []) items.push({ name: t.label, kind: 'threshold' });
    if (items.length < 2 && !(s.thresholds || []).length) return;
    for (const it of items) {
      const el = document.createElement('span');
      el.className = 'legend-item';
      const sw = document.createElement('span');
      sw.className = 'legend-swatch legend-' + (it.kind || 'sim') + (it.dash ? ' legend-dashed' : '');
      if (it.kind !== 'band' && it.kind !== 'threshold') sw.style.setProperty('--sw', it.kind === 'baseline' ? chrome().baseline : seriesColor(it.colorIndex ?? 0));
      el.append(sw, document.createTextNode(it.name));
      this.legendEl.append(el);
    }
  }

  toggleTable() {
    const show = this.tableEl.hidden;
    this.tableEl.hidden = !show;
    this.tableBtn.setAttribute('aria-pressed', String(show));
    if (show) this.renderTable();
  }

  renderTable() {
    const s = this.spec;
    const xs = this.allX();
    const ser = (s.series || []).filter((d) => d.kind !== 'obs' && d.y?.length);
    if (!xs.length) { this.tableEl.textContent = 'No data yet.'; return; }
    const stride = Math.max(1, Math.ceil(xs.length / 60));
    let html = `<table><caption>${s.title} (${s.unit || ''}) — every ${stride} day(s)</caption><thead><tr><th scope="col">${s.xLabel || 'Day'}</th>`;
    for (const d of ser) html += `<th scope="col">${d.name}</th>`;
    if (s.band) html += `<th scope="col">${s.band.name} (low)</th><th scope="col">${s.band.name} (high)</th>`;
    html += '</tr></thead><tbody>';
    for (let i = 0; i < xs.length; i += stride) {
      html += `<tr><th scope="row">${xs[i]}</th>`;
      for (const d of ser) html += `<td>${formatNumber(d.y[i])}</td>`;
      if (s.band) html += `<td>${formatNumber(s.band.lo[i])}</td><td>${formatNumber(s.band.hi[i])}</td>`;
      html += '</tr>';
    }
    html += '</tbody></table>';
    const obs = (s.series || []).filter((d) => d.kind === 'obs');
    for (const o of obs) {
      html += `<table><caption>${o.name}</caption><thead><tr><th>Date</th><th>Value</th></tr></thead><tbody>`;
      o.x.forEach((x, i) => { html += `<tr><td>${o.labels?.[i] ?? x}</td><td>${formatNumber(o.y[i])}</td></tr>`; });
      html += '</tbody></table>';
    }
    this.tableEl.innerHTML = html;
  }

  layout() {
    const rect = this.wrap.getBoundingClientRect();
    const w = Math.max(240, Math.floor(rect.width));
    const h = this.spec.height || 220;
    return { w, h, left: 52, right: 74, top: 10, bottom: 30 };
  }

  domain() {
    const s = this.spec;
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    const take = (x, y) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      if (x < xmin) xmin = x; if (x > xmax) xmax = x;
      if (y < ymin) ymin = y; if (y > ymax) ymax = y;
    };
    for (const d of s.series || []) for (let i = 0; i < (d.y?.length || 0); i++) take(d.x[i], d.y[i]);
    if (s.band) for (let i = 0; i < s.band.x.length; i++) { take(s.band.x[i], s.band.lo[i]); take(s.band.x[i], s.band.hi[i]); }
    for (const t of s.thresholds || []) if (Number.isFinite(t.y)) { ymin = Math.min(ymin, t.y); ymax = Math.max(ymax, t.y); }
    if (!Number.isFinite(xmin)) { xmin = 0; xmax = 1; ymin = 0; ymax = 1; }
    if (s.yMin !== undefined) ymin = Math.min(s.yMin, ymin);
    if (ymax === ymin) ymax = ymin + 1;
    const t = niceTicks(ymin, ymax, 4);
    return { xmin, xmax: xmax === xmin ? xmin + 1 : xmax, ymin: t.lo, ymax: t.hi, yticks: t.ticks, ystep: t.step };
  }

  draw() {
    const c = this.canvas;
    const L = this.layout();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.style.width = L.w + 'px';
    c.style.height = L.h + 'px';
    if (c.width !== Math.round(L.w * dpr) || c.height !== Math.round(L.h * dpr)) {
      c.width = Math.round(L.w * dpr);
      c.height = Math.round(L.h * dpr);
    }
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const k = chrome();
    g.fillStyle = k.surface;
    g.fillRect(0, 0, L.w, L.h);
    const D = this.domain();
    this.D = D; this.L = L;
    const pw = L.w - L.left - L.right, ph = L.h - L.top - L.bottom;
    const X = (x) => L.left + ((x - D.xmin) / (D.xmax - D.xmin)) * pw;
    const Y = (y) => L.top + ph - ((y - D.ymin) / (D.ymax - D.ymin)) * ph;
    this.X = X; this.Y = Y;
    g.font = '11px system-ui, -apple-system, "Segoe UI", sans-serif';
    // grid + y ticks
    g.strokeStyle = k.grid; g.lineWidth = 1; g.fillStyle = k.muted; g.textAlign = 'right'; g.textBaseline = 'middle';
    for (const t of D.yticks) {
      const y = Math.round(Y(t)) + 0.5;
      g.beginPath(); g.moveTo(L.left, y); g.lineTo(L.left + pw, y); g.stroke();
      g.fillText(formatTick(t, D.ystep), L.left - 6, y);
    }
    // x ticks
    const xt = niceTicks(D.xmin, D.xmax, Math.max(2, Math.floor(pw / 80)));
    g.textAlign = 'center'; g.textBaseline = 'top';
    for (const t of xt.ticks) {
      if (t < D.xmin - 1e-9 || t > D.xmax + 1e-9) continue;
      g.fillText(String(t), X(t), L.top + ph + 6);
    }
    g.strokeStyle = k.axis;
    g.beginPath(); g.moveTo(L.left, L.top + ph + 0.5); g.lineTo(L.left + pw, L.top + ph + 0.5); g.stroke();
    g.fillStyle = k.muted; g.textAlign = 'right';
    g.fillText(this.spec.xLabel || 'Day', L.left + pw, L.top + ph + 18);

    const s = this.spec;
    // band (e.g. daily DO min–max)
    if (s.band && s.band.x.length) {
      g.fillStyle = k.band;
      g.beginPath();
      s.band.x.forEach((x, i) => { const px = X(x), py = Y(s.band.hi[i]); i ? g.lineTo(px, py) : g.moveTo(px, py); });
      for (let i = s.band.x.length - 1; i >= 0; i--) g.lineTo(X(s.band.x[i]), Y(s.band.lo[i]));
      g.closePath(); g.fill();
    }
    // thresholds
    for (const t of s.thresholds || []) {
      g.save();
      g.strokeStyle = t.color || k.thresh; g.setLineDash([5, 4]); g.lineWidth = 1.5;
      const y = Y(t.y);
      g.beginPath(); g.moveTo(L.left, y); g.lineTo(L.left + pw, y); g.stroke();
      g.restore();
      g.fillStyle = k.ink2; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText(t.short || '', L.left + pw + 6, y);
    }
    // series
    const labels = [];
    for (const d of s.series || []) {
      if (!d.y?.length) continue;
      const col = d.kind === 'baseline' ? k.baseline : seriesColor(d.colorIndex ?? 0);
      if (d.kind === 'obs') {
        g.fillStyle = col; g.strokeStyle = k.surface; g.lineWidth = 2;
        for (let i = 0; i < d.y.length; i++) {
          const px = X(d.x[i]), py = Y(d.y[i]);
          g.beginPath(); g.moveTo(px, py - 5); g.lineTo(px + 5, py); g.lineTo(px, py + 5); g.lineTo(px - 5, py); g.closePath();
          g.stroke(); g.fill();
        }
        continue;
      }
      g.save();
      g.strokeStyle = col;
      g.lineWidth = d.kind === 'baseline' ? 1.25 : 2;
      g.lineJoin = 'round'; g.lineCap = 'round';
      if (d.dash) g.setLineDash(d.dash);
      g.beginPath();
      // decimate to ~2 points per pixel for speed on long runs
      const n = d.y.length, stride = Math.max(1, Math.floor(n / (pw * 2)));
      let started = false;
      for (let i = 0; i < n; i += stride) {
        const y = d.y[i];
        if (!Number.isFinite(y)) { started = false; continue; }
        const px = X(d.x[i]), py = Y(y);
        started ? g.lineTo(px, py) : g.moveTo(px, py);
        started = true;
      }
      g.stroke();
      g.restore();
      if (d.kind !== 'baseline') labels.push({ y: Y(d.y[n - 1]), text: d.short || d.name, col });
    }
    // line-end direct labels (≤ 4 series), nudged apart
    if (labels.length && labels.length <= 4) {
      labels.sort((a, b) => a.y - b.y);
      for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 12) labels[i].y = labels[i - 1].y + 12;
      g.textAlign = 'left'; g.textBaseline = 'middle';
      for (const lb of labels) {
        g.fillStyle = lb.col; g.fillRect(L.left + pw + 4, lb.y - 1, 6, 2);
        g.fillStyle = k.ink2; g.fillText(truncate(lb.text, 11), L.left + pw + 13, lb.y);
      }
    }
    // crosshair
    if (this.hoverIndex !== null) this.drawHover(g, k);
  }

  drawHover(g, k) {
    const xs = this.allX();
    const i = this.hoverIndex;
    if (!xs.length || i < 0 || i >= xs.length) { this.tip.hidden = true; return; }
    const L = this.L, X = this.X, Y = this.Y;
    const x = X(xs[i]);
    g.strokeStyle = k.muted; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x + 0.5, L.top); g.lineTo(x + 0.5, L.h - L.bottom); g.stroke();
    const rows = [];
    for (const d of this.spec.series || []) {
      if (d.kind === 'obs' || !d.y?.length) continue;
      const v = d.y[i];
      const col = d.kind === 'baseline' ? k.baseline : seriesColor(d.colorIndex ?? 0);
      if (Number.isFinite(v)) {
        g.fillStyle = col; g.strokeStyle = k.surface; g.lineWidth = 2;
        g.beginPath(); g.arc(x, Y(v), 4, 0, Math.PI * 2); g.fill(); g.stroke();
      }
      rows.push(`<div class="tip-row"><span class="tip-sw" style="background:${col}"></span>${d.name}: <b>${formatNumber(v)}</b></div>`);
    }
    if (this.spec.band) rows.push(`<div class="tip-row">${this.spec.band.name}: ${formatNumber(this.spec.band.lo[i])}–${formatNumber(this.spec.band.hi[i])}</div>`);
    this.tip.innerHTML = `<div class="tip-head">${this.spec.xLabel || 'Day'} ${xs[i]}</div>${rows.join('')}<div class="tip-unit">${this.spec.unit || ''}</div>`;
    this.tip.hidden = false;
    const tw = this.tip.offsetWidth;
    let left = x + 12;
    if (left + tw > L.w - 4) left = x - tw - 12;
    this.tip.style.left = Math.max(4, left) + 'px';
    this.tip.style.top = L.top + 'px';
  }

  onPointer(e) {
    const xs = this.allX();
    if (!xs.length || !this.X) return;
    const r = this.canvas.getBoundingClientRect();
    const px = e.clientX - r.left;
    const D = this.D, L = this.L;
    const pw = L.w - L.left - L.right;
    const xv = D.xmin + ((px - L.left) / pw) * (D.xmax - D.xmin);
    let best = 0, bd = Infinity;
    // xs is sorted: binary search
    let lo = 0, hi = xs.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] < xv) lo = m; else hi = m; }
    for (const j of [lo, hi]) { const dd = Math.abs(xs[j] - xv); if (dd < bd) { bd = dd; best = j; } }
    if (best !== this.hoverIndex) { this.hoverIndex = best; this.draw(); }
  }

  onKey(e) {
    const xs = this.allX();
    if (!xs.length) return;
    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const cur = this.hoverIndex ?? (e.key === 'ArrowRight' ? -1 : xs.length);
      this.hoverIndex = Math.max(0, Math.min(xs.length - 1, cur + (e.key === 'ArrowRight' ? step : -step)));
      this.draw();
    } else if (e.key === 'Home') { this.hoverIndex = 0; this.draw(); }
    else if (e.key === 'End') { this.hoverIndex = xs.length - 1; this.draw(); }
    else if (e.key === 'Escape') { this.hoverIndex = null; this.tip.hidden = true; this.draw(); }
  }
}

/** Axis tick label with just enough decimals for the tick step. */
function formatTick(v, step) {
  const dec = step >= 1 ? 0 : Math.min(6, Math.ceil(-Math.log10(step) - 1e-9));
  return v.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

/**
 * Horizontal bar chart for energy budgets (single unit: kJ). Drawn as HTML so it scales and
 * reads well without canvas. bars = [{label, value, group}] ; groups get a categorical colour.
 */
export function renderBars(container, { title, unit, bars, note }) {
  const max = Math.max(1e-9, ...bars.map((b) => Math.abs(b.value)));
  const groups = [...new Set(bars.map((b) => b.group))];
  let html = `<div class="bars"><h4 class="chart-title">${title} <span class="chart-unit">(${unit})</span></h4>`;
  if (groups.length > 1) {
    html += '<div class="chart-legend">' + groups.map((gname, i) => `<span class="legend-item"><span class="legend-swatch legend-bar" style="--sw:${seriesColor(i)}"></span>${gname}</span>`).join('') + '</div>';
  }
  html += '<ul class="bar-list">';
  for (const b of bars) {
    const gi = groups.indexOf(b.group);
    const pct = (Math.abs(b.value) / max) * 100;
    html += `<li><span class="bar-label">${b.label}</span><span class="bar-track"><span class="bar-fill" style="width:${pct.toFixed(1)}%;--sw:${seriesColor(gi)}"></span></span><span class="bar-value">${formatNumber(b.value)}</span></li>`;
  }
  html += '</ul>';
  if (note) html += `<p class="chart-note">${note}</p>`;
  html += '</div>';
  container.innerHTML = html;
}
