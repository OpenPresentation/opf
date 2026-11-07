import fs from 'node:fs';
const p='docs/shapes.md'; let s=fs.readFileSync(p,'utf8');
const rep=(o,n)=>{ if(s.split(o).length!==2) throw Error(o); s=s.replace(o,n); };
rep("| Overlay placement | slide-level `shapes: [...]` placed by fractions or attached to a block (SH-04) | `a:xfrm a:off a:ext` |",
"| Overlay placement | slide-level `shapes: [...]` placed by `x`, `y`, `width`, `height` (fractions) or `at` a block | `a:xfrm a:off a:ext` |\n| Overlay layer | `layer`: front (default) or back | shape tree order: after the background, watermark and logo, or after everything |");
rep("| Stacking | array order | shape tree order |","| Stacking | array order (within a layer) | shape tree order |");
rep("| Connector | `connector: { from, to, route, stroke }` among slide-level `shapes` (SH-04) | `p:cxnSp`, `a:stCxn`, `a:endCxn` |\n| Connection site | the nearest facing site; `fromSite`/`toSite` to override (SH-04) | `idx` |",
"| Connector | `connector: { from, to, route }` with `stroke`, among slide-level `shapes` | `p:cxnSp`, `a:stCxn`, `a:endCxn` |\n| Connection site | the nearest facing site; `fromSite`/`toSite` to override | `idx` |\n| Connector middle | `adjust: { adj1 }` on an elbow or curved connector | `a:avLst` of `bentConnector3`, `curvedConnector3` |\n| Native diagram | a `diagram` block, exported with `diagrams: \"shapes\"` (the default) | one `p:grpSp` of `p:sp` and `p:cxnSp` |");
fs.writeFileSync(p,s);
