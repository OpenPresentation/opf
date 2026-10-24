// Phase 4 cases (artifacts/source-editor/TEST-PLAN.md sections 4.10 `J-HNT-*`, 4.1 `{{` and 6): the shape hint in JSON, YAML and Markdown, the built-in
// variables after `{{` and accepting one with several cursors, and the target of a Markdown image. Row format: [id, requirement, title, format, doc, steps,
// expect, options?] (see json.mjs). The three arrays are added to the case lists of json-complete.mjs, yaml-complete.mjs and markdown-complete.mjs.
import { K, M, MS, T } from '../source-keyboard.mjs';

const PILLARS = '{\n  "slides": [{\n    "layout": "pillars",\n    "title": "a",\n    |\n  }]\n}';
const HINT_LIVE = 'Slide with layout pillars: title set, items next, notes optional';

// ---- the shape hint ------------------------------------------------------------------------------------------------------------------------
export const jsonHints = [
  ['J-HNT-001', 'R-HNT-01', 'Ctrl+Shift+Space shows the slide shape for a slide with a layout', 'json', PILLARS, [MS('Space')], { hint: { has: ['pillars', 'title', 'items', 'next'] } }],
  ['J-HNT-002', 'R-HNT-01', 'the next unset region is marked', 'json', PILLARS, [MS('Space')], { hint: { next: 'items', rows: [['title', 'set'], ['items', 'next'], ['notes', 'optional']] } }],
  ['J-HNT-003', 'R-HNT-01', 'organization shows its required members', 'json', '{\n  "slides": [],\n  "organization": {\n    |\n  }\n}', [MS('Space')], { hint: { has: ['id', 'name'], next: 'id', rows: [['id', 'next'], ['name', 'optional']] } }],
  ['J-HNT-004', 'R-HNT-01', 'Escape closes the hint', 'json', '{\n  "slides": [{\n    |\n  }]\n}', [MS('Space'), K('Escape')], { hint: { open: 0 } }],
  ['J-HNT-005', 'R-HNT-01', 'the hint is open before Escape', 'json', '{\n  "slides": [{\n    |\n  }]\n}', [MS('Space')], { hint: { open: 1, title: 'slide', next: null } }],
  ['J-HNT-006', 'R-HNT-02', 'typing a comma after a member of a slide with a layout shows the hint by itself', 'json', '{\n  "slides": [{\n    "layout": "pillars",\n    "title": "a"|\n  }]\n}', [T(',')], { hint: { open: 1, has: ['pillars'], next: 'items' }, live: HINT_LIVE }],
  ['J-HNT-007', 'R-HNT-02', 'Escape closes the automatic hint', 'json', '{\n  "slides": [{\n    "layout": "pillars",\n    "title": "a"|\n  }]\n}', [T(','), K('Escape')], { hint: { open: 0 } }],
  ['J-HNT-008', 'R-HNT-02', 'a comma inside a string shows nothing', 'json', '{"slides":[{"layout":"pillars","title":"a|"}]}', [T(',')], { hint: { open: 0 } }],
  ['J-HNT-009', 'R-HNT-02', 'a comma between the entries of a list shows nothing', 'json', '{"slides":[{"layout":"pillars","items":["a"|]}]}', [T(',')], { hint: { open: 0 } }],
  ['J-HNT-010', 'R-HNT-02', 'a slide with no layout does not open it by itself', 'json', '{"slides":[{"title":"a"|}]}', [T(',')], { hint: { open: 0 } }],
  ['J-HNT-011', 'R-HNT-02', 'a { typed for a nested object of a slide opens nothing', 'json', '{"slides":[{"layout":"pillars","design":|}]}', [T('{')], { hint: { open: 0 } }],
  ['J-HNT-012', 'R-HNT-03', 'it updates as the slide gains a member', 'json', PILLARS, [MS('Space'), T('"items": 1')], { hint: { open: 1, rows: [['title', 'set'], ['items', 'set']], next: null } }],
  ['J-HNT-013', 'R-HNT-03', 'arrow keys move the caret and do not navigate the hint', 'json', '{\n  "slides": [{\n    "layout": "pillars",\n    |\n    "title": "a"\n  }]\n}', [MS('Space'), K('ArrowDown')], { text: '{\n  "slides": [{\n    "layout": "pillars",\n    \n    |"title": "a"\n  }]\n}', hint: { open: 1, next: 'items' } }],
  ['J-HNT-014', 'R-HNT-03', 'it closes when the caret leaves the object', 'json', '{\n  "slides": [{\n    "layout": "pillars",\n    |\n  }, {\n    "title": "b"\n  }]\n}', [MS('Space'), ['caret', '"b"', 1]], { hint: { open: 0 } }],
  ['J-HNT-015', 'R-HNT-03', 'it stays while the caret goes into a value of the object', 'json', '{\n  "slides": [{\n    "layout": "pillars",\n    "title": "a",\n    "items": ["x", "y"]\n  }]\n}', [['caret', '"y"', 2], MS('Space')], { hint: { open: 1, title: 'pillars', rows: [['title', 'set'], ['items', 'set']] } }],
  ['J-HNT-016', 'R-HNT-04', 'a slide with no layout lists its common fields', 'json', '{\n  "slides": [{\n    "title": "a",\n    |\n  }]\n}', [MS('Space')], { hint: { has: ['subtitle', 'items', 'notes'], rows: [['title', 'set'], ['subtitle', 'optional']] } }],
  ['J-HNT-017', 'R-HNT-04', 'a chart shows its type and data', 'json', '{"slides":[{"chart":{"type":"column",|}}]}', [MS('Space')], { hint: { title: 'chart', next: 'data', rows: [['type', 'set'], ['data', 'next']] } }],
  ['J-HNT-018', 'R-HNT-04', 'a block shows the field of its type', 'json', '{"slides":[{"blocks":[{"type":"chart",|}]}]}', [MS('Space')], { hint: { title: 'block', next: 'chart', has: ['chart', 'id', 'region'] } }],
  ['J-HNT-019', 'R-HNT-04', 'an object the schema has no shape for has no hint', 'json', '{"slides":[{"title":"a","extensions":{|}}]}', [MS('Space')], { hint: { open: 0 }, live: 'No shape hint here' }],
  ['J-HNT-020', 'R-HNT-04', 'an unknown layout is named and the common fields are listed', 'json', '{"slides":[{"layout":"nope","title":"a",|}]}', [MS('Space')], { hint: { title: '(not found)', has: ['subtitle'] } }],
  ['J-HNT-021', 'R-A11Y-04', 'it is a tooltip with a role and a label, near the caret', 'json', PILLARS, [MS('Space')], { hint: { tooltip: true, role: 'tooltip', label: /^Shape hint: slide · layout "pillars"$/, near: 160 } }],
  ['J-HNT-022', 'R-A11Y-04', 'it is said in the live region as one sentence', 'json', PILLARS, [MS('Space')], { live: HINT_LIVE }],
  ['J-HNT-023', 'R-HNT-05', 'a read-only editor shows it too', 'json', PILLARS, [['readOnly', true], ['caret', '"title": "a",\n    ', 18], MS('Space')], { hint: { open: 1, next: 'items' } }],
  ['J-HNT-024', 'R-A11Y-06', 'it does not animate when the person asks for less motion', 'json', PILLARS, [['emulate', { reducedMotion: 'reduce' }], MS('Space')], { hint: { open: 1, animation: 'none' } }],
  ['J-HNT-025', 'R-HNT-05', 'the completion list opens beside it', 'json', PILLARS, [MS('Space'), T('"')], { hint: { open: 1 }, popup: { open: 1, has: ['items', 'notes'] } }],
  ['J-HNT-026', 'R-HNT-05', 'Escape closes the list first, then the hint', 'json', PILLARS, [MS('Space'), T('"'), K('Escape')], { hint: { open: 1 }, popup: { open: 0 } }],
  ['J-HNT-027', 'R-HNT-05', '... and a second Escape closes the hint', 'json', PILLARS, [MS('Space'), T('"'), K('Escape'), K('Escape')], { hint: { open: 0 } }],
  ['J-HNT-028', 'R-HNT-03', 'it closes when the object is deleted', 'json', '{\n  "slides": [{\n    "layout": "pillars",\n    |\n  }]\n}', [MS('Space'), M('a'), K('Delete')], { hint: { open: 0 } }],
  ['J-HNT-029', 'R-HNT-03', 'pressing the key again keeps one hint', 'json', PILLARS, [MS('Space'), MS('Space')], { hint: { open: 1, next: 'items' } }],
];

