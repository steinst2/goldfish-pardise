/**
 * basic.js — the simplified "Basic" lab for 9th grade.
 * Same model as the Advanced lab; fewer controls, plain-language status cards, four charts and a
 * day-by-day story of what happened. Wording aims at about a grade-8 reading level.
 */
import { defaultsFor, fishAlive, fishWetGrams, tankSVG } from './lab.js';
import { LineChart, formatNumber } from '../visualization/charts.js';
import { DATA_KINDS } from '../data/provenance.js';

export const BASIC_CHOICES = {
  food: { little: 0.75, normal: 1.5, lots: 3 },
  light: { low: 30, medium: 80, high: 100 },
  pump: { off: 'gentle', on: 'strong' },
};
export const BASIC_DEFAULTS = { scenario: 'A', fishCount: 8, food: 'normal', light: 'medium', pump: 'off', days: 60 };

/** Turn the five Basic choices into full lab settings. */
export function basicToSettings(b) {
  const base = defaultsFor(b.scenario);
  return {
    ...base,
    scenario: b.scenario,
    days: +b.days,
    fishCount: +b.fishCount,
    feedPct: BASIC_CHOICES.food[b.food],
    light: BASIC_CHOICES.light[b.light],
    aeration: BASIC_CHOICES.pump[b.pump],
    cropDensity: 60,
  };
}
export function isBasicDefault(b) {
  return Object.keys(BASIC_DEFAULTS).every((k) => String(b[k]) === String(BASIC_DEFAULTS[k]));
}

const NAME = { A: 'Fish tank', B: 'Fish tank + plants' };

/** Plain-language events from one run (for the story panel and the worksheet). */
export function storyEvents(run) {
  const p = run.params;
  const days = run.days;
  const ev = [];
  const firstDay = (test) => days.find((d) => d.day > 0 && test(d));
  const bloom = firstDay((d) => d.chlEstimate > 100);
  if (bloom) ev.push({ day: bloom.day, icon: '🟢', text: 'The water is turning green. Algae are growing fast.' });
  const lowO2 = firstDay((d) => d.doMin < p.doStress);
  if (lowO2) ev.push({ day: lowO2.day, icon: '🌙', text: 'At night, oxygen dropped below the danger line. Without sunlight, algae stop making oxygen, but every living thing keeps using it.' });
  const decomp = firstDay((d) => d.bact > 5 * Math.max(0.01, days[0].bact));
  if (decomp) ev.push({ day: decomp.day, icon: '🦠', text: 'Decomposer bacteria are multiplying fast. They feed on dead algae, droppings and leftover food, and they use up oxygen while they do it.' });
  const fNH3 = (d) => d.nh4 * unionized(p);
  const nh3 = firstDay((d) => fNH3(d) > p.nh3Stress * 0.5);
  if (nh3) ev.push({ day: nh3.day, icon: '⚠️', text: 'Toxic ammonia from fish waste is building up faster than bacteria can change it into nitrate.' });
  const firstDeath = firstDay((d, i) => fishAlive(run, days.indexOf(d)) < p.fishCount);
  if (firstDeath) ev.push({ day: firstDeath.day, icon: '🐟', text: 'The first fish died.' });
  const half = firstDay((d) => fishAlive(run, days.indexOf(d)) <= p.fishCount / 2);
  if (half && p.fishCount > 1) ev.push({ day: half.day, icon: '💀', text: 'Half of the fish are gone.' });
  const harvests = days.filter((d) => d.harvested > 0);
  if (harvests.length) {
    const g = (harvests[0].harvested * p.volumeL) / 1000;
    ev.push({ day: harvests[0].day, icon: '🥬', text: `First harvest: ${formatNumber(g)} g (dry) of plants picked. The nitrogen and phosphorus inside them leave the tank as food.` });
  }
  ev.sort((a, b) => a.day - b.day);
  const last = days[days.length - 1];
  const alive = fishAlive(run, days.length - 1);
  const a = last.acc;
  let cause = '';
  if (alive < p.fishCount) cause = a.deathHypoxia >= a.deathAmmonia ? ' Most of the fish died from a lack of oxygen.' : ' Most of the fish died from toxic ammonia.';
  const water = last.chlEstimate > 300 ? 'very green (like pea soup)' : last.chlEstimate > 30 ? 'green' : 'clear';
  ev.push({ day: last.day, icon: alive === p.fishCount ? '🎉' : '📋', text: `End: ${alive} of ${p.fishCount} fish are alive. The water is ${water}.${cause}` });
  return ev;
}

