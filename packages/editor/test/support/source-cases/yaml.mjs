// YAML cases of the keyboard test plan that phase 0 closes (Y-TAB, Y-LIN, Y-MUL, Y-FMT); phase 2's completion, Enter, pairs, problems and Canonicalize are in yaml-complete.mjs. See json.mjs for the row format.
import { K, M, MS, P } from '../source-keyboard.mjs';

const DECK_YAML = 'name: Q3 Review\nslides:\n  - title: Q3 Review\n  - title: Highlights\n    items:\n      - Revenue up 12%\n      - Churn down\n';

export const yamlCases = [
  ['Y-TAB-001', 'R-KEY-01', 'Tab inserts spaces at the caret (2)', 'yaml', 'name: x|', [K('Tab')], { text: 'name: x |' }],
  ['Y-TAB-002', 'R-KEY-02', 'Tab on a multi-line selection indents by 2', 'yaml', '⟦a: 1\nb: 2⟧', [K('Tab')], { text: '⟦  a: 1\n  b: 2⟧' }],
  ['Y-TAB-003', 'R-KEY-02', 'Shift+Tab outdents by 2', 'yaml', '⟦    a: 1\n    b: 2⟧', [K('Shift+Tab')], { text: '⟦  a: 1\n  b: 2⟧' }],
  ['Y-TAB-004', 'R-IND-01', 'the unit stays 2 after edits, whatever one line has (F15)', 'yaml', 'slides:\n  - title: a\n      deep: 1\n|', [K('Tab'), K('Tab'), K('Shift+Tab')], { text: 'slides:\n  - title: a\n      deep: 1\n  |' }],
  ['Y-TAB-004b', 'R-IND-01', 'a 6-space line does not make Shift+Tab remove 6', 'yaml', 'a:\n      b: 1|', [K('Shift+Tab')], { text: 'a:\n    b: 1|' }],
  ['Y-TAB-005', 'R-IND-04', 'no tab character is ever inserted', 'yaml', '|', [K('Tab')], { not: '\t' }],
  ['Y-TAB-006', 'R-IND-04', 'Backspace in leading spaces removes one unit', 'yaml', 'a:\n    |', [K('Backspace')], { text: 'a:\n  |' }],
  ['Y-LIN-001', 'R-KEY-07', 'Alt+Down moves a line down (F13)', 'yaml', 'a: 1|\nb: 2', [K('Alt+ArrowDown')], { text: 'b: 2\na: 1|' }],
  ['Y-LIN-002', 'R-KEY-07', 'Alt+Up moves a line up', 'yaml', 'a: 1\nb: 2|', [K('Alt+ArrowUp')], { text: 'b: 2|\na: 1' }],
  ['Y-MUL-001', 'R-KEY-08', 'Mod+D adds the next occurrence', 'yaml', 'a: x\nb: x|', [M('d'), M('d')], { cursors: 2 }],
  ['Y-MUL-002', 'R-KEY-08', 'typing at two cursors edits both lines', 'yaml', 'a: x\nb: x|', [M('d'), M('d'), P('y')], { text: 'a: y|\nb: y|' }],
  ['Y-PST-001', 'R-PASTE', 'a multi-line paste ending in a bracket is inserted as written (F19)', 'yaml', 'name: x\n|', [P('slides:\n  - title: a\n    items: [\n      b\n    ]\n')], { text: 'name: x\nslides:\n  - title: a\n    items: [\n      b\n    ]\n|', deck: { '/slides/0/items/0': 'b' } }],
  ['Y-PST-002', 'R-PASTE', 'YAML paste is one undo step', 'yaml', 'name: x\n|', [P('slides:\n  - title: a\n')], { undo: [1, 'name: x\n|'] }],
  ['Y-FMT-001', 'R-FMT-02', 'Shift+Alt+F formats and keeps comments (F23)', 'yaml', '# deck\nname:   x   # inline\nslides:\n    - title: a\n|', [K('Alt+Shift+f')], { has: '# deck\nname: x # inline\nslides:\n  - title: a\n' }],
  ['Y-FMT-002', 'R-FMT-02', 'Mod+Shift+F also formats in YAML', 'yaml', 'name:    x\nslides: []\n|', [MS('f')], { has: 'name: x\nslides: []\n' }],
  ['Y-FMT-003', 'R-FMT-02', 'the Format button gives the same result', 'yaml', 'name:    x\nslides: []\n|', [['clickFormat']], { has: 'name: x\nslides: []\n' }],
  ['Y-FMT-004', 'R-FMT-02', 'Format never produces a comment-loss note', 'yaml', '# keep\nname: x\nslides: []\n|', [K('Alt+Shift+f')], { has: '# keep\n', findings: { warnings: 0 } }],
  ['Y-FMT-005', 'R-FMT-02', 'Format keeps blank lines, quote styles and key order', 'yaml', "name: 'x'\n\nslides:\n  - title: \"a\"\n|", [K('Alt+Shift+f')], { has: "name: 'x'\n\nslides:\n  - title: \"a\"\n" }],
  ['Y-FMT-006', 'R-FMT-02', 'Format is idempotent', 'yaml', DECK_YAML, [K('Alt+Shift+f'), ['snapshot', '1'], K('Alt+Shift+f'), ['expectSame', '1']], {}],
  ['Y-FMT-007', 'R-FMT-02', 'Format on YAML with errors says so and leaves the text', 'yaml', 'name: x\n  bad: [\n|', [K('Alt+Shift+f')], { has: 'name: x\n  bad: [\n', status: /cannot be formatted/ }, { allowError: false }],
  ['Y-FMT-008', 'R-FMT-02', 'Format keeps the deck', 'yaml', DECK_YAML.replace('name:', 'name:  '), [K('Alt+Shift+f')], { deck: { '/slides/1/items/0': 'Revenue up 12%', '/name': 'Q3 Review' } }],
  ['Y-FMT-009', 'R-FMT-02', 'Format is one undo step', 'yaml', 'name:    x\nslides: []\n|', [K('Alt+Shift+f')], { undo: [1, 'name:    x\nslides: []\n|'] }],
];