export const yamlHints = [
  ['Y-HNT-001', 'R-HNT-01', 'the shape of a slide with a layout', 'yaml', 'slides:\n  - layout: pillars\n    title: a\n    |\n', [MS('Space')], { hint: { has: ['pillars', 'title', 'items'], next: 'items', rows: [['title', 'set'], ['items', 'next'], ['notes', 'optional']] } }],
  ['Y-HNT-002', 'R-HNT-01', 'organization shows its required members', 'yaml', 'organization:\n  id: acme\n  |\n', [MS('Space')], { hint: { next: 'name', rows: [['id', 'set'], ['name', 'next']] } }],
  ['Y-HNT-003', 'R-HNT-01', 'Escape closes it', 'yaml', 'slides:\n  - layout: pillars\n    |\n', [MS('Space'), K('Escape')], { hint: { open: 0 } }],
  ['Y-HNT-004', 'R-HNT-02', 'a comma in a flow mapping of a slide with a layout opens it', 'yaml', 'slides:\n  - {layout: pillars, title: a|}\n', [T(',')], { hint: { open: 1, has: ['pillars'], next: 'items' } }],
  ['Y-HNT-005', 'R-HNT-02', 'a comma in a plain scalar opens nothing', 'yaml', 'slides:\n  - layout: pillars\n    title: Hello|\n', [T(', world')], { hint: { open: 0 } }],
  ['Y-HNT-006', 'R-HNT-03', 'it follows the caret into the next slide and closes', 'yaml', 'slides:\n  - layout: pillars\n    title: a\n    |\n  - title: b\n', [MS('Space'), ['caret', 'title: b', 3]], { hint: { open: 0 } }],
  ['Y-HNT-007', 'R-HNT-03', 'a new item after a dash shows the slide', 'yaml', 'slides:\n  - |\n', [MS('Space')], { hint: { title: 'slide', has: ['title'] } }],
  ['Y-HNT-008', 'R-HNT-05', 'a read-only editor shows it', 'yaml', 'slides:\n  - layout: pillars\n    |\n', [['readOnly', true], ['caret', 'pillars\n    ', 12], MS('Space')], { hint: { open: 1, next: 'title' } }],
];

