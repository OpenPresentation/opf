export default [
  ['packages/javascript/src/finding-text.ts', `  "^\\d{4}-\\d{2}-\\d{2}$": {`, `  "^\\s*-?[0-9.]+([ ,]+-?[0-9.]+){3}\\s*$": { what: "a viewBox of four numbers, \`minX minY width height\`, like \`0 0 24 24\`", next: "write four numbers separated by spaces." },
  "^[a-z][A-Za-z0-9]*$": { what: "an adjust value name like \`adj\` or \`adj1\` (a letter, then letters and digits)", next: "use the name of one of the preset's adjust values (docs/shapes.md lists them)." },
  "^\\d{4}-\\d{2}-\\d{2}$": {`],
  ['packages/javascript/test/finding-text-rules.test.mjs', `test('every case of the corpus triggers its rule, and every one of the 89 rules has a case', () => {`, `test('every case of the corpus triggers its rule, and every one of the 93 rules has a case', () => {`],
  ['packages/javascript/test/finding-text-rules.test.mjs', `	assert.equal(RULE_IDS.length, 89);`, `	assert.equal(RULE_IDS.length, 93);`],
];
