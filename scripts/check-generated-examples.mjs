import {validate} from '../packages/javascript/dist/index.js';
import {embeddedDeckFor, loadCatalogs, scenarioSpecs} from './generate-example-suite.mjs';

// Exercise the templates in memory: checking the committed fixtures alone
// cannot detect a generator that will reintroduce invalid catalog records.
// Each generated deck embeds its records, so it validates with no catalog registered.
const catalogs = await loadCatalogs();
const failures = [];
for (const [index, spec] of scenarioSpecs.entries()) {
  const {deck, folder, filename} = embeddedDeckFor(spec, index, catalogs);
  const result = validate(deck, {only: ['format', 'references'], catalogs: []});
  const findings = result.findings.filter(issue => issue.severity === 'error' || issue.ruleId === 'opf/unresolved-reference');
  if (!result.valid || findings.length) failures.push({file: `examples/gallery/${folder}/${filename}`, findings});
}
console.log(JSON.stringify({valid: failures.length === 0, generated: scenarioSpecs.length, failures}, null, 2));
if (failures.length) process.exitCode = 1;
