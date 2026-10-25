import assert from 'node:assert/strict';
import { HANG_SHARE, MAX_HANG, hangCap, hangColumns } from '../src/source-wrap.js';

// The hanging indent of a wrapped line is capped at 40% of the line's width, in whole columns, and never above MAX_HANG (src/source-wrap.js).
// The cap is computed from the measured width and not in the stylesheet, where a percentage made style and layout very slow (opf-editor 0.26.7).
assert.equal(HANG_SHARE, 0.4);

// A phone: 321px of line and 8.13px columns hold 39.5 columns; 40% of that is 15 whole columns.
assert.equal(hangCap(321, 8.128), 15);
// 320px of 8px columns: 40 columns, 16 of them; the cap never rounds up to more than 40%.
assert.equal(hangCap(320, 8), 16);
assert.equal(hangCap(319, 8), 15);
assert.ok(hangCap(321, 8.128) * 8.128 <= 321 * 0.4);
// A wide pane is capped by MAX_HANG, not by its width.
assert.equal(hangCap(1200, 8), MAX_HANG);
assert.equal(hangCap(80 * 8 / 0.4, 8), 32);
// A line narrower than three columns has no hang.
assert.equal(hangCap(10, 8), 0);
assert.equal(hangCap(20, 8), 1);
// Sizes that are not known yet (hidden editor, no measurement) leave the hang uncapped; a later measure corrects it.
for (const [width, column] of [[0, 8], [-5, 8], [320, 0], [320, -1], [Number.NaN, 8], [320, Number.NaN], [undefined, undefined]]) assert.equal(hangCap(width, column), MAX_HANG, `${width} x ${column}`);

// The cap applies to the columns hangColumns gives: a deeply indented line hangs at most the cap, a shallow one keeps its columns.
const deep = `${' '.repeat(40)}"deep": "text"`, shallow = '  "a": 1';
assert.equal(hangColumns(deep), MAX_HANG);
assert.equal(Math.min(hangColumns(deep), hangCap(321, 8.128)), 15);
assert.equal(Math.min(hangColumns(shallow), hangCap(321, 8.128)), 4);
console.log('hang cap: 40% of the width in whole columns, never above MAX_HANG, uncapped while the size is unknown');
