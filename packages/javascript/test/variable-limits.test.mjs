import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fill, listVariables, resolveVariables, validate, visibleLength } from '../dist/index.js';
import { fromMarkdown, toMarkdown } from '../dist/markdown.js';
import { fromYaml, toYaml } from '../dist/yaml.js';

// FR-09 (CR 14): limits on a variable's value: maxLength and maxLines on a text variable, maxItems on a list variable. A value over a limit is the
// warning opf/variable-overflow. maxLength and maxItems are read on the value; maxLines by composition, at each place the variable is drawn.

const LONG = 'A headline that runs well past the room the template has for it, so it wraps onto a third line of the title';
const deck = (variables, slides, extra = {}) => ({ name: 'Limits', language: 'en-US', template: true, variables, slides, ...extra });
const overflow = (document, options = {}) => validate(document, { only: ['variable-overflow'], ...options }).findings.filter((finding) => finding.ruleId === 'opf/variable-overflow');
const clone = (value) => JSON.parse(JSON.stringify(value));

test('the schema takes the limits on the kind they belong to and rejects them elsewhere', () => {
  const ok = deck({ headline: { type: 'text', value: 'Hi', maxLength: 10, maxLines: 2 }, agenda: { type: 'list', value: ['a'], maxItems: 3 } }, [{ title: '{{headline}}', items: 'var:agenda' }]);
  assert.equal(validate(ok, { only: ['format'] }).valid, true);
  for (const bad of [
    { type: 'number', value: 1, maxLength: 3 },
    { type: 'list', value: ['a'], maxLength: 3 },
    { type: 'list', value: ['a'], maxLines: 1 },
    { type: 'text', value: 'a', maxItems: 1 },
    { type: 'text', value: 'a', maxLength: 0 },
    { type: 'text', value: 'a', maxLength: 1.5 },
    { type: 'list', value: ['a'], maxItems: -1 },
  ]) {
    const report = validate(deck({ field: bad }, [{ title: '{{field}}' }]), { only: ['format'] });
    assert.equal(report.valid, false, JSON.stringify(bad));
  }
});

test('maxLength counts characters as a reader sees them, not code units', () => {
  assert.equal(visibleLength('Café'), 4);
  assert.equal(visibleLength('Café'), 4);
  assert.equal(visibleLength('👨‍👩‍👧'), 1);
  assert.equal(visibleLength('🇩🇪🇫🇷'), 2);
  assert.equal(visibleLength('हिन्दी'), 2);
  assert.equal(visibleLength(''), 0);
  // 6 visible characters, many more code units: within a limit of 6.
  const within = deck({ note: { type: 'text', value: 'Café 👨‍👩‍👧', maxLength: 6 } }, [{ title: '{{note}}' }]);
  assert.deepEqual(overflow(within), []);
  const over = deck({ note: { type: 'text', value: 'Café 👨‍👩‍👧!', maxLength: 6 } }, [{ title: '{{note}}' }]);
  const [finding] = overflow(over);
  assert.equal(finding.severity, 'warning');
  assert.equal(finding.path, '/variables/note');
  assert.deepEqual(finding.measured, { characters: 7, maxLength: 6 });
  assert.match(finding.message, /7 characters; its maxLength is 6/);
  // Rich text counts its plain text.
  const rich = deck({ note: { type: 'text', value: [{ text: 'Caf' }, { text: 'é!', bold: true }], maxLength: 4 } }, [{ title: '{{note}}' }]);
  assert.equal(overflow(rich).length, 1);
});

test('maxLength and maxItems are checked on the declared value and on a value given to the check', () => {
  const template = deck({ headline: { type: 'text', maxLength: 10, example: 'Short' }, agenda: { type: 'list', maxItems: 2, value: ['a', 'b'] } }, [{ title: '{{headline}}', items: 'var:agenda' }]);
  assert.deepEqual(overflow(template), []);
  const given = overflow(template, { values: { headline: 'Eleven char', agenda: ['a', 'b', 'c'] } });
  assert.deepEqual(given.map((finding) => [finding.path, finding.measured]), [['/variables/headline', { characters: 11, maxLength: 10 }], ['/variables/agenda', { items: 3, maxItems: 2 }]]);
  assert.ok(given.every((finding) => finding.severity === 'warning' && finding.slide === undefined));
  // A warning never makes the deck invalid, and the same deck without limits has no finding.
  assert.equal(validate(template, { values: { headline: 'Eleven char' } }).valid, true);
  const unlimited = clone(template);
  for (const variable of Object.values(unlimited.variables)) for (const key of ['maxLength', 'maxItems']) delete variable[key];
  assert.deepEqual(overflow(unlimited, { values: { headline: 'Eleven char', agenda: ['a', 'b', 'c'] } }), []);
});

