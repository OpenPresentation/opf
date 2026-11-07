import fs from 'node:fs';
const p='packages/pptx/src/index.js';
let s=fs.readFileSync(p,'utf8');
const T='>>>>>>> origin/codex/sh-07-native-diagrams\n';
let a=s.indexOf('<<<<<<< HEAD\n=======\n  // SH-07: a diagram written as shapes');
let b=s.indexOf(T,a)+T.length; s=s.slice(0,a)+s.slice(b);
a=s.indexOf('<<<<<<< HEAD\n  // SH-05: the drawn shapes');
let m=s.indexOf('=======\n',a), e=s.indexOf(T,m);
s=s.slice(0,a)+s.slice(a+13,m)+s.slice(m+8,e)+s.slice(e+T.length);
const rep=(o,n)=>{ if(s.split(o).length!==2) throw Error('count '+o); s=s.replace(o,n); };
rep("if (asArray(tree?.['p:grpSp']).some(group => !isImagePlaceholderGroup(group) && groupAtRisk(group)))",
    "if (asArray(tree?.['p:grpSp']).some(group => !isImagePlaceholderGroup(group) && !intactDiagramGroups.has(group) && groupAtRisk(group)))");
rep("  const diagramMembers = new Set();\n", "  const diagramMembers = new Set(), intactDiagramGroups = new Set();\n");
rep("    const members = nativeTextShapes(group);\n", "    intactDiagramGroups.add(group);\n    const members = nativeTextShapes(group);\n");
fs.writeFileSync(p,s);
