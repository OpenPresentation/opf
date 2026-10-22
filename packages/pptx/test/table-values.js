import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
// Text regressions inspect canonical content; style/merge regressions inspect
// the complete objects separately in styled-table-import.mjs.
export const cellValue = cell => cell && typeof cell === 'object' && !Array.isArray(cell) && Object.hasOwn(cell,'value') ? cell.value : cell;
export const tableValues = table => ({...table,...(table.columns ? {columns:table.columns.map(cellValue)} : {}),rows:table.rows.map(row=>row.map(cellValue))});

// Native table parser fixtures retain document/theme metadata but carry no authored table values.
// RR-59 provenance restoration has separate controls; this keeps raw OOXML style checks independent.
export function nativeTableEntries(bytes) {
  const entries = unzipSync(bytes);
  for (const name of Object.keys(entries)) if (/^ppt\/tags\/opfData\d+\.xml$/.test(name)) {
    entries[name] = strToU8(strFromU8(entries[name]).replace(/<p:tag name="OPF_DATA_V1"[^>]*\/>/g, ''));
  }
  return entries;
}
export const nativeTableBytes = bytes => zipSync(nativeTableEntries(bytes));
