// Format JSON as the OPF schema files are formatted: 2-space indent, arrays of primitives on one line.
export function format(value, indent = '') {
  const next = indent + '  ';
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.every(v => v === null || typeof v !== 'object')) return `[${value.map(v => JSON.stringify(v)).join(', ')}]`;
    return `[\n${value.map(v => next + format(v, next)).join(',\n')}\n${indent}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (!keys.length) return '{}';
    return `{\n${keys.map(k => `${next}${JSON.stringify(k)}: ${format(value[k], next)}`).join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(value);
}
