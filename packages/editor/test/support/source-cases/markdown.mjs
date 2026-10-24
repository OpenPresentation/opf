// Markdown cases of the keyboard test plan that phase 0 closes (M-FMT, M-LIN, M-MUL); phase 2's completion, lists, pairs, problems and Canonicalize are in markdown-complete.mjs. See json.mjs for the row format.
import { K, M, MS, P } from '../source-keyboard.mjs';

const DECK_MD = '---\nname: Q3 Review\n---\n\n# Q3 Review\n\n---\n\n# Highlights\n\n- Revenue up 12%\n- Churn down\n';

export const markdownCases = [
  ['M-FMT-001', 'R-FMT-03', 'Format collapses blank runs and keeps comments', 'md', '# A\n\n\n\n<!-- keep -->\n- x\n|', [K('Alt+Shift+f')], { has: '# A\n\n<!-- keep -->\n- x\n' }],
  ['M-FMT-002', 'R-FMT-03', 'Format formats the front matter as YAML', 'md', '---\nname:    x\n---\n# A\n|', [K('Alt+Shift+f')], { has: '---\nname: x\n---\n# A\n' }],
  ['M-FMT-003', 'R-FMT-03', 'Mod+Shift+F also formats Markdown (F23)', 'md', '# A\n\n\n- x\n|', [MS('f')], { has: '# A\n\n- x\n' }],
  ['M-FMT-004', 'R-FMT-03', 'Format never changes the deck', 'md', DECK_MD.replace('\n\n# Highlights', '\n\n\n\n# Highlights'), [K('Alt+Shift+f')], { deck: { '/slides/1/title': 'Highlights', '/name': 'Q3 Review' } }],
  ['M-FMT-005', 'R-FMT-03', 'Format is idempotent', 'md', DECK_MD.replace('\n\n# Highlights', '\n\n\n\n# Highlights'), [K('Alt+Shift+f'), ['snapshot', '1'], K('Alt+Shift+f'), ['expectSame', '1']], {}],
  ['M-FMT-006', 'R-FMT-03', 'Format leaves blank lines inside a code fence alone', 'md', '# A\n\n```\none\n\n\n\ntwo\n```\n\n\n\nend\n|', [K('Alt+Shift+f')], { has: '```\none\n\n\n\ntwo\n```\n\nend\n' }],
  ['M-FMT-007', 'R-FMT-03', 'Format ends the text with one newline', 'md', '# A\n\ntext\n\n\n|', [K('Alt+Shift+f')], { has: '# A\n\ntext\n' }],
  ['M-FMT-008', 'R-FMT-03', 'the Format button does the same', 'md', '# A\n\n\n- x\n|', [['clickFormat']], { has: '# A\n\n- x\n' }],
  ['M-PST-001', 'R-PASTE', 'a multi-line paste ending in } is inserted as written (F19)', 'md', '# A\n\n|', [P('```json\n{\n"a": 1\n}\n```\n')], { text: '# A\n\n```json\n{\n"a": 1\n}\n```\n|' }],
  ['M-PST-002', 'R-PASTE', 'a pasted list keeps its lines', 'md', '# A\n\n|', [P('- one\n- two\n')], { text: '# A\n\n- one\n- two\n|' }],
  ['M-LIN-001', 'R-KEY-07', 'Alt+Down moves a line (F13)', 'md', 'a|\nb', [K('Alt+ArrowDown')], { text: 'b\na|' }],
  ['M-MUL-001', 'R-KEY-08', 'Mod+D works in Markdown', 'md', 'x| a\nx b', [M('d'), M('d')], { cursors: 2 }],
  ['M-TAB-001', 'R-KEY-01', 'Tab inserts up to the next stop (2) at the caret', 'md', 'a|', [K('Tab')], { text: 'a |' }],
  ['M-TAB-002', 'R-IND-01', 'the unit stays 2 whatever one list line has (F15)', 'md', '- a\n      - deep\n|', [K('Tab'), K('Shift+Tab')], { text: '- a\n      - deep\n|' }],
];
