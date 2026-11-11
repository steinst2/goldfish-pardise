/**
 * import.js — read REAL environmental observations from CSV files in the browser.
 *
 * Accepted inputs
 *   1. The classroom CSV produced by scripts/fetch_wqp.py or scripts/fetch_usgs.py
 *      (schema documented in docs/DATA_DICTIONARY.md; recognised by its `data_category` column).
 *   2. A raw Water Quality Portal "Result" CSV downloaded from waterqualitydata.us
 *      (legacy WQX 2.2 column names such as MonitoringLocationIdentifier, ResultMeasureValue,
 *      ResultMeasure/MeasureUnitCode). Newer WQX 3.0 profiles use different column names
 *      (e.g. Location_Identifier, Result_Measure); we recognise the common ones, and if a
 *      required column cannot be found the importer says exactly which one is missing.
 *
 * Nothing in this file creates, edits or "fills in" observation values. Every original value,
 * unit and qualifier is retained. A converted value is added ONLY when the conversion is
 * unambiguous (e.g. "mg/l asNO3" → mg N/L by molar mass); otherwise the row is kept but
 * marked as not comparable with the model.
 */
import { validateObservations } from './validation.js';

/** RFC-4180 CSV parser (handles quotes, escaped quotes, CRLF, and commas inside quotes). */
export function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  if (inQ) throw new ImportError('The file ends inside a quoted field. It may be truncated or not a CSV file.');
  return rows;
}

export class ImportError extends Error {}

/** Column aliases: first match wins. Legacy WQX 2.2 names, WQX 3.0 names, classroom names. */
const COLUMNS = {
  locationId: ['monitoring_location_id', 'MonitoringLocationIdentifier', 'Location_Identifier'],
  locationName: ['monitoring_location_name', 'MonitoringLocationName', 'Location_Name'],
  organization: ['organization_id', 'OrganizationIdentifier', 'Org_Identifier'],
  provider: ['provider', 'ProviderName', 'ProviderName'],
  date: ['activity_start_date', 'ActivityStartDate', 'Activity_StartDate'],
  time: ['activity_start_time', 'ActivityStartTime/Time', 'Activity_StartTime'],
  characteristic: ['characteristic_name', 'CharacteristicName', 'Result_Characteristic'],
  fraction: ['sample_fraction', 'ResultSampleFractionText', 'Result_SampleFraction'],
  value: ['result_value', 'ResultMeasureValue', 'Result_Measure'],
  unit: ['result_unit', 'ResultMeasure/MeasureUnitCode', 'Result_MeasureUnit'],
  status: ['result_status', 'ResultStatusIdentifier', 'Result_MeasureStatusIdentifier'],
  qualifier: ['result_qualifier', 'MeasureQualifierCode', 'Result_MeasureQualifierCode'],
  detection: ['detection_condition', 'ResultDetectionConditionText', 'Result_ResultDetectionCondition'],
  latitude: ['latitude', 'LatitudeMeasure', 'Location_Latitude'],
  longitude: ['longitude', 'LongitudeMeasure', 'Location_Longitude'],
  sourceUrl: ['source_url'],
  queryUrl: ['query_url'],
  retrieved: ['retrieved_utc', 'download_date'],
  sourceName: ['source_name'],
  category: ['data_category'],
};
const REQUIRED = ['locationId', 'date', 'characteristic', 'value', 'unit'];

function findColumns(header) {
  const idx = {};
  const norm = header.map((h) => h.trim());
  for (const [key, names] of Object.entries(COLUMNS)) {
    idx[key] = -1;
    for (const n of names) {
      const j = norm.indexOf(n);
      if (j >= 0) { idx[key] = j; break; }
    }
  }
  return idx;
}

/**
 * Which classroom-model variable a characteristic can be compared with, if any.
 * Returns {variable, label, modelUnit} or null.
 */
