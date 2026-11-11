// Tests for the browser CSV importer (runs in Node; no browser needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCSV, convertUnit, mapCharacteristic, importObservations, ImportError } from '../src/data/import.js';
import { normalizeDate } from '../src/data/validation.js';

test('CSV parser handles quotes, commas and CRLF', () => {
  const rows = parseCSV('a,b,c\r\n"x, y","say ""hi""",3\r\n');
  assert.deepEqual(rows, [['a', 'b', 'c'], ['x, y', 'say "hi"', '3']]);
});

test('dates: ISO and US forms accepted, impossible dates rejected', () => {
  assert.equal(normalizeDate('2010-05-04'), '2010-05-04');
  assert.equal(normalizeDate('5/4/2010'), '2010-05-04');
  assert.equal(normalizeDate('2010-02-30'), null);
  assert.equal(normalizeDate('yesterday'), null);
});

test('unit conversion is exact where unambiguous and refuses guesses', () => {
  close(convertUnit('no3', 4.43, 'mg/l asNO3').value, 4.43 * 14.007 / 62.004, 1e-12);
  assert.equal(convertUnit('no3', 1, 'mg/l as N').value, 1);
  assert.equal(convertUnit('po4', 0.03, 'mg/l').value, null, 'ambiguous phosphate basis not converted');
  assert.equal(convertUnit('do', 95, '%').value, null, 'percent saturation not converted');
  close(convertUnit('tempC', 68, 'deg F').value, 20, 1e-12);
  assert.equal(convertUnit('chl', 12, 'ug/l').value, 12);
});

test('characteristic mapping', () => {
  assert.equal(mapCharacteristic('Dissolved oxygen (DO)').variable, 'do');
  assert.equal(mapCharacteristic('Inorganic nitrogen (nitrate and nitrite)').variable, 'no3');
  assert.equal(mapCharacteristic('Phosphorus', 'Total').variable, 'waterTotalP');
  assert.equal(mapCharacteristic('Atrazine'), null);
});

test('rows labelled as synthetic are refused as observations', () => {
  const text = readFileSync(new URL('./fixtures/SYNTHETIC_wqp_legacy_fixture.csv', import.meta.url), 'utf8');
  assert.throws(() => importObservations(text, 'fixture.csv'), ImportError);
});

test('legacy WQP columns import, keep originals, and flag non-detects', () => {
  // A tiny in-test example used only to exercise the parser (not data, not shown anywhere).
  const csv = [
    'MonitoringLocationIdentifier,MonitoringLocationName,ActivityStartDate,CharacteristicName,ResultSampleFractionText,ResultMeasureValue,ResultMeasure/MeasureUnitCode,ResultDetectionConditionText,ProviderName',
    'UNIT-1,Parser check,2001-07-01,Nitrate,Dissolved,4.43,mg/l asNO3,,X',
    'UNIT-1,Parser check,2001-07-02,Ammonia and ammonium,Dissolved,,mg/l as N,Not Detected,X',
    'UNIT-1,Parser check,2001-13-02,pH,,7.9,std units,,X',
  ].join('\n');
  const ds = importObservations(csv, 'unit.csv');
  assert.equal(ds.format, 'wqp-legacy');
  assert.equal(ds.report.validRows, 1);
  const nitrate = ds.rows[0];
  assert.equal(nitrate.rawValue, '4.43');
  assert.equal(nitrate.unit, 'mg/l asNO3');
  close(nitrate.modelValue, 4.43 * 14.007 / 62.004, 1e-12);
  assert.ok(ds.rows[1].nonDetect);
  assert.ok(ds.rows[2].issues.some((s) => s.includes('not a valid calendar date')));
});

test('helpful errors for wrong files', () => {
  assert.throws(() => importObservations('<html><body>busy</body></html>'), /web page/);
  assert.throws(() => importObservations('a,b\n1,2\n'), /missing required column/);
  assert.throws(() => importObservations(''), /empty/);
});

function close(a, b, tol) { assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`); }
