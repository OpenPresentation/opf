import assert from 'node:assert/strict';
import {defaultCatalog, resolvePresentation, toSvg} from './catalog-harness.mjs';

// LH-114, LH-121: the preview draws a pull line's accent rule where core placed it, in the primary color, and a timeline's progress
// line over the connector up to the current event with a status word under each label (English), in left-to-right and right-to-left decks.
const attrs = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const quote = {text: 'We did not leave over a feature. We left because nobody called.', attribution: 'Exit interview', role: 'Mid-market customer'};
const events = [{when: 'Jan', what: 'Design freeze', status: 'done'}, {when: 'May', what: 'US cutover', status: 'current'}, {when: 'Aug', what: 'APAC cutover', status: 'planned'}];
let checked = 0;
for (const language of ['en-US', 'ar']) {
  const deck = {name: 'Pull line', language, design: {theme: 'classic'}, slides: [
    {title: 'Why customers churn', blocks: [{items: ['Low usage', 'Slow support', 'Price increase']}, {quote}]},
    {title: 'Roadmap', blocks: [{timeline: events}]},
  ]};
  const svgs = toSvg(deck, {trace: true, catalogs: [defaultCatalog]});
  const bound = resolvePresentation(deck, {catalogs: [defaultCatalog]}).slides;
  const layout = bound[0].geometry.items.find((item) => item.quoteLayout).quoteLayout;
  assert.ok(layout.rule, `${language}: a pull line`);
  const rule = [...svgs[0].matchAll(/<rect\b([^>]*)\/?>/g)].map(([, a]) => attrs(a)).find((entry) => entry['data-opf-quote-rule'] === 'true');
  assert.ok(rule, `${language}: the rule is drawn`);
  assert.deepEqual([rule.x, rule.y, rule.width, rule.height].map(Number), [layout.rule.x, layout.rule.y, layout.rule.width, layout.rule.height].map((value) => Number(value.toFixed(4))));
  assert.equal(rule.fill.toUpperCase(), bound[0].design.colors.primary.toUpperCase(), `${language}: in the primary color`);
  const timeline = bound[1].geometry.items.find((item) => item.timelineLayout).timelineLayout;
  const progress = [...svgs[1].matchAll(/<line\b([^>]*)\/?>/g)].map(([, a]) => attrs(a)).find((entry) => entry['data-opf-timeline-progress'] === 'true');
  assert.ok(progress && timeline.progress, `${language}: the progress line`);
  assert.equal(progress.stroke.toUpperCase(), bound[1].design.colors.primary.toUpperCase());
  const words = (svgs[1].match(/data-opf-timeline-role="status"/g) ?? []).length;
  assert.equal(words, language === 'en-US' ? 3 : 0, `${language}: status words`);
  assert.equal(words, timeline.statusLabels?.length ?? 0);
  checked++;
}
assert.equal(checked, 2);
console.log('lh-114 pull line and timeline progress in the preview: ok');
