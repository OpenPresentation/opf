import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { fromMarkdown, toMarkdown } from '../dist/markdown.js';

// OPF 0.19 (RR-79): in the Markdown dialect a block's region= is its `region`: a region of the slide's layout template, or (OPF 0.35)
// a cell of the grid of a slide without a layout; layout= reads as written.
describe('the Markdown dialect', () => {
  test('region=<name> pins a block; region=<cell> names the block\'s cell; layout= is read', () => {
    const source = '<!-- slide: layout=roadmap-split -->\n# Roadmap\n\nFirst\n\n<!-- block: region=metrics -->\nTargets agreed with finance.\n\n---\n\n# Plain\n\n<!-- block: region=start -->\nLeft side\n\n<!-- block: region=center+end -->\nRight side\n';
    const { presentation } = fromMarkdown(source, { validate: false });
    assert.deepEqual(presentation.slides[0].blocks, [{ text: 'First' }, { region: 'metrics', text: 'Targets agreed with finance.' }]);
    assert.deepEqual(presentation.slides[1].blocks, [{ region: 'start', text: 'Left side' }, { region: 'center+end', text: 'Right side' }]);
    const back = fromMarkdown(toMarkdown(presentation).markdown, { validate: false }).presentation;
    assert.deepEqual(back.slides[0].blocks, presentation.slides[0].blocks);
    assert.deepEqual(back.slides[1].blocks, presentation.slides[1].blocks);
  });

  test('a single pinned block stays a block', () => {
    const { presentation } = fromMarkdown('# x\n\n<!-- block: region=notes -->\nOnly one\n', { validate: false });
    assert.deepEqual(presentation.slides[0].blocks, [{ region: 'notes', text: 'Only one' }]);
  });
});
