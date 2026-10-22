// Full provenance stores style spans, never source words. Native edits win.
const keys = ['fontSize', 'fontFamily', 'color'];
const literalColor = value => typeof value === 'string' && /^#(?:[a-f0-9]{3}|[a-f0-9]{6}|[a-f0-9]{8})$/i.test(value);
export function sourceRunStyles(value) {
  if (!Array.isArray(value) || !value.length) return undefined;
  const spans = value.map(run => typeof run === 'string' ? {length: run.length, string: true} : {
    length: run.text.length, ...(run.color !== undefined && !literalColor(run.color) ? {keepColor: true} : {}), ...Object.fromEntries(keys.filter(key => run[key] !== undefined && (key !== 'color' || literalColor(run.color))).map(key => [key, run[key]]))
  });
  if (spans.some(span => !span.length)) return undefined;
  try { validateSourceRunStyles(spans); } catch { return undefined; }
  return spans;
}
export function validateSourceRunStyles(spans) {
  if (!Array.isArray(spans) || !spans.length || spans.length > 10000) throw Error('Invalid source style spans.');
  let length = 0;
  for (const span of spans) {
    if (!span || typeof span !== 'object' || Array.isArray(span) || Object.keys(span).some(key => !['length', 'string', 'keepColor', ...keys].includes(key))
      || !Number.isSafeInteger(span.length) || span.length < 1 || (length += span.length) > 1000000
      || (span.keepColor !== undefined && (span.keepColor !== true || span.color !== undefined))
      || (span.string !== undefined && span.string !== true)
      || (span.fontSize !== undefined && (!Number.isFinite(span.fontSize) || span.fontSize <= 0))
      || (span.fontFamily !== undefined && (typeof span.fontFamily !== 'string' || !span.fontFamily || span.fontFamily.length > 256))
      || (span.color !== undefined && !literalColor(span.color))) throw Error('Invalid source style span.');
  }
}
export function restoreSourceRunStyles(value, spans, intact) {
  if (!spans || !Array.isArray(value) || !keys.some(key => intact[key])) return value;
  const runs = value.map(run => typeof run === 'string' ? {text: run} : run);
  if (runs.some(run => typeof run.text !== 'string') || runs.reduce((n, run) => n + run.text.length, 0) !== spans.reduce((n, span) => n + span.length, 0)) return value;
  const result = []; let runIndex = 0, offset = 0;
  for (const span of spans) {
    let left = span.length; const pieces = [];
    while (left) {
      const run = runs[runIndex], take = Math.min(left, run.text.length - offset);
      if (!take) { runIndex++; offset = 0; continue; }
      const piece = {...run, text: run.text.slice(offset, offset + take)};
      for (const key of keys) if (intact[key] && !(key === 'color' && span.keepColor)) { if (span[key] === undefined) delete piece[key]; else piece[key] = span[key]; }
      pieces.push(piece); left -= take; offset += take;
    }
    for (const piece of pieces) {
      const previous = result.at(-1);
      if (pieces.indexOf(piece) > 0 && previous && typeof previous === 'object' && JSON.stringify({...previous, text: ''}) === JSON.stringify({...piece, text: ''})) previous.text += piece.text;
      else result.push(piece);
    }
    if (span.string && pieces.length && Object.keys(result.at(-1)).length === 1 && keys.every(key => intact[key])) result[result.length - 1] = result.at(-1).text;
  }
  return result;
}
// Property-specific evidence includes every native run/default property in order.
// A change anywhere conservatively disables that property's source restoration.
export function nativeRunStyleEvidence(tree, hash) {
  const values = {fontSize: [], fontFamily: [], color: []};
  const visit = (node, path = []) => {
    if (Array.isArray(node)) { node.forEach((item, index) => visit(item, [...path, index])); return; }
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'sz') values.fontSize.push([[...path, key], value]);
      if (/^a:(latin|ea|cs|sym)$/.test(key)) values.fontFamily.push([[...path, key], value]);
      if (/^a:(srgbClr|schemeClr|sysClr|prstClr)$/.test(key)) values.color.push([[...path, key], value]);
      visit(value, [...path, key]);
    }
  };
  visit(tree);
  return Object.fromEntries(keys.map(key => [key, hash(JSON.stringify(values[key]))]));
}

export function hasSourceRunStyles(topology) {
  if (!topology || typeof topology !== 'object') return false;
  if (Array.isArray(topology)) return topology.some(hasSourceRunStyles);
  return topology.sourceStyles !== undefined || Object.values(topology).some(hasSourceRunStyles);
}
