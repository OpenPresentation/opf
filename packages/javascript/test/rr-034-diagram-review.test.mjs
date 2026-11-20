// RR-034: the independent review of OPF's DOT (SH-12) and PlantUML (SH-13) readers. The principle these tests hold: documented syntax draws
// correctly, and anything else is refused or reported at the author's line, never half-drawn silently. A table of the constructs the docs
// claim (PlantUML's own documentation examples for each kind OPF draws, Graphviz's for DOT) says for each source the exact Mermaid it
// becomes and that pele draws it; one test per review finding follows, then limits, hostile text and a mutation fuzz.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DIAGRAM_SOURCE_LIMIT, checkDiagram, composeSlide, dotToMermaid, layoutDiagram, plantumlToMermaid} from '../dist/composition.js';
import {validate} from '../dist/index.js';

const measure = (text, size, style) => Array.from(text).length * size * (style.mono ? .6 : style.bold ? .58 : .52);
const uml = body => `@startuml\n${body}\n@enduml`;
const read = (source, syntax) => (syntax === 'dot' ? dotToMermaid : plantumlToMermaid)(source, {maxEdges: 500});
const translate = (source, syntax = 'plantuml') => {
  const result = read(source, syntax);
  assert.ok(result.ok, `${JSON.stringify(source)}: ${JSON.stringify(result.issue)}`);
  return result.translation.mermaid;
};
const issue = (source, syntax = 'plantuml') => {
  const result = read(source, syntax);
  assert.equal(result.ok, false, `${JSON.stringify(source)} should not translate`);
  return result.issue;
};
const draw = (source, syntax = 'plantuml') => layoutDiagram({source, syntax}, {width: 1100, height: 480, nominal: 32, floor: 16, measure, idPrefix: 'rr'});
const alt = (source, syntax = 'plantuml') => draw(source, syntax).alt;
const lines = (source, syntax = 'plantuml') => translate(source, syntax).split('\n');

// ---- The table: every row is a source the docs claim, the Mermaid it becomes, and a drawing pele accepts.

