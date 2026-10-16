import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import {auditSvg, previewOutcome} from './render-api.mjs';
import {hostRenderOutcome} from './font-availability.mjs';

test('estimated and host callers use the current export, preserving diagnostics, options and source', () => {
  const document = {slides: [{text: 'Current content'}]}, before = structuredClone(document), fonts = {fixture: true}, calls = [];
  const renderer = {resolvePresentation: doc => {doc.checked = true; return {geometry: 'actual'};},
    toSvg: (doc, options) => {calls.push(options); doc.changed = true; options.onDiagnostic?.({code: 'observed'}); return ['<svg>Current content</svg>'];},
    renderSvg: () => assert.fail('current export exists: historical API must not run')};
  assert.deepEqual(previewOutcome(renderer, document), {resolved: {geometry: 'actual'}, svgs: ['<svg>Current content</svg>'], pdiag: ['observed']});
  assert.equal(calls[0].trace, true);
  assert.deepEqual(hostRenderOutcome({gate: {ok: true}, fonts}, renderer, document), {ok: true});
  assert.deepEqual(calls[1], {fonts}); assert.deepEqual(document, before);
});
test('historical export remains usable only without a current function', () => {
  const options = {trace: true}; let calls = 0;
  const renderer = {renderSvg: (doc, got) => {calls++; assert.equal(got, options); return ['old svg'];}};
  assert.deepEqual(auditSvg(renderer, {}, options), ['old svg']); assert.equal(calls, 1);
  assert.throws(() => auditSvg({}, {}, options), /neither toSvg nor historical renderSvg/);
});
test('a genuine current renderer error remains a failure, never hidden by the historical route', () => {
  const error = Object.assign(new Error('current shaping failed'), {code: 'font-shaping-failed', details: {fontFamily: 'Face', cause: 'exact cause'}});
  const renderer = {resolvePresentation: () => ({}), toSvg: () => {throw error;}, renderSvg: () => assert.fail('must not retry')};
  assert.throws(() => auditSvg(renderer, {}, {}), actual => actual === error);
  assert.deepEqual(previewOutcome(renderer, {}), {fatal: 'preview threw font-shaping-failed', message: 'current shaping failed'});
  assert.deepEqual(hostRenderOutcome({gate: {ok: true}, fonts: {}}, renderer, {}), {ok: false, code: 'font-shaping-failed', family: 'Face', cause: 'exact cause'});
});
test('the own installed current renderer export produces a real estimated preview through the maintained adapter', async () => {
  const require = createRequire(new URL('../../../../../../packages/javascript/package.json', import.meta.url));
  const renderer = await import(pathToFileURL(require.resolve('@openpresentation/opf-render')).href);
  assert.equal(typeof renderer.toSvg, 'function'); assert.equal(renderer.renderSvg, undefined);
  const document = {slides: [{title: 'Current renderer adapter', text: 'Same authored content'}]};
  const outcome = previewOutcome(renderer, document);
  assert.equal(outcome.fatal, undefined, JSON.stringify(outcome));
  assert.equal(outcome.resolved.slides.length, 1); assert.equal(outcome.svgs.length, 1);
  assert.match(outcome.svgs[0], /Same authored content/); assert.deepEqual(outcome.pdiag, []);
  assert.deepEqual(hostRenderOutcome({gate: {ok: true}, fonts: undefined}, renderer, document), {ok: true});
});
