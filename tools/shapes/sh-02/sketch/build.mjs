// Build a PPTX of rectangles, each with one variant of the sketched-line XML, to see which one PowerPoint draws.
import PptxGenJS from "file:///C:/opf-work/sh-02-shape-block/packages/pptx/vendor/pptxgenjs/pptxgen.es.js";
import JSZip from "file:///C:/opf-work/sh-02-shape-block/packages/pptx/vendor/jszip/index-min.js";
import { writeFileSync } from "node:fs";
const URI = '{C807C97D-BFC1-408E-A445-0C87EB9F89A2}', NS = 'http://schemas.microsoft.com/office/drawing/2018/sketchyshapes';
const rectPath = (w, h) => `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="0" b="0"/><a:pathLst><a:path w="${w}" h="${h}" extrusionOk="0"><a:moveTo><a:pt x="0" y="0"/></a:moveTo><a:lnTo><a:pt x="${w}" y="0"/></a:lnTo><a:lnTo><a:pt x="${w}" y="${h}"/></a:lnTo><a:lnTo><a:pt x="0" y="${h}"/></a:lnTo><a:close/></a:path></a:pathLst></a:custGeom>`;
const W = 2286000, H = 1371600;
const variants = {
  prst: `<ask:lineSketchStyleProps xmlns:ask="${NS}" sd="1219033472"><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><ask:type><ask:lineSketchFreehand/></ask:type></ask:lineSketchStyleProps>`,
  none: `<ask:lineSketchStyleProps xmlns:ask="${NS}" sd="1219033472"><ask:type><ask:lineSketchFreehand/></ask:type></ask:lineSketchStyleProps>`,
  cust: `<ask:lineSketchStyleProps xmlns:ask="${NS}" sd="1219033472">${rectPath(W, H)}<ask:type><ask:lineSketchFreehand/></ask:type></ask:lineSketchStyleProps>`,
  scribble: `<ask:lineSketchStyleProps xmlns:ask="${NS}" sd="1219033472">${rectPath(W, H)}<ask:type><ask:lineSketchScribble/></ask:type></ask:lineSketchStyleProps>`,
};
const p = new PptxGenJS(); p.layout = "LAYOUT_WIDE";
const s = p.addSlide();
Object.keys(variants).forEach((name, i) => {
  s.addShape('rect', { x: 0.5 + (i % 2) * 6.3, y: 0.6 + Math.floor(i / 2) * 3.4, w: W / 914400, h: H / 914400, objectName: `v-${name}`, fill: { type: 'none' }, line: { color: '1F5AA6', width: 3 } });
  s.addText(name, { x: 0.5 + (i % 2) * 6.3, y: 0.1 + Math.floor(i / 2) * 3.4, w: 3, h: 0.4, fontSize: 14 });
});
const z = await JSZip.loadAsync(await p.write({ outputType: "nodebuffer" }));
let xml = await z.file('ppt/slides/slide1.xml').async('string');
for (const [name, ext] of Object.entries(variants)) {
  xml = xml.replace(new RegExp(String.raw`(name="v-${name}"[\s\S]*?<a:ln\b[^>]*>[\s\S]*?)(</a:ln>)`), (_, head, close) => `${head}<a:extLst><a:ext uri="${URI}">${ext}</a:ext></a:extLst>${close}`);
}
z.file('ppt/slides/slide1.xml', xml);
writeFileSync(process.argv[2], await z.generateAsync({ type: 'nodebuffer' }));
console.log(xml.match(/name="v-prst"[\s\S]*?<\/a:ln>/)[0].slice(-600));
