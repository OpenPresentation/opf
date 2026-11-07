import fs from 'node:fs';
const rep=(s,o,n)=>{ if(s.split(o).length!==2) throw Error('count '+o.slice(0,60)); return s.replace(o,n); };
let s=fs.readFileSync('packages/pptx/src/shape-import.js','utf8');
s=rep(s,`  const walk = (nodes, groups) => {
    for (const node of nodes ?? []) {
      const tag = tagOf(node);
      if (tag === 'p:grpSp') {
        const properties = findKid(kidsOf(node), 'p:grpSpPr');
        const group = properties ? xfrmOf(drawingObject([properties])['p:grpSpPr']?.['a:xfrm']) : undefined;
        z++;
        walk(kidsOf(node), [...groups, group]);`,`  const walk = (nodes, groups, top) => {
    for (const node of nodes ?? []) {
      const tag = tagOf(node);
      if (tag === 'p:grpSp') {
        const properties = findKid(kidsOf(node), 'p:grpSpPr');
        const group = properties ? xfrmOf(drawingObject([properties])['p:grpSpPr']?.['a:xfrm']) : undefined;
        const name = groups.length ? top : String(drawingObject([findKid(kidsOf(node), 'p:nvGrpSpPr')].filter(Boolean))['p:nvGrpSpPr']?.['p:cNvPr']?.name ?? '');
        z++;
        walk(kidsOf(node), [...groups, group], name);`);
s=rep(s,"        drawn.push({tag, z: z++, index: tag === 'p:sp' ? indexes.get(node) : undefined, props, grouped: groups.length > 0, frame: own ? frameOnSlide(own, groups) : undefined});",
"        drawn.push({tag, z: z++, index: tag === 'p:sp' ? indexes.get(node) : undefined, props, grouped: groups.length > 0, ...(top !== undefined ? {group: top} : {}), frame: own ? frameOnSlide(own, groups) : undefined});");
s=rep(s,"        drawn.push({tag, z: z++, frame: own ? frameOnSlide(own, groups) : undefined});",
"        drawn.push({tag, z: z++, ...(top !== undefined ? {group: top} : {}), frame: own ? frameOnSlide(own, groups) : undefined});");
s=rep(s,"  walk(treeKids, []);","  walk(treeKids, [], undefined);");
fs.writeFileSync('packages/pptx/src/shape-import.js',s);
let i=fs.readFileSync('packages/pptx/src/index.js','utf8');
i=rep(i,"  importNativeConnectors(drawnAll, shapeContext);\n",
"  // SH-07 with SH-05: the glued edges of an intact diagram group are the diagram's drawing, not overlay connectors.\n  const intactDiagramNames = new Set([...intactDiagramGroups].map(group => String(group?.['p:nvGrpSpPr']?.['p:cNvPr']?.name ?? '')));\n  const drawnOutsideDiagrams = drawnAll.filter(entry => entry.group === undefined || !intactDiagramNames.has(entry.group));\n  importNativeConnectors(drawnOutsideDiagrams, shapeContext);\n");
i=rep(i,"  settleLayers(drawnAll.flatMap(entry => {","  settleLayers(drawnOutsideDiagrams.flatMap(entry => {");
fs.writeFileSync('packages/pptx/src/index.js',i);
