// SH-12/SH-13 review: authored directions and names survive translation; hostile schedules terminate with a diagnostic.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { checkDiagram, dotToMermaid, plantumlToMermaid } from '../dist/composition.js';

const uml = body => `@startuml\n${body}\n@enduml`;

test('PlantUML state transitions keep a left-pointing authored arrow', () => {
  const translated = plantumlToMermaid(uml('state Draft\nstate Review\nDraft <-- Review : return'), { maxEdges: 500 });
  assert.equal(translated.ok, true);
  assert.ok(translated.translation.mermaid.includes('Review --> Draft : return'), translated.translation.mermaid);
  assert.ok(!translated.translation.mermaid.includes('Draft --> Review'));
});

test('PlantUML Gantt schedules terminate with findings when no working day or bounded schedule exists', () => {
  const cases = [
    ['@startgantt\n' + ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map(day => `${day} is closed`).join('\n') + '\n[Work] lasts 1 day\n@endgantt', 'diagram-syntax'],
    ['@startgantt\n[Work] lasts 999999999999999999999999999999999999 days\n@endgantt', 'diagram-limit'],
    ['@startgantt\n[Work] starts 2001-01-01 and ends 9999-12-31\n@endgantt', 'diagram-limit'],
  ];
  // A process deadline proves even a parser regression cannot hang the test runner.
  const moduleUrl = new URL('../dist/composition.js', import.meta.url).href;
  const script = `import { checkDiagram } from ${JSON.stringify(moduleUrl)}; const cases = JSON.parse(process.argv[1]); process.stdout.write(JSON.stringify(cases.map(([source]) => checkDiagram({source, syntax: 'plantuml'}))));`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script, JSON.stringify(cases)], { encoding: 'utf8', timeout: 2000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const findings = JSON.parse(result.stdout);
  for (let index = 0; index < cases.length; index++) {
    assert.equal(findings[index].ok, false);
    assert.equal(findings[index].issue.code, cases[index][1]);
  }
});

test('generated DOT cluster IDs cannot collide with authored node IDs', () => {
  const source = 'digraph { c0 [label="Outside"]; subgraph cluster_one { a [label="Inside"] } c0 -> a }';
  const translated = dotToMermaid(source, { maxEdges: 500 });
  assert.equal(translated.ok, true);
  assert.ok(!translated.translation.mermaid.includes('subgraph c0['), translated.translation.mermaid);
  assert.equal(checkDiagram({ source, syntax: 'dot' }).ok, true);
});
test('PlantUML component containers cannot collide with authored element IDs', () => {
  const source = uml('node Server {\ncomponent Worker as g0\n}\ncomponent Client\nClient --> g0');
  const translated = plantumlToMermaid(source, { maxEdges: 500 });
  assert.equal(translated.ok, true);
  assert.ok(!translated.translation.mermaid.includes('subgraph g0['), translated.translation.mermaid);
  assert.equal(checkDiagram({ source, syntax: 'plantuml' }).ok, true);
});

test('PlantUML Gantt rejects impossible calendar dates and reversed task spans', () => {
  for (const body of ['[Work] starts 2026-02-30 and lasts 1 day', '[Work] starts 2026-02-01 and ends 2026-01-01']) {
    const result = checkDiagram({ source: '@startgantt\n' + body + '\n@endgantt', syntax: 'plantuml' });
    assert.equal(result.ok, false);
    assert.equal(result.issue.code, 'diagram-syntax');
  }
});