test('maxLines is checked by composition at each place the variable is drawn, naming the slide', () => {
  const document = deck(
    { headline: { type: 'text', value: LONG, maxLines: 1 } },
    [{ id: 'one', title: '{{headline}}' }, { id: 'two', title: 'Two', items: ['{{headline}}', 'short'] }, { id: 'three', title: 'Three', text: 'Intro: {{headline}} and more' }, { id: 'four', title: 'No variable' }],
  );
  const findings = overflow(document);
  assert.deepEqual(findings.map((finding) => [finding.slide, finding.slideId, finding.path]), [[0, 'one', '/slides/0/title'], [1, 'two', '/slides/1/items/0'], [2, 'three', '/slides/2/text']]);
  for (const finding of findings) {
    assert.equal(finding.severity, 'warning');
    assert.equal(finding.measured.maxLines, 1);
    assert.ok(finding.measured.lines > 1);
  }
  // Within the limit nothing is reported.
  const roomy = clone(document);
  roomy.variables.headline.maxLines = 20;
  assert.deepEqual(overflow(roomy), []);
  // A short value in the same places is within a limit of one line.
  assert.deepEqual(overflow(document, { values: { headline: 'Short' } }), []);
});

test('a variable drawn inside longer text counts the lines its own characters occupy', () => {
  const document = deck({ who: { type: 'text', value: 'Acme', maxLines: 1 } }, [{ id: 'long', title: 'Long', text: `${'word '.repeat(60)}{{who}}` }]);
  assert.deepEqual(overflow(document), [], 'a short value inside a long paragraph is one line, however long the paragraph');
});

test('maxLines is read from the value given to the check, per variable', () => {
  const document = deck({ headline: { type: 'text', example: 'Short', maxLines: 1 } }, [{ id: 'one', title: '{{headline}}' }]);
  assert.deepEqual(overflow(document), []);
  assert.equal(overflow(document, { values: { headline: LONG } }).length, 1);
});

test('fill and resolveVariables report maxLength and maxItems as a variable-overflow diagnostic', () => {
  const template = deck({ headline: { type: 'text', maxLength: 10 }, agenda: { type: 'list', maxItems: 2 } }, [{ title: '{{headline}}', items: 'var:agenda' }]);
  const result = fill(template, [{ headline: 'Short', agenda: ['a'] }, { headline: 'Far too long a headline', agenda: ['a', 'b', 'c'] }]);
  assert.deepEqual(result.diagnostics.map((entry) => [entry.code, entry.severity, entry.id, entry.records]), [['variable-overflow', 'warning', 'headline', [2]], ['variable-overflow', 'warning', 'agenda', [2]]]);
  assert.equal(result.complete, true);
  const one = resolveVariables(template, { headline: 'Far too long a headline', agenda: ['a'] });
  assert.deepEqual(one.diagnostics.map((entry) => entry.code), ['variable-overflow']);
  assert.match(one.diagnostics[0].message, /23 characters; its maxLength is 10/);
});

test('limits change nothing about what a deck resolves to', () => {
  const limited = deck({ headline: { type: 'text', maxLength: 5, maxLines: 1 }, agenda: { type: 'list', maxItems: 1 } }, [{ title: '{{headline}}', items: 'var:agenda' }]);
  const plain = clone(limited);
  for (const variable of Object.values(plain.variables)) for (const key of ['maxLength', 'maxLines', 'maxItems']) delete variable[key];
  const values = { headline: 'A much longer headline', agenda: ['a', 'b'] };
  assert.deepEqual(resolveVariables(limited, values).presentation, resolveVariables(plain, values).presentation);
  assert.deepEqual(overflow(plain, { values }), []);
});

test('listVariables carries the limits for fill forms and agents', () => {
  const template = deck({ headline: { type: 'text', maxLength: 48, maxLines: 2 }, agenda: { type: 'list', maxItems: 5 }, plain: { type: 'text' } }, [{ title: '{{headline}}', items: 'var:agenda', text: '{{plain}}' }]);
  const [headline, agenda, plain] = listVariables(template);
  assert.equal(headline.maxLength, 48);
  assert.equal(headline.maxLines, 2);
  assert.equal(agenda.maxItems, 5);
  assert.equal('maxLength' in plain || 'maxLines' in plain || 'maxItems' in plain, false);
});

test('the keys survive a YAML and a Markdown round trip', () => {
  const document = deck({ headline: { type: 'text', value: 'Hi', maxLength: 48, maxLines: 2 }, agenda: { type: 'list', value: ['a', 'b'], maxItems: 5 } }, [{ title: '{{headline}}', items: 'var:agenda' }]);
  const yaml = fromYaml(toYaml(document).yaml, { validate: false });
  assert.deepEqual(yaml.presentation.variables, document.variables);
  const markdown = fromMarkdown(toMarkdown(document).markdown, { validate: false });
  assert.deepEqual(markdown.presentation.variables, document.variables);
});

test('the example deck template validates without a finding and fills within its limits', () => {
  const example = JSON.parse(readFileSync(new URL('../../../examples/technical/variable-limits.opf.json', import.meta.url), 'utf8'));
  const report = validate(example, { catalogs: [] });
  assert.equal(report.valid, true);
  assert.deepEqual(report.findings.filter((finding) => finding.ruleId === 'opf/variable-overflow'), []);
  const long = overflow(example, { values: { headline: 'A headline that is far too long for the cover of this template', agenda: ['a', 'b', 'c', 'd', 'e', 'f'] } });
  assert.deepEqual(long.map((finding) => finding.path), ['/variables/headline', '/variables/agenda']);
});