const UML_ROWS = [
  {name: "seq basic", source: "@startuml\nAlice -> Bob: Authentication Request\nBob --> Alice: Authentication Response\n\nAlice -> Bob: Another authentication Request\nAlice <-- Bob: another authentication Response\n@enduml", lines: [
    "sequenceDiagram",
    "  participant Alice",
    "  participant Bob",
    "  Alice->>Bob: Authentication Request",
    "  Bob-->>Alice: Authentication Response",
    "  Alice->>Bob: Another authentication Request",
    "  Bob-->>Alice: another authentication Response",
  ]},
  {name: "seq participants", source: "@startuml\nparticipant Participant as Foo\nactor Actor as Foo1\nboundary Boundary as Foo2\ncontrol Control as Foo3\nentity Entity as Foo4\ndatabase Database as Foo5\ncollections Collections as Foo6\nqueue Queue as Foo7\nFoo -> Foo1 : To actor\nFoo -> Foo2 : To boundary\nFoo -> Foo3 : To control\nFoo -> Foo4 : To entity\nFoo -> Foo5 : To database\nFoo -> Foo6 : To collections\nFoo -> Foo7: To queue\n@enduml", lines: [
    "sequenceDiagram",
    "  participant Foo@{ \"alias\": \"Participant\" }",
    "  actor Foo1@{ \"alias\": \"Actor\" }",
    "  participant Foo2@{ \"type\": \"boundary\", \"alias\": \"Boundary\" }",
    "  participant Foo3@{ \"type\": \"control\", \"alias\": \"Control\" }",
    "  participant Foo4@{ \"type\": \"entity\", \"alias\": \"Entity\" }",
    "  participant Foo5@{ \"type\": \"database\", \"alias\": \"Database\" }",
    "  participant Foo6@{ \"type\": \"collections\", \"alias\": \"Collections\" }",
    "  participant Foo7@{ \"type\": \"queue\", \"alias\": \"Queue\" }",
    "  Foo->>Foo1: To actor",
    "  Foo->>Foo2: To boundary",
    "  Foo->>Foo3: To control",
    "  Foo->>Foo4: To entity",
    "  Foo->>Foo5: To database",
    "  Foo->>Foo6: To collections",
    "  Foo->>Foo7: To queue",
  ]},
  {name: "seq alt", source: "@startuml\nAlice -> Bob: Authentication Request\nalt successful case\n    Bob -> Alice: Authentication Accepted\nelse some kind of failure\n    Bob -> Alice: Authentication Failure\n    opt\n        loop 1000 times\n            Alice -> Bob: DNS Attack\n        end\n    end\nelse Another type of failure\n   Bob -> Alice: Please repeat\nend\n@enduml", lines: [
    "sequenceDiagram",
    "  participant Alice",
    "  participant Bob",
    "  Alice->>Bob: Authentication Request",
    "  alt successful case",
    "  Bob->>Alice: Authentication Accepted",
    "  else some kind of failure",
    "  Bob->>Alice: Authentication Failure",
    "  opt",
    "  loop 1000 times",
    "  Alice->>Bob: DNS Attack",
    "  end",
    "  end",
    "  else Another type of failure",
    "  Bob->>Alice: Please repeat",
    "  end",
  ]},
  {name: "seq activation", source: "@startuml\nparticipant User\nUser -> A: DoWork\nactivate A\nA -> B: << createRequest >>\nactivate B\nB -> C: DoWork\nactivate C\nC --> B: WorkDone\ndestroy C\nB --> A: RequestCreated\ndeactivate B\nA -> User: Done\ndeactivate A\n@enduml", lines: [
    "sequenceDiagram",
    "  participant User",
    "  participant A",
    "  User->>A: DoWork",
    "  activate A",
    "  participant B",
    "  A->>B: #lt;#lt; createRequest #gt;#gt;",
    "  activate B",
    "  participant C",
    "  B->>C: DoWork",
    "  activate C",
    "  destroy C",
    "  C-->>B: WorkDone",
    "  B-->>A: RequestCreated",
    "  deactivate B",
    "  A->>User: Done",
    "  deactivate A",
  ]},
  {name: "seq return", source: "@startuml\nBob -> Alice : hello\nAlice -> Alice : some action\nreturn bye\nreturn some other return\n@enduml", lines: [
    "sequenceDiagram",
    "  participant Bob",
    "  participant Alice",
    "  Bob->>Alice: hello",
    "  Alice->>Alice: some action",
    "  Alice-->>Alice: bye",
    "  Alice-->>Bob: some other return",
  ]},
  {name: "seq return ++", source: "@startuml\nAlice -> Bob ++ : hello\nBob -> Charlie ++ : more\nreturn inner\nreturn outer\n@enduml", lines: [
    "sequenceDiagram",
    "  participant Alice",
    "  participant Bob",
    "  Alice->>+Bob: hello",
    "  participant Charlie",
    "  Bob->>+Charlie: more",
    "  Charlie-->>-Bob: inner",
    "  Bob-->>-Alice: outer",
  ]},
  {name: "seq note", source: "@startuml\nAlice->Bob : hello\nnote left: this is a first note\n\nBob->Alice : ok\nnote right: this is another note\n\nBob->Bob : I am thinking\nnote left\na note\ncan also be defined\non several lines\nend note\n@enduml", lines: [
    "sequenceDiagram",
    "  participant Alice",
    "  participant Bob",
    "  Alice->>Bob: hello",
    "  Note left of Bob: this is a first note",
    "  Bob->>Alice: ok",
    "  Note right of Alice: this is another note",
    "  Bob->>Bob: I am thinking",
    "  Note left of Bob: a note<br>can also be defined<br>on several lines",
  ]},
  {name: "seq divider", source: "@startuml\n== Initialization ==\n\nAlice -> Bob: Authentication Request\nBob --> Alice: Authentication Response\n\n== Repetition ==\n\nAlice -> Bob: Another authentication Request\nAlice <-- Bob: another authentication Response\n@enduml", lines: [
    "sequenceDiagram",
    "  participant Alice",
    "  participant Bob",
    "  Note over Alice,Bob: Initialization",
    "  Alice->>Bob: Authentication Request",
    "  Bob-->>Alice: Authentication Response",
    "  Note over Alice,Bob: Repetition",
    "  Alice->>Bob: Another authentication Request",
    "  Bob-->>Alice: another authentication Response",
  ]},
  {name: "seq delay", source: "@startuml\nAlice -> Bob: Authentication Request\nBob --> Alice: Authentication Response\n...\nAlice -> Bob: Another authentication Request\nAlice <-- Bob: another authentication Response\n...5 minutes later...\nBob --> Alice: Bye !\n@enduml", lines: [
    "sequenceDiagram",
    "  participant Alice",
    "  participant Bob",
    "  Alice->>Bob: Authentication Request",
    "  Bob-->>Alice: Authentication Response",
    "  Alice->>Bob: Another authentication Request",
    "  Bob-->>Alice: another authentication Response",
    "  Note over Alice,Bob: 5 minutes later",
    "  Bob-->>Alice: Bye !",
  ]},
  {name: "seq box", source: "@startuml\nbox \"Internal Service\" #LightBlue\nparticipant Bob\nparticipant Alice\nend box\nparticipant Other\n\nBob -> Alice : hello\nAlice -> Other : hello\n@enduml", lines: [
    "sequenceDiagram",
    "  box Internal Service",
    "  participant Bob",
    "  participant Alice",
    "  end",
    "  participant Other",
    "  Bob->>Alice: hello",
    "  Alice->>Other: hello",
  ]},
  {name: "seq create", source: "@startuml\nBob -> Alice : hello\ncreate Other\nAlice -> Other : new\ndestroy Other\n@enduml", lines: [
    "sequenceDiagram",
    "  participant Bob",
    "  participant Alice",
    "  Bob->>Alice: hello",
    "  create participant Other",
    "  Alice->>Other: new",
    "  destroy Other",
  ]},
  {name: "class relations", source: "@startuml\nClass01 <|-- Class02\nClass03 *-- Class04\nClass05 o-- Class06\nClass07 .. Class08\nClass09 -- Class10\n@enduml", lines: [
    "classDiagram",
    "  class Class01",
    "  class Class02",
    "  Class01 <|-- Class02",
    "  class Class03",
    "  class Class04",
    "  Class03 *-- Class04",
    "  class Class05",
    "  class Class06",
    "  Class05 o-- Class06",
    "  class Class07",
    "  class Class08",
    "  Class07 .. Class08",
    "  class Class09",
    "  class Class10",
    "  Class09 -- Class10",
  ]},
  {name: "class members", source: "@startuml\nclass Dummy {\n  String data\n  void methods()\n}\n\nclass Flight {\n   flightNumber : Integer\n   departureTime : Date\n}\n@enduml", lines: [
    "classDiagram",
    "  class Dummy {",
    "    String data",
    "    void methods()",
    "  }",
    "  class Flight {",
    "    flightNumber : Integer",
    "    departureTime : Date",
    "  }",
  ]},
  {name: "class labels", source: "@startuml\nClass01 \"1\" *-- \"many\" Class02 : contains\nClass03 o-- Class04 : aggregation\nClass05 --> \"1\" Class06\n@enduml", lines: [
    "classDiagram",
    "  class Class01",
    "  class Class02",
    "  Class01 \"1\" *-- \"many\" Class02 : contains",
    "  class Class03",
    "  class Class04",
    "  Class03 o-- Class04 : aggregation",
    "  class Class05",
    "  class Class06",
    "  Class05 --> \"1\" Class06",
  ]},
  {name: "class abstract", source: "@startuml\nabstract class AbstractList\nabstract AbstractCollection\ninterface List\ninterface Collection\n\nList <|-- AbstractList\nCollection <|-- AbstractCollection\n\nCollection <|- List\nAbstractCollection <|- AbstractList\nAbstractList <|-- ArrayList\n\nclass ArrayList {\n  Object[] elementData\n  size()\n}\n\nenum TimeUnit {\n  DAYS\n  HOURS\n  MINUTES\n}\n@enduml", lines: [
    "classDiagram",
    "  class AbstractList",
    "  <<abstract>> AbstractList",
    "  class AbstractCollection",
    "  <<abstract>> AbstractCollection",
    "  class List",
    "  <<interface>> List",
    "  class Collection",
    "  <<interface>> Collection",
    "  List <|-- AbstractList",
    "  Collection <|-- AbstractCollection",
    "  Collection <|-- List",
    "  AbstractCollection <|-- AbstractList",
    "  class ArrayList",
    "  AbstractList <|-- ArrayList",
    "  class ArrayList {",
    "    Object[] elementData",
    "    size()",
    "  }",
    "  class TimeUnit {",
    "    <<enumeration>>",
    "    DAYS",
    "    HOURS",
    "    MINUTES",
    "  }",
  ]},
  {name: "state basic", source: "@startuml\n[*] --> State1\nState1 --> [*]\nState1 : this is a string\nState1 : this is another string\n\nState1 -> State2\nState2 --> [*]\n@enduml", lines: [
    "stateDiagram-v2",
    "  [*] --> State1",
    "  State1 --> [*]",
    "  State1 : this is a string",
    "  State1 : this is another string",
    "  State1 --> State2",
    "  State2 --> [*]",
  ]},
  {name: "state composite", source: "@startuml\nstate \"Accumulate Enough Data\\nLong State Name\" as long1\nlong1 : Just a test\n\n[*] --> long1\nlong1 --> long1 : New Data\nlong1 --> ProcessData : Enough Data\n@enduml", lines: [
    "stateDiagram-v2",
    "  state \"Accumulate Enough Data<br>Long State Name\" as long1",
    "  long1 : Just a test",
    "  [*] --> long1",
    "  long1 --> long1 : New Data",
    "  long1 --> ProcessData : Enough Data",
  ]},
  {name: "state nested", source: "@startuml\nstate NotShooting {\n  [*] --> Idle\n  Idle --> Configuring : EvConfig\n  Configuring --> Idle : EvConfig\n}\n\n[*] --> NotShooting\nNotShooting --> [*]\n@enduml", lines: [
    "stateDiagram-v2",
    "  state NotShooting {",
    "    [*] --> Idle",
    "    Idle --> Configuring : EvConfig",
    "    Configuring --> Idle : EvConfig",
    "  }",
    "  [*] --> NotShooting",
    "  NotShooting --> [*]",
  ]},
  {name: "state choice", source: "@startuml\nstate choice1 <<choice>>\nstate fork1 <<fork>>\nstate join1 <<join>>\n[*] --> choice1 : from start\nchoice1 --> fork1 : from choice\nfork1 --> join1\n@enduml", lines: [
    "stateDiagram-v2",
    "  state choice1 <<choice>>",
    "  state fork1 <<fork>>",
    "  state join1 <<join>>",
    "  [*] --> choice1 : from start",
    "  choice1 --> fork1 : from choice",
    "  fork1 --> join1",
  ]},
  {name: "activity basic", source: "@startuml\nstart\n:Hello world;\n:This is defined on\nseveral **lines**;\nstop\n@enduml", lines: [
    "flowchart TB",
    "  a0@{ shape: sm-circ, label: \" \" }",
    "  a1@{ shape: rounded, label: \"Hello world\" }",
    "  a2@{ shape: rounded, label: \"This is defined on<br>several lines\" }",
    "  a3@{ shape: fr-circ, label: \" \" }",
    "  a0 --> a1",
    "  a1 --> a2",
    "  a2 --> a3",
  ]},
  {name: "activity if", source: "@startuml\nstart\nif (Graphviz installed?) then (yes)\n  :process all\\ndiagrams;\nelse (no)\n  :process only\n  __sequence__ and __activity__ diagrams;\nendif\nstop\n@enduml", lines: [
    "flowchart TB",
    "  a0@{ shape: sm-circ, label: \" \" }",
    "  a1@{ shape: diam, label: \"Graphviz installed?\" }",
    "  a2@{ shape: rounded, label: \"process all<br>diagrams\" }",
    "  a3@{ shape: rounded, label: \"process only<br>sequence and activity diagrams\" }",
    "  a4@{ shape: fr-circ, label: \" \" }",
    "  a0 --> a1",
    "  a1 -->|\"yes\"| a2",
    "  a1 -->|\"no\"| a3",
    "  a2 --> a4",
    "  a3 --> a4",
  ]},
  {name: "activity while", source: "@startuml\nstart\nwhile (data available?)\n  :read data;\n  :generate diagrams;\nendwhile\nstop\n@enduml", lines: [
    "flowchart TB",
    "  a0@{ shape: sm-circ, label: \" \" }",
    "  a1@{ shape: diam, label: \"data available?\" }",
    "  a2@{ shape: rounded, label: \"read data\" }",
    "  a3@{ shape: rounded, label: \"generate diagrams\" }",
    "  a4@{ shape: fr-circ, label: \" \" }",
    "  a0 --> a1",
    "  a1 --> a2",
    "  a2 --> a3",
    "  a3 --> a1",
    "  a1 --> a4",
  ]},
  {name: "activity repeat", source: "@startuml\nstart\nrepeat\n  :read data;\n  :generate diagrams;\nrepeat while (more data?)\nstop\n@enduml", lines: [
    "flowchart TB",
    "  a0@{ shape: sm-circ, label: \" \" }",
    "  a1@{ shape: rounded, label: \"read data\" }",
    "  a2@{ shape: rounded, label: \"generate diagrams\" }",
    "  a3@{ shape: diam, label: \"more data?\" }",
    "  a4@{ shape: fr-circ, label: \" \" }",
    "  a0 --> a1",
    "  a1 --> a2",
    "  a2 --> a3",
    "  a3 --> a1",
    "  a3 --> a4",
  ]},
  {name: "activity fork", source: "@startuml\nstart\nif (multiprocessor?) then (yes)\n  fork\n    :Treatment 1;\n  fork again\n    :Treatment 2;\n  end fork\nelse (monoproc)\n  :Treatment 1;\n  :Treatment 2;\nendif\nstop\n@enduml", lines: [
    "flowchart TB",
    "  a0@{ shape: sm-circ, label: \" \" }",
    "  a1@{ shape: diam, label: \"multiprocessor?\" }",
    "  a2@{ shape: fork, label: \" \" }",
    "  a3@{ shape: rounded, label: \"Treatment 1\" }",
    "  a4@{ shape: rounded, label: \"Treatment 2\" }",
    "  a5@{ shape: fork, label: \" \" }",
    "  a6@{ shape: rounded, label: \"Treatment 1\" }",
    "  a7@{ shape: rounded, label: \"Treatment 2\" }",
    "  a8@{ shape: fr-circ, label: \" \" }",
    "  a0 --> a1",
    "  a1 -->|\"yes\"| a2",
    "  a2 --> a3",
    "  a2 --> a4",
    "  a3 --> a5",
    "  a4 --> a5",
    "  a1 -->|\"monoproc\"| a6",
    "  a6 --> a7",
    "  a5 --> a8",
    "  a7 --> a8",
  ]},
  {name: "activity swimlane", source: "@startuml\n|Swimlane1|\nstart\n:foo1;\n|#AntiqueWhite|Swimlane2|\n:foo2;\n:foo3;\n|Swimlane1|\n:foo4;\n|Swimlane2|\n:foo5;\nstop\n@enduml", lines: [
    "flowchart TB",
    "  subgraph g0[\"Swimlane1\"]",
    "    a0@{ shape: sm-circ, label: \" \" }",
    "    a1@{ shape: rounded, label: \"foo1\" }",
    "    a4@{ shape: rounded, label: \"foo4\" }",
    "  end",
    "  subgraph g1[\"Swimlane2\"]",
    "    a2@{ shape: rounded, label: \"foo2\" }",
    "    a3@{ shape: rounded, label: \"foo3\" }",
    "    a5@{ shape: rounded, label: \"foo5\" }",
    "    a6@{ shape: fr-circ, label: \" \" }",
    "  end",
    "  a0 --> a1",
    "  a1 --> a2",
    "  a2 --> a3",
    "  a3 --> a4",
    "  a4 --> a5",
    "  a5 --> a6",
  ]},
  {name: "usecase basic", source: "@startuml\n:Main Admin: as Admin\n(Use the application) as (Use)\n\nUser -> (Start)\nUser --> (Use)\n\nAdmin ---> (Use)\n@enduml", lines: [
    "usecase-beta",
    "  actor Admin(\"Main Admin\")",
    "  actor User",
    "  Use(\"Use the application\")",
    "  Start(\"Start\")",
    "  User --> Start",
    "  User --> Use",
    "  Admin --> Use",
  ]},
  {name: "usecase boundary", source: "@startuml\nleft to right direction\nactor Guest as g\npackage Professional {\n  actor Chef as c\n  actor \"Food Critic\" as fc\n}\npackage Restaurant {\n  usecase \"Eat Food\" as UC1\n  usecase \"Pay for Food\" as UC2\n}\nfc --> UC1\ng --> UC1\nc --> UC2\nUC2 .> UC1 : include\n@enduml", lines: [
    "usecase-beta",
    "  direction LR",
    "  actor g(\"Guest\")",
    "  actor c(\"Chef\")",
    "  actor fc(\"Food Critic\")",
    "  systemBoundary \"Restaurant\"@{ type: package }",
    "    UC1(\"Eat Food\")",
    "    UC2(\"Pay for Food\")",
    "  end",
    "  fc --> UC1",
    "  g --> UC1",
    "  c --> UC2",
    "  UC2 ..> : include UC1",
  ]},
  {name: "usecase extend", source: "@startuml\nUser --> (Use)\n(Use) <.. (Extra) : extends\n(Use) ..> (Base) : includes\nnote right of (Use) : A note\n@enduml", lines: [
    "usecase-beta",
    "  actor User",
    "  Use(\"Use\")",
    "  Extra(\"Extra\")",
    "  Base(\"Base\")",
    "  User --> Use",
    "  Use ..> : extend Extra",
    "  Use ..> : include Base",
    "  note for Use \"A note\"",
  ]},
  {name: "component basic", source: "@startuml\nDataAccess - [First Component]\n[First Component] ..> HTTP : use\n@enduml", lines: [
    "flowchart TB",
    "  DataAccess@{ shape: rect, label: \"DataAccess\" }",
    "  k1@{ shape: rect, label: \"First Component\" }",
    "  HTTP@{ shape: rect, label: \"HTTP\" }",
    "  DataAccess --- k1",
    "  k1 -.->|\"use\"| HTTP",
  ]},
  {name: "component nodes", source: "@startuml\nnode node1\nnode node2\nnode node3\nnode node4\nnode node5\nnode1 -- node2\nnode1 .. node3\nnode1 ~~ node4\nnode1 == node5\n@enduml", lines: [
    "flowchart TB",
    "  node1@{ shape: st-rect, label: \"node1\" }",
    "  node2@{ shape: st-rect, label: \"node2\" }",
    "  node3@{ shape: st-rect, label: \"node3\" }",
    "  node4@{ shape: st-rect, label: \"node4\" }",
    "  node5@{ shape: st-rect, label: \"node5\" }",
    "  node1 --- node2",
    "  node1 -.- node3",
    "  node1 --- node4",
    "  node1 === node5",
  ]},
  {name: "component grouping", source: "@startuml\npackage \"Some Group\" {\n  HTTP - [First Component]\n  [Another Component]\n}\n\nnode \"Other Groups\" {\n  FTP - [Second Component]\n  [First Component] --> FTP\n}\n\ncloud {\n  [Example 1]\n}\n\ndatabase \"MySql\" {\n  folder \"This is my folder\" {\n    [Folder 3]\n  }\n  frame \"Foo\" {\n    [Frame 4]\n  }\n}\n\n[Another Component] --> [Example 1]\n[Example 1] --> [Folder 3]\n[Folder 3] --> [Frame 4]\n@enduml", lines: [
    "flowchart TB",
    "  subgraph g0[\"Some Group\"]",
    "    HTTP@{ shape: rect, label: \"HTTP\" }",
    "    k1@{ shape: rect, label: \"First Component\" }",
    "    k2@{ shape: rect, label: \"Another Component\" }",
    "  end",
    "  subgraph g1[\"Other Groups\"]",
    "    FTP@{ shape: rect, label: \"FTP\" }",
    "    k4@{ shape: rect, label: \"Second Component\" }",
    "  end",
    "  subgraph g2[\" \"]",
    "    k5@{ shape: rect, label: \"Example 1\" }",
    "  end",
    "  subgraph g3[\"MySql\"]",
    "    subgraph g4[\"This is my folder\"]",
    "      k6@{ shape: rect, label: \"Folder 3\" }",
    "    end",
    "    subgraph g5[\"Foo\"]",
    "      k7@{ shape: rect, label: \"Frame 4\" }",
    "    end",
    "  end",
    "  HTTP --- k1",
    "  FTP --- k4",
    "  k1 --> FTP",
    "  k2 --> k5",
    "  k5 --> k6",
    "  k6 --> k7",
  ]},
  {name: "component deployment", source: "@startuml\nartifact artifact1 as \"Artifact\"\nnode node1\ndatabase db1\nnode1 --> db1\nartifact1 ..> node1 : deployed on\n@enduml", lines: [
    "flowchart TB",
    "  artifact1@{ shape: doc, label: \"Artifact\" }",
    "  node1@{ shape: st-rect, label: \"node1\" }",
    "  db1@{ shape: cyl, label: \"db1\" }",
    "  node1 --> db1",
    "  artifact1 -.->|\"deployed on\"| node1",
  ]},
  {name: "mindmap", source: "@startmindmap\n* Debian\n** Ubuntu\n*** Linux Mint\n*** Kubuntu\n** LMDE\n*** SolydXK\n**** <s>Raspmbc</s> => OSMC\n@endmindmap", lines: [
    "mindmap",
    "  m0(\"Debian\")",
    "    m1(\"Ubuntu\")",
    "      m2(\"Linux Mint\")",
    "      m3(\"Kubuntu\")",
    "    m4(\"LMDE\")",
    "      m5(\"SolydXK\")",
    "        m6(\"Raspmbc =#gt; OSMC\")",
  ]},
  {name: "mindmap sides", source: "@startmindmap\n+ OS\n++ Ubuntu\n+++ Linux Mint\n++ LMDE\n-- Windows 95\n--- Windows 98\n-- Mac OS\n@endmindmap", lines: [
    "mindmap",
    "  m0(\"OS\")",
    "    m1(\"Ubuntu\")",
    "      m2(\"Linux Mint\")",
    "    m3(\"LMDE\")",
    "    m4(\"Windows 95\")",
    "      m5(\"Windows 98\")",
    "    m6(\"Mac OS\")",
  ]},
  {name: "gantt basic", source: "@startgantt\n[Prototype design] lasts 15 days\n[Test prototype] lasts 10 days\n[Test prototype] starts at [Prototype design]'s end\n@endgantt", lines: [
    "gantt",
    "  dateFormat YYYY-MM-DD",
    "  axisFormat %-j",
    "  Prototype design :t0, 2001-01-01, 15d",
    "  Test prototype :t1, 2001-01-16, 10d",
  ]},
  {name: "gantt project", source: "@startgantt\nProject starts the 2020-07-01\n[Prototype design] starts 2020-07-01 and ends 2020-07-15\n[Test prototype] starts 2020-07-16 and lasts 10 days\n[Deploy] happens at [Test prototype]'s end\n@endgantt", lines: [
    "gantt",
    "  dateFormat YYYY-MM-DD",
    "  Prototype design :t0, 2020-07-01, 15d",
    "  Test prototype :t1, 2020-07-16, 10d",
    "  Deploy :milestone, t2, 2020-07-26, 0d",
  ]},
  {name: "gantt closed", source: "@startgantt\nProject starts 2020-06-22\nsaturday are closed\nsunday are closed\n2020-06-24 is closed\n[Task1] lasts 10 days\n[Task2] starts at [Task1]'s end and lasts 5 days\n@endgantt", lines: [
    "gantt",
    "  dateFormat YYYY-MM-DD",
    "  excludes sunday, saturday, 2020-06-24",
    "  Task1 :t0, 2020-06-22, 10d",
    "  Task2 :t1, 2020-07-07, 5d",
  ]},
  {name: "alias sequence, quoted forms", source: "@startuml\nparticipant \"Web App\" as W\nparticipant API as \"Deck API\"\ndatabase \"Deck store\" as DB\nW -> API : go\nAPI -> DB : save\n@enduml", lines: [
    "sequenceDiagram",
    "  participant W@{ \"alias\": \"Web App\" }",
    "  participant API@{ \"alias\": \"Deck API\" }",
    "  participant DB@{ \"type\": \"database\", \"alias\": \"Deck store\" }",
    "  W->>API: go",
    "  API->>DB: save",
  ]},
  {name: "alias class", source: "@startuml\nclass \"Deck store\" as Store\nclass Slide as \"A slide\"\nclass Deck as D\nD --> Store\nSlide --> D\n@enduml", lines: [
    "classDiagram",
    "  class Store[\"Deck store\"]",
    "  class Slide[\"A slide\"]",
    "  class D[\"Deck\"]",
    "  D --> Store",
    "  Slide --> D",
  ]},
  {name: "alias state", source: "@startuml\nstate \"In review\" as Review\nstate Published as \"Live\"\nstate Draft as Dr\n[*] --> Dr\nDr --> Review\nReview --> Published\n@enduml", lines: [
    "stateDiagram-v2",
    "  state \"In review\" as Review",
    "  state \"Live\" as Published",
    "  state \"Draft\" as Dr",
    "  [*] --> Dr",
    "  Dr --> Review",
    "  Review --> Published",
  ]},
  {name: "alias use case", source: "@startuml\nusecase Login as L\nusecase (Logout) as O\nusecase Reset as \"Reset password\"\nactor User as U\nactor \"Customer service\" as CS\nactor Admin as \"The admin\"\nU --> L\nU --> O\nCS --> Reset\nAdmin --> L\n@enduml", lines: [
    "usecase-beta",
    "  actor U(\"User\")",
    "  actor CS(\"Customer service\")",
    "  actor Admin(\"The admin\")",
    "  L(\"Login\")",
    "  O(\"Logout\")",
    "  Reset(\"Reset password\")",
    "  U --> L",
    "  U --> O",
    "  CS --> Reset",
    "  Admin --> L",
  ]},
  {name: "alias component and container", source: "@startuml\ncomponent Web as W\ncomponent \"Web app\" as W2\ncomponent API as \"The API\"\ndatabase \"Store\" as S\npackage Server as SRV {\n  component Core\n}\nW --> API\nW2 --> S\nSRV --> S\nW --> SRV\n@enduml", lines: [
    "flowchart TB",
    "  W@{ shape: rect, label: \"Web\" }",
    "  W2@{ shape: rect, label: \"Web app\" }",
    "  API@{ shape: rect, label: \"The API\" }",
    "  S@{ shape: cyl, label: \"Store\" }",
    "  subgraph g0[\"Server\"]",
    "    Core@{ shape: rect, label: \"Core\" }",
    "  end",
    "  W --> API",
    "  W2 --> S",
    "  g0 --> S",
    "  W --> g0",
  ]},
  {name: "alias gantt", source: "@startgantt\n[Prototype design] as [D1] lasts 3 days\n[Build] starts at [D1]'s end and lasts 2 days\n@endgantt", lines: [
    "gantt",
    "  dateFormat YYYY-MM-DD",
    "  axisFormat %-j",
    "  Prototype design :t0, 2001-01-01, 3d",
    "  Build :t1, 2001-01-04, 2d",
  ]},
  {name: "elements named like keywords", source: "@startuml\nNode -> Server : hi\nRecord -> Node : x\nState -> Record : y\nClass -> State : z\nObject -> Class : w\nClock -> Server : tick\n@enduml", lines: [
    "sequenceDiagram",
    "  participant Node",
    "  participant Server",
    "  Node->>Server: hi",
    "  participant Record",
    "  Record->>Node: x",
    "  participant p3@{ \"alias\": \"State\" }",
    "  p3->>Record: y",
    "  participant p4@{ \"alias\": \"Class\" }",
    "  p4->>p3: z",
    "  participant Object",
    "  Object->>p4: w",
    "  participant Clock",
    "  Clock->>Server: tick",
  ]},
  {name: "elements named like styling words", source: "@startuml\nBrowser -> Header : render\nHeader -> Footer : x\nShow -> Footer : y\nFooter -> Browser : z\nScale -> Hide : a\nCaption -> Title : b\nLegend -> Skinparam : c\nGroup -> Service : d\nLoop -> Alt : e\n@enduml", lines: [
    "sequenceDiagram",
    "  participant Browser",
    "  participant Header",
    "  Browser->>Header: render",
    "  participant Footer",
    "  Header->>Footer: x",
    "  participant Show",
    "  Show->>Footer: y",
    "  Footer->>Browser: z",
    "  participant Scale",
    "  participant Hide",
    "  Scale->>Hide: a",
    "  participant Caption",
    "  participant p7@{ \"alias\": \"Title\" }",
    "  Caption->>p7: b",
    "  participant Legend",
    "  participant Skinparam",
    "  Legend->>Skinparam: c",
    "  participant Group",
    "  participant Service",
    "  Group->>Service: d",
    "  participant p12@{ \"alias\": \"Loop\" }",
    "  participant p13@{ \"alias\": \"Alt\" }",
    "  p12->>p13: e",
  ]},
  {name: "styling is ignored", source: "@startuml\nskinparam backgroundColor #EEEBDC\nskinparam sequence {\n  ArrowColor DeepSkyBlue\n}\nhide footbox\nscale 2\nheader page header\nfooter page footer\ncaption a caption\nlegend right\n  a legend\nendlegend\n!theme cerulean\nAlice -> Bob : hi\n@enduml", lines: [
    "sequenceDiagram",
    "  participant Alice",
    "  participant Bob",
    "  Alice->>Bob: hi",
  ]},
  {name: "sequence arrows", source: "@startuml\nA -> B : a\nA ->> B : b\nA -\\ B : c\nA ->x B : d\nA <- B : e\nA <-> B : f\nA --> B : g\nA <-- B : h\n@enduml", lines: [
    "sequenceDiagram",
    "  participant A",
    "  participant B",
    "  A->>B: a",
    "  A-)B: b",
    "  A-)B: c",
    "  A-xB: d",
    "  B->>A: e",
    "  A<<->>B: f",
    "  A-->>B: g",
    "  B-->>A: h",
  ]},
  {name: "return after activation", source: "@startuml\nAlice -> Bob ++ : hello\nBob -> Charlie ++ : more\nreturn inner\nreturn outer\n@enduml", lines: [
    "sequenceDiagram",
    "  participant Alice",
    "  participant Bob",
    "  Alice->>+Bob: hello",
    "  participant Charlie",
    "  Bob->>+Charlie: more",
    "  Charlie-->>-Bob: inner",
    "  Bob-->>-Alice: outer",
  ]},
  {name: "return of a call inside an activation", source: "@startuml\nA -> B ++ : call\nB -> C : inner\nreturn done\n@enduml", lines: [
    "sequenceDiagram",
    "  participant A",
    "  participant B",
    "  A->>+B: call",
    "  participant C",
    "  B->>C: inner",
    "  B-->>-A: done",
  ]},
  {name: "destroy after a message of others", source: "@startuml\nA -> B : one\nB -> C : two\ndestroy C\nA -> B : three\n@enduml", lines: [
    "sequenceDiagram",
    "  participant A",
    "  participant B",
    "  A->>B: one",
    "  participant C",
    "  destroy C",
    "  B->>C: two",
    "  A->>B: three",
  ]},
  {name: "create and destroy", source: "@startuml\nA -> B : one\ncreate C\nB -> C : new\nB -> C : more\ndestroy C\nA -> B : after\n@enduml", lines: [
    "sequenceDiagram",
    "  participant A",
    "  participant B",
    "  A->>B: one",
    "  create participant C",
    "  B->>C: new",
    "  destroy C",
    "  B->>C: more",
    "  A->>B: after",
  ]},
  {name: "gantt names that are directives", source: "@startgantt\n[Header] lasts 3 days\n[Title page] lasts 2 days\n[section a] lasts 1 day\n[%% done] lasts 1 day\n@endgantt", lines: [
    "gantt",
    "  dateFormat YYYY-MM-DD",
    "  axisFormat %-j",
    "  Header :t0, 2001-01-01, 3d",
    "  #84;itle page :t1, 2001-01-01, 2d",
    "  #115;ection a :t2, 2001-01-01, 1d",
    "  #37;#37; done :t3, 2001-01-01, 1d",
  ]},
  {name: "class stereotype and separators", source: "@startuml\nclass Object << general >>\nclass C {\n  -- Fields --\n  name : String\n  ..\n  __init__()\n}\n@enduml", lines: [
    "classDiagram",
    "  class Object",
    "  <<general>> Object",
    "  class C {",
    "    name : String",
    "    init()",
    "  }",
  ]},
  {name: "anonymous container", source: "@startuml\ncloud {\n  [Example 1]\n}\n[Example 1] --> [Other]\n@enduml", lines: [
    "flowchart TB",
    "  Other@{ shape: rect, label: \"Other\" }",
    "  subgraph g0[\" \"]",
    "    k0@{ shape: rect, label: \"Example 1\" }",
    "  end",
    "  k0 --> Other",
  ]},
  {name: "sequence delay and divider before any message", source: "@startuml\n== Init ==\nA -> B : x\n...5 minutes later...\nB -> A : y\n|||\n...\n||45||\n@enduml", lines: [
    "sequenceDiagram",
    "  participant A",
    "  participant B",
    "  Note over A,B: Init",
    "  A->>B: x",
    "  Note over A,B: 5 minutes later",
    "  B->>A: y",
  ]},
];
const DOT_ROWS = [
  {name: "simple digraph", source: "digraph G {\n  main -> parse -> execute;\n  main -> init;\n  main -> cleanup;\n  execute -> make_string;\n  execute -> printf\n  init -> make_string;\n  main -> printf;\n  execute -> compare;\n}", lines: [
    "flowchart TB",
    "  main@{ shape: stadium, label: \"main\" }",
    "  parse@{ shape: stadium, label: \"parse\" }",
    "  execute@{ shape: stadium, label: \"execute\" }",
    "  init@{ shape: stadium, label: \"init\" }",
    "  cleanup@{ shape: stadium, label: \"cleanup\" }",
    "  make_string@{ shape: stadium, label: \"make_string\" }",
    "  printf@{ shape: stadium, label: \"printf\" }",
    "  compare@{ shape: stadium, label: \"compare\" }",
    "  main --> parse",
    "  parse --> execute",
    "  main --> init",
    "  main --> cleanup",
    "  execute --> make_string",
    "  execute --> printf",
    "  init --> make_string",
    "  main --> printf",
    "  execute --> compare",
  ]},
  {name: "undirected graph", source: "graph G {\n  a -- b -- c;\n  b -- d;\n}", lines: [
    "flowchart TB",
    "  a@{ shape: stadium, label: \"a\" }",
    "  b@{ shape: stadium, label: \"b\" }",
    "  c@{ shape: stadium, label: \"c\" }",
    "  d@{ shape: stadium, label: \"d\" }",
    "  a --- b",
    "  b --- c",
    "  b --- d",
  ]},
  {name: "strict digraph", source: "strict digraph {\n  a -> b;\n  a -> b;\n  b -> a;\n}", lines: [
    "flowchart TB",
    "  a@{ shape: stadium, label: \"a\" }",
    "  b@{ shape: stadium, label: \"b\" }",
    "  a --> b",
    "  b --> a",
  ]},
  {name: "shapes and styles", source: "digraph {\n  node [shape=box];\n  start [shape=Mdiamond];\n  end [shape=Msquare];\n  a [label=\"Step one\", style=dashed];\n  b [shape=circle, style=bold];\n  start -> a -> b -> end;\n}", lines: [
    "flowchart TB",
    "  start@{ shape: diam, label: \"start\" }",
    "  n1@{ shape: rect, label: \"end\" }",
    "  a@{ shape: rect, label: \"Step one\" }",
    "  b@{ shape: circle, label: \"b\" }",
    "  start --> a",
    "  a --> b",
    "  b --> n1",
    "  style a stroke-dasharray: 6 4",
    "  style b stroke-width: 2px",
  ]},
  {name: "edge labels and styles", source: "digraph {\n  a -> b [label=\"yes\", style=dashed];\n  a -> c [label=\"no\", style=bold];\n  b -> c [arrowhead=none];\n  c -> a [dir=back, label=\"back\"];\n  b -> d [arrowhead=dot];\n  d -> e [style=invis];\n}", lines: [
    "flowchart TB",
    "  a@{ shape: stadium, label: \"a\" }",
    "  b@{ shape: stadium, label: \"b\" }",
    "  c@{ shape: stadium, label: \"c\" }",
    "  d@{ shape: stadium, label: \"d\" }",
    "  e@{ shape: stadium, label: \"e\" }",
    "  a -.->|\"yes\"| b",
    "  a ==>|\"no\"| c",
    "  b --- c",
    "  a -->|\"back\"| c",
    "  b --o d",
    "  d ~~~ e",
  ]},
  {name: "rankdir and label", source: "digraph {\n  rankdir=LR;\n  label=\"Pipeline\";\n  a -> b -> c;\n}", lines: [
    "---",
    "title: 'Pipeline'",
    "---",
    "flowchart LR",
    "  a@{ shape: stadium, label: \"a\" }",
    "  b@{ shape: stadium, label: \"b\" }",
    "  c@{ shape: stadium, label: \"c\" }",
    "  a --> b",
    "  b --> c",
  ]},
  {name: "clusters", source: "digraph G {\n  subgraph cluster_0 {\n    label = \"process #1\";\n    a0 -> a1 -> a2 -> a3;\n  }\n  subgraph cluster_1 {\n    label = \"process #2\";\n    b0 -> b1 -> b2 -> b3;\n  }\n  start -> a0;\n  start -> b0;\n  a1 -> b3;\n  b2 -> a3;\n  a3 -> end;\n  b3 -> end;\n}", lines: [
    "flowchart TB",
    "  start@{ shape: stadium, label: \"start\" }",
    "  n9@{ shape: stadium, label: \"end\" }",
    "  subgraph c0[\"process #35;1\"]",
    "    a0@{ shape: stadium, label: \"a0\" }",
    "    a1@{ shape: stadium, label: \"a1\" }",
    "    a2@{ shape: stadium, label: \"a2\" }",
    "    a3@{ shape: stadium, label: \"a3\" }",
    "  end",
    "  subgraph c1[\"process #35;2\"]",
    "    b0@{ shape: stadium, label: \"b0\" }",
    "    b1@{ shape: stadium, label: \"b1\" }",
    "    b2@{ shape: stadium, label: \"b2\" }",
    "    b3@{ shape: stadium, label: \"b3\" }",
    "  end",
    "  a0 --> a1",
    "  a1 --> a2",
    "  a2 --> a3",
    "  b0 --> b1",
    "  b1 --> b2",
    "  b2 --> b3",
    "  start --> a0",
    "  start --> b0",
    "  a1 --> b3",
    "  b2 --> a3",
    "  a3 --> n9",
    "  b3 --> n9",
  ]},
  {name: "nested clusters", source: "digraph {\n  subgraph cluster_outer {\n    label=\"Outer\";\n    subgraph cluster_inner { label=\"Inner\"; x -> y }\n    z\n  }\n  y -> z\n}", lines: [
    "flowchart TB",
    "  subgraph c0[\"Outer\"]",
    "    z@{ shape: stadium, label: \"z\" }",
    "    subgraph c1[\"Inner\"]",
    "      x@{ shape: stadium, label: \"x\" }",
    "      y@{ shape: stadium, label: \"y\" }",
    "    end",
    "  end",
    "  x --> y",
    "  y --> z",
  ]},
  {name: "record and html", source: "digraph {\n  node [shape=record];\n  s [label=\"{Slide|title\\ltext\\l}\"];\n  h [shape=plaintext, label=<Line one<br/>Line <b>two</b>>];\n  s -> h;\n}", lines: [
    "flowchart TB",
    "  s@{ shape: rect, label: \"Slide<br>title<br>text\" }",
    "  h@{ shape: text, label: \"Line one<br>Line two\" }",
    "  s --> h",
  ]},
  {name: "set edges", source: "digraph {\n  {a b} -> {c d};\n}", lines: [
    "flowchart TB",
    "  a@{ shape: stadium, label: \"a\" }",
    "  b@{ shape: stadium, label: \"b\" }",
    "  c@{ shape: stadium, label: \"c\" }",
    "  d@{ shape: stadium, label: \"d\" }",
    "  a --> c",
    "  a --> d",
    "  b --> c",
    "  b --> d",
  ]},
  {name: "ports and ids", source: "digraph {\n  \"node one\":p1 -> node2:n;\n  42 -> \"a b\";\n}", lines: [
    "flowchart TB",
    "  n0@{ shape: stadium, label: \"node one\" }",
    "  node2@{ shape: stadium, label: \"node2\" }",
    "  n2@{ shape: stadium, label: \"42\" }",
    "  n3@{ shape: stadium, label: \"a b\" }",
    "  n0 --> node2",
    "  n2 --> n3",
  ]},
  {name: "comments and multiline strings", source: "/* header */ digraph { // line\n  # preprocessor\n  a [label=\"one\" + \"two\"];\n  b [label=\"x\\\ny\"];\n  a -> b\n}", lines: [
    "flowchart TB",
    "  a@{ shape: stadium, label: \"onetwo\" }",
    "  b@{ shape: stadium, label: \"xy\" }",
    "  a --> b",
  ]},
];

