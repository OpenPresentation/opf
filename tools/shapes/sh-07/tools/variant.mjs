// node variant.mjs <in.pptx> <out.pptx> <mode>: a copy of a PPTX with its slide XML changed, to find what PowerPoint refuses.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { zipSync, unzipSync, strFromU8, strToU8 } = createRequire('C:/opf-work/sh-07-native-diagrams/packages/pptx/package.json')('fflate');
const [input, output, mode] = process.argv.slice(2);
const parts = unzipSync(readFileSync(input));
for (const key of Object.keys(parts).filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))) {
  let xml = strFromU8(parts[key]);
  if (mode === 'nocxn') xml = xml.replace(/<a:(stCxn|endCxn)[^>]*\/>/g, '');
  if (mode === 'nofill') xml = xml.replace(/<p:cxnSp>[\s\S]*?<\/p:cxnSp>/g, (c) => c.replace(/<a:path w="\d+" h="\d+" stroke="0">[\s\S]*?<\/a:path>/g, '').replace(/<a:solidFill>(<a:srgbClr val="\w+"><\/a:srgbClr>)<\/a:solidFill><a:ln/, '<a:noFill/><a:ln'));
  if (mode === 'sp') xml = xml.replace(/<p:cxnSp><p:nvCxnSpPr>(<p:cNvPr[^>]*\/>)<p:cNvCxnSpPr>[\s\S]*?<\/p:cNvCxnSpPr><p:nvPr\/><\/p:nvCxnSpPr>([\s\S]*?)<\/p:cxnSp>/g, '<p:sp><p:nvSpPr>$1<p:cNvSpPr/><p:nvPr/></p:nvSpPr>$2</p:sp>');
  if (mode === 'prst') xml = xml.replace(/<p:cxnSp>[\s\S]*?<\/p:cxnSp>/g, (c) => c.replace(/<a:custGeom>[\s\S]*?<\/a:custGeom>/, '<a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom>'));
  if (mode === 'onepath') xml = xml.replace(/<p:cxnSp>[\s\S]*?<\/p:cxnSp>/g, (c) => c.replace(/<a:path w="\d+" h="\d+" stroke="0">[\s\S]*?<\/a:path>/g, ''));
  if (mode === 'plainpath') xml = xml.replace(/<p:cxnSp>[\s\S]*?<\/p:cxnSp>/g, (c) => c.replace(/<a:path w="\d+" h="\d+" stroke="0">[\s\S]*?<\/a:path>/g, '').replace(/ fill="none">/g, '>'));
  if (mode === 'line') xml = xml.replace(/<p:cxnSp>[\s\S]*?<\/p:cxnSp>/g, (c) => c.replace(/<a:pathLst>[\s\S]*?<\/a:pathLst>/, '<a:pathLst><a:path w="100" h="100"><a:moveTo><a:pt x="0" y="0"/></a:moveTo><a:lnTo><a:pt x="100" y="100"/></a:lnTo></a:path></a:pathLst>'));
  if (mode === 'bare') xml = xml.replace(/<p:cxnSp>[\s\S]*?<\/p:cxnSp>/g, (c) => c.replace('<a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="l" t="t" r="r" b="b"/>', ''));
  if (mode === 'outside') xml = xml.replace(/(<p:cxnSp>[\s\S]*?<\/p:cxnSp>)+/, (run) => { globalThis.moved = run; return ''; }).replace('</p:grpSp>', () => `</p:grpSp>${globalThis.moved}`);
  if (mode === 'nobins') xml = xml.replace(/ bIns="\d+" rtlCol="0" anchor="t"/g, ' bIns="0" rtlCol="0" anchor="t"');
  if (mode.startsWith('arrow-')) {
    // The straight edge L_B_C_0 as a straightConnector1 with a native tail end of the given w/len.
    const [, w, len] = mode.split('-');
    xml = xml.replace(/<p:sp><p:nvSpPr><p:cNvPr id="(\d+)" name="OPF diagram 1 edge L_B_C_0"\/>[\s\S]*?<\/p:sp>/, (sp, id) => {
      const off = /<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(sp).slice(1).map(Number);
      const y = off[1] + off[3] / 2;
      const ln = /<a:ln [\s\S]*?<\/a:ln>/.exec(sp)[0].replace('</a:ln>', `<a:tailEnd type="triangle" w="${w}" len="${len}"/></a:ln>`);
      return `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="arrow"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm><a:off x="${off[0]}" y="${Math.round(y)}"/><a:ext cx="${off[2]}" cy="0"/></a:xfrm><a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:noFill/>${ln}</p:spPr></p:cxnSp>`;
    });
  }
  if (mode === 'notags') xml = xml.replace(/<p:custDataLst><p:tags r:id="rIdOpfDiagram1"\/><\/p:custDataLst>/, '');
  if (mode === 'nogroup') xml = xml.replace(/<p:grpSp><p:nvGrpSpPr>[\s\S]*?<\/p:grpSpPr>/, '').replace('</p:grpSp>', '');
  if (mode === 'empty') xml = xml.replace(/<p:cNvCxnSpPr><\/p:cNvCxnSpPr>/g, '<p:cNvCxnSpPr/>');
  if (mode === 'noalpha') xml = xml.replace(/<a:srgbClr val="(\w+)"><\/a:srgbClr>/g, '<a:srgbClr val="$1"/>');
  parts[key] = strToU8(xml);
}
writeFileSync(output, zipSync(parts));
