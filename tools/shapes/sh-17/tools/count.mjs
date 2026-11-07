import { gallery } from '@openpresentation/gallery';
import { composeSlide } from 'file:///C:/opf-work/sh-17-linear-smartart/packages/javascript/dist/composition.js';
const TEXT = {
  short: ['Vision', 'Plan', 'Build', 'Ship', 'Learn', 'Grow', 'Scale', 'Serve'],
  medium: ['Clear purpose', 'Shared goals', 'Team habits', 'Weekly reviews', 'Open roadmap', 'Fast feedback', 'Steady delivery', 'Happy customers'],
  long: ['Why we exist and who we serve', 'The few goals that matter this year', 'How teams plan, decide and ship', 'The reviews that keep plans honest', 'Data everyone can see and trust', 'Feedback loops measured in days', 'Releases that land every single week', 'Customers who stay and refer others'],
};
const dims = { wide: [1280, 720], standard: [960, 720], square: [720, 720] };
const tally = {};
for (const kind of ['chevrons', 'flow', 'vertical-flow']) for (const [aspect, [width, height]] of Object.entries(dims)) for (const text of Object.keys(TEXT)) for (let n = 1; n <= 8; n++) {
  const r = composeSlide({ layout: kind, title: 'How we work', items: TEXT[text].slice(0, n) }, { layout: gallery.layouts[kind], width, height });
  const a = r.arrangements?.[0], key = `${kind} ${a ? a.design : 'list'}`;
  tally[key] = (tally[key] ?? 0) + 1;
  if (!a) console.log('list', kind, aspect, text, n);
}
console.log(tally);
