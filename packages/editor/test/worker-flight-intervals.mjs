import assert from 'node:assert/strict';
import { workerFlightBlock } from './support/worker-flight.mjs';
import { blockFailures } from './support/block-budget.mjs';

const cases = [
  ['no request remains null for the majority-flight guard', [[0, 20, 16]], [], null],
  ['fully inside keeps all excess', [[0, 20, 16]], [[0, 20]], 16],
  ['fully outside old requests do not count current participation', [[20, 40, 16]], [[0, 10]], null],
  ['entering busy excludes earlier outside time', [[0, 20, 16]], [[17, 30]], 3],
  ['leaving busy still counts its possible excess', [[0, 20, 16]], [[0, 8]], 8],
  ['late endpoint outside busy is not discarded', [[0, 20, 16]], [[5, 10]], 5],
  ['the nominal4ms is not invented as blocked time', [[0, 4, 0]], [[0, 4]], 0],
  ['a shorter timer interval has no positive excess', [[0, 3, -1]], [[0, 3]], 0],
  ['a short overlap caps excess, not a proportional share', [[0, 20, 16]], [[10, 12]], 2],
  ['a zero-width window contributes zero', [[0, 20, 16]], [[10, 10]], 0],
  ['overlapping/unsorted windows count their union once', [[0, 30, 26]], [[12, 18], [4, 10], [0, 6]], 16],
  ['adjacent windows stay one union', [[0, 20, 16]], [[0, 5], [5, 10]], 10],
  ['the maximum considers all beats rather than one selected endpoint', [[0, 10, 6], [10, 30, 16]], [[8, 18]], 8],
  // Actual retained clocks: Mac ee1abe8c6b7fd2df... JSON paced6, Windows73b883b6596ffe15... JSON paced11.
  ['retained Mac post-clear boundary caps old10.5ms at3.2ms possible busy', [[3685.7999999970198, 3700.2999999970198, 10.5]], [[3665.5, 3689]], 3.2000000029802322],
  ['retained Windows post-clear boundary caps old10ms at0.5ms possible busy', [[5206.700000000012, 5220.700000000012, 10]], [[5186.700000000012, 5207.200000000012]], 0.5],
  ['retained Mac late-ending beat can INCREASE old1ms flight', [[2096.7999999970198, 2107.7999999970198, 7]], [[2052.7000000029802, 2100.2000000029802]], 3.4000000059604645],
];
for (const [name, beats, windows, expected] of cases) {
  const before = structuredClone({ beats, windows });
  assert.equal(workerFlightBlock(beats, windows), expected, name);
  assert.deepEqual({ beats, windows }, before, `${name}: inputs remain unchanged`);
}
// Across two collections the prior closed window must remain available to a heartbeat that was incomplete at the first.
const history = [[8, 18]];
assert.equal(workerFlightBlock([[0, 4, 0]], history, history), 0, 'a fresh request counts before its pending heartbeat completes');
assert.equal(workerFlightBlock([[4, 24, 16]], history, []), 10, 'the next collection includes the late heartbeat overlap with the prior window');
assert.equal(workerFlightBlock([[24, 34, 6]], history, []), null, 'a later no-request edit cannot inherit a zero-valued phantom request');
assert.equal(workerFlightBlock([], history, history), 0, 'a real fresh request is recorded even without a completed heartbeat');
assert.equal(workerFlightBlock([], history, []), null, 'old cumulative history alone is not evidence of a new request');
assert.throws(() => workerFlightBlock([[0, 4, 0]], history, [[9, 19]]), TypeError, 'fresh-request facts must belong to actual retained history');
for (const [beats, windows] of [
  [[[0, Infinity, 1]], []], [[[0, 10, NaN]], [[0, 10]]], [[[-1, 10, 7]], [[0, 10]]],
  [[[10, 0, -14]], [[0, 10]]], [[[0, 10, 5]], [[0, 10]]], [[[0, 10, 6], [5, 15, 6]], [[0, 20]]],
  [[[0, 10, 6]], [[0, NaN]]], [[[0, 10, 6]], [[5, 1]]], [[[0, 10, 6]], [[-1, 10]]],
]) assert.throws(() => workerFlightBlock(beats, windows), TypeError, 'bad clocks must refuse, not become a cheap flight sample');

// CodeMirror's background parse (idle callbacks) is taken out of the in-flight time; everything else in the span still counts.
const parseCases = [
  ['a parse slice filling the span leaves only its edges', [[0, 110, 106]], [[0, 106]], [[1, 99]], 8],
  ['a parse outside the span changes nothing', [[0, 20, 16]], [[0, 20]], [[30, 40]], 16],
  ['a span wholly inside a parse is a request with no block, not a missing one', [[0, 20, 16]], [[5, 10]], [[0, 20]], 0],
  ['two parse slices both come out', [[0, 60, 56]], [[0, 60]], [[2, 20], [30, 58]], 14],
  ['a check after the parse in the same span still counts', [[0, 154, 150]], [[0, 150]], [[1, 99]], 52],
  ['no request stays null with parses around', [[0, 20, 16]], [], [[0, 20]], null],
];
for (const [name, beats, windows, parses, expected] of parseCases) {
  const before = structuredClone({ beats, windows, parses });
  assert.equal(workerFlightBlock(beats, windows, [], parses), expected, name);
  assert.deepEqual({ beats, windows, parses }, before, `${name}: inputs remain unchanged`);
}
for (const parses of [[[0, NaN]], [[5, 1]], [[-1, 3]], [[0]]]) assert.throws(() => workerFlightBlock([[0, 10, 6]], [[0, 10]], [], parses), TypeError, 'bad parse clocks must refuse');

