// The three forms of a SmartArt frame without a layout part: an empty r:lo (OPF's export), a dangling r:lo, and no r:lo at all.
import {readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const {unzipSync, zipSync, strFromU8, strToU8} = createRequire('C:/opf-work/sh-09-smartart-tier1/packages/pptx/package.json')('fflate');
for (const base of ['pyramid-4-short-wide', 'matrix-4-short-wide']) {
  const variants = {empty: x => x, dangling: x => x.replace('r:lo=""', 'r:lo="rId99"'), absent: x => x.replace(' r:lo=""', '')};
  for (const [name, f] of Object.entries(variants)) {
    const parts = unzipSync(readFileSync(`../sweep3/pptx/${base}.pptx`));
    parts['ppt/slides/slide1.xml'] = strToU8(f(strFromU8(parts['ppt/slides/slide1.xml'])));
    writeFileSync(`pptx/${base}-lo-${name}.pptx`, zipSync(parts));
  }
}
