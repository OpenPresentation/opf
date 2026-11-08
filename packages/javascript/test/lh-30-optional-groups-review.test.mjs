import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveVariables } from '../dist/index.js';
const template = text => ({ template: true, name: 'Review', variables: { quote: { type: 'text', required: false } }, slides: [{ blocks: [{ blocks: [{ text: 'var:quote' }, { text }] }] }] });

test('optional group omission cannot hide unknown user variables or invalid built-ins', () => {
  for (const [text, code] of [['{{undeclared}}', 'variable-unknown'], ['{{deck.invalid}}', 'variable-unknown-builtin'], ['var:slide.number', 'variable-unknown-builtin']]) {
    const result = resolveVariables(template(text));
    assert.equal(result.presentation.slides[0].blocks.length, 1, text);
    assert.ok(result.diagnostics.some(row => row.code === code), text);
    assert.ok(!result.diagnostics.some(row => row.code === 'variable-group-omitted'), text);
  }
});

test('valid built-ins remain outside the optional-content test', () => {
  for (const text of ['{{deck.name}}', '{{slide.number}}']) {
    const result = resolveVariables(template(text));
    assert.equal(result.presentation.slides[0].blocks.length, 0, text);
    assert.ok(result.diagnostics.some(row => row.code === 'variable-group-omitted'), text);
  }
});

test('nested optional groups retain the documented whole-parent omission', () => {
  const document = template('Static caption');
  document.slides[0].blocks[0].blocks[0] = { blocks: [{ text: 'var:quote' }] };
  assert.equal(resolveVariables(document).presentation.slides[0].blocks.length, 0);
});
