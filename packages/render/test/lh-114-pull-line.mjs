import assert from 'node:assert/strict';
import {LANGUAGES, timelineStatusWordsFor} from '@openpresentation/opf/composition';
import {defaultCatalog, resolvePresentation, toSvg} from './catalog-harness.mjs';

// LH-114, LH-121: keep the pull-rule geometry/color and timeline progress in LTR/RTL decks.
// Generated status words are visible localized text traced to the event; an advertised language
// without a status vocabulary keeps its markers/progress and authored labels without English fallback.
const attrs = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const quote = {text: 'We did not leave over a feature. We left because nobody called.', attribution: 'Exit interview', role: 'Mid-market customer'};
const events = [{when: 'Jan', what: 'Design freeze', status: 'done'}, {when: 'May', what: 'US cutover', status: 'current'}, {when: 'Aug', what: 'APAC cutover', status: 'planned'}];
const cases = [['en-US', ['Done', 'Current', 'Planned']], ['ar', ['مكتمل', 'حالي', 'مخطط']], ['af', []]];
assert.ok(LANGUAGES.some((language) => language.tag === 'af'), 'the no-vocabulary control is an advertised language');
assert.equal(LANGUAGES.find((language) => language.tag === 'af').timelineStatusWords, undefined, 'Afrikaans has no generated status vocabulary');
assert.equal(timelineStatusWordsFor('af'), undefined, 'the public language lookup agrees with that precondition');
let checked = 0;
for (const [language, expectedWords] of cases) {
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
  assert.equal(words, expectedWords.length, `${language}: visible generated status word count`);
  assert.equal(words, timeline.statusLabels?.length ?? 0);
  assert.deepEqual((timeline.statusLabels ?? []).map((label) => label.text), expectedWords, `${language}: literal localized words in the composed plan`);
  const labels = [...svgs[1].matchAll(/<g\b[^>]*data-opf-timeline-role="status"[^>]*>([\s\S]*?)<\/g>/g)];
  assert.equal(labels.length, expectedWords.length, `${language}: every status role has visible text`);
  for (const [index, label] of labels.entries()) {
    const texts = [...label[1].matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)];
    assert.equal(texts.length, 1, `${language}: one painted status word for event ${index}`);
    const properties = attrs(texts[0][1]);
    assert.equal(properties['data-opf-path'], `slides.1.blocks.0.timeline.${index}`, `${language}: generated word traces to its canonical event, not a fictitious text field`);
    // Unicode directional isolates affect bidi ordering, not the visible word.
    const visible = texts[0][2].replace(/<[^>]*>/g, '').replace(/[\u2066-\u2069]/g, '');
    assert.equal(visible, expectedWords[index], `${language}: actual SVG localized text`);
    assert.ok(Number(properties['font-size']) > 0 && properties.fill !== 'none', `${language}: the word has a painted font and fill`);
  }
  const markers = [...svgs[1].matchAll(/<circle\b([^>]*)\/?>/g)].map(([, a]) => attrs(a)).filter((entry) => entry['data-opf-timeline-status']);
  assert.deepEqual(markers.map((entry) => entry['data-opf-timeline-status']), ['done', 'current', 'current', 'planned'], `${language}: canonical statuses survive translation or missing vocabulary`);
  assert.deepEqual(markers.map((entry) => entry['data-opf-path']), [0, 1, 1, 2].map((index) => `slides.1.blocks.0.timeline.${index}`), `${language}: markers retain canonical source traces`);
  for (const event of events) {
    assert.ok(svgs[1].includes(event.when) && svgs[1].includes(event.what), `${language}: authored event labels remain visible`);
  }
  if (language !== 'en-US') {
    for (const word of cases[0][1]) assert.ok(!svgs[1].includes(`>${word}<`), `${language}: no English generated-word fallback`);
  }
  checked++;
}
assert.equal(checked, 3);
console.log('lh-114 pull line and timeline progress/localized words in English, Arabic and no-vocabulary Afrikaans: ok');