export const markdownHints = [
  ['M-HNT-001', 'R-HNT-01', 'the shape of a slide with <!-- slide: layout=pillars -->', 'md', '# A\n\n---\n\n<!-- slide: layout=pillars -->\n# B\n\n|', [MS('Space')], { hint: { has: ['pillars'], next: 'items', title: 'pillars', aside: 'slide 2 of 2', rows: [['title', 'set'], ['items', 'next'], ['notes', 'optional']] } }],
  ['M-HNT-002', 'R-HNT-01', 'the rows say how Markdown writes the field', 'md', '# A\n\n<!-- slide: layout=pillars -->\n|', [MS('Space')], { hint: { has: ['# Title', 'Note:'] } }],
  ['M-HNT-003', 'R-HNT-01', 'in the front matter: organization shows its required members', 'md', '---\norganization:\n  id: acme\n  |\n---\n\n# A\n', [MS('Space')], { hint: { next: 'name', rows: [['id', 'set'], ['name', 'next']] } }],
  ['M-HNT-004', 'R-HNT-01', 'in an opf-slide fence the slide of the Markdown above it', 'md', '<!-- slide: layout=agenda -->\n# A\n\n```opf-slide\nnotes: n\n|\n```\n', [MS('Space')], { hint: { title: 'agenda', rows: [['title', 'set'], ['items', 'next'], ['notes', 'set']] } }],
  ['M-HNT-005', 'R-HNT-01', 'Escape closes it', 'md', '# A\n\n<!-- slide: layout=pillars -->\n|', [MS('Space'), K('Escape')], { hint: { open: 0 } }],
  ['M-HNT-006', 'R-HNT-02', 'a comma in the prose of a slide opens nothing', 'md', '# A\n\n<!-- slide: layout=pillars -->\nHello|', [T(', world')], { hint: { open: 0 } }],
  ['M-HNT-007', 'R-HNT-03', 'the second slide of a Markdown deck is the one the caret is in', 'md', '# A\n\n<!-- slide: layout=agenda -->\n\n---\n\n# B\n\n<!-- slide: layout=pillars -->\n- one\n|', [MS('Space')], { hint: { title: 'pillars', aside: 'slide 2 of 2' } }],
  ['M-HNT-008', 'R-HNT-04', 'a code fence has no shape', 'md', '# A\n\n```js\nconst a = 1;\n|\n```\n', [MS('Space')], { hint: { title: 'slide' } }],
];

