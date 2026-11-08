// SH-13: PlantUML diagrams. OPF reads PlantUML itself and writes each diagram as the pele family that draws it (sequence, class, state,
// flowchart for activity and component diagrams, use case, mind map, gantt); every other PlantUML diagram and the preprocessor are refused
// with their position.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DIAGRAM_SYNTAXES, PLANTUML_DIAGRAMS, checkDiagram, composeSlide, diagramsPending, layoutDiagram, plantumlToMermaid} from '../dist/composition.js';
import {fromMarkdown, toMarkdown} from '../dist/markdown.js';
import {validate} from '../dist/index.js';

const measure = (text, size, style) => Array.from(text).length * size * (style.mono ? .6 : style.bold ? .58 : .52);
const deck = slides => ({$schema: 'https://openpresentation.org/schema/opf/v1', name: 'PlantUML', language: 'en-US', slides});
const translate = source => {
  const result = plantumlToMermaid(source, {maxEdges: 500});
  assert.ok(result.ok, JSON.stringify(result.issue));
  return result.translation;
};
const lines = source => translate(source).mermaid.split('\n');
const issue = source => {
  const result = plantumlToMermaid(source, {maxEdges: 500});
  assert.equal(result.ok, false, `${source} should not translate`);
  return result.issue;
};
const uml = body => `@startuml\n${body}\n@enduml`;

// One source per kind, as authors write them.
export const SOURCES = {
  sequence: uml('actor User\nparticipant "Deck API" as API\ndatabase Store\nUser -> API : POST /decks\nAPI -> Store : save\nStore --> API : id\nAPI --> User : 201 Created'),
  class: uml('abstract class Shape {\n  +{abstract} area() : double\n  #name : String\n}\nclass Circle {\n  -radius : double\n}\ninterface Drawable\nShape <|-- Circle\nCircle ..|> Drawable'),
  state: uml('[*] --> Draft\nstate "In review" as Review\nDraft --> Review : submit\nReview --> Published : approve\nPublished --> [*]'),
  activity: uml('start\n:Receive the brief;\nif (Approved?) then (yes)\n  :Build the deck;\nelse (no)\n  :Return it;\nendif\nstop'),
  usecase: uml('left to right direction\nactor Presenter\nrectangle OPF {\n  usecase (Write a deck) as UC1\n  (Export) as UC2\n}\nPresenter --> UC1\nUC1 ..> UC2 : <<include>>'),
  component: uml('package "Front end" {\n  [Web app] as Web\n}\nnode Server {\n  [API]\n  database "Decks" as DB\n}\nWeb --> [API] : REST\n[API] --> DB'),
  mindmap: '@startmindmap\n* Strategy\n** Growth\n*** Markets\n** Efficiency\n** People\n@endmindmap',
  gantt: '@startgantt\nProject starts 2026-01-05\n[Brief] lasts 5 days\nthen [Layouts] lasts 10 days\n[Release] happens at [Layouts]\'s end\n@endgantt',
};

test('PlantUML is a diagram syntax beside Mermaid and DOT, with eight diagram kinds', () => {
  assert.deepEqual([...DIAGRAM_SYNTAXES], ['mermaid', 'dot', 'plantuml']);
  assert.deepEqual(PLANTUML_DIAGRAMS, {sequence: 'sequence', class: 'class', state: 'state', activity: 'flowchart', usecase: 'usecase', component: 'flowchart', mindmap: 'mindmap', gantt: 'gantt'});
  for (const [kind, source] of Object.entries(SOURCES)) {
    assert.equal(translate(source).diagram, kind, kind);
    assert.deepEqual(checkDiagram({source, syntax: 'plantuml'}), {ok: true, type: PLANTUML_DIAGRAMS[kind]}, kind);
  }
});

