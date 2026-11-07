import {readFileSync, writeFileSync, copyFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const {unzipSync, zipSync, strFromU8, strToU8} = createRequire('C:/opf-work/sh-09-smartart-tier1/packages/pptx/package.json')('fflate');
const base = process.argv[2], src = `../sweep/pptx/${base}.pptx`;
const variants = {
  pts: x => x,
  pct100: x => x.replace(/<a:lnSpc><a:spcPts val="\d+"\/><\/a:lnSpc>/g, '<a:lnSpc><a:spcPct val="100000"/></a:lnSpc>'),
  pct90: x => x.replace(/<a:lnSpc><a:spcPts val="\d+"\/><\/a:lnSpc>/g, '<a:lnSpc><a:spcPct val="90000"/></a:lnSpc>'),
  bef: x => x.replace(/<a:spcBef><a:spcPts val="0"\/><\/a:spcBef>/g, '<a:spcBef><a:spcPts val="600"/></a:spcBef>'),
};
for (const [name, f] of Object.entries(variants)) {
  const parts = unzipSync(readFileSync(src));
  for (const k of Object.keys(parts)) if (/ppt\/diagrams\/data\d+\.xml/.test(k)) parts[k] = strToU8(f(strFromU8(parts[k])));
  writeFileSync(`pptx/${base}-${name}.pptx`, zipSync(parts));
  copyFileSync(`../sweep/preview/${base}-1.png`, `preview/${base}-${name}-1.png`);
}