// ---- built-in variables ----------------------------------------------------------------------------------------------------------------------------
const JVARS = '{"variables":{"brand":{"type":"text","value":"Acme"}},"organization":{"id":"acme","name":"Acme Corp"},"slides":[{"title":"Hello |"}]}';
export const jsonVariables = [
  ['J-VAR-001', 'R-CMP-19', '{{ lists the document\'s variables first, then the built-ins by prefix', 'json', JVARS, [T('{{')], { popup: { open: 1, first: 'brand', has: ['brand', 'deck.name', 'deck.slideCount', 'speaker.name', 'speakers', 'organization.name', 'slide.number', 'slide.section'], order: ['brand', 'deck.name', 'speaker.name', 'organization.name', 'slide.number'] } }],
  ['J-VAR-002', 'R-CMP-19', '{{org filters to the organization names', 'json', JVARS, [T('{{org')], { popup: { open: 1, first: 'organization.name', has: ['organization.legalName', 'organization.tagline', 'organization.acme.name'], not: ['brand', 'deck.name', 'speaker.name', 'slide.number'] } }],
  ['J-VAR-003', 'R-CMP-19', 'a built-in the document sets shows its value, one it does not says so', 'json', JVARS, [T('{{')], { popup: { details: { 'organization.name': 'Acme Corp', 'organization.tagline': 'not set', 'speaker.name': 'not set', 'slide.number': 'per slide', brand: 'text variable' } } }],
  ['J-VAR-004', 'R-CMP-19', 'Tab writes the built-in and closes the braces', 'json', JVARS, [T('{{organization.n'), K('Tab')], { has: '"Hello {{organization.name}}"', popup: { open: 0 } }],
  ['J-VAR-005', 'R-CMP-19', 'the dot is part of the name: {{speaker. lists the speaker names', 'json', JVARS, [T('{{speaker.')], { popup: { open: 1, has: ['speaker.name', 'speaker.title', 'speaker.email'], not: ['organization.name'] } }],
  ['J-VAR-006', 'R-CMP-19', 'the documentation says it resolves to nothing when the document does not set it', 'json', JVARS, [T('{{speaker.n')], { docs: { shown: true, has: ['resolves to nothing'] } }],
  ['J-VAR-007', 'R-CMP-19', 'with no declared variables the built-ins are still offered', 'json', '{"slides":[{"title":"|"}]}', [T('{{')], { popup: { open: 1, first: 'deck.name' } }],
  ['J-VAR-008', 'R-CMP-19', 'a name that the engine does not know is not offered as a logo', 'json', JVARS, [T('{{organization.')], { popup: { open: 1, not: ['organization.logo', 'organization.logo.icon'] } }],
  // Several cursors: the typed name is replaced at every one and the braces are closed at each, in one undo step.
  ['J-VAR-010', 'R-CMP-19', 'three cursors: Tab writes the built-in at each', 'json', '{"slides":[{"title":"A {{"},{"title":"B {{"},{"title":"C {{"}]}', [['addCursors', ['A {{', 'B {{', 'C {{']], T('org'), K('Tab')], { text: '{"slides":[{"title":"A {{organization.name}}|"},{"title":"B {{organization.name}}|"},{"title":"C {{organization.name}}|"}]}', cursors: 3 }],
  ['J-VAR-011', 'R-CMP-19', 'braces that are already there are not doubled, at any cursor', 'json', '{"slides":[{"title":"A {{}}"},{"title":"B {{"}]}', [['addCursors', ['A {{', 'B {{']], T('org'), K('Enter')], { text: '{"slides":[{"title":"A {{organization.name}}|"},{"title":"B {{organization.name}}|"}]}', cursors: 2 }],
  ['J-VAR-012', 'R-CMP-19', 'the accept is one undo step', 'json', '{"slides":[{"title":"A {{"},{"title":"B {{"}]}', [['addCursors', ['A {{', 'B {{']], T('org'), K('Tab')], { undo: [1, '{"slides":[{"title":"A {{org|"},{"title":"B {{org|"}]}'] }],
  ['J-VAR-013', 'R-CMP-19', 'two cursors in one line', 'json', '{"slides":[{"title":"{{ and {{"}]}', [['addCursors', ['{{', '{{ and {{']], T('deck.n'), K('Tab')], { text: '{"slides":[{"title":"{{deck.name}}| and {{deck.name}}|"}]}', cursors: 2 }],
  ['J-VAR-014', 'R-CMP-19', 'the list keeps filtering with several cursors', 'json', '{"slides":[{"title":"A {{"},{"title":"B {{"}]}', [['addCursors', ['A {{', 'B {{']], T('speakers')], { popup: { open: 1, first: 'speakers' }, cursors: 2 }],
];

