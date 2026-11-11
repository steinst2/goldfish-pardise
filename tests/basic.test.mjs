// Guards the numbers printed in the teacher key (teacher/lab-worksheet-teacher-key.pdf).
// If the model changes and one of these fails, update scripts/make_worksheet.py and rebuild the PDFs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runExperiment, fishAlive } from '../src/ui/lab.js';
import { basicToSettings, BASIC_DEFAULTS, storyEvents } from '../src/ui/basic.js';

const run = (o) => runExperiment(basicToSettings({ ...BASIC_DEFAULTS, ...o }), { baseline: false }).runs;
const end = (r) => { const n = r.days.length - 1; const d = r.days[n]; return { alive: fishAlive(r, n), waste: d.nh4 + d.no3, algae: d.algae }; };
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m}: ${a} vs ${b}`);

test('Mission 1 outcomes match the teacher key', () => {
  assert.equal(end(run({}).A).alive, 0, 'starting tank');
  assert.equal(end(run({ pump: 'on' }).A).alive, 8, 'pump on');
  assert.equal(end(run({ light: 'low' }).A).alive, 8, 'low light');
  assert.equal(end(run({ light: 'high' }).A).alive, 0, 'high light');
  assert.equal(end(run({ food: 'little' }).A).alive, 2, 'little food');
  assert.equal(end(run({ fishCount: 2 }).A).alive, 2, 'two fish');
});

test('Mission 2 story days match the teacher key', () => {
  const ev = storyEvents(run({}).A);
  const day = (frag) => ev.find((e) => e.text.includes(frag))?.day;
  assert.equal(day('turning green'), 4);
  assert.equal(day('multiplying fast'), 8);
  assert.equal(day('danger line'), 13);
  assert.equal(day('first fish died'), 15);
  assert.equal(day('Half of the fish'), 19);
});

test('Mission 3 comparison matches the teacher key', () => {
  const r1 = run({ scenario: 'compare', pump: 'on' });
  const a = end(r1.A), b = end(r1.B);
  assert.equal(a.alive, 8); assert.equal(b.alive, 8);
  near(a.waste, 33, 2, 'run 1 tank waste'); near(b.waste, 13, 2, 'run 1 plants waste');
  assert.ok(b.algae > 0 && b.algae < a.algae, 'plants reduce but do not remove algae');
  const r2 = run({ scenario: 'compare', pump: 'on', food: 'lots' });
  assert.equal(end(r2.A).alive, 0); assert.equal(end(r2.B).alive, 8);
  const r3 = run({ scenario: 'compare', pump: 'off', food: 'lots' });
  assert.equal(end(r3.A).alive, 0); assert.equal(end(r3.B).alive, 0);
});