// The CI runs of 2026-11-14, rebuilt edit by edit: the gap of the edit is one heartbeat interval that starts as the request goes out; the in-flight
// block that was reported is a parse slice from 1 ms after that until 1 ms before the answer. Counted (the old verdict) they fail; with the parse left out
// they pass. The same spans filled by main-thread work that is no idle callback (a check beside the worker's) still fail.
const rebuild = (gap, flight, { parse = true, check = 0 } = {}) => {
  const end = 100 + flight + check;
  return { beats: [[100, 104 + gap + check, gap + check]], windows: [[100, end]], parses: parse && flight > 2 ? [[101, 99 + flight]] : [] };
};
const judge = ({ edits, flights, baseline }, options = {}) => {
  const rows = edits.map((gap, index) => rebuild(gap, flights[index], options));
  const flight = rows.map(({ beats, windows, parses }) => workerFlightBlock(beats, windows, windows, options.counted ? [] : parses));
  return blockFailures({ samples: rows.map(({ beats }) => beats[0][2]), flight, baseline, limit: 100 });
};
const measured = {
  'Linux paced (failed)': { edits: [70, 68, 50, 56, 74, 79, 67, 47, 73, 76, 58, 45], flights: [54, 54, 38, 56, 55, 61, 67, 47, 59, 61, 58, 45], baseline: [116, 120, 122, 118, 113, 106, 110, 106, 109, 107, 106, 169] },
  'Windows quick (failed)': { edits: [87, 106, 82, 91], flights: [87, 88, 82, 74], baseline: [227, 172, 169, 152] },
  'Windows paced (passed)': { edits: [65, 59, 52, 45, 33, 44, 51, 35, 53, 44, 36, 31], flights: [65, 59, 52, 45, 2, 44, 51, 35, 53, 44, 36, 9], baseline: [135, 165, 138, 144, 160, 136, 132, 140, 247, 202, 143, 155] },
  'Linux paced (passed)': { edits: [11, 14, 18, 15, 12, 15, 17, 14, 17, 18, 36, 24], flights: [2, 2, 4, 1, 1, 4, 4, 5, 1, 2, 4, 4], baseline: [66, 83, 63, 77, 63, 64, 62, 64, 64, 63, 64, 103] },
  'Linux quick (passed)': { edits: [35, 30, 29, 17], flights: [2, 3, 2, 1], baseline: [102, 84, 82, 74] },
};
for (const [name, series] of Object.entries(measured)) {
  assert.deepEqual(judge(series), [], `${name}: passes with the background parse left out`);
  // A check of about 45% of the main-thread edit (a bad runner's check beside the worker's) after the parse, in the same span, fails.
  const check = Math.round(0.45 * series.baseline.slice().sort((a, b) => a - b)[series.baseline.length >> 1]);
  assert.match(judge(series, { check }).join(), /while the worker checks/, `${name}: a ${check} ms main-thread check beside the worker's fails`);
}
for (const name of ['Linux paced (failed)', 'Windows quick (failed)']) {
  assert.match(judge(measured[name], { counted: true }).join(), /while the worker checks/, `${name}: with the parse counted it fails, as on CI`);
  // The same spans filled by main-thread work that is no parse: a check beside the worker's.
  assert.match(judge(measured[name], { parse: false }).join(), /while the worker checks/, `${name}: the same block from a check fails`);
}

// These finite controls isolate the intended budget reason; they do not substitute for the existing real BURN/worker-off runs.
const baseline = [100, 100, 100, 100], samples = [45, 45, 45, 45];
const burned = workerFlightBlock([[0, 49, 45]], [[0, 49]]);
const burnFailures = blockFailures({ samples, flight: [burned, burned, burned, burned], baseline, limit: 100 });
assert.equal(burnFailures.length, 1);
assert.match(burnFailures[0], /while the worker checks, over 25%/);
const absent = workerFlightBlock([[0, 49, 45]], []);
assert.match(blockFailures({ samples, flight: [absent, absent, absent, absent], baseline, limit: 100 })[0], /only 0 of 4 edits were checked in the worker/);
const outsideApply = workerFlightBlock([[0, 84, 80]], [[0, 3]]);
assert.deepEqual(blockFailures({ samples: [80, 80, 80, 80], flight: [outsideApply, outsideApply, outsideApply, outsideApply], baseline, limit: 100 }), []);
console.log('Worker-flight intervals: full/partial/late overlap, union, nominal period, actual Mac/Windows boundaries, clock refusals, the background parse left out (CI runs of 2026-11-14 rebuilt) and unchanged budget controls passed.');