test('sequence diagrams: participants and their kinds, messages, groups, notes, activations', () => {
  assert.deepEqual(lines(SOURCES.sequence), [
    'sequenceDiagram',
    '  actor User',
    '  participant API@{ "alias": "Deck API" }',
    '  participant Store@{ "type": "database" }',
    '  User->>API: POST /decks',
    '  API->>Store: save',
    '  Store-->>API: id',
    '  API-->>User: 201 Created',
  ]);
  const flow = lines(uml([
    'title Checkout', 'autonumber', 'participant Web', 'Web -> Pay ++ : charge', 'Pay -> Bank : authorize', 'Bank -->> Pay : ok', 'return paid',
    'Web <- Pay : receipt', 'Web ->x Pay : cancel', 'Web <-> Pay : sync',
    'alt approved', '  Pay -> Web : yes', 'else declined', '  Pay -> Web : no', 'end',
    'loop every day', '  Web -> Pay : poll', 'end', 'par', '  Web -> Pay : a', 'else', '  Web -> Bank : b', 'end',
    'group Retry', '  Web -> Pay : again', 'end',
    'note left of Web : first', 'note over Web, Pay', '  shared', 'end note', '== Later ==', '...', '|||',
    'activate Bank', 'deactivate Bank',
  ].join('\n')));
  assert.deepEqual(flow, [
    'sequenceDiagram', '  title Checkout', '  autonumber', '  participant Web',
    '  participant Pay', '  Web->>+Pay: charge', '  participant Bank', '  Pay->>Bank: authorize', '  Bank--)Pay: ok', '  Pay-->>-Web: paid',
    '  Pay->>Web: receipt', '  Web-xPay: cancel', '  Web<<->>Pay: sync',
    '  alt approved', '  Pay->>Web: yes', '  else declined', '  Pay->>Web: no', '  end',
    '  loop every day', '  Web->>Pay: poll', '  end', '  par', '  Web->>Pay: a', '  and', '  Web->>Bank: b', '  end',
    '  rect', '  Note over Web,Pay: Retry', '  Web->>Pay: again', '  end',
    '  Note left of Web: first', '  Note over Web,Pay: shared', '  Note over Web,Bank: Later',
    '  activate Bank', '  deactivate Bank',
  ]);
  // Message text keeps what pele would read as syntax.
  assert.ok(lines(uml('A -> B : a; b # "c" <d>')).includes('  A->>B: a#59; b #35; #quot;c#quot; #lt;d#gt;'));
  assert.equal(issue(uml('[-> A : from outside')).code, 'diagram-unsupported');
  assert.match(issue(uml('A -> B : hi\nthis is not a statement ][')).message, /cannot read this line of a PlantUML sequence diagram/);
  assert.equal(issue(uml('A -> B : hi\nthis is not a statement ][')).line, 3);
});

test('class diagrams: classes, members, stereotypes, relations with cardinalities and labels, notes and packages', () => {
  assert.deepEqual(lines(SOURCES.class), [
    'classDiagram',
    '  class Shape {', '    <<abstract>>', '    +area() double*', '    #name : String', '  }',
    '  class Circle {', '    -radius : double', '  }',
    '  class Drawable', '  <<interface>> Drawable',
    '  Shape <|-- Circle', '  Circle ..|> Drawable',
  ]);
  const more = lines(uml([
    'class "Deck store" as Store<T>', 'enum Color {\n  RED\n  GREEN\n}', 'class List { +items : List<Slide> }', 'Store "1" *-- "many" Slide : holds >', 'Store o-- Color', 'Slide --> Color',
    'Slide ..> Store', 'Store : +{static} count : int', 'note right of Store : one per deck', 'package model {\n  class Theme\n}', 'class Deck extends Base implements Printable',
  ].join('\n')));
  for (const expected of ['  class Store~T~["Deck store"]', '  class Color {', '    <<enumeration>>', '    RED', '  class List {', '    +items : List~Slide~', '  Store "1" *-- "many" Slide : holds',
    '  Store o-- Color', '  Slide --> Color', '  Slide ..> Store', '  Store : +count : int$', '  note for Store "one per deck"', '  namespace model {', '    class Theme', '  Base <|-- Deck', '  Printable <|.. Deck']) {
    assert.ok(more.includes(expected), `${expected}\n${more.join('\n')}`);
  }
});

test('state diagrams: states, transitions, composites, concurrency, choices and notes', () => {
  assert.deepEqual(lines(SOURCES.state), ['stateDiagram-v2', '  [*] --> Draft', '  state "In review" as Review', '  Draft --> Review : submit', '  Review --> Published : approve', '  Published --> [*]']);
  const composite = lines(uml('state Live {\n  [*] --> Serving\n  Serving -> Draining : drain\n  --\n  [*] --> Watching\n}\nstate check <<choice>>\nLive --> check\ncheck --> [*]\nnote left of Live : two regions\nLive : serving traffic\nstate Idle #pink'));
  assert.deepEqual(composite, ['stateDiagram-v2', '  state Live {', '    [*] --> Serving', '    Serving --> Draining : drain', '    --', '    [*] --> Watching', '  }', '  state check <<choice>>', '  Live --> check', '  check --> [*]', '  note left of Live : two regions', '  Live : serving traffic', '  Idle']);
  assert.equal(issue(uml('[*] --> A\nA --> [H]')).code, 'diagram-unsupported');
});

