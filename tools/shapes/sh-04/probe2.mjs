import { presetGeometry, customGeometry } from 'file:///C:/opf-work/sh-04-overlays-connectors/packages/javascript/dist/shape-geometry.js';
for (const p of ['rect','roundRect','ellipse','chevron','wedgeRectCallout','flowChartDecision','straightConnector1','bentConnector3','curvedConnector3','bentConnector2']) { const g = presetGeometry(p, 200, 100); console.log(p, JSON.stringify(g.connectionSites), p.includes('onnector') ? JSON.stringify(g.paths.map(x=>x.d)) : ''); }
console.log(JSON.stringify(customGeometry('M0 0 L1 0 L0.5 1 Z', 100, 100).connectionSites));
console.log(JSON.stringify(presetGeometry('bentConnector3', 200, 100, {adj1: 1.5}).paths.map(x=>x.d)));
console.log(JSON.stringify(presetGeometry('curvedConnector3', 200, 100, {adj1: 0.5}).paths.map(x=>x.d)));
