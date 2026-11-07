// Print the composed arrangement of a quick cycle slide: node geom.mjs <count> <text short|medium|long> [dims] [lang]
const W = 'file:///C:/opf-work/sh-18-cycle-smartart/packages';
const comp = await import(`${W}/javascript/dist/composition.js`);
const core = await import(`${W}/javascript/dist/index.js`);
const { gallery } = await import(`${W}/gallery/dist/index.js`);
const TEXT = {
  short: ['Plan', 'Build', 'Ship', 'Learn', 'Grow', 'Scale', 'Serve', 'Rest'],
  medium: ['Clear purpose', 'Shared goals', 'Team habits', 'Weekly reviews', 'Open roadmap', 'Fast feedback', 'Steady delivery', 'Happy customers'],
  long: ['Why we exist and who we serve', 'The few goals that matter this year', 'How teams plan, decide and ship', 'The reviews that keep plans honest', 'Data everyone can see and trust', 'Feedback loops measured in days', 'Releases that land every single week', 'Customers who stay and refer others'],
};
const [count = 4, text = 'short', dims = '16:9'] = process.argv.slice(2);
const deck = { $schema: 'https://openpresentation.org/schema/opf/v1', design: { dimensions: dims }, slides: [{ layout: 'cycle', title: 'The loop', items: TEXT[text].slice(0, +count) }] };
const ctx = core.resolveSlideContext(deck, 0, { catalogs: [gallery] });
const g = comp.composeSlide(deck.slides[0], ctx.options);
for (const a of g.arrangements ?? []) {
  console.log(a.kind, a.design, 'size', a.fontSize, 'frame', JSON.stringify(a.frame), a.instead ?? '');
  for (const n of a.nodes) console.log('  node', n.index, n.preset, JSON.stringify(n.box));
  for (const r of a.arrows ?? []) console.log('  arrow', r.index, r.rotation, JSON.stringify(r.box));
}
console.log((g.diagnostics ?? []).map(d => d.code + ': ' + d.message).join('\n'));
