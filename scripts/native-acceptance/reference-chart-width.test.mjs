// Actual Office-free export captured from genuine consumer069; no export/generation or Office in these tests.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import test from "node:test";
import { fromPptx } from "../../packages/pptx/dist/index.js";
import { gallery } from "../../packages/gallery/dist/index.js";
import { readReferenceSources } from "./reference-chart-fixtures.mjs";
import { inspectReferenceArchive, archiveDependencies } from "./reference-chart-archive.mjs";
import { assertReferenceWitnessSource, compareReferenceWitnessImports } from "./reference-chart-profile.mjs";
import { digest } from "./identity.mjs";
const folder=fileURLToPath(new URL("./test-fixtures/reference-width/",import.meta.url));
const manifest=JSON.parse(fs.readFileSync(path.join(folder,"manifest.json"),"utf8"));
const bytes=fs.readFileSync(path.join(folder,"reference-native-lines.pptx"));
assert.equal(bytes.length,manifest.bytes);assert.equal(digest(bytes),manifest.sha256);
const source=readReferenceSources().find(s=>s.id==="reference-native-lines").document;
const archive=inspectReferenceArchive(bytes,archiveDependencies());
assertReferenceWitnessSource(archive,source);
assert.deepEqual(archive.canvas,{cx:12192000,cy:6858000});
const read=async(input)=>{const diagnostics=[];const document=await fromPptx(input,{catalogs:[gallery],onDiagnostic:d=>diagnostics.push(d)});return {document,diagnostics};};
const original=()=>read(bytes);
const charts=doc=>doc.slides[0].chart??doc.slides[0].blocks.find(b=>b.chart).chart;
test("real fractional1.5 reference import compares exact current14288EMU projection",async()=>{
  const imported=await original(),floor=charts(imported.document).referenceLines[1];
  assert.equal(source.slides[0].chart.referenceLines[1].stroke.width,1.5);
  assert.equal(floor.stroke.width,14288/9525);
  assert.notEqual(floor.stroke.width,1.5,"This real serialized boundary must remain exercised");
  assert.deepEqual(compareReferenceWitnessImports(source,{original:imported,"saved-reopened":imported},archive.canvas),[]);
});
test("actual plus1EMU reference style edit stays current and refuses the source-bound expectation",async()=>{
  const require=createRequire(new URL("../../packages/pptx/package.json",import.meta.url)),{unzipSync,strFromU8,strToU8,zipSync}=require("fflate");
  const parts=unzipSync(bytes),file="ppt/charts/chart1.xml",xml=strFromU8(parts[file]);
  let edits=0;const changed=xml.replace(/<c:ser>[\s\S]*?<\/c:ser>/g,ser=>{
    if(!ser.includes("Floor -10"))return ser;
    assert.match(ser,/<a:ln w="14288"/);edits++;
    return ser.replace('<a:ln w="14288"','<a:ln w="14289"');
  });
  assert.equal(edits,1);assert.notEqual(changed,xml);parts[file]=strToU8(changed);
  const mutated=zipSync(parts),current=await read(mutated),unchanged=await original();
  assert.equal(charts(current.document).referenceLines[1].stroke.width,14289/9525);
  assert.deepEqual(charts(current.document).data,source.slides[0].chart.data);
  assert.equal(charts(current.document).referenceLines[1].value,-10);
  assert.equal(charts(current.document).referenceLines[1].label,"Floor -10");
  assert.throws(()=>assertReferenceWitnessSource(inspectReferenceArchive(mutated,archiveDependencies()),source),/line width differs/);
  const findings=compareReferenceWitnessImports(source,{original:unchanged,"saved-reopened":current},archive.canvas);
  assert.ok(findings.some(f=>f.phase==="saved-reopened"&&f.reference===1&&f.code==="import-reference-value-label-style-differs"));
});
test("source-bound canvas is required and malformed canvas cannot define an expected stroke",async()=>{
  const imported=await original(),phases={original:imported,"saved-reopened":imported};
  for(const canvas of [undefined,null,{cx:0,cy:6858000},{cx:12192000,cy:NaN},{cx:12192000,cy:6858000.5}])
    assert.throws(()=>compareReferenceWitnessImports(source,phases,canvas),/source canvas/);
});

test("default width and legal0/64 remain exact while the64bound cannot accept an illegal65source",async()=>{
  const imported=await original();
  const defaultChart=imported.document.slides[1].chart??imported.document.slides[1].blocks.find(b=>b.chart).chart;
  assert.equal(source.slides[1].chart.referenceLines[0].stroke,undefined);
  assert.equal(defaultChart.referenceLines[0].stroke.width,4/3);
  for(const width of [0,64]){
    const wanted=structuredClone(source),current=structuredClone(imported);
    wanted.slides[0].chart.referenceLines[0].stroke.width=width;
    charts(current.document).referenceLines[0].stroke.width=width;
    assert.deepEqual(compareReferenceWitnessImports(wanted,{original:current,"saved-reopened":current},archive.canvas),[]);
  }
  const illegal=structuredClone(source),current=structuredClone(imported);
  illegal.slides[0].chart.referenceLines[0].stroke.width=65;
  charts(current.document).referenceLines[0].stroke.width=64;
  assert.ok(compareReferenceWitnessImports(illegal,{original:current,"saved-reopened":current},archive.canvas).some(f=>f.code==="import-reference-value-label-style-differs"));
});

// Pure nonunit-canvas expectation: no export or native observation is performed.
test("nonunit source canvas uses exporter multiplication order at an observable halfEMU boundary",async()=>{
  const sourceCanvas={cx:9144000,cy:5143500},scale=0.75,width=0.5009273840769903;
  assert.equal(Math.min(sourceCanvas.cx,sourceCanvas.cy)/6858000,scale);
  assert.equal(Math.round((width*scale)*9525),3578);
  assert.equal(Math.round((width*9525)*scale),3579,"Reassociation must remain observably different");
  const wanted=structuredClone(source),current=await original();
  wanted.slides[0].chart.referenceLines[0].stroke.width=width;
  for(const [index,slide] of wanted.slides.entries()){
    const actual=current.document.slides[index].chart??current.document.slides[index].blocks.find(b=>b.chart).chart;
    for(const [reference,line] of slide.chart.referenceLines.entries())
      actual.referenceLines[reference].stroke.width=Math.min(64,Math.round(((line.stroke?.width??4/3)*scale)*9525)/(9525*scale));
  }
  assert.equal(charts(current.document).referenceLines[0].stroke.width,3578/(9525*scale));
  assert.deepEqual(compareReferenceWitnessImports(wanted,{original:current,"saved-reopened":current},sourceCanvas),[]);
  const wrong=structuredClone(current);
  charts(wrong.document).referenceLines[0].stroke.width=3579/(9525*scale);
  assert.ok(compareReferenceWitnessImports(wanted,{original:current,"saved-reopened":wrong},sourceCanvas).some(f=>f.phase==="saved-reopened"&&f.reference===0&&f.code==="import-reference-value-label-style-differs"));
});