function unionized(p) {
  const pKa = 0.09018 + 2729.92 / (p.tempC + 273.15);
  return 1 / (1 + Math.pow(10, pKa - p.pH));
}

function status(level, words) {
  const icon = { good: '●', warn: '▲', bad: '✖' }[level];
  return `<span class="bs-light bs-${level}"><span aria-hidden="true">${icon}</span> ${words}</span>`;
}

export class BasicView {
  constructor(root) {
    this.root = root;
    this.charts = {};
    this.result = null;
    this.day = 0;
  }

  mount() {
    const grid = this.root.querySelector('#basic-charts');
    grid.innerHTML = '';
    for (const id of ['oxygen', 'fish', 'algae', 'waste']) {
      const card = document.createElement('section');
      card.className = 'chart-card';
      const holder = document.createElement('div');
      card.append(holder);
      grid.append(card);
      this.charts[id] = new LineChart(holder, { title: '', series: [], height: 200 });
    }
    this.root.querySelector('#basic-day').addEventListener('input', (e) => this.setDay(+e.target.value));
  }

  render(result) {
    this.result = result;
    const run0 = Object.values(result.runs)[0];
    this.day = run0.days.length - 1;
    const sl = this.root.querySelector('#basic-day');
    sl.max = this.day; sl.value = this.day;
    const k = DATA_KINDS[result.kind];
    const badge = this.root.querySelector('#basic-kind');
    badge.className = `kind-badge ${k.className}`;
    badge.textContent = k.label;
    badge.title = k.description;
    this.renderDay();
    this.renderCharts();
    this.renderStory();
  }

  setDay(i) { this.day = i; this.renderDay(); }

  renderDay() {
    const res = this.result;
    this.root.querySelector('#basic-day-out').textContent = `Day ${this.day}`;
    const ids = Object.keys(res.runs);
    this.root.querySelector('#basic-tank').innerHTML = ids.map((id) => tankSVG(res.runs[id], Math.min(this.day, res.runs[id].days.length - 1), id, NAME[id])).join('');
    this.root.querySelector('#basic-status').innerHTML = ids.map((id) => {
      const run = res.runs[id];
      const i = Math.min(this.day, run.days.length - 1);
      const d = run.days[i];
      const p = run.params;
      const alive = fishAlive(run, i);
      const o2 = d.doMin ?? d.do;
      const o2s = o2 >= p.doStress * 1.5 ? status('good', 'Healthy') : o2 >= p.doStress ? status('warn', 'Getting low') : status('bad', 'Fish in danger');
      const nh3 = d.nh4 * unionized(p);
      const nh3s = nh3 < p.nh3Stress * 0.5 ? status('good', 'Safe') : nh3 < p.nh3Stress ? status('warn', 'Rising') : status('bad', 'Toxic');
      const chl = d.chlEstimate;
      const ws = chl < 30 ? status('good', 'Clear') : chl < 300 ? status('warn', 'Green') : status('bad', 'Pea soup');
      const fs = alive === p.fishCount ? status('good', `${alive} of ${p.fishCount} alive`) : alive >= p.fishCount / 2 ? status('warn', `${alive} of ${p.fishCount} alive`) : status('bad', `${alive} of ${p.fishCount} alive`);
      const harvestG = (d.acc.harvC / 0.5) * p.volumeL / 1000;
      return `<div class="bs-group"><h3>${NAME[id]} <span class="muted">· day ${d.day}</span></h3><ul class="bs-cards">
        <li><span class="bs-label">Fish</span>${fs}</li>
        <li><span class="bs-label">Oxygen <small>(lowest today)</small></span>${o2s}<small>${formatNumber(o2)} mg/L</small></li>
        <li><span class="bs-label">Toxic ammonia</span>${nh3s}<small>${formatNumber(nh3)} mg/L</small></li>
        <li><span class="bs-label">Water</span>${ws}<small>algae ${formatNumber(d.algae)} mg/L</small></li>
        ${p.cropDensity > 0 ? `<li><span class="bs-label">Food grown so far</span><span class="bs-light bs-neutral">🥬 ${formatNumber(harvestG)} g harvested</span><small>dry mass</small></li>` : ''}
      </ul></div>`;
    }).join('');
  }

