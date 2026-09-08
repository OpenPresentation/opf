// Text regressions inspect canonical content; style/merge regressions inspect
// the complete objects separately in styled-table-import.mjs.
export const cellValue = cell => cell && typeof cell === 'object' && !Array.isArray(cell) && Object.hasOwn(cell,'value') ? cell.value : cell;
export const tableValues = table => ({...table,...(table.columns ? {columns:table.columns.map(cellValue)} : {}),rows:table.rows.map(row=>row.map(cellValue))});
