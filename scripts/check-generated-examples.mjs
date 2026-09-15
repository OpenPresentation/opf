import {lintPresentation} from '../packages/javascript/dist/lint.js';
import {catalogKinds, deckFor, loadCatalogIds, scenarioSpecs} from './generate-example-suite.mjs';

// Exercise the templates in memory: checking the committed fixtures alone
// cannot detect a generator that will reintroduce invalid catalog records.
const catalogs = Object.fromEntries(await Promise.all(
  Object.entries(catalogKinds).map(async ([name, kind]) => [name, await loadCatalogIds(kind)]),
));
const failures = [];
for (const [index, spec] of scenarioSpecs.entries()) {
  const {deck, folder, filename} = deckFor(spec, index, catalogs);
  const result = lintPresentation(deck);
  if (!result.valid) failures.push({
    file: `examples/gallery/${folder}/${filename}`,
    diagnostics: result.diagnostics.filter(issue => issue.severity === 'error'),
  });
}
console.log(JSON.stringify({valid: failures.length === 0, generated: scenarioSpecs.length, failures}, null, 2));
if (failures.length) process.exitCode = 1;