export const yamlVariables = [
  ['Y-VAR-001', 'R-CMP-19', '{{org lists the organization built-ins and a declared variable comes first', 'yaml', 'variables:\n  brand: {type: text, value: Acme}\norganization:\n  id: acme\n  name: Acme Corp\nslides:\n  - title: "Hello |"', [T('{{org')], { popup: { open: 1, first: 'organization.name', has: ['organization.acme.name'], details: { 'organization.name': 'Acme Corp' } } }],
  ['Y-VAR-002', 'R-CMP-19', 'in a plain scalar, Tab writes the built-in', 'yaml', 'name: Q3\nslides:\n  - title: Hello |', [T('{{deck.n'), K('Tab')], { has: 'title: Hello {{deck.name}}' }],
  ['Y-VAR-003', 'R-CMP-19', 'three cursors in a YAML text', 'yaml', 'slides:\n  - title: "A {{"\n  - title: "B {{"\n  - title: "C {{"\n', [['addCursors', ['A {{', 'B {{', 'C {{']], T('slide.n'), K('Tab')], { text: 'slides:\n  - title: "A {{slide.number}}|"\n  - title: "B {{slide.number}}|"\n  - title: "C {{slide.number}}|"\n', cursors: 3 }],
  ['Y-VAR-004', 'R-CMP-19', 'braces already there are kept at one cursor', 'yaml', 'slides:\n  - title: "A {{}}"\n  - title: "B {{"\n', [['addCursors', ['A {{', 'B {{']], T('deck.n'), K('Enter')], { text: 'slides:\n  - title: "A {{deck.name}}|"\n  - title: "B {{deck.name}}|"\n', cursors: 2 }],
];

const MVARS = '---\nname: Q3\nspeaker:\n  name: Ada\nvariables:\n  brand:\n    type: text\n    value: Acme\n---\n\n';
export const markdownVariables = [
  ['M-VAR-001', 'R-CMP-19', '{{ in a heading lists the declared variables, then the built-ins', 'md', `${MVARS}# Hello |`, [T('{{')], { popup: { open: 1, first: 'brand', has: ['deck.name', 'speaker.name', 'speakers', 'organization.name', 'slide.number'] } }],
  ['M-VAR-002', 'R-CMP-19', '{{sp filters to the speaker names and shows the value', 'md', `${MVARS}# Hello |`, [T('{{sp')], { popup: { open: 1, first: 'speaker.name', details: { 'speaker.name': 'Ada', 'speaker.title': 'not set' } } }],
  ['M-VAR-003', 'R-CMP-19', 'in a paragraph, Enter writes the built-in', 'md', `${MVARS}# A\n\nBy |`, [T('{{speaker.n'), K('Enter')], { has: 'By {{speaker.name}}' }],
  ['M-VAR-004', 'R-CMP-04', 'Note: lines are verbatim', 'md', `${MVARS}# A\n\nNote: by |`, [T('{{')], { popup: { open: 0 } }],
  ['M-VAR-005', 'R-CMP-19', 'three cursors in Markdown text', 'md', `${MVARS}# A {{\n\nB {{\n\nC {{\n`, [['addCursors', ['# A {{', 'B {{', 'C {{']], T('deck.n'), K('Tab')], { has: '# A {{deck.name}}\n\nB {{deck.name}}\n\nC {{deck.name}}\n', cursors: 3 }],
];

