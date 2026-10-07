import assert from 'node:assert/strict';
import {validatePresentation} from '@openpresentation/opf';
import {schemaAtPath, createSchemaValue, listSchemaFields} from '../src/schema.js';
import {createEditorSession} from '../src/index.js';

// FA-06: Metric.sentiment is edited through the same schema-driven forms as Metric.trend (an enum, offered by the
// property forms and the JSON editor from the shared schema), as one validated, undoable step.
const deck = {slides: [{metric: {value: 3.1, unit: '%', label: 'Churn', delta: '-0.6 pts', trend: 'down'}}]};
const trend = schemaAtPath(deck, '/slides/0/metric/trend'), sentiment = schemaAtPath(deck, '/slides/0/metric/sentiment');
assert.deepEqual(trend.enum, ['up', 'down', 'flat']);
assert.deepEqual(sentiment.enum, ['positive', 'negative', 'neutral']);
assert.match(sentiment.description, /good news/);
assert.equal(createSchemaValue(sentiment), 'positive');
const field = listSchemaFields().find(item => item.schema === 'presentation' && item.path === '/$defs/Metric/properties/sentiment');
assert.ok(field, 'the field reference lists Metric.sentiment');
assert.deepEqual(field.values, ['positive', 'negative', 'neutral']);

const session = createEditorSession(structuredClone(deck));
session.set('slides.0.metric.sentiment', 'positive');
assert.equal(session.document.slides[0].metric.sentiment, 'positive');
assert.equal(session.document.slides[0].metric.trend, 'down', 'the trend and its word are untouched');
assert.equal(validatePresentation(session.document).valid, true);
// The composed metric carries it, so the preview and export colour the arrow from the session document.
assert.equal(session.composeSlide(0).items.find(item => item.metricLayout).metricLayout.sentiment, 'positive');
session.undo();
assert.deepEqual(session.document, deck, 'undo removes the sentiment again');
session.redo();
assert.equal(session.document.slides[0].metric.sentiment, 'positive');
// An invalid sentiment is reported by validation, and refused outright by a session that rejects invalid edits.
session.set('slides.0.metric.sentiment', 'good');
assert.equal(session.validation.valid, false);
session.undo();
assert.equal(session.validation.valid, true);
const strict = createEditorSession(structuredClone(deck), {rejectInvalid: true});
assert.throws(() => strict.set('slides.0.metric.sentiment', 'good'), /invalid/i);
assert.deepEqual(strict.document, deck);
console.log('FA-06 editor: Metric.sentiment is a schema-driven enum field, set, validated, undone and composed through the session.');
