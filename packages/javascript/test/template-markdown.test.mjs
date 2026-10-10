import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { fromMarkdown, toMarkdown } from '../dist/markdown.js';

// OPF 0.19 (RR-79): in the Markdown dialect a block's region= names a region of the slide's layout template, unless it is a
// promoted-region key; layout=auto reads as written.
describe('the Markdown dialect', () => {
  test('region=<name> pins a block; region=<promoted key> is still a promoted region; layout=auto is read', () => {
    const source = '<!-- slide: layout=roadmap-split -->\n# Roadmap\n\nFirst\n\n<!-- block: region=metrics -->\nTargets agreed with finance.\n\n---\n\n<!-- slide: layout=auto -->\n# Plain\n\n<!-- block: region=left -->\nLeft side\n';
    const { presentation } = fromMarkdown(source, { validate: false });
    assert.deepEqual(presentation.slides[0].blocks, [{ text: 'First' }, { region: 'metrics', text: 'Targets agreed with finance.' }]);
    assert.equal(presentation.slides[1].layout, 'auto');
    assert.deepEqual(presentation.slides[1].left, { text: 'Left side' });
    const back = fromMarkdown(toMarkdown(presentation).markdown, { validate: false }).presentation;
    assert.deepEqual(back.slides[0].blocks, presentation.slides[0].blocks);
  });

  test('a single pinned block stays a block', () => {
    const { presentation } = fromMarkdown('# x\n\n<!-- block: region=notes -->\nOnly one\n', { validate: false });
    assert.deepEqual(presentation.slides[0].blocks, [{ region: 'notes', text: 'Only one' }]);
  });
});
