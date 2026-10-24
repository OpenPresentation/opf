// Phase 1 cases (artifacts/source-editor/TEST-PLAN.md section 4.2): how the completion list behaves while the author edits the word.
import { K, T } from '../source-keyboard.mjs';

const KEY = '{\n  "slides": [],\n  |\n}';

export const jsonList = [
  ['J-ACC-016', 'R-CMP-10', 'Left keeps the list and refilters', 'json', KEY, [T('"desi'), K('ArrowLeft')], { popup: { open: 1, has: ['design', 'description'] }, text: '{\n  "slides": [],\n  "des|i"\n}' }],
  ['J-ACC-016b', 'R-CMP-10', 'Left to the start of the word keeps the list', 'json', KEY, [T('"des'), K('ArrowLeft'), K('ArrowLeft'), K('ArrowLeft')], { popup: { open: 1, has: ['design'] } }],
  ['J-ACC-016c', 'R-CMP-10', 'Left past the opening quote closes the list', 'json', KEY, [T('"d'), K('ArrowLeft'), K('ArrowLeft')], { popup: { open: 0 } }],
  ['J-ACC-016d', 'R-CMP-10', 'Right inside the word keeps the list', 'json', '{\n  "slides": [],\n  "d|esi"\n}', [K('Control+Space'), K('ArrowRight')], { popup: { open: 1 } }],
  ['J-ACC-016e', 'R-CMP-10', 'Right past the closing quote closes the list', 'json', KEY, [T('"des'), K('ArrowRight')], { popup: { open: 0 } }],
  ['J-ACC-017', 'R-CMP-10', 'Backspace widens the list', 'json', KEY, [T('"des'), K('Backspace')], { popup: { open: 1, has: ['description', 'design'] }, text: '{\n  "slides": [],\n  "de|"\n}' }],
  ['J-ACC-017b', 'R-CMP-10', 'Backspace after Ctrl+Space inside a word widens the list', 'json', '{\n  "slides": [],\n  "des|"\n}', [K('Control+Space'), K('Backspace')], { popup: { open: 1, has: ['description', 'design'] } }],
  ['J-ACC-017c', 'R-CMP-10', 'Backspace to an empty string keeps the list', 'json', KEY, [T('"d'), K('Backspace')], { popup: { open: 1 } }],
  ['J-ACC-017d', 'R-CMP-10', 'Backspace over the opening quote closes the list', 'json', KEY, [T('"'), K('Backspace')], { popup: { open: 0 }, text: '{\n  "slides": [],\n  |\n}' }],
  ['J-ACC-018', 'R-CMP-10', 'a space closes the list and inserts a space', 'json', KEY, [T('"des'), T(' ')], { popup: { open: 0 }, has: '"des "' }],
  ['J-ACC-019', 'R-CMP-10', 'a comma after a bare word closes the list', 'json', KEY, [T('des'), T(',')], { popup: { open: 0 }, has: 'des,' }],
  ['J-ACC-020', 'R-CMP-11', 'Shift+Enter accepts and replaces the whole token', 'json', '{\n  "slides": [],\n  "de|sign": {}\n}', [K('Control+Space'), K('Shift+Enter')], { has: '"design": {}', not: 'signsign' }],
  ['J-ACC-020b', 'R-CMP-11', 'Shift+Tab accepts the selected item', 'json', KEY, [T('"desi'), K('Shift+Tab')], { has: '"design": ', popup: { open: 0 } }],
  ['J-ACC-020c', 'R-CMP-11', 'Shift+Enter with no list is a plain new line', 'json', '{\n  "a": 1|\n}', [K('Shift+Enter')], { text: '{\n  "a": 1\n  |\n}' }],
  ['J-ACC-020d', 'R-CMP-11', 'Shift+Tab with no list outdents the line', 'json', '{\n  "a": 1|\n}', [K('Shift+Tab')], { text: '{\n"a": 1|\n}' }],
  ['J-ACC-021', 'R-CMP-17', 'Ctrl+Space with the list open hides the documentation, again shows it', 'json', KEY, [T('"desc'), ['expectDocs', true], K('Control+Space'), ['expectDocs', false], K('Control+Space'), ['expectDocs', true]], { popup: { open: 1 } }],
  ['J-ACC-021b', 'R-CMP-17', 'the documentation panel describes the selected key', 'json', KEY, [T('"desc')], { docs: { has: ['Free-form prose'] } }],
];
