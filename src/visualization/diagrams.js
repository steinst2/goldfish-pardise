/**
 * diagrams.js — live matter-cycle diagrams (SVG) built from a simulation's cumulative fluxes.
 *
 * Arrow thickness is proportional to the square root of the flux so small flows stay visible.
 * Every number is the TOTAL amount moved during the run, in grams for the whole system
 * (concentration flux in mg/L × water volume in L ÷ 1000).
 *
 * The diagrams show MATTER. Energy is shown separately (bar chart) because energy is not
 * recycled: see src/model/energy.js.
 */
import { formatNumber } from './charts.js';

const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

/**
 * nodes: [{id, label, x, y, kind:'pool'|'living'|'outside'}]
 * edges: [{from, to, value, label, bend}]   value in grams
 */
export function renderFlowDiagram(container, { title, desc, nodes, edges, unit = 'g', width = 820, height = 420 }) {
  container.innerHTML = '';
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', class: 'flow-diagram' });
  svg.append(el('title', {}, title));
  svg.append(el('desc', {}, desc));
  const defs = el('defs');
  const marker = el('marker', { id: `arrow-${title.replace(/\W/g, '')}`, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '11', markerHeight: '11', markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse' });
  marker.append(el('path', { d: 'M0,0 L10,5 L0,10 z', class: 'flow-arrowhead' }));
  defs.append(marker);
  svg.append(defs);
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const maxV = Math.max(1e-9, ...edges.map((e) => Math.abs(e.value)));
  const NW = 124, NH = 42;
  const gEdges = el('g');
  const gLabels = el('g');
  for (const e of edges) {
    if (e.listOnly) continue;
    const a = byId[e.from], b = byId[e.to];
    if (!a || !b) continue;
    const w = e.value > 0 ? 1.5 + 6 * Math.sqrt(Math.abs(e.value) / maxV) : 1;
    // start/end on the node boxes' edges
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const clip = (n, sx, sy) => {
      const tx = Math.abs(sx) > 1e-9 ? (NW / 2 + 6) / Math.abs(sx) : Infinity;
      const ty = Math.abs(sy) > 1e-9 ? (NH / 2 + 6) / Math.abs(sy) : Infinity;
      const t = Math.min(tx, ty);
      return [n.x + sx * t, n.y + sy * t];
    };
    const [x1, y1] = clip(a, ux, uy);
    const [x2, y2] = clip(b, -ux, -uy);
    const bend = e.bend ?? 0;
    const mx = (x1 + x2) / 2 - uy * bend, my = (y1 + y2) / 2 + ux * bend;
    const path = el('path', {
      d: `M${x1.toFixed(1)},${y1.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`,
      class: 'flow-edge' + (e.value > 0 ? '' : ' flow-zero'),
      'stroke-width': w.toFixed(2),
      'marker-end': `url(#${marker.getAttribute('id')})`,
    });
    path.append(el('title', {}, `${e.label}: ${formatNumber(e.value)} ${unit}`));
    gEdges.append(path);
    const lx = 0.25 * x1 + 0.5 * mx + 0.25 * x2 + (e.dx || 0), ly = 0.25 * y1 + 0.5 * my + 0.25 * y2 + (e.dy || 0);
    const t = el('text', { x: lx.toFixed(1), y: (ly - 4).toFixed(1), class: 'flow-label', 'text-anchor': 'middle' });
    t.append(el('tspan', { x: lx.toFixed(1), dy: '0' }, e.label));
    t.append(el('tspan', { x: lx.toFixed(1), dy: '13', class: 'flow-value' }, `${formatNumber(e.value)} ${unit}`));
    gLabels.append(t);
  }
  const gNodes = el('g');
  for (const n of nodes) {
    const g = el('g', { class: `flow-node flow-${n.kind || 'pool'}` });
    g.append(el('rect', { x: n.x - NW / 2, y: n.y - NH / 2, width: NW, height: NH, rx: n.kind === 'outside' ? 4 : 12 }));
    const lines = n.label.split('\n');
    lines.forEach((ln, i) => g.append(el('text', { x: n.x, y: n.y + (i - (lines.length - 1) / 2) * 14 + 4, 'text-anchor': 'middle' }, ln)));
    gNodes.append(g);
  }
  svg.append(gEdges, gNodes, gLabels);
  container.append(svg);
  // text alternative
  const list = document.createElement('details');
  list.className = 'flow-text';
  list.innerHTML = `<summary>Read this diagram as a list</summary><ul>${edges.map((e) => e.listOnly ? `<li>${e.label} → ${byId[e.to]?.label.replace('\n', ' ')}: ${formatNumber(e.value)} ${unit} (too small to draw)</li>` : `<li>${byId[e.from]?.label.replace('\n', ' ')} → ${byId[e.to]?.label.replace('\n', ' ')} (${e.label}): ${formatNumber(e.value)} ${unit}</li>`).join('')}</ul>`;
  container.append(list);
}

/** Nitrogen cycle for one run. acc values are mg/L; V converts to grams for the whole system. */
export function nitrogenDiagram(container, run) {
  const a = run.days[run.days.length - 1].acc;
  const g = (x) => (x * run.params.volumeL) / 1000;
  const hasCrops = run.params.cropDensity > 0;
  const nodes = [
    { id: 'food', label: 'Fish food\n(from outside)', x: 90, y: 60, kind: 'outside' },
    { id: 'fish', label: 'Goldfish', x: 320, y: 60, kind: 'living' },
    { id: 'nh4', label: 'Ammonium\nNH₄⁺', x: 320, y: 215, kind: 'pool' },
    { id: 'no3', label: 'Nitrate\nNO₃⁻', x: 560, y: 215, kind: 'pool' },
    { id: 'n2', label: 'N₂ gas\n(to the air)', x: 560, y: 365, kind: 'outside' },
    { id: 'algae', label: 'Algae', x: 320, y: 365, kind: 'living' },
    { id: 'det', label: 'Dead matter\n& waste', x: 90, y: 365, kind: 'pool' },
  ];
  const edges = [
    { from: 'food', to: 'fish', value: g(a.inFeedN), label: 'food added', dy: -6 },
    { from: 'fish', to: 'nh4', value: g(a.fishExcretedN), label: 'excretion', dx: 40 },
    { from: 'nh4', to: 'no3', value: g(a.nitrified), label: 'nitrification (bacteria)', dy: -8 },
    { from: 'no3', to: 'n2', value: g(a.denitrified), label: 'denitrification', dx: 52 },
    { from: 'no3', to: 'algae', value: g(a.algaeUptakeN), label: 'uptake by algae (NH₄⁺ + NO₃⁻)', dx: 30, dy: 6 },
    { from: 'algae', to: 'det', value: g(a.toDetN_algae), label: 'algae die', dy: -6 },
    { from: 'det', to: 'nh4', value: g(a.mineralizedN), label: 'decomposition', dx: -30, dy: -6 },
    { from: 'fish', to: 'det', value: g(a.toDetN_fish), label: 'feces, uneaten food, deaths', dx: -70, bend: -20 },
    { from: 'nh4', to: 'det', value: g(a.toDetN_microbe), label: 'Dead bacteria', listOnly: true },
  ];
  if (hasCrops) {
    nodes.push({ id: 'crop', label: 'Crop plants', x: 760, y: 60, kind: 'living' });
    nodes.push({ id: 'plate', label: 'Harvest\n(to the plate)', x: 760, y: 215, kind: 'outside' });
    edges.push({ from: 'no3', to: 'crop', value: g(a.cropUptakeN), label: 'root uptake', dx: -30 });
    edges.push({ from: 'crop', to: 'plate', value: g(a.harvN), label: 'harvest', dx: 34 });
    edges.push({ from: 'crop', to: 'det', value: g(a.toDetN_crop), label: 'Dropped crop roots & leaves', listOnly: true });
  }
  if (a.wcOutN > 0) {
    nodes.push({ id: 'drain', label: 'Water change\n(drained)', x: 90, y: 215, kind: 'outside' });
    edges.push({ from: 'nh4', to: 'drain', value: g(a.wcOutN), label: 'drained (all forms)', dy: -6 });
  }
  renderFlowDiagram(container, {
    title: 'Nitrogen cycle — total nitrogen moved during this run',
    desc: 'Boxes are places nitrogen is stored; arrows are processes; numbers are grams of nitrogen moved. Nitrification changes ammonium into nitrate — the nitrogen stays in the water. Only denitrification, harvest and water changes remove nitrogen.',
    nodes, edges, unit: 'g N',
  });
}

export function carbonDiagram(container, run) {
  const a = run.days[run.days.length - 1].acc;
  const g = (x) => (x * run.params.volumeL) / 1000;
  const hasCrops = run.params.cropDensity > 0;
  const nodes = [
    { id: 'air', label: 'Air (CO₂)', x: 420, y: 55, kind: 'outside' },
    { id: 'dic', label: 'Dissolved CO₂\n+ bicarbonate', x: 420, y: 215, kind: 'pool' },
    { id: 'algae', label: 'Algae', x: 150, y: 215, kind: 'living' },
    { id: 'food', label: 'Fish food\n(from outside)', x: 150, y: 365, kind: 'outside' },
    { id: 'life', label: 'Fish, bacteria\n& dead matter', x: 420, y: 365, kind: 'living' },
  ];
  const netAir = g(a.atmC);
  const edges = [
    { from: 'dic', to: 'algae', value: g(a.gppC), label: 'photosynthesis', dy: -8 },
    { from: 'life', to: 'dic', value: g(a.respC), label: 'respiration + decomposition', dx: 82, bend: -30 },
    { from: 'algae', to: 'life', value: g(a.algaeLossC), label: 'eaten or dies', dx: -40, dy: 8 },
    { from: 'food', to: 'life', value: g(a.inFeedC), label: 'food', dy: -6 },
    netAir >= 0
      ? { from: 'air', to: 'dic', value: netAir, label: 'net CO₂ dissolving', dx: -60 }
      : { from: 'dic', to: 'air', value: -netAir, label: 'net CO₂ escaping', dx: -60 },
  ];
  if (hasCrops) {
    nodes.push({ id: 'crop', label: 'Crop plants', x: 700, y: 215, kind: 'living' });
    nodes.push({ id: 'plate', label: 'Harvest\n(to the plate)', x: 700, y: 365, kind: 'outside' });
    edges.push({ from: 'air', to: 'crop', value: g(a.cropAirC), label: 'leaves fix CO₂ from air', dx: 60 });
    edges.push({ from: 'crop', to: 'plate', value: g(a.harvC), label: 'harvest', dx: 34 });
  }
  renderFlowDiagram(container, {
    title: 'Carbon cycle — total carbon moved during this run',
    desc: 'Photosynthesis moves carbon from CO₂ into living things; respiration and decomposition return it to CO₂. The same carbon atoms can be used again and again.',
    nodes, edges, unit: 'g C',
  });
}
