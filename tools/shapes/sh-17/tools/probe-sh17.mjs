import { gallery } from '@openpresentation/gallery';
import { composeSlide } from './dist/composition.js';
for (const layout of ['chevrons', 'flow', 'vertical-flow']) for (const items of [['Plan', 'Build', 'Test', 'Ship'], ['Research the market', 'Design the pilot', 'Run it with two teams'], ['A considerably longer label that has to wrap', 'Another long one here', 'Third']]) {
  const r = composeSlide({ layout, title: 'Process', items }, { layout: gallery.layouts[layout] });
  const a = r.arrangements?.[0];
  console.log(layout, items.length, a ? `${a.design} size ${a.fontSize} frame ${JSON.stringify(a.frame)} node0 ${JSON.stringify(a.nodes[0].box)} arrows ${a.arrows?.length ?? 0} lines ${a.smartArt.lines} ${a.instead ?? ''}` : 'none', r.diagnostics.filter(d => d.code === 'arrangement-adapted').map(d => d.message).join(';'));
}