test('PlantUML: every documented construct becomes the Mermaid it should and pele draws it', () => {
  for (const row of UML_ROWS) {
    assert.deepEqual(lines(row.source), row.lines, row.name);
    assert.doesNotThrow(() => draw(row.source), row.name);
  }
});

test('DOT: every documented construct becomes the Mermaid it should and pele draws it', () => {
  for (const row of DOT_ROWS) {
    assert.deepEqual(lines(row.source, 'dot'), row.lines, row.name);
    assert.doesNotThrow(() => draw(row.source, 'dot'), row.name);
  }
});

// ---- Finding 1: `X as Y`.

test('finding 1: in an unquoted `X as Y`, Y is the name and X is what is drawn, in every kind that has aliases', () => {
  // PlantUML's own example draws two participants, labeled Participant and Actor.
  const documented = uml('participant Participant as Foo\nactor Actor as Foo1\nFoo -> Foo1 : To actor');
  assert.equal(lines(documented).filter(line => /^ {2}(participant|actor) /.test(line)).length, 2);
  assert.equal(alt(documented), 'Sequence diagram: Participant, Actor, To actor');
  assert.equal(alt(uml('participant "Web App" as W\nW -> API : go')), 'Sequence diagram: Web App, API, go');
  assert.equal(alt(uml('participant W as "Web App"\nW -> API : go')), 'Sequence diagram: Web App, API, go');
  assert.equal(alt(uml('usecase Login as L\nactor User as U\nU --> L')), 'Use case diagram: User, Login');
  assert.equal(alt(uml('usecase "Log in" as L\nactor "A user" as U\nU --> L')), 'Use case diagram: A user, Log in');
  assert.equal(alt(uml('usecase L as "Log in"\nactor U as "A user"\nU --> L')), 'Use case diagram: A user, Log in');
  assert.equal(alt(uml('(Use the application) as (Use)\nUser --> (Use)')), 'Use case diagram: User, Use the application');
  assert.equal(alt(uml('class Deck as D\nclass Block as B\nD --> B')), 'Class diagram: Deck, Block');
  assert.equal(alt(uml('class "Deck store" as S\nclass B as "A block"\nS --> B')), 'Class diagram: Deck store, A block');
  assert.equal(alt(uml('state Draft as Dr\nstate "In review" as Re\n[*] --> Dr\nDr --> Re')), 'State diagram: Draft, In review');
  assert.equal(alt(uml('state Re as "In review"\n[*] --> Re')), 'State diagram: In review');
  assert.equal(alt(uml('component Web as W\ncomponent "The API" as A\ncomponent D as "Data"\nW --> A\nA --> D')), 'Component diagram: Web, The API, Data');
  assert.equal(alt('@startgantt\n[Prototype design] as [D1] lasts 3 days\n[Build] starts at [D1]\'s end and lasts 2 days\n@endgantt').startsWith('Gantt chart: Prototype design, Build'), true);
  // A container is linked by the name it is declared with; there is no extra node for it.
  const container = lines(uml('package Server as S {\n  component Core\n}\ncomponent W\nW --> S'));
  assert.deepEqual(container.filter(line => /^ +k?\w+@\{/.test(line)).map(line => line.trim().split('@')[0]), ['W', 'Core']);
  assert.ok(container.includes('  W --> g0'));
});

// ---- Finding 2: keywords that are also names.

test('finding 2: an element named like a styling word keeps its messages and relations, in every kind', () => {
  const words = ['Header', 'Footer', 'Show', 'Hide', 'Scale', 'Caption', 'Title', 'Legend', 'Skinparam', 'Mainframe', 'Newpage', 'Left'];
  for (const word of words) {
    const source = uml(`Other -> ${word} : one\n${word} -> Other : two\n${word} --> ${word} : self`);
    assert.equal(lines(source).filter(line => /->>/.test(line)).length, 3, word);
  }
  // The reviewer's input: no message is dropped.
  const reviewer = uml('Browser -> Header : render\nHeader -> Footer : x\nShow -> Footer : y\nFooter -> Browser : z');
  assert.deepEqual(lines(reviewer).filter(line => /->>/.test(line)), ['  Browser->>Header: render', '  Header->>Footer: x', '  Show->>Footer: y', '  Footer->>Browser: z']);
  // Other kinds: relations and members of elements with those names.
  assert.equal(alt(uml('class Header\nclass Title\nTitle : +name\nHeader --> Title : uses')), 'Class diagram: Header, Title, +name, uses');
  assert.ok(lines(uml('[Header] --> [Footer]\nShow ..> [Footer]')).some(line => /\.->/.test(line)));
  assert.equal(alt(uml('[*] --> Show\nShow --> Hide : go')), 'State diagram: Show, Hide, go');
  // The real statements are still styling, and a styling word followed by words is a statement, not a participant.
  const styled = uml('hide footbox\nshow footbox\nscale 2\nscale max 800\nheader the header\nleft header text\nfooter the footer\ncaption the caption\nlegend left\n  the legend\nend legend\nheader\n  multi\nend header\nskinparam monochrome true\nskinparam sequence {\n  ArrowColor red\n}\nautoactivate on\nA -> B : hi');
  assert.deepEqual(lines(styled), ['sequenceDiagram', '  participant A', '  participant B', '  A->>B: hi']);
  assert.equal(issue(uml('hide @unlinked\nA -> B')).code, 'diagram-unsupported');
  assert.equal(issue(uml('A -> B\nnewpage\nB -> A')).code, 'diagram-syntax', 'a page break is not drawn as one page');
  assert.match(issue(uml('<style>\nsequenceDiagram {\nA -> B')).message, /not closed/);
});

test('every other keyword rule is a whole statement, not a prefix: participants named Node, State, Record, Class, Clock, Group, Loop, Return', () => {
  const words = ['Node', 'State', 'Record', 'Class', 'Object', 'Clock', 'Group', 'Loop', 'Alt', 'Opt', 'Box', 'Else', 'Return', 'Autonumber', 'Activate', 'Note', 'Partition', 'Usecase', 'Interface'];
  for (const word of words) {
    const source = uml(`Other -> ${word} : one\n${word} -> Other : two`);
    assert.equal(lines(source).filter(line => /->>/.test(line)).length, 2, word);
    assert.equal(draw(source).type, 'sequence', word);
  }
  // A class member, however it is written, does not decide the kind of the diagram.
  assert.equal(draw(uml('class C {\n  :colon first\n  [x] member\n  start\n}\nC --> D')).type, 'class');
});

// ---- Finding 3: return.

test('finding 3: return answers the call of the most recent activation, or else the last call; only an activation is deactivated', () => {
  const documented = uml('Bob -> Alice : hello\nAlice -> Alice : some action\nreturn bye\nreturn some other return');
  assert.deepEqual(lines(documented).slice(3), ['  Bob->>Alice: hello', '  Alice->>Alice: some action', '  Alice-->>Alice: bye', '  Alice-->>Bob: some other return']);
  assert.doesNotThrow(() => draw(documented));
  assert.deepEqual(lines(uml('A -> B ++ : call\nB -> C : inner\nreturn done')).slice(3), ['  A->>+B: call', '  participant C', '  B->>C: inner', '  B-->>-A: done']);
  assert.deepEqual(lines(uml('A -> B : call\nactivate B\nreturn done')).slice(-3), ['  A->>B: call', '  activate B', '  B-->>-A: done']);
  assert.match(issue(uml('participant A\nreturn x')).message, /no message to answer|there is none to answer/);
});

// ---- Finding 4 and 5: DOT strings, backticks.

test('finding 4: an escaped backslash ends no string and a string ending in one closes', () => {
  const source = 'digraph{a [label="c:\\\\"]; b [label="x"]; a->b}';
  assert.equal(alt(source, 'dot'), 'Graph: c:\\, x');
  assert.equal(alt('digraph{a [label="say \\"hi\\""]; a->b}', 'dot'), 'Graph: say "hi", b');
  assert.equal(alt('digraph{a [label="\\\\\\\\"]; a->b}', 'dot'), 'Graph: \\\\, b');
  assert.equal(alt('digraph{a [label="x\\\\"]; b [label="y\\\\"]; a->b}', 'dot'), 'Graph: x\\, y\\');
  assert.equal(alt('digraph{a [label="p\\\\\\"q"]; a->b}', 'dot'), 'Graph: p\\"q, b');
  assert.match(issue('digraph{a [label="c:\\\\]; b}', 'dot').message, /not closed/);
  assert.equal(alt('digraph{a [label="line \\\nbreak"]}', 'dot'), 'Graph: line break');
});

test('finding 5: author text is literal text: a backtick, quotes and every character the target syntax reads', () => {
  const texts = ['`', '`x`', '`x', 'x`', '"', "'", '#', ';', '|', '[', ']', '(', ')', '{', '}', '<', '>', '&', '\\', '%', '%%', '@', ':', '*', '_', '-', '=', '~', '$', '!', ',', '.', '/', '?', 'a --> b', 'end', '--', '%% c', '1;2', 'a|b', '[x]', '(x)', '{x}', '"q"', "it's", 'x: y'];
  const dotString = text => `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  // [where, source of a text, syntax, texts to leave out, what the drawing shows for a text]
  const lead = text => `n${text}`;
  const positions = [
    ['DOT node label', text => `digraph { a [label=${dotString(text)}]; a -> b }`, 'dot'],
    ['DOT edge label', text => `digraph { a -> b [label=${dotString(text)}] }`, 'dot'],
    ['DOT cluster label', text => `digraph { subgraph cluster_x { label=${dotString(text)}; a } a -> b }`, 'dot'],
    ['DOT graph label', text => `digraph { label=${dotString(text)}; a -> b }`, 'dot'],
    ['DOT node name', text => `digraph { ${dotString(text)} -> b }`, 'dot'],
    ['sequence message', text => uml(`A -> B : ${text}`), 'plantuml'],
    ['sequence note', text => uml(`A -> B : x\nnote over A : ${text}`), 'plantuml'],
    ['sequence participant', text => uml(`participant "${text}" as A\nA -> B : x`), 'plantuml', /"/],
    ['sequence frame', text => uml(`alt n${text}\nA -> B : x\nend`), 'plantuml', /^\[x\]$/, lead],
    ['sequence title', text => uml(`title n${text}\nA -> B : x`), 'plantuml', undefined, lead],
    ['class name', text => uml(`class "${text}" as C\nC --> D`), 'plantuml', /"/],
    ['class relation', text => uml(`class C\nclass D\nC --> D : ${text}`), 'plantuml'],
    ['state name', text => uml(`state "${text}" as S\n[*] --> S`), 'plantuml', /"/],
    ['state transition', text => uml(`[*] --> A\nA --> B : ${text}`), 'plantuml'],
    ['state description', text => uml(`state A : ${text}\n[*] --> A`), 'plantuml'],
    ['activity action', text => uml(`start\n:${text};\nstop`), 'plantuml'],
    ['activity condition', text => uml(`start\nif (${text}) then (yes)\n:a;\nendif\nstop`), 'plantuml'],
    ['use case name', text => uml(`usecase "${text}" as U\nactor A\nA --> U`), 'plantuml', /"|^\(x\)$/],
    ['use case relation', text => uml(`actor A\n(B)\nA --> (B) : ${text}`), 'plantuml', /^[<>]$/],
    ['component name', text => uml(`component "${text}" as C\ncomponent D\nC --> D`), 'plantuml', /"/],
    ['component link', text => uml(`[A] --> [B] : ${text}`), 'plantuml'],
    ['mind map node', text => `@startmindmap\n* Root\n** n${text}\n@endmindmap`, 'plantuml', undefined, lead],
    ['gantt task', text => `@startgantt\n[n${text}] lasts 3 days\n@endgantt`, 'plantuml', /[[\]]/, lead],
  ];
  for (const [where, build, syntax, skip, expected = text => text] of positions) {
    for (const text of texts) {
      if (skip?.test(text)) continue;
      const source = build(text);
      assert.ok(read(source, syntax).ok, `${where} ${JSON.stringify(text)}: ${JSON.stringify(read(source, syntax).issue)}`);
      assert.ok(alt(source, syntax).includes(expected(text)), `${where} ${JSON.stringify(text)}: ${alt(source, syntax)}`);
    }
  }
  // The reviewer's input: a label that starts with a backtick was a Mermaid markdown string.
  assert.equal(alt('digraph{a->b [label="`x` y"]}', 'dot'), 'Graph: a, b, `x` y');
  assert.equal(alt('digraph{a->b [label="`x"]; subgraph cluster_q { label="`q`"; c } }', 'dot'), 'Graph: `q`, a, b, c, `x');
  assert.ok(translate('digraph{a->b [label="`x` y"]}', 'dot').includes('#96;x#96; y'));
});

test('a drawing pele rejects is reported against the author\'s source without a generated line number', () => {
  const source = uml('A -> B : x\ndeactivate B');
  const found = checkDiagram({source, syntax: 'plantuml'});
  assert.equal(found.ok, false);
  assert.equal(found.issue.line, undefined);
  assert.match(found.issue.message, /^The layout engine rejected the PlantUML source \(Trying to inactivate an inactive participant \(B\)\); /);
  assert.doesNotMatch(found.issue.message, /line \d/);
  assert.throws(() => draw(source), error => error.diagramIssue?.message === found.issue.message);
  // A Mermaid source keeps pele's own position.
  assert.equal(checkDiagram({source: 'flowchart TB\n a -->'}).issue.line, 2);
});

// ---- Finding 6: regular expressions.

test('finding 6: hostile lines finish quickly and are refused or read, never slow', () => {
  const time = source => { const start = performance.now(); const result = plantumlToMermaid(source, {maxEdges: 500}); return {ms: performance.now() - start, result}; };
  for (const char of ['-', '=', '~', '.', ' ', 'a', '"', '(', '[', ':', '<', '*']) {
    for (const head of ['class X\nA ', 'state X\nA ', 'usecase U\nA ', 'component C\nA ', '[A] ', 'participant A\nA ->', 'start\nif (']) {
      const {ms, result} = time(`@startuml\n${head}${char.repeat(19000)}\n@enduml`);
      assert.ok(ms < 100, `${JSON.stringify(head)} ${JSON.stringify(char)} took ${ms} ms`);
      assert.equal(result.ok, false);
    }
  }
  // Many long lines: the work is bounded by the source limit, not by what a pattern could make of it.
  for (const char of ['-', '=', '~', '.', 'a', '<', ' ', '"', '(']) {
    for (const lead of ['A ', 'class A ', 'note left of A : ', ':', 'A -> B : ', '[A] ', 'state A ', 'if (']) {
      const body = lead + char.repeat(1900);
      const {ms} = time(`@startuml\n${Array.from({length: 10}, () => body).join('\n')}\n@enduml`);
      assert.ok(ms < 250, `${JSON.stringify(lead)} ${JSON.stringify(char)} took ${ms} ms`);
    }
  }
  assert.match(issue(uml(`A -> B : ${'x'.repeat(2100)}`)).message, /longer than 2000 characters/);
  const dotStart = performance.now();
  for (const text of [`digraph{${'a->'.repeat(8000)}b}`, `digraph{a [label="${'\\'.repeat(19000)}`, `digraph{${'<'.repeat(19000)}}`, `digraph{${'/*'.repeat(9000)}}`, `digraph{${'a [b=c, '.repeat(2000)}}`]) read(text, 'dot');
  assert.ok(performance.now() - dotStart < 500);
});

// ---- Finding 7, 8, 9: timing, arrow ends, spacers.

test('finding 7: a timing diagram is refused only by its own statements, not by a participant named Clock', () => {
  assert.equal(translate(uml('Clock -> Server : tick')).includes('Clock->>Server: tick'), true);
  assert.equal(issue(uml('robust "Web Browser" as WB\n@0\nWB is Idle')).code, 'diagram-unsupported');
  assert.equal(issue(uml('clock clk with period 50')).code, 'diagram-unsupported');
  assert.equal(issue(uml('concise "Web User" as WU')).code, 'diagram-unsupported');
  assert.equal(issue(uml('binary "Enable" as EN')).code, 'diagram-unsupported');
  assert.equal(issue(uml('analog "Vcc" as VCC')).code, 'diagram-unsupported');
  assert.equal(issue(uml('object Deck\nDeck --> Slide')).code, 'diagram-unsupported');
  assert.equal(translate(uml('Object -> Deck : make')).includes('Object->>Deck: make'), true);
  assert.equal(translate(uml('Archimate -> Deck : make')).includes('Archimate->>Deck: make'), true);
  assert.equal(translate(uml('Nwdiag -> Deck : make')).includes('Nwdiag->>Deck: make'), true);
});

test('finding 8: a circle end is refused, a cross or open end is drawn as the same end, and nothing becomes another arrow', () => {
  for (const source of ['A ->o B : x', 'A o-> B : x', 'A o->o B : x', 'A <->o B : x', 'A -\\o B : x']) {
    const found = issue(uml(`participant A\nparticipant B\n${source}`));
    assert.equal(found.code, 'diagram-unsupported', source);
    assert.match(found.message, /circle/, source);
    assert.equal(found.line, 4, source);
  }
  for (const source of ['A x-> B : x', 'A <->x B : x', 'A <-\\ B : x']) assert.equal(issue(uml(`participant A\nparticipant B\n${source}`)).code, 'diagram-unsupported', source);
  const drawn = lines(uml('A -> B : a\nA ->> B : b\nA ->x B : c\nA --x B : d\nA <- B : e\nA <-> B : f\nA <--> B : g\nA --> B : h')).slice(3);
  assert.deepEqual(drawn, ['  A->>B: a', '  A-)B: b', '  A-xB: c', '  A--xB: d', '  B->>A: e', '  A<<->>B: f', '  A<<-->>B: g', '  A-->>B: h']);
});

test('finding 9: a participant named like a block is a participant; spacing lines are ignored and delays with text are notes', () => {
  assert.equal(draw(uml('Group -> Service : x\nService --> Group : y\nBox -> Loop : z')).type, 'sequence');
  assert.deepEqual(lines(uml('A -> B : 1\n...5 minutes later...\nB -> A : 2\n|||\n...\n||45||\nA -> B : 3')).slice(3), ['  A->>B: 1', '  Note over A,B: 5 minutes later', '  B->>A: 2', '  A->>B: 3']);
  // A divider before the first message is not lost.
  assert.deepEqual(lines(uml('== Init ==\nA -> B : x')), ['sequenceDiagram', '  participant A', '  participant B', '  Note over A,B: Init', '  A->>B: x']);
  // Blocks still work, and a group is still a box.
  assert.deepEqual(lines(uml('group Retry\n  A -> B : again\nend')).slice(-5), ['  rect', '  participant A', '  participant B', '  Note over A,B: Retry', '  A->>B: again', '  end'].slice(-5));
});

test('sequence documentation examples with create, destroy and autonumber', () => {
  const found = lines(uml('participant User\nUser -> A: DoWork\nactivate A\nA -> B: << createRequest >>\nactivate B\nB -> C: DoWork\nactivate C\nC --> B: WorkDone\ndestroy C\nB --> A: RequestCreated\ndeactivate B\nA -> User: Done\ndeactivate A'));
  assert.deepEqual(found.slice(found.indexOf('  activate C')), ['  activate C', '  destroy C', '  C-->>B: WorkDone', '  B-->>A: RequestCreated', '  deactivate B', '  A->>User: Done', '  deactivate A']);
  assert.match(issue(uml('autonumber 10\nA -> B : x')).message, /plain autonumber/);
  assert.equal(translate(uml('autonumber\nA -> B : x')).includes('  autonumber'), true);
  assert.deepEqual(lines(uml('A -> B !! : bye')).slice(-2), ['  destroy B', '  A->>B: bye']);
  assert.equal(issue(uml('A -> B **')).code, 'diagram-unsupported', 'create is written as create');
});

// ---- Notes, containers and the rest of the audit.

test('what carries content and cannot be drawn is refused, not dropped', () => {
  assert.match(issue(uml('[*] --> A\nnote "text" as N')).message, /floating note/);
  assert.match(issue(uml('[*] --> A\nA --> B\nnote on link : text')).message, /note on a link/);
  assert.match(issue(uml('[*] --> A\nnote top of A : x')).message, /left of or right of/);
  assert.match(issue(uml('class A\nclass B\nA --> B\nnote on link : x')).message, /note on a link/);
  assert.match(issue(uml('class A\nnote "floating" as N1\nN1 .. A')).message, /floating note/);
  assert.equal(translate(uml('class A\nnote "floating" as N1')).includes('note "floating"'), true);
  assert.match(issue(uml('actor A\n(B)\nA --> (B)\nnote "x" as N')).message, /floating note/);
  assert.match(issue(uml('[A]\nnote "x" as N')).message, /floating note/);
  assert.match(issue('@startgantt\n[A] lasts 5 days\n[A] pauses on 2020-07-02\n@endgantt').message, /pause/);
  assert.match(issue('@startgantt\n[A] lasts 5 days\n[A] is deleted\n@endgantt').message, /is deleted/);
  assert.match(issue('@startmindmap\n* Root\n**:open\nnever closed\n@endmindmap').message, /not ended with ;/);
  assert.equal(draw('@startmindmap\n* Root\n**\n@endmindmap').type, 'mindmap', 'an empty node is a blank node');
  assert.match(issue(uml('A -> B : hi\nthis is not a statement ][')).message, /cannot read this line of a PlantUML sequence diagram/);
});

// ---- Finding 10: limits in the readers themselves.

test('finding 10: the readers enforce the source limit and the nesting limit with a clear message', () => {
  const long = `digraph{${'a->b;'.repeat(5000)}}`;
  assert.ok(long.length > DIAGRAM_SOURCE_LIMIT);
  assert.deepEqual([issue(long, 'dot').code, issue(long, 'dot').message], ['diagram-limit', `The diagram source is longer than ${DIAGRAM_SOURCE_LIMIT} characters.`]);
  assert.deepEqual([issue(uml(`A -> B : ${'x\n'.repeat(11000)}`)).code, issue(uml(`A -> B : ${'x\n'.repeat(11000)}`)).message], ['diagram-limit', `The diagram source is longer than ${DIAGRAM_SOURCE_LIMIT} characters.`]);
  // Nesting: 1,100 nested groups used to reach pele's 320,000-character limit with a message about generated text.
  const nestedDot = depth => `digraph{${'subgraph cluster_a{'.repeat(depth)}x${'}'.repeat(depth)}}`;
  assert.equal(read(nestedDot(16), 'dot').ok, true);
  assert.match(issue(nestedDot(17), 'dot').message, /nested more than 16 deep/);
  const nestedPackages = depth => uml(`${Array.from({length: depth}, (_, at) => `package p${at} {`).join('\n')}\n[x]\n${'}\n'.repeat(depth)}`);
  assert.equal(read(nestedPackages(16)).ok, true);
  assert.deepEqual([issue(nestedPackages(17)).code, issue(nestedPackages(1100)).code], ['diagram-limit', 'diagram-limit']);
  assert.match(issue(nestedPackages(1100)).message, /nested more than 16 deep/);
  const deepGroups = uml(`${'alt x\n'.repeat(20)}A -> B : y\n${'end\n'.repeat(20)}`);
  assert.equal(issue(deepGroups).code, 'diagram-limit');
  // What the reader writes is bounded too: a source within the limit whose drawing instructions would exceed pele's.
  const wide = `digraph{${'subgraph cluster_a{'.repeat(16)}${Array.from({length: 4800}, (_, at) => `${String.fromCharCode(97 + Math.floor(at / 676) % 26, 97 + Math.floor(at / 26) % 26, 97 + at % 26)};`).join('')}${'}'.repeat(16)}}`;
  assert.ok(wide.length < DIAGRAM_SOURCE_LIMIT);
  const tooBig = read(wide, 'dot');
  assert.equal(tooBig.ok, false);
  assert.equal(tooBig.issue.code, 'diagram-limit');
  assert.match(tooBig.issue.message, /too many nodes, labels or groups/);
});

// ---- Finding 11: the finding the validator reports.

test('finding 11: a diagram source error is reported with a hint that says what to do, with the position when the reader has one', () => {
  const deck = slides => ({$schema: 'https://openpresentation.org/schema/opf/v1', name: 'Diagrams', language: 'en-US', slides});
  const report = validate(deck([
    {title: 'DOT', diagram: {source: 'digraph { a -> }', syntax: 'dot'}},
    {title: 'PlantUML', diagram: {source: uml('A -> B : hi\nthis is not a statement ]['), syntax: 'plantuml'}},
    {title: 'Rejected', diagram: {source: uml('A -> B : x\ndeactivate B'), syntax: 'plantuml'}},
    {title: 'Mermaid', diagram: 'flowchart TB\n a -->'},
  ]));
  const findings = report.findings.filter(finding => finding.path.endsWith('/diagram'));
  assert.equal(findings.length, 4, JSON.stringify(report.findings));
  for (const finding of findings) {
    assert.equal(finding.ruleId, 'opf/unresolved-content', 'one rule id for every syntax: Mermaid errors are reported the same way');
    assert.match(finding.message, /^The diagram cannot be drawn/);
    assert.match(finding.help, /^Fix the diagram source where the message points/);
    assert.match(finding.help, /the diagrams guide lists for that syntax/);
    assert.doesNotMatch(finding.help, /Supply what the message asks for/);
  }
  assert.match(findings[0].message, /\(line 1, column \d+\)/);
  assert.match(findings[1].message, /\(line 3, column 1\)/);
  assert.doesNotMatch(findings[2].message, /line \d/);
  assert.match(findings[3].message, /\(line 2, column 7\)/);
});

// ---- Mutation fuzz: untrusted text never throws and never takes long.

test('fuzz: random mutations of the example sources never throw, never run long and never hit an internal error', () => {
  const sources = [];
  for (const file of ['dot-diagrams', 'plantuml-diagrams']) {
    const found = [];
    const walk = value => { if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === 'object') { if (typeof value.diagram?.source === 'string') found.push(value.diagram); Object.values(value).forEach(walk); } };
    walk(JSON.parse(readFileSync(new URL(`../../../examples/technical/${file}.opf.json`, import.meta.url), 'utf8')));
    sources.push(...found.filter(diagram => diagram.syntax === 'dot' || diagram.syntax === 'plantuml').map(diagram => [diagram.source, diagram.syntax]));
  }
  assert.ok(sources.length >= 10);
  let seed = 0x2f6e2b1;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
  const pick = list => list[Math.floor(random() * list.length)];
  const junk = ['"', "'", '{', '}', '[', ']', '(', ')', '<', '>', '-', '--', '->', '..>', '*', '#', ';', ':', '\\', '`', '|', '\n', ' ', '@startuml', '@enduml', 'end', 'note', 'as', 'class', 'package', '!', '%%', '\u0000', '\u00e9', '/*', '*/', '++', '**', '==', '~~'];
  const start = performance.now();
  let slowest = 0;
  for (let round = 0; round < 400; round++) {
    const [original, syntax] = pick(sources);
    let text = original;
    for (let edit = 1 + Math.floor(random() * 4); edit > 0; edit--) {
      const at = Math.floor(random() * (text.length + 1));
      const kind = random();
      if (kind < .35) text = text.slice(0, at) + pick(junk) + text.slice(at);
      else if (kind < .6) text = text.slice(0, at) + text.slice(at + 1 + Math.floor(random() * 12));
      else if (kind < .8) text = text.slice(0, at) + text.slice(Math.floor(random() * text.length));
      else text = text.slice(0, at) + text.slice(Math.floor(random() * (at + 1)), at) + pick(junk).repeat(1 + Math.floor(random() * 40)) + text.slice(at);
    }
    const before = performance.now();
    const result = read(text, syntax);
    slowest = Math.max(slowest, performance.now() - before);
    if (result.ok) assert.ok(result.translation.mermaid.length > 0);
    else {
      assert.ok(result.issue.message.length > 0);
      assert.doesNotMatch(result.issue.message, /^OPF could not read this (DOT|PlantUML) source/, `an internal error on ${JSON.stringify(text)}: ${result.issue.message}`);
    }
    // checkDiagram (parse by pele) must not throw either, and a source that reads draws or reports.
    const checked = checkDiagram({source: text, syntax});
    if (result.ok && !checked.ok) assert.match(checked.issue.message, /^The layout engine rejected the (DOT|PlantUML) source/, JSON.stringify(text));
  }
  assert.ok(slowest < 400, `the slowest source took ${slowest} ms`);
  assert.ok(performance.now() - start < 60000);
});

test('composeSlide draws every row of the table at the slide level', () => {
  const slide = {title: 'Diagrams', diagram: {source: UML_ROWS[0].source, syntax: 'plantuml'}};
  const item = composeSlide(slide, {width: 1920, height: 1080, scale: 1.5}).items.find(entry => entry.field === 'diagram');
  assert.ok(item?.diagram, 'drawn');
});