// ---- the target of a Markdown image --------------------------------------------------------------------------------------------------------------------
const IMG = '---\nassets:\n  logo: logo.png\n  clip:\n    src: intro.mp4\n    mediaType: video/mp4\n  photo:\n    src: photo.jpg\n    title: A photo\nvariables:\n  hero: {type: image, value: a.png}\n  brand: {type: text, value: Acme}\n---\n\n';
export const markdownImages = [
  ['M-IMG-001', 'R-CMP-19', 'typing ![alt]( lists the assets and the image variables', 'md', `${IMG}# A\n\n|`, [T('![alt](')], { popup: { open: 1, has: ['asset:logo', 'asset:clip', 'asset:photo', 'var:hero'], not: ['var:brand'], count: [4, 4] } }],
  ['M-IMG-002', 'R-CMP-19', 'a typed prefix filters, Tab replaces only the target', 'md', `${IMG}# A\n\n|`, [T('![alt](asset:lo'), K('Tab')], { text: `${IMG}# A\n\n![alt](asset:logo|)`, popup: { open: 0 } }],
  ['M-IMG-003', 'R-CMP-19', 'the parenthesis is closed when the pair rule did not close it', 'md', `${IMG}# A\n\n![alt](lo|`, [K('Control+Space'), K('Tab')], { text: `${IMG}# A\n\n![alt](asset:logo)|` }],
  ['M-IMG-004', 'R-CMP-19', 'an existing parenthesis is kept, and the caret stays before it', 'md', `${IMG}# A\n\n![alt](lo|)\n`, [K('Control+Space'), K('Tab')], { text: `${IMG}# A\n\n![alt](asset:logo|)\n` }],
  ['M-IMG-005', 'R-CMP-19', 'Ctrl+Space works inside the parentheses', 'md', `${IMG}# A\n\n![](|)`, [K('Control+Space')], { popup: { open: 1, first: 'asset:logo' } }],
  ['M-IMG-006', 'R-CMP-19', 'an image variable is offered and inserted', 'md', `${IMG}# A\n\n![](|)`, [T('var:h'), K('Tab')], { has: '![](var:hero)' }],
  ['M-IMG-007', 'R-CMP-19', 'a video line lists the videos first', 'md', `${IMG}# A\n\n<!-- block: as=video -->\n![clip](|)`, [K('Control+Space')], { popup: { open: 1, first: 'asset:clip' } }],
  ['M-IMG-008', 'R-CMP-04', 'a link is not an image', 'md', `${IMG}# A\n\nsee [link](|)`, [K('Control+Space')], { popup: { open: 0 } }],
  ['M-IMG-009', 'R-CMP-04', 'Note: lines are verbatim', 'md', `${IMG}# A\n\nNote: ![](|)`, [K('Control+Space')], { popup: { open: 0 } }],
  ['M-IMG-010', 'R-CMP-04', 'a code fence is verbatim', 'md', `${IMG}# A\n\n\`\`\`js\n![](|)\n\`\`\`\n`, [K('Control+Space')], { popup: { open: 0 } }],
  ['M-IMG-011', 'R-CMP-19', 'a deck with no assets offers nothing', 'md', '# A\n\n![](|)', [K('Control+Space')], { popup: { open: 0 } }],
  ['M-IMG-012', 'R-CMP-14', 'accepting is one undo step', 'md', `${IMG}# A\n\n![alt](lo|`, [K('Control+Space'), K('Tab')], { undo: [1, `${IMG}# A\n\n![alt](lo|`] }],
  ['M-IMG-013', 'R-CMP-19', 'the deck reads the asset reference that was written', 'md', `${IMG}# A\n\n|`, [T('![alt](asset:ph'), K('Tab')], { deck: { '/slides/0/image/src': 'asset:photo' } }],
  ['M-IMG-014', 'R-A11Y-01', 'each target has an accessible name with its place', 'md', `${IMG}# A\n\n![](|)`, [K('Control+Space'), ['waitLabels']], { popup: { ariaNames: [/^asset:logo, reference, logo\.png\. 1 of 4$/] } }],
  ['M-IMG-015', 'R-CMP-19', 'an image in a list item', 'md', `${IMG}# A\n\n- ![](|)`, [K('Control+Space')], { popup: { open: 1, has: ['asset:logo'] } }],
];

export const phase4Json = [...jsonHints, ...jsonVariables];
export const phase4Yaml = [...yamlHints, ...yamlVariables];
export const phase4Markdown = [...markdownHints, ...markdownVariables, ...markdownImages];
