import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide} from '../dist/composition.js';
import {resolveSlideContext} from '../dist/index.js';
import {layouts} from '../dist/catalogs.js';

// RR-58: the bundled image-bleed record alone fills the slide. A document that names only the layout, with no
// composition or design of its own, composes its image at the full canvas.
const image = {src: 'data:image/png;base64,iVBORw0KGgo=', alt: 'Full-bleed photograph'};

test('the bundled image-bleed record declares zero padding', () => {
  const record = layouts.find(layout => layout.id === 'image-bleed');
  assert.deepEqual(record.composition, {padding: 0});
});

test('a bare image-bleed slide composes its image at 0,0,1280,720', () => {
  const presentation = {$schema: 'https://openpresentation.org/schema/opf/v1', name: 'Bleed', slides: [{id: 's1', layout: 'image-bleed', image}]};
  const context = resolveSlideContext(presentation, 0);
  assert.deepEqual(context.diagnostics, []);
  const geometry = composeSlide(presentation.slides[0], {...context.options, width: 1280, height: 720});
  const picture = geometry.items.find(item => item.field === 'image');
  assert.deepEqual(picture?.box, {x: 0, y: 0, width: 1280, height: 720});
  assert.deepEqual(geometry.diagnostics.filter(diagnostic => diagnostic.severity === 'error'), []);
});

test('a slide composition still overrides the record padding', () => {
  const record = layouts.find(layout => layout.id === 'image-bleed');
  const geometry = composeSlide({id: 's1', layout: 'image-bleed', image, composition: {padding: 0.05}}, {layout: record, width: 1280, height: 720});
  const picture = geometry.items.find(item => item.field === 'image');
  assert.deepEqual(picture?.box, {x: 36, y: 36, width: 1208, height: 648});
});
