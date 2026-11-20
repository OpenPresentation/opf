// SH-13: PlantUML diagrams in PowerPoint. A PlantUML diagram is drawn as the pele family of its kind, so the export writes it the way
// SH-07 writes that family: one group of native shapes, connectors and text with the authored PlantUML value in OPF_DIAGRAM_V1, so import
// reads the PlantUML source back. A PlantUML diagram OPF does not draw is the unavailable placeholder.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {fromPptx, toPptx, toSvg} from './helpers/default-catalog.mjs';

const FIXED = {seed: 1, timestamp: '2026-01-01T00:00:00Z', zipDate: '2026-01-01T00:00:00Z'};
let checked = 0;
const uml = body => `@startuml\n${body}\n@enduml`;
const SOURCES = {
  sequence: uml('actor User\nparticipant "Deck API" as API\nUser -> API : POST /decks\nAPI --> User : 201 Created'),
  class: uml('class Deck {\n  +name : String\n}\nclass Slide\nDeck "1" *-- "many" Slide'),
  state: uml('[*] --> Draft\nDraft --> Published : approve\nPublished --> [*]'),
  activity: uml('start\n:Write;\nif (Approved?) then (yes)\n  :Publish;\nelse (no)\n  :Revise;\nendif\nstop'),
  usecase: uml('actor Presenter\n(Write a deck) as UC1\nPresenter --> UC1'),
  component: uml('[Web] --> [API] : REST\n[API] --> [Store]'),
  mindmap: '@startmindmap\n* Strategy\n** Growth\n** People\n@endmindmap',
  gantt: '@startgantt\nProject starts 2026-01-05\n[Brief] lasts 5 days\nthen [Build] lasts 10 days\n@endgantt',
};
const deck = {name: 'PlantUML diagrams', slides: [
  ...Object.entries(SOURCES).map(([kind, source]) => ({title: kind, diagram: {source, syntax: 'plantuml', ...(kind === 'sequence' ? {alt: 'The user creates a deck through the API.'} : {})}})),
  {title: 'Refused', diagram: {source: uml('robust "Web" as W'), syntax: 'plantuml'}},
]};
const diagnostics = [];
const bytes = await toPptx(deck, {...FIXED, onDiagnostic: entry => diagnostics.push(entry)});
const entries = unzipSync(bytes);

// ---- 1. Every kind is one group of native shapes; none falls back to a picture.
{
  Object.keys(SOURCES).forEach((kind, index) => {
    const xml = strFromU8(entries[`ppt/slides/slide${index + 1}.xml`]);
    assert.match(xml, /<p:grpSp><p:nvGrpSpPr><p:cNvPr id="\d+" name="OPF diagram \d+"/, `${kind}: a group`);
    assert.ok(!/<p:pic>/.test(xml), `${kind}: no picture`);
  });
  assert.deepEqual(diagnostics.filter(entry => entry.code === 'diagram-shapes-unavailable'), []);
  const sequence = strFromU8(entries['ppt/slides/slide1.xml']);
  assert.match(sequence, /descr="The user creates a deck through the API\."/);
  for (const text of ['User', 'Deck API', 'POST /decks', '201 Created']) assert.ok(sequence.includes(`<a:t>${text}</a:t>`), `sequence text ${text}`);
  const activity = strFromU8(entries['ppt/slides/slide4.xml']);
  assert.match(activity, /name="OPF diagram \d+" descr="Activity diagram: Write, Approved\?, Publish, Revise, yes, no"/);
  assert.match(activity, /<a:prstGeom prst="diamond">/, 'the decision is a diamond');
  checked++;
}

// ---- 2. A PlantUML diagram OPF does not draw is the placeholder, as in the preview.
{
  const last = Object.keys(SOURCES).length + 1;
  assert.match(strFromU8(entries[`ppt/slides/slide${last}.xml`]), /Diagram unavailable/);
  const drawn = await toSvg(deck, last), svg = Array.isArray(drawn) ? drawn.join('') : String(drawn);
  assert.match(svg, /Diagram unavailable/);
  checked++;
}

// ---- 3. Import: every unchanged group is its PlantUML diagram again, syntax and all.
{
  const back = await fromPptx(bytes);
  deck.slides.forEach((slide, index) => {
    const imported = back.slides[index].diagram ?? back.slides[index].blocks?.find(block => block.diagram)?.diagram;
    assert.deepEqual(imported, slide.diagram, `slide ${index + 1}`);
  });
  checked++;
}

console.log(`SH-13 checks passed (${checked}): PlantUML diagrams of every kind as native shapes, the refused diagram's placeholder, and the round trip of the PlantUML source.`);
