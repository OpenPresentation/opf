import fs from 'node:fs';
const rep=(s,o,n)=>{ if(s.split(o).length!==2) throw Error('count '+o.slice(0,60)); return s.replace(o,n); };
let s=fs.readFileSync('packages/pptx/src/shape-import.js','utf8');
s=rep(s,"        const name = groups.length ? top : String(drawingObject([findKid(kidsOf(node), 'p:nvGrpSpPr')].filter(Boolean))['p:nvGrpSpPr']?.['p:cNvPr']?.name ?? '');\n        z++;\n        walk(kidsOf(node), [...groups, group], name);",
"        z++;\n        walk(kidsOf(node), [...groups, group], groups.length ? top : topGroups++);");
s=rep(s,"  let z = 0;\n  const walk","  let z = 0, topGroups = 0;\n  const walk");
s=rep(s," * `p:pic` and `p:graphicFrame` with their frame only (they take a z slot; the overlay check reads their boxes).\n",
" * `p:pic` and `p:graphicFrame` with their frame only (they take a z slot; the overlay check reads their boxes). A grouped entry has\n * `group`, the index of its top-level p:grpSp among the shape tree's (the parsed tree's `p:grpSp` order).\n");
fs.writeFileSync('packages/pptx/src/shape-import.js',s);
let i=fs.readFileSync('packages/pptx/src/index.js','utf8');
i=rep(i,"  const intactDiagramNames = new Set([...intactDiagramGroups].map(group => String(group?.['p:nvGrpSpPr']?.['p:cNvPr']?.name ?? '')));\n  const drawnOutsideDiagrams = drawnAll.filter(entry => entry.group === undefined || !intactDiagramNames.has(entry.group));",
"  const intactDiagramIndexes = new Set([...intactDiagramGroups].map(group => asArray(tree?.['p:grpSp']).indexOf(group)));\n  const drawnOutsideDiagrams = drawnAll.filter(entry => entry.group === undefined || !intactDiagramIndexes.has(entry.group));");
fs.writeFileSync('packages/pptx/src/index.js',i);
