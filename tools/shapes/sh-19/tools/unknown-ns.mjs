// node unknown-ns.mjs <in.pptx> <out.pptx>: the same file, every SmartArt mc:Choice requiring a namespace PowerPoint does not know, so
// PowerPoint takes the mc:Fallback picture (SH-16's fallback, as an app without SmartArt shows it).
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { unzipSync, zipSync, strFromU8, strToU8 } = createRequire('C:/opf-work/sh-19-smartart-layouts/packages/pptx/package.json')('fflate');
const [input, output] = process.argv.slice(2), entries = unzipSync(readFileSync(input));
let count = 0;
for (const part of Object.keys(entries).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path))) {
  const xml = strFromU8(entries[part]), next = xml.replaceAll('xmlns:dgm1612="http://schemas.microsoft.com/office/drawing/2016/12/diagram"', 'xmlns:dgm1612="urn:openpresentation.org/test/unknown-namespace"');
  count += (xml.match(/Requires="dgm1612"/g) ?? []).length;
  entries[part] = strToU8(next);
}
writeFileSync(output, zipSync(entries));
console.log(`${count} SmartArt frames now require an unknown namespace -> ${output}`);