test('activity diagrams become flowcharts: actions, decisions, loops, forks, partitions and lanes', () => {
  assert.deepEqual(lines(SOURCES.activity), [
    'flowchart TB',
    '  a0@{ shape: sm-circ, label: " " }', '  a1@{ shape: rounded, label: "Receive the brief" }', '  a2@{ shape: diam, label: "Approved?" }',
    '  a3@{ shape: rounded, label: "Build the deck" }', '  a4@{ shape: rounded, label: "Return it" }', '  a5@{ shape: fr-circ, label: " " }',
    '  a0 --> a1', '  a1 --> a2', '  a2 -->|"yes"| a3', '  a2 -->|"no"| a4', '  a3 --> a5', '  a4 --> a5',
  ]);
  const loops = lines(uml('start\nwhile (More slides?) is (yes)\n  :Draw a slide;\nendwhile (no)\nrepeat\n  :Check;\nrepeat while (Findings?) is (yes) not (no)\nfork\n  :PPTX;\nfork again\n  :PDF;\nend fork\n-> done;\n:Publish;\nstop'));
  for (const edge of ['  a1 -->|"yes"| a2', '  a2 --> a1', '  a1 -->|"no"| a3', '  a4 -->|"yes"| a3', '  a4 -->|"no"| a5', '  a5 --> a6', '  a5 --> a7', '  a6 --> a8', '  a7 --> a8', '  a8 -->|"done"| a9']) assert.ok(loops.includes(edge), `${edge}\n${loops.join('\n')}`);
  assert.ok(loops.includes('  a5@{ shape: fork, label: " " }'));
  const lanes = lines(uml('|Author|\nstart\n:Write;\n|Reviewer|\n:Review;\n|Author|\n:Publish;\nstop'));
  assert.ok(lanes.includes('  subgraph g0["Author"]') && lanes.includes('  subgraph g1["Reviewer"]'));
  const partition = lines(uml('start\npartition Build {\n  :Compile;\n  :Test;\n}\nstop'));
  assert.ok(partition.includes('  subgraph g0["Build"]') && partition.includes('    a1@{ shape: rounded, label: "Compile" }'));
  const multi = lines(uml('start\n:First line\nsecond line;\nstop'));
  assert.ok(multi.includes('  a1@{ shape: rounded, label: "First line<br>second line" }'));
  assert.equal(issue(uml('(*) --> "First"\n"First" --> (*)')).code, 'diagram-unsupported', 'the legacy syntax is refused');
  assert.equal(issue(uml('start\nif (x) then (yes)\n  :a;\nstop')).code, 'diagram-syntax', 'an if without endif');
});

test('use case diagrams: actors, use cases, boundaries, include and extend', () => {
  assert.deepEqual(lines(SOURCES.usecase), ['usecase-beta', '  direction LR', '  actor Presenter', '  systemBoundary "OPF"', '    UC1("Write a deck")', '    UC2("Export")', '  end', '  Presenter --> UC1', '  UC1 ..> : include UC2']);
  const forms = lines(uml(':Main admin: as Admin\nactor "Customer service" as CS\nUser -> (Start)\nAdmin --> (Manage) : configures\n(Manage) .> (Audit) : extends\nCS --|> User\nnote right of (Start) : the first step'));
  for (const expected of ['  actor Admin("Main admin")', '  actor CS("Customer service")', '  actor User', '  Start("Start")', '  User --> Start', '  Admin -- configures --> Manage', '  Manage ..> : extend Audit', '  CS --|> User', '  note for Start "the first step"']) {
    assert.ok(forms.includes(expected), `${expected}\n${forms.join('\n')}`);
  }
});

test('component and deployment diagrams become flowcharts with containers as groups', () => {
  assert.deepEqual(lines(SOURCES.component), [
    'flowchart TB',
    '  subgraph g0["Front end"]', '    Web@{ shape: rect, label: "Web app" }', '  end',
    '  subgraph g1["Server"]', '    API@{ shape: rect, label: "API" }', '    DB@{ shape: cyl, label: "Decks" }', '  end',
    '  Web -->|"REST"| API', '  API --> DB',
  ]);
  const shapes = lines(uml('cloud CDN\n() "REST" as REST\ninterface Events\nqueue Jobs\nartifact Bundle\nactor Ops\n[A] ..> [B] : uses\n[A] - REST\n[A] -[hidden]- [B]\nCDN <-- [A]'));
  for (const expected of ['  CDN@{ shape: cloud, label: "CDN" }', '  REST@{ shape: circle, label: "REST" }', '  Events@{ shape: circle, label: "Events" }', '  Jobs@{ shape: h-cyl, label: "Jobs" }',
    '  Bundle@{ shape: doc, label: "Bundle" }', '  Ops@{ shape: person, label: "Ops" }', '  A -.->|"uses"| B', '  A --- REST', '  A ~~~ B', '  A --> CDN']) {
    assert.ok(shapes.includes(expected), `${expected}\n${shapes.join('\n')}`);
  }
});

