/**
 * provenance.js — keep track of where every observation came from.
 *
 * The three kinds of numbers in this app are never mixed silently:
 *   OBSERVED            real measurements from a named monitoring location
 *   SIMULATED           output of the classroom model with default (baseline) settings
 *   STUDENT EXPERIMENT  output of the classroom model after a student changed settings
 */

export const DATA_KINDS = {
  OBSERVED: { label: 'OBSERVED DATA', className: 'kind-observed', description: 'Real environmental measurements from a named monitoring station.' },
  SIMULATED: { label: 'SIMULATED DATA', className: 'kind-simulated', description: 'Results produced by the classroom ecosystem model with its default settings.' },
  EXPERIMENT: { label: 'STUDENT EXPERIMENT', className: 'kind-experiment', description: 'Model results after you changed the starting conditions.' },
};

/** Build a provenance record for an imported dataset. */
export function provenanceFor(dataset, userNotes = {}) {
  const rows = dataset.rows.filter((r) => r.ok);
  const dates = rows.map((r) => r.isoDate).filter(Boolean).sort();
  const first = rows[0] || {};
  const providers = [...new Set(rows.map((r) => r.provider).filter(Boolean))];
  const orgs = [...new Set(rows.map((r) => r.organization).filter(Boolean))];
  return {
    data_category: 'OBSERVED',
    file_name: dataset.fileName,
    format: dataset.format,
    source_name: first.sourceName || userNotes.sourceName || 'Water Quality Portal (waterqualitydata.us)',
    source_url: first.sourceUrl || userNotes.sourceUrl || 'https://www.waterqualitydata.us/',
    query_url: first.queryUrl || userNotes.queryUrl || '(not recorded in file)',
    retrieved_utc: first.retrieved || userNotes.retrieved || '(not recorded in file — ask your teacher)',
    providers,
    organizations: orgs,
    monitoring_locations: [...dataset.locations.keys()].map((id) => ({ id, name: dataset.locations.get(id)[0].locationName, latitude: dataset.locations.get(id)[0].latitude, longitude: dataset.locations.get(id)[0].longitude, n: dataset.locations.get(id).length })),
    collection_dates: dates.length ? { first: dates[0], last: dates[dates.length - 1] } : null,
    rows_total: dataset.report.total,
    rows_usable: dataset.report.validRows,
    imported_at: new Date().toISOString(),
  };
}

/** Citation sentence students can paste into a lab report. */
export function citation(prov) {
  const locs = prov.monitoring_locations.map((l) => `${l.name || l.id} (${l.id})`).join('; ');
  const range = prov.collection_dates ? `${prov.collection_dates.first} to ${prov.collection_dates.last}` : 'dates unknown';
  return `${prov.organizations.join(', ') || 'Monitoring organization not listed'}. Water-quality observations at ${locs}, ${range}. Retrieved ${prov.retrieved_utc} from ${prov.source_name}, ${prov.source_url}. Data provider(s): ${prov.providers.join(', ') || 'not listed'}.`;
}
