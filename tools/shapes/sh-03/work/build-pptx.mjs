// Build a PPTX from a JSON spec: { slides: [ { cells: [ { x,y,w,h (px), geom, fill, line, fx (effectLst xml) } ] } ] }
import PptxGenJS from "file:///C:/opf-work/sh-03-effects/packages/pptx/vendor/pptxgenjs/pptxgen.es.js";
import JSZip from "file:///C:/opf-work/sh-03-effects/packages/pptx/vendor/jszip/index-min.js";
import { readFileSync, writeFileSync } from "node:fs";
const [specPath, outPath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
const p = new PptxGenJS(); p.layout = "LAYOUT_WIDE";
const IN = 96;
const names = [];
spec.slides.forEach((slide, si) => {
  const s = p.addSlide();
  s.background = { color: slide.background ?? "FFFFFF" };
  slide.cells.forEach((c, ci) => {
    const name = `fx-${si}-${ci}`;
    const opts = { x: c.x / IN, y: c.y / IN, w: c.w / IN, h: c.h / IN, objectName: name };
    if (c.fill && c.fill !== "none") opts.fill = { color: c.fill.replace('#','').slice(0,6), transparency: c.fillOpacity != null ? Math.round((1 - c.fillOpacity) * 100) : 0 };
    else opts.fill = { type: "none" };
    if (c.line) opts.line = { color: c.line.replace('#',''), width: (c.lineWidth ?? 2) * 0.75 };
    if (c.rotate) opts.rotate = c.rotate;
    if (c.text) s.addText(c.text, { ...opts, shape: c.geom ?? "rect", fontSize: c.fontSize ?? 28, bold: true, color: (c.textColor ?? "FFFFFF").replace("#",""), fontFace: "Arial", align: "center", valign: "middle" }); else s.addShape(c.geom ?? "rect", opts);
    if (c.label) s.addText(c.label, { x: c.x / IN, y: (c.y + c.h + (c.labelDy ?? 6)) / IN, w: Math.max(c.w, 200) / IN, h: 0.22, fontSize: 9, color: "666666", margin: 0, fontFace: "Arial" });
    names.push([si, name, c.fx ?? ""]);
  });
});
const buf = await p.write({ outputType: "nodebuffer" });
const z = await JSZip.loadAsync(buf);
for (let si = 0; si < spec.slides.length; si++) {
  const path = `ppt/slides/slide${si + 1}.xml`;
  let xml = await z.file(path).async("string");
  for (const [s, name, fx] of names) {
    if (s !== si || !fx) continue;
    const re = new RegExp(`(name="${name}"[^]*?)</p:spPr>`);
    xml = xml.replace(re, (_m, head) => `${head}${fx}</p:spPr>`);
  }
  z.file(path, xml);
}
writeFileSync(outPath, await z.generateAsync({ type: "nodebuffer" }));
console.log("wrote", outPath);