test('mind maps: star depth, Markdown indentation, sides, boxless nodes and multi-line nodes', () => {
  assert.deepEqual(lines(SOURCES.mindmap), ['mindmap', '  m0("Strategy")', '    m1("Growth")', '      m2("Markets")', '    m3("Efficiency")', '    m4("People")']);
  assert.deepEqual(lines('@startmindmap\n* Root\n  * Child\n    * Grandchild\n  * Other\n@endmindmap'), ['mindmap', '  m0("Root")', '    m1("Child")', '      m2("Grandchild")', '    m3("Other")']);
  assert.deepEqual(lines('@startmindmap\n+ Root\n++ Right\n-- Left\n**_ Plain\n**:Two\nlines;\n@endmindmap'), ['mindmap', '  m0("Root")', '    m1("Right")', '    m2("Left")', '    m3["Plain"]', '    m4("Two<br>lines")']);
  assert.equal(issue('@startmindmap\n* One\n* Two\n@endmindmap').code, 'diagram-unsupported');
});

test('gantt charts: OPF schedules the tasks in working days and pele draws them', () => {
  assert.deepEqual(lines(SOURCES.gantt), ['gantt', '  dateFormat YYYY-MM-DD', '  Brief :t0, 2026-01-05, 5d', '  Layouts :t1, 2026-01-10, 10d', '  Release :milestone, t2, 2026-01-20, 0d']);
  const closed = lines('@startgantt\nProject starts 2026-01-05\nsaturday are closed\nsunday are closed\n-- Design --\n[Brief] lasts 5 days\n[Brief] is 100% completed\n[Layouts] starts at [Brief]\'s end and lasts 2 weeks\n-- Build --\n[Engine] starts 2 days after [Layouts]\'s end\n[Engine] lasts 3 days\n[Engine] is 40% complete\n@endgantt');
  assert.deepEqual(closed, ['gantt', '  dateFormat YYYY-MM-DD', '  excludes sunday, saturday', '  section Design', '  Brief :done, t0, 2026-01-05, 5d', '  Layouts :t1, 2026-01-12, 14d', '  section Build', '  Engine :active, t2, 2026-02-02, 3d']);
  // Without a project start the days are numbered from 1.
  assert.deepEqual(lines('@startgantt\n[Plan] lasts 3 days\nthen [Do] lasts 4 days\n@endgantt'), ['gantt', '  dateFormat YYYY-MM-DD', '  axisFormat %-j', '  Plan :t0, 2001-01-01, 3d', '  Do :t1, 2001-01-04, 4d']);
  assert.equal(issue('@startgantt\n[A] lasts 3 days\n[B] starts at [Missing]\'s end\n@endgantt').code, 'diagram-syntax');
});

test('what OPF does not draw is refused at its position', () => {
  const refused = (source, pattern, line) => {
    const found = issue(source);
    assert.equal(found.code, 'diagram-unsupported', source);
    assert.match(found.message, pattern);
    if (line !== undefined) assert.equal(found.line, line, source);
  };
  refused('@startwbs\n* Project\n@endwbs', /work breakdown structure/, 1);
  refused('@startjson\n{"a": 1}\n@endjson', /JSON/, 1);
  refused('@startsalt\n{ x }\n@endsalt', /Salt/, 1);
  refused(uml('robust "Web" as W\n@0\nW is Idle'), /timing diagrams/, 2);
  refused(uml('object Deck\nobject Slide\nDeck --> Slide'), /object diagrams/, 2);
  refused(uml('!include common.puml\nA -> B'), /preprocessor \(!include\)/, 2);
  refused(uml('!define X 1\nA -> B'), /preprocessor/, 2);
  refused(uml('$x = 1\nA -> B'), /preprocessor/, 2);
  refused('@startuml\nA -> B\n@enduml\n@startuml\nC -> D\n@enduml', /holds one diagram/, 4);
  assert.equal(issue('A -> B').code, 'diagram-syntax', 'no @start line');
  assert.equal(issue('@startuml\nA -> B').code, 'diagram-syntax', 'no @end line');
  assert.equal(issue(uml(Array.from({length: 501}, (_, index) => `A -> B : ${index}`).join('\n'))).code, 'diagram-limit');
});