  renderCharts() {
    const res = this.result;
    const ids = Object.keys(res.runs);
    const cmp = ids.length > 1;
    const ser = (fn, name, ci, dash) => ids.map((id, j) => {
      const run = res.runs[id];
      return { name: cmp ? `${NAME[id]}${name ? ' — ' + name : ''}` : name || NAME[id], short: cmp ? (id === 'A' ? 'Tank' : '+ Plants') : (name || NAME[id]), x: run.days.map((d) => d.day), y: run.days.map((d, i) => fn(d, run, i)), colorIndex: cmp ? j : ci, dash, kind: 'sim' };
    });
    const first = res.runs[ids[0]];
    this.charts.oxygen.update({
      title: 'How much oxygen is in the water?', unit: 'mg/L', yMin: 0,
      series: ser((d) => d.doMean ?? d.do, cmp ? '' : 'Oxygen', 0),
      band: cmp ? null : { name: 'Lowest–highest each day', x: first.days.map((d) => d.day), lo: first.days.map((d) => d.doMin ?? d.do), hi: first.days.map((d) => d.doMax ?? d.do) },
      thresholds: [{ y: first.params.doStress, label: 'Danger line for fish', short: 'danger' }],
      note: 'Oxygen goes up in the day (photosynthesis) and down at night (respiration).',
    });
    this.charts.fish.update({
      title: 'How many fish are alive?', unit: 'fish', yMin: 0,
      series: ser((d, run, i) => fishAlive(run, i), cmp ? '' : 'Fish alive', 1),
    });
    this.charts.algae.update({
      title: 'How much algae is growing?', unit: 'mg/L', yMin: 0,
      series: ser((d) => d.algae, cmp ? '' : 'Algae', 2),
      note: 'Algae are tiny producers. Lots of algae makes the water green.',
    });
    this.charts.waste.update({
      title: 'How much fish waste is in the water?', unit: 'mg of nitrogen per L', yMin: 0,
      series: cmp
        ? ser((d) => d.nh4 + d.no3, 'waste nitrogen', 0)
        : [...ser((d) => d.nh4, 'Ammonia (toxic)', 0), ...ser((d) => d.no3, 'Nitrate (less harmful)', 1, [6, 4])],
      note: cmp ? 'Ammonia + nitrate together. Plants soak up nitrate.' : 'Bacteria turn toxic ammonia into nitrate. Plants and algae soak up nitrate.',
    });
  }

  renderStory() {
    const res = this.result;
    const box = this.root.querySelector('#basic-story');
    box.innerHTML = Object.entries(res.runs).map(([id, run]) => `
      <div class="story-col"><h3>${NAME[id]}</h3><ol class="story">${storyEvents(run).map((e) => `<li><span class="story-day">Day ${e.day}</span><span class="story-icon" aria-hidden="true">${e.icon}</span><span>${e.text}</span></li>`).join('')}</ol></div>`).join('');
  }
}

/** Values a student copies onto the paper worksheet. */
export function worksheetNumbers(run) {
  const last = run.days.length - 1;
  const d = run.days[last];
  const lowest = Math.min(...run.days.slice(1).map((x) => x.doMin));
  return { alive: fishAlive(run, last), of: run.params.fishCount, lowestO2: lowest, algae: d.algae, waste: d.nh4 + d.no3, fishG: fishWetGrams(d.fish, run.params.volumeL) };
}
