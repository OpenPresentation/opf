// CSSOM preserves optional comma whitespace in var-containing values.
// Admit only the reviewed grammar contexts; all other text stays exact.
function commaWhitespace(property, value) {
  if (property.startsWith('--')) return value;
  const functions = new Set(['max', 'min', 'minmax', 'color-mix', 'linear-gradient']);
  const stack = [];
  let result = '', quote = '';
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    result += c;
    if (c === '\\') { if (i + 1 < value.length) result += value[++i]; continue; }
    if (quote) { if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '/' && value[i + 1] === '*') {
      const end = value.indexOf('*/', i + 2);
      if (end < 0) return result + value.slice(i + 1);
      result += value.slice(i + 1, end + 2); i = end + 1; continue;
    }
    if (c === '(') stack.push(value.slice(0, i).match(/[-a-zA-Z0-9_]+$/)?.[0].toLowerCase() ?? '');
    else if (c === ')') stack.pop();
    else if (c === ',' && stack.every((name) => functions.has(name) || name === 'calc')) {
      const allowed = stack.length ? functions.has(stack.at(-1)) : property === 'transition' || property === 'box-shadow';
      if (allowed) while (/[\t\n\r\f ]/.test(value[i + 1] ?? '') && i + 1 < value.length) i++;
    }
  }
  return result;
}

export function canonicalCssomRules(rules) {
  return rules.map((rule) => ({
    ...rule,
    ...(rule.declarations ? {declarations: rule.declarations.map(([name, value, priority]) => [name, commaWhitespace(name, value), priority])} : {}),
    ...(rule.rules ? {rules: canonicalCssomRules(rule.rules)} : {}),
  }));
}
