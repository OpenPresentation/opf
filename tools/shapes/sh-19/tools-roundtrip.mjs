// Every OPF design at every count: the definition built from its tables, evaluated by the interpreter, gives the design back.
import * as c from 'file:///C:/opf-work/sh-19-smartart-layouts/packages/javascript/dist/composition.js';
const area = { x: 100, y: 150, width: 1080, height: 480 };
let worst = 0, fails = [];
for (const design of c.OPF_LAYOUT_DESIGNS) for (const rtl of [false, true]) {
  const recipe = { design, area, gap: 24, radius: 12, rtl, lines: 2, columns: 3 };
  const def = c.compositeLayoutDefinition({ uniqueId: 'x', title: 'x', description: 'x', category: 'other' }, area, 8, k => c.opfLayoutGeometry(recipe, k), { node: 'node1', text: design === 'pyramid-steps' ? 'slide' : 'node', margins: [.2, .2, .2, .2], fontSize: 24 });
  if (def.reason) { fails.push(`${design} rtl=${rtl}: ${def.reason}`); continue; }
  for (let k = 1; k <= 8; k++) {
    const want = c.opfLayoutGeometry(recipe, k); if (!want) continue;
    const got = c.layoutArrangement(c.evaluateLayoutDefinition(def, area, k));
    const d = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.width - b.width), Math.abs(a.height - b.height));
    if (got.nodes.length !== want.nodes.length || got.arrows.length !== (want.arrows?.length ?? 0)) { fails.push(`${design} ${k}: ${got.nodes.length}/${want.nodes.length} nodes ${got.arrows.length}/${want.arrows?.length ?? 0} arrows`); continue; }
    want.nodes.forEach((n, i) => { worst = Math.max(worst, d(n.box, got.nodes[i].box), d(n.textBox, got.nodes[i].textBox)); });
    (want.arrows ?? []).forEach((a, i) => { const g = got.arrows[i]; worst = Math.max(worst, d(a.box, g.box), Math.abs(((a.rotation - g.rotation) % 360 + 540) % 360 - 180)); });
  }
}
console.log('worst', worst.toFixed(4), 'px'); console.log(fails.join('\n'));