export function mapCharacteristic(name, fraction = '') {
  const n = (name || '').toLowerCase();
  const f = (fraction || '').toLowerCase();
  if (/^dissolved oxygen/.test(n) || n === 'oxygen') return { variable: 'do', label: 'Dissolved oxygen', modelUnit: 'mg/L' };
  if (/^temperature, water/.test(n)) return { variable: 'tempC', label: 'Water temperature', modelUnit: '°C' };
  if (n === 'ph') return { variable: 'pH', label: 'pH', modelUnit: 'pH units' };
  if (/chlorophyll a/.test(n)) return { variable: 'chl', label: 'Chlorophyll-a', modelUnit: 'µg/L' };
  if (/^(nitrate|inorganic nitrogen \(nitrate and nitrite\)|nitrate \+ nitrite|nitrite \+ nitrate)/.test(n)) return { variable: 'no3', label: 'Nitrate (+ nitrite) as N', modelUnit: 'mg N/L' };
  if (/^ammonia/.test(n) || /^ammonium/.test(n)) return { variable: 'nh4', label: 'Ammonia + ammonium as N', modelUnit: 'mg N/L' };
  if (/^(orthophosphate|phosphate-phosphorus|soluble reactive phosphorus)/.test(n)) return { variable: 'po4', label: 'Dissolved phosphate as P', modelUnit: 'mg P/L' };
  if (n === 'phosphorus' || /^total phosphorus/.test(n)) {
    if (f === 'dissolved') return { variable: 'dissolvedP', label: 'Dissolved phosphorus as P', modelUnit: 'mg P/L' };
    return { variable: 'waterTotalP', label: 'Total phosphorus in the water as P', modelUnit: 'mg P/L' };
  }
  if (n === 'nitrogen' || n === 'total nitrogen, mixed forms' || /^total nitrogen/.test(n)) return { variable: 'waterTotalN', label: 'Total nitrogen in the water as N', modelUnit: 'mg N/L' };
  return null;
}

const MW = { N: 14.007, NO3: 62.004, NO2: 46.006, NH4: 18.038, NH3: 17.031, P: 30.974, PO4: 94.971 };

/**
 * Convert an original value to the model's unit when the conversion is unambiguous.
 * Returns {value, unit, note} or {value:null, note} when not convertible.
 */
export function convertUnit(variable, value, unitRaw) {
  const u = (unitRaw || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!Number.isFinite(value)) return { value: null, note: 'no numeric value' };
  const ok = (v, unit, note = '') => ({ value: v, unit, note });
  switch (variable) {
    case 'do':
      if (u === 'mg/l' || u === 'mg/l o2') return ok(value, 'mg/L');
      if (u === '%' || u.includes('sat')) return { value: null, note: 'percent saturation cannot be converted to mg/L without temperature and pressure' };
      break;
    case 'tempC':
      if (u === 'deg c' || u === '°c' || u === 'degc' || u === 'c') return ok(value, '°C');
      if (u === 'deg f' || u === '°f') return ok((value - 32) * 5 / 9, '°C', 'converted from °F');
      break;
    case 'pH':
      if (u === '' || u === 'std units' || u === 'none' || u === 'ph units' || u === 'standard units') return ok(value, 'pH units');
      break;
    case 'chl':
      if (u === 'ug/l' || u === 'µg/l' || u === 'μg/l' || u === 'mg/m3') return ok(value, 'µg/L');
      if (u === 'mg/l') return ok(value * 1000, 'µg/L', 'converted from mg/L');
      break;
    case 'no3': case 'nh4': case 'waterTotalN': {
      const scale = u.startsWith('ug/l') || u.startsWith('µg/l') ? 0.001 : u.startsWith('mg/l') ? 1 : null;
      if (scale === null) break;
      if (/as ?n\b/.test(u) || u.endsWith(' n')) return ok(value * scale, 'mg N/L');
      if (/as ?no3/.test(u)) return ok(value * scale * MW.N / MW.NO3, 'mg N/L', 'converted from NO₃ to N basis (× 14.007/62.004)');
      if (/as ?nh4/.test(u)) return ok(value * scale * MW.N / MW.NH4, 'mg N/L', 'converted from NH₄ to N basis (× 14.007/18.038)');
      if (/as ?nh3/.test(u)) return ok(value * scale * MW.N / MW.NH3, 'mg N/L', 'converted from NH₃ to N basis (× 14.007/17.031)');
      if (variable === 'waterTotalN' && (u === 'mg/l' || u === 'ug/l')) return ok(value * scale, 'mg N/L', 'total nitrogen is reported as N by convention');
      return { value: null, note: `unit "${unitRaw}" does not say whether the value is "as N" or "as NO₃"; not converted` };
    }
    case 'po4': case 'waterTotalP': case 'dissolvedP': {
      const scale = u.startsWith('ug/l') || u.startsWith('µg/l') ? 0.001 : u.startsWith('mg/l') ? 1 : null;
      if (scale === null) break;
      if (/as ?p\b/.test(u) || u.endsWith(' p')) return ok(value * scale, 'mg P/L');
      if (/as ?po4/.test(u)) return ok(value * scale * MW.P / MW.PO4, 'mg P/L', 'converted from PO₄ to P basis (× 30.974/94.971)');
      if (variable !== 'po4' && (u === 'mg/l' || u === 'ug/l')) return ok(value * scale, 'mg P/L', 'phosphorus reported as P by convention');
      return { value: null, note: `unit "${unitRaw}" does not say whether the value is "as P" or "as PO₄"; not converted` };
    }
    default: break;
  }
  return { value: null, note: `unit "${unitRaw}" is not one this app can convert for ${variable}` };
}