test('styling is ignored: skinparam, themes, colors, hide and show', () => {
  const styled = uml("skinparam backgroundColor #EEEBDC\nskinparam sequence {\n  ArrowColor DeepSkyBlue\n}\n!theme cerulean\nhide footbox\n' a comment\n/' a block\ncomment '/\nAlice -> Bob : hi");
  assert.deepEqual(lines(styled), ['sequenceDiagram', '  participant Alice', '  participant Bob', '  Alice->>Bob: hi']);
});

test('a PlantUML diagram lays out as its family, with an alt text naming its kind, and nothing is pending in Node', () => {
  for (const [kind, source] of Object.entries(SOURCES)) {
    const laid = layoutDiagram({source, syntax: 'plantuml'}, {width: 1100, height: 480, nominal: 32, floor: 16, measure, idPrefix: kind});
    assert.equal(laid.type, PLANTUML_DIAGRAMS[kind], kind);
    assert.ok(laid.fontSize >= 16 || laid.overflow, kind);
  }
  assert.match(layoutDiagram({source: SOURCES.activity, syntax: 'plantuml'}, {width: 1100, height: 480, nominal: 32, floor: 16, measure, idPrefix: 'a'}).alt, /^Activity diagram: Receive the brief/);
  assert.match(layoutDiagram({source: SOURCES.component, syntax: 'plantuml'}, {width: 1100, height: 480, nominal: 32, floor: 16, measure, idPrefix: 'c'}).alt, /^Component diagram: /);
  assert.match(layoutDiagram({source: SOURCES.sequence, syntax: 'plantuml'}, {width: 1100, height: 480, nominal: 32, floor: 16, measure, idPrefix: 's'}).alt, /^Sequence diagram: /);
  assert.deepEqual(diagramsPending(deck([{diagram: {source: SOURCES.sequence, syntax: 'plantuml'}}])), []);
});

test('composition and validate: a PlantUML diagram draws, a refused one is a finding at the diagram', () => {
  const presentation = deck([{title: 'Creating a deck', diagram: {source: SOURCES.sequence, syntax: 'plantuml'}}]);
  const item = composeSlide(presentation.slides[0], {width: 1920, height: 1080, scale: 1.5}).items.find(entry => entry.field === 'diagram');
  assert.equal(item.diagram.type, 'sequence');
  const report = validate(presentation);
  assert.equal(report.schemaValid, true);
  assert.deepEqual(report.findings.filter(finding => finding.severity === 'error'), []);
  const refused = validate(deck([{title: 'Timing', diagram: {source: uml('robust "Web" as W'), syntax: 'plantuml'}}]));
  assert.ok(refused.findings.some(finding => finding.path === '/slides/0/diagram' && /line 2, column 1\): OPF does not draw PlantUML timing diagrams/.test(finding.message)), JSON.stringify(refused.findings));
});

test('Markdown: a ```plantuml fence is a PlantUML diagram and writes back as one; a PlantUML code block stays code', () => {
  const presentation = deck([
    {title: 'Sequence', diagram: {source: SOURCES.sequence, syntax: 'plantuml'}},
    {title: 'With alt', diagram: {source: SOURCES.mindmap, syntax: 'plantuml', alt: 'Strategy has three branches.'}},
    {title: 'Code', code: {source: SOURCES.state, language: 'plantuml'}},
  ]);
  const {markdown, report} = toMarkdown(presentation);
  assert.equal(report.lossless, true);
  assert.ok(markdown.includes('```plantuml\n@startuml\nactor User'));
  assert.ok(markdown.includes('```plantuml alt="Strategy has three branches."\n@startmindmap'));
  const back = fromMarkdown(markdown);
  assert.deepEqual(back.presentation.slides[0].diagram, {source: SOURCES.sequence, syntax: 'plantuml'});
  assert.deepEqual(back.presentation.slides[1].diagram, {source: SOURCES.mindmap, syntax: 'plantuml', alt: 'Strategy has three branches.'});
  assert.deepEqual(back.presentation.slides[2].code, {source: SOURCES.state, language: 'plantuml'});
  const empty = fromMarkdown('# Diagram\n\n```plantuml\n```\n');
  assert.ok(empty.findings.some(finding => finding.ruleId === 'markdown/diagram-source' && /plantuml block has no source/.test(finding.message)));
});
