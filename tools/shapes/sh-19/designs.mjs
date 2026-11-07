import { gallery } from 'file:///C:/opf-work/sh-19-smartart-layouts/packages/gallery/dist/index.js';
import { composeSlide } from 'file:///C:/opf-work/sh-19-smartart-layouts/packages/javascript/dist/composition.js';
const long = ['Why we exist and who we serve', 'The few goals that matter this year', 'How teams plan, decide and ship', 'The reviews that keep plans honest', 'Data everyone can see and trust', 'Feedback loops measured in days'];
for (const layout of ['cycle', 'pyramid', 'matrix', 'chevrons', 'flow', 'vertical-flow']) for (const n of [3, 4, 5, 6]) {
  const a = composeSlide({ layout, title: 'T', items: long.slice(0, n) }, { layout: gallery.layouts[layout] }).arrangements?.[0];
  console.log(layout, n, a?.design, a?.layout?.design, a?.layout?.lines ?? '', a?.layout?.compact ?? '');
}
