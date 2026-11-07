import {fromPptx, toPptx} from 'file:///C:/opf-work/sh-phase-2/packages/pptx/test/helpers/default-catalog.mjs';
const FLOW = {source: 'flowchart LR
  A[Request] --- B[Review]
  B --> C[Build]', alt: 'Flow'};
const deck = {slides: [{title: 'R', diagram: FLOW}]};
const bytes = await toPptx(deck, {});
const reports = [];
const back = await fromPptx(bytes, {onDiagnostic: e => reports.push(e.code)});
console.log(JSON.stringify(back.slides[0]).slice(0, 600));
console.log(reports);
const {unzipSync, strFromU8} = await import('fflate');
const xml = strFromU8(unzipSync(bytes)['ppt/slides/slide1.xml']);
console.log('cxnSp', (xml.match(/<p:cxnSp>/g) ?? []).length);
