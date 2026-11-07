import { readFileSync, writeFileSync } from 'node:fs';
let src = readFileSync('build.mjs', 'utf8');
// a zigzag "sketched" outline for the cust variant
src = src.replace("cust: `<ask:lineSketchStyleProps xmlns:ask=\"${NS}\" sd=\"1219033472\">${rectPath(W, H)}", "cust: `<ask:lineSketchStyleProps xmlns:ask=\"${NS}\" sd=\"1219033472\">${zig(W, H)}");
src = src.replace("const W = 2286000", "const zig = (w, h) => { let pts = []; for (let i = 0; i <= 20; i++) pts.push([w * i / 20, (i % 2) * h * 0.1]); for (let i = 0; i <= 10; i++) pts.push([w - (i % 2) * w * 0.05, h * i / 10]); for (let i = 20; i >= 0; i--) pts.push([w * i / 20, h - (i % 2) * h * 0.1]); return `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l=\"0\" t=\"0\" r=\"0\" b=\"0\"/><a:pathLst><a:path w=\"${w}\" h=\"${h}\" extrusionOk=\"0\"><a:moveTo><a:pt x=\"0\" y=\"0\"/></a:moveTo>${pts.map(([x, y]) => `<a:lnTo><a:pt x=\"${Math.round(x)}\" y=\"${Math.round(y)}\"/></a:lnTo>`).join('')}<a:close/></a:path></a:pathLst></a:custGeom>`; };\nconst W = 2286000");
writeFileSync('build2.mjs', src);
