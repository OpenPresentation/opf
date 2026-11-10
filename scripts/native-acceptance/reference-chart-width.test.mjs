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
const original=()=>fromPptx(bytes,{catalogs:[gallery]});
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
  const mutated=zipSync(parts),current=await fromPptx(mutated,{catalogs:[gallery]}),unchanged=await original();
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