/**
 * Parse CSV text into an observation dataset.
 * @returns {{format, rows:Array, report, locations, characteristics}}
 */
export function importObservations(text, fileName = 'uploaded.csv') {
  if (typeof text !== 'string' || !text.trim()) throw new ImportError('The file is empty.');
  if (/^\s*</.test(text)) throw new ImportError('This looks like a web page (HTML), not a CSV file. In the Water Quality Portal choose "Comma-separated" as the file format.');
  const table = parseCSV(text);
  if (table.length < 2) throw new ImportError('The file has a header row but no data rows.');
  const header = table[0];
  const idx = findColumns(header);
  const missing = REQUIRED.filter((k) => idx[k] < 0);
  if (missing.length) {
    const names = missing.map((k) => COLUMNS[k].join(' or ')).join('; ');
    throw new ImportError(`This CSV is missing required column(s): ${names}. Use the classroom CSV made by scripts/fetch_wqp.py, or a Water Quality Portal "Sample Results" download.`);
  }
  const format = idx.category >= 0 ? 'classroom' : header.includes('MonitoringLocationIdentifier') ? 'wqp-legacy' : 'wqp-wqx3';
  const get = (r, k) => (idx[k] >= 0 ? (r[idx[k]] ?? '').trim() : '');
  const rows = [];
  for (let i = 1; i < table.length; i++) {
    const r = table[i];
    if (r.length === 1 && r[0].trim() === '') continue;
    const rawValue = get(r, 'value');
    const num = rawValue === '' ? NaN : Number(rawValue);
    const characteristic = get(r, 'characteristic');
    const fraction = get(r, 'fraction');
    const map = mapCharacteristic(characteristic, fraction);
    const conv = map ? convertUnit(map.variable, num, get(r, 'unit')) : { value: null, note: 'characteristic not represented in the classroom model' };
    rows.push({
      line: i + 1,
      category: get(r, 'category') || 'OBSERVED',
      locationId: get(r, 'locationId'),
      locationName: get(r, 'locationName'),
      organization: get(r, 'organization'),
      provider: get(r, 'provider'),
      date: get(r, 'date'),
      time: get(r, 'time'),
      characteristic,
      fraction,
      rawValue,
      value: num,
      unit: get(r, 'unit'),
      status: get(r, 'status'),
      qualifier: get(r, 'qualifier'),
      detection: get(r, 'detection'),
      latitude: get(r, 'latitude'),
      longitude: get(r, 'longitude'),
      sourceUrl: get(r, 'sourceUrl'),
      queryUrl: get(r, 'queryUrl'),
      retrieved: get(r, 'retrieved'),
      sourceName: get(r, 'sourceName') || (format === 'classroom' ? '' : 'Water Quality Portal (waterqualitydata.us)'),
      variable: map?.variable ?? null,
      variableLabel: map?.label ?? null,
      modelValue: conv.value,
      modelUnit: conv.unit ?? map?.modelUnit ?? null,
      conversionNote: conv.note || '',
    });
  }
  const report = validateObservations(rows, { format, fileName });
  if (report.errors.length && report.validRows === 0) {
    throw new ImportError(report.errors.slice(0, 5).map((e) => e.message).join(' '));
  }
  const locations = groupBy(rows.filter((r) => r.ok), (r) => r.locationId);
  const characteristics = groupBy(rows.filter((r) => r.ok), (r) => `${r.characteristic}${r.fraction ? ' (' + r.fraction + ')' : ''} [${r.unit}]`);
  return { format, fileName, rows, report, locations, characteristics };
}

function groupBy(list, keyFn) {
  const m = new Map();
  for (const x of list) {
    const k = keyFn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

/** Summary statistics for numeric values. */
export function summarize(values) {
  const v = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!v.length) return { n: 0 };
  const q = (p) => { const i = (v.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return v[lo] + (v[hi] - v[lo]) * (i - lo); };
  return { n: v.length, min: v[0], q1: q(0.25), median: q(0.5), q3: q(0.75), max: v[v.length - 1], mean: v.reduce((a, b) => a + b, 0) / v.length };
}
