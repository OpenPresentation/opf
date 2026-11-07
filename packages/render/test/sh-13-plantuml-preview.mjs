// SH-13: the preview draws a PlantUML diagram as core lays it out (pele's family of its kind from OPF's reading of the source): the same
// picture as that Mermaid diagram, named after the PlantUML kind, and the "Diagram unavailable" placeholder for one OPF does not draw.
import assert from 'node:assert/strict';
import { plantumlToMermaid } from '@openpresentation/opf/composition';
import { toSvg } from './catalog-harness.mjs';

const deck = slides => ({ language: 'en-US', design: { fontScheme: 'roboto', colorScheme: 'corporate-blue' }, slides });
const sources = {
  sequence: '@startuml\nactor User\nparticipant "Deck API" as API\nUser -> API : POST /decks\nAPI --> User : 201 Created\n@enduml',
  activity: '@startuml\nstart\n:Write;\nif (Approved?) then (yes)\n  :Publish;\nelse (no)\n  :Revise;\nendif\nstop\n@enduml',
  mindmap: '@startmindmap\n* Strategy\n** Growth\n** People\n@endmindmap',
};
const families = { sequence: 'sequence', activity: 'flowchart', mindmap: 'mindmap' };

for (const [kind, source] of Object.entries(sources)) {
  const svg = toSvg(deck([{ title: kind, diagram: { source, syntax: 'plantuml' } }]), 1);
  assert.match(svg, new RegExp(`data-opf-diagram="${families[kind]}" role="img"`), kind);
  for (const leftover of ['var(--', 'color-mix', 'class="pele']) assert.ok(!svg.includes(leftover), `${kind}: no ${leftover}`);
  const translated = plantumlToMermaid(source, { maxEdges: 500 });
  assert.ok(translated.ok, kind);
  const same = toSvg(deck([{ title: kind, diagram: translated.translation.mermaid }]), 1);
  assert.equal(svg.replace(/aria-label="[^"]*"/g, ''), same.replace(/aria-label="[^"]*"/g, ''), `${kind}: the drawing of its Mermaid family`);
}
assert.match(toSvg(deck([{ title: 'Flow', diagram: { source: sources.activity, syntax: 'plantuml' } }]), 1), /aria-label="Activity diagram: Write, Approved\?, Publish, Revise, yes, no"/);
assert.match(toSvg(deck([{ title: 'Timing', diagram: { source: '@startuml\nrobust "Web" as W\n@enduml', syntax: 'plantuml' } }]), 1), /Diagram unavailable/);

console.log('SH-13 preview: PlantUML diagrams draw as their Mermaid family, a refused one as the placeholder');
