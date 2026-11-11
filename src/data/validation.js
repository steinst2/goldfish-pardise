/**
 * validation.js — checks on imported observation rows, with messages a teacher can act on.
 * Rows are never altered here; each row gets `ok` (usable for plotting) plus `issues`.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const US_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** Parse a date string as a calendar date (no time-zone shifting). Returns 'YYYY-MM-DD' or null. */
export function normalizeDate(s) {
  if (!s) return null;
  let m = ISO_DATE.exec(s.trim().slice(0, 10));
  let y, mo, d;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = US_DATE.exec(s.trim()))) { y = +m[3]; mo = +m[1]; d = +m[2]; }
  else return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Physically plausible ranges (in the MODEL unit) used only to FLAG — never to delete — values. */
const PLAUSIBLE = {
  do: [0, 25], tempC: [-2, 45], pH: [0, 14], chl: [0, 5000],
  no3: [0, 200], nh4: [0, 200], po4: [0, 50], waterTotalP: [0, 50], dissolvedP: [0, 50], waterTotalN: [0, 300],
};

export function validateObservations(rows, { format, fileName } = {}) {
  const errors = [];
  const warnings = [];
  const today = new Date().toISOString().slice(0, 10);
  let validRows = 0, comparable = 0, synthetic = 0;
  for (const r of rows) {
    r.issues = [];
    const d = normalizeDate(r.date);
    if (!r.locationId) r.issues.push('no monitoring location ID');
    if (!d) r.issues.push(`date "${r.date}" is not a valid calendar date (expected YYYY-MM-DD)`);
    else if (d > today) r.issues.push(`date ${d} is in the future`);
    r.isoDate = d;
    if (!r.characteristic) r.issues.push('no characteristic name');
    const detected = !/not detected|non-detect|below/i.test(r.detection);
    if (r.rawValue === '' && !detected) {
      r.nonDetect = true; // kept, labelled, never plotted as a number
    } else if (r.rawValue === '') r.issues.push('no result value');
    else if (!Number.isFinite(r.value)) r.issues.push(`result "${r.rawValue}" is not a number`);
    if (/synthetic|test fixture|simulated/i.test(`${r.category} ${r.sourceName} ${r.locationName}`) || (r.category && r.category.toUpperCase() !== 'OBSERVED')) {
      synthetic++;
      r.issues.push('row is labelled as synthetic, simulated or test data — not a field observation');
    }
    if (r.variable && Number.isFinite(r.modelValue)) {
      const [lo, hi] = PLAUSIBLE[r.variable] || [-Infinity, Infinity];
      if (r.modelValue < lo || r.modelValue > hi) r.flag = `value outside the usual range ${lo}–${hi} ${r.modelUnit}; check the original record`;
    }
    if (/^(rejected)$/i.test(r.status)) r.flag = 'result status is "Rejected" by the data provider';
    r.ok = r.issues.length === 0 && !r.nonDetect;
    if (r.ok) validRows++;
    if (r.ok && Number.isFinite(r.modelValue)) comparable++;
  }
  const bad = rows.filter((r) => r.issues.length);
  if (bad.length) {
    const sample = bad.slice(0, 3).map((r) => `line ${r.line}: ${r.issues.join('; ')}`).join(' | ');
    (validRows ? warnings : errors).push({ message: `${bad.length} of ${rows.length} rows could not be used (${sample}${bad.length > 3 ? ' …' : ''}).` });
  }
  if (synthetic) errors.push({ message: `${synthetic} row(s) are labelled as synthetic or simulated. Only real field observations may be imported as OBSERVED data.` });
  const nd = rows.filter((r) => r.nonDetect).length;
  if (nd) warnings.push({ message: `${nd} row(s) are non-detects (below the laboratory's detection limit). They are listed but not plotted as numbers.` });
  const flagged = rows.filter((r) => r.flag).length;
  if (flagged) warnings.push({ message: `${flagged} value(s) are flagged for review (unusual range or rejected status). They are shown with a warning, not removed.` });
  if (format !== 'classroom') warnings.push({ message: 'This is a raw portal download, so it has no download date or query URL. Write down where and when it was downloaded: the provenance panel will show "not recorded". A teacher can add this information with scripts/fetch_wqp.py normalize.' });
  if (validRows && !comparable) warnings.push({ message: 'None of the usable rows can be compared with the model (different characteristics or units). You can still explore them.' });
  return { errors, warnings, validRows, comparable, total: rows.length, fileName };
}
