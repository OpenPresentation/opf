// Rectangles and an ellipse with each sketch type, the ext holding the shape's own plain geometry; resized through COM, PowerPoint
// recomputes the sketched outline from the seed and saves it.
import PptxGenJS from "file:///C:/opf-work/sh-02-shape-block/packages/pptx/vendor/pptxgenjs/pptxgen.es.js";
import JSZip from "file:///C:/opf-work/sh-02-shape-block/packages/pptx/vendor/jszip/index-min.js";
import { writeFileSync } from "node:fs";
const URI = '{C807C97D-BFC1-408E-A445-0C87EB9F89A2}', NS = 'http://schemas.microsoft.com/office/drawing/2018/sketchyshapes';
const W = 2286000, H = 1371600;
const rectPath = `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="0" b="0"/><a:pathLst><a:path w="${W}" h="${H}" extrusionOk="0"><a:moveTo><a:pt x="0" y="0"/></a:moveTo><a:lnTo><a:pt x="${W}" y="0"/></a:lnTo><a:lnTo><a:pt x="${W}" y="${H}"/></a:lnTo><a:lnTo><a:pt x="0" y="${H}"/></a:lnTo><a:close/></a:path></a:pathLst></a:custGeom>`;
const types = ['lineSketchCurved', 'lineSketchFreehand', 'lineSketchScribble', 'lineSketchNone'];
const p = new PptxGenJS(); p.layout = "LAYOUT_WIDE";
const s = p.addSlide();
types.forEach((t, i) => {
  s.addShape('rect', { x: 0.5 + (i % 2) * 6.3, y: 0.6 + Math.floor(i / 2) * 3.4, w: W / 914400, h: H / 914400, objectName: `v-${t}`, fill: { type: 'none' }, line: { color: '1F5AA6', width: 3 } });
});
const z = await JSZip.loadAsync(await p.write({ outputType: "nodebuffer" }));
let xml = await z.file('ppt/slides/slide1.xml').async('string');
for (const t of types) {
  const ext = `<ask:lineSketchStyleProps xmlns:ask="${NS}" sd="1219033472">${rectPath}<ask:type><ask:${t}/></ask:type></ask:lineSketchStyleProps>`;
  xml = xml.replace(new RegExp(String.raw`(name="v-${t}"[\s\S]*?<a:ln\b[^>]*>[\s\S]*?)(</a:ln>)`), (_, head, close) => `${head}<a:extLst><a:ext uri="${URI}">${ext}</a:ext></a:extLst>${close}`);
}
z.file('ppt/slides/slide1.xml', xml);
writeFileSync(process.argv[2], await z.generateAsync({ type: 'nodebuffer' }));
