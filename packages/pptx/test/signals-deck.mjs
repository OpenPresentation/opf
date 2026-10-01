// A hand-written, untagged PPTX in the shape a real-world deck has: a master with text styles, three layouts,
// placeholders that inherit position, size, bullets and fonts, scheme colours, groups with child transforms,
// a connector, a picture, a table, hyperlinks and a slide-number field. It is authored here from scratch (no
// third-party deck, no OPF tags), so signals tests run against decks that carry no provenance.
import {zipSync, zlibSync} from 'fflate';

const encoder = new TextEncoder();
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

// A 2x2 opaque RGB PNG (red, green / blue, white), encoded here so the bytes are valid and reproducible.
function crc32(bytes) {
  let crc = ~0;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xEDB88320 : crc >>> 1; }
  return ~crc >>> 0;
}
function pngChunk(type, data) {
  const out = new Uint8Array(12 + data.length), view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(encoder.encode(type), 4); out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
const PNG = (() => {
  const header = new Uint8Array(13), view = new DataView(header.buffer);
  view.setUint32(0, 2); view.setUint32(4, 2); header.set([8, 2, 0, 0, 0], 8);
  const rows = Uint8Array.from([0, 255, 0, 0, 0, 255, 0, 0, 0, 0, 255, 255, 255, 255]);
  const parts = [Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', header), pngChunk('IDAT', zlibSync(rows)), pngChunk('IEND', new Uint8Array())];
  return Uint8Array.from(parts.flatMap(part => [...part]));
})();

const rels = items => `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(([id, type, target, mode]) => `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"${mode ? ` TargetMode="${mode}"` : ''}/>`).join('')}</Relationships>`;

const solid = value => `<a:solidFill>${value.startsWith('#') ? `<a:srgbClr val="${value.slice(1)}"/>` : `<a:schemeClr val="${value}"/>`}</a:solidFill>`;
const emu = inches => Math.round(inches * 914400);
const xfrm = (x, y, w, h, extra = '') => `<a:xfrm${extra}><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>`;
const nvSp = (id, name, extra = '', nvPr = '') => `<p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr${extra}/><p:nvPr>${nvPr}</p:nvPr></p:nvSpPr>`;
const paragraph = (text, {level, props = '', run = ''} = {}) => `<a:p><a:pPr${level ? ` lvl="${level}"` : ''}${props}/><a:r><a:rPr lang="en-US"${run}/><a:t>${text}</a:t></a:r></a:p>`;

const master = `${declaration}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
<p:sp>${nvSp(2, 'Title Placeholder 1', '', '<p:ph type="title"/>')}<p:spPr>${xfrm(0.9, 0.4, 11.5, 1.2)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr anchor="b"><a:normAutofit/></a:bodyPr><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Title</a:t></a:r></a:p></p:txBody></p:sp>
<p:sp>${nvSp(3, 'Text Placeholder 2', '', '<p:ph type="body" idx="1"/>')}<p:spPr>${xfrm(0.9, 1.9, 11.5, 4.6)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr lvl="0"/><a:r><a:rPr lang="en-US"/><a:t>Body</a:t></a:r></a:p></p:txBody></p:sp>
<p:sp>${nvSp(4, 'Slide Number Placeholder 3', '', '<p:ph type="sldNum" sz="quarter" idx="4"/>')}<p:spPr>${xfrm(11.2, 6.9, 1.4, 0.4)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr anchor="ctr"/><a:lstStyle><a:lvl1pPr algn="r"><a:defRPr sz="1200"><a:solidFill><a:schemeClr val="tx2"/></a:solidFill></a:defRPr></a:lvl1pPr></a:lstStyle><a:p><a:fld id="{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}" type="slidenum"><a:rPr lang="en-US"/><a:t>‹#›</a:t></a:fld></a:p></p:txBody></p:sp>
</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/><p:sldLayoutId id="2147483650" r:id="rId2"/><p:sldLayoutId id="2147483651" r:id="rId3"/></p:sldLayoutIdLst>
<p:txStyles>
<p:titleStyle><a:lvl1pPr algn="l"><a:lnSpc><a:spcPct val="90000"/></a:lnSpc><a:buNone/><a:defRPr sz="4000" b="0">${solid('tx1')}<a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></p:titleStyle>
<p:bodyStyle><a:lvl1pPr marL="342900" indent="-342900" algn="l"><a:lnSpc><a:spcPct val="100000"/></a:lnSpc><a:spcBef><a:spcPts val="1000"/></a:spcBef><a:buFont typeface="Arial"/><a:buChar char="•"/><a:defRPr sz="2800">${solid('tx1')}<a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr><a:lvl2pPr marL="742950" indent="-285750" algn="l"><a:spcBef><a:spcPts val="500"/></a:spcBef><a:buFont typeface="Arial"/><a:buChar char="–"/><a:defRPr sz="2400">${solid('tx1')}<a:latin typeface="+mn-lt"/></a:defRPr></a:lvl2pPr></p:bodyStyle>
<p:otherStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr><a:lvl1pPr marL="0" algn="l"><a:defRPr sz="1800">${solid('tx1')}<a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></p:otherStyle>
</p:txStyles></p:sldMaster>`;

const layout = (type, name, shapes) => `${declaration}<p:sldLayout ${NS} type="${type}"><p:cSld name="${name}"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
const layoutSp = (id, name, ph, box, body = '') => `<p:sp>${nvSp(id, name, '', ph)}<p:spPr>${box ? xfrm(...box) : ''}</p:spPr><p:txBody><a:bodyPr/>${body || '<a:lstStyle/>'}<a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`;

const layouts = [
  layout('title', 'Title Slide',
    layoutSp(2, 'Title 1', '<p:ph type="ctrTitle"/>', [1.4, 1.9, 10.5, 1.8], '<a:lstStyle><a:lvl1pPr algn="ctr"><a:defRPr sz="5400"/></a:lvl1pPr></a:lstStyle>')
    + layoutSp(3, 'Subtitle 2', '<p:ph type="subTitle" idx="1"/>', [1.4, 3.9, 10.5, 1.0], '<a:lstStyle><a:lvl1pPr marL="0" indent="0" algn="ctr"><a:buNone/><a:defRPr sz="2400"/></a:lvl1pPr></a:lstStyle>')),
  layout('obj', 'Title and Content',
    layoutSp(2, 'Title 1', '<p:ph type="title"/>', null) + layoutSp(3, 'Content Placeholder 2', '<p:ph idx="1"/>', null)
    + layoutSp(4, 'Slide Number Placeholder 3', '<p:ph type="sldNum" sz="quarter" idx="12"/>', null)),
  layout('blank', 'Blank', '')
];

const theme = `${declaration}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Contoso Review"><a:themeElements>
<a:clrScheme name="Contoso"><a:dk1><a:srgbClr val="111827"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="374151"/></a:dk2><a:lt2><a:srgbClr val="F3F4F6"/></a:lt2><a:accent1><a:srgbClr val="2563EB"/></a:accent1><a:accent2><a:srgbClr val="F59E0B"/></a:accent2><a:accent3><a:srgbClr val="10B981"/></a:accent3><a:accent4><a:srgbClr val="EF4444"/></a:accent4><a:accent5><a:srgbClr val="8B5CF6"/></a:accent5><a:accent6><a:srgbClr val="14B8A6"/></a:accent6><a:hlink><a:srgbClr val="1D4ED8"/></a:hlink><a:folHlink><a:srgbClr val="6D28D9"/></a:folHlink></a:clrScheme>
<a:fontScheme name="Contoso"><a:majorFont><a:latin typeface="Segoe UI Semibold"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Segoe UI"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>
<a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>
</a:themeElements></a:theme>`;

const presentation = `${declaration}<p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${[1, 2, 3, 4].map(n => `<p:sldId id="${255 + n}" r:id="rId${n + 1}"/>`).join('')}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr><a:lvl1pPr marL="0" algn="l"><a:defRPr sz="1800">${solid('tx1')}<a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></p:defaultTextStyle></p:presentation>`;

const slide = (shapes, attrs = '') => `${declaration}<p:sld ${NS}${attrs}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
const phShape = (id, name, ph, body, box) => `<p:sp>${nvSp(id, name, '', ph)}<p:spPr>${box ? xfrm(...box) : ''}</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/>${body}</p:txBody></p:sp>`;

const slide1 = slide(
  phShape(2, 'Title 1', '<p:ph type="ctrTitle"/>', paragraph('Acme Analytics Platform'))
  + phShape(3, 'Subtitle 2', '<p:ph type="subTitle" idx="1"/>', paragraph('Q3 2026 Product Review'))
);

const slide2 = slide(
  phShape(2, 'Title 1', '<p:ph type="title"/>', paragraph('Highlights'))
  + phShape(3, 'Content Placeholder 2', '<p:ph idx="1"/>',
    paragraph('Revenue grew 24% year over year') + paragraph('Enterprise segment led growth', {level: 1}) + paragraph('Churn fell to 2.1%') + paragraph('Launched three new regions'))
  + phShape(4, 'Slide Number Placeholder 3', '<p:ph type="sldNum" sz="quarter" idx="12"/>',
    '<a:p><a:fld id="{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}" type="slidenum"><a:rPr lang="en-US"/><a:t>2</a:t></a:fld></a:p>')
);

const textBox = (id, name, box, body, {fill = '', line = '', geometry = 'rect', bodyPr = '<a:bodyPr wrap="square" rtlCol="0"><a:spAutoFit/></a:bodyPr>'} = {}) =>
  `<p:sp>${nvSp(id, name, ' txBox="1"')}<p:spPr>${xfrm(...box)}<a:prstGeom prst="${geometry}"><a:avLst/></a:prstGeom>${fill || '<a:noFill/>'}${line}</p:spPr><p:txBody>${bodyPr}<a:lstStyle/>${body}</p:txBody></p:sp>`;

const slide3 = slide(
  textBox(2, 'TextBox 1', [0.9, 0.5, 8, 0.6], paragraph('Deploy script', {run: ' sz="2800" b="1"'}))
  + textBox(3, 'Code panel', [0.9, 1.3, 6.2, 1.6],
    ['def deploy(env):', '    build()', '    push(env)'].map(line => `<a:p><a:r><a:rPr lang="en-US" sz="1400"><a:solidFill><a:srgbClr val="1F2937"/></a:solidFill><a:latin typeface="Consolas"/></a:rPr><a:t xml:space="preserve">${line}</a:t></a:r></a:p>`).join(''),
    {fill: solid('#F2F2F2'), line: `<a:ln w="12700">${solid('#D1D5DB')}</a:ln>`})
  // A group drawn at 1:1: its children use the slide's own coordinates.
  + `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="4" name="Metric card"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="${emu(0.9)}" y="${emu(3.4)}"/><a:ext cx="${emu(3.6)}" cy="${emu(1.8)}"/><a:chOff x="${emu(0.9)}" y="${emu(3.4)}"/><a:chExt cx="${emu(3.6)}" cy="${emu(1.8)}"/></a:xfrm></p:grpSpPr>`
  + `<p:sp>${nvSp(5, 'Card background')}<p:spPr>${xfrm(0.9, 3.4, 3.6, 1.8)}<a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>${solid('accent1')}<a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`
  + textBox(6, 'Metric value', [1.1, 3.5, 3.2, 1.0], `<a:p><a:r><a:rPr lang="en-US" sz="5400" b="1"><a:solidFill><a:schemeClr val="bg1"/></a:solidFill></a:rPr><a:t>98.7%</a:t></a:r></a:p>`)
  + textBox(7, 'Metric label', [1.1, 4.5, 3.2, 0.5], `<a:p><a:r><a:rPr lang="en-US" sz="1400"><a:solidFill><a:schemeClr val="bg2"/></a:solidFill></a:rPr><a:t>Platform uptime</a:t></a:r></a:p>`)
  + `</p:grpSp>`
  // A group whose children are laid out in a space twice the group's size (scale 0.5) and offset: nested once more.
  + `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="8" name="Scaled card"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="${emu(5.4)}" y="${emu(3.4)}"/><a:ext cx="${emu(3.6)}" cy="${emu(1.8)}"/><a:chOff x="1000" y="2000"/><a:chExt cx="${emu(7.2)}" cy="${emu(3.6)}"/></a:xfrm></p:grpSpPr>`
  + `<p:sp>${nvSp(9, 'Scaled background')}<p:spPr><a:xfrm><a:off x="1000" y="2000"/><a:ext cx="${emu(7.2)}" cy="${emu(3.6)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${solid('#E5E7EB')}</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`
  + `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="10" name="Inner group"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="${1000 + emu(1)}" y="${2000 + emu(1)}"/><a:ext cx="${emu(4)}" cy="${emu(1)}"/><a:chOff x="0" y="0"/><a:chExt cx="${emu(4)}" cy="${emu(1)}"/></a:xfrm></p:grpSpPr>`
  + textBox(11, 'Scaled label', [0, 0, 4, 1], `<a:p><a:r><a:rPr lang="en-US" sz="2800" i="1"/><a:t>Net revenue retention</a:t></a:r></a:p>`)
  + `</p:grpSp></p:grpSp>`
  + `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="12" name="Arrow 11"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr>${xfrm(4.6, 4.3, 0.7, 0)}<a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:ln w="19050">${solid('tx2')}<a:tailEnd type="triangle"/></a:ln></p:spPr></p:cxnSp>`
  + textBox(13, 'Source note', [0.9, 5.6, 8, 0.4],
    `<a:p><a:r><a:rPr lang="en-US" sz="1200"/><a:t>Source: </a:t></a:r><a:r><a:rPr lang="en-US" sz="1200"><a:hlinkClick r:id="rId2"/></a:rPr><a:t>status page</a:t></a:r></a:p>`)
);

const slide4 = slide(
  textBox(2, 'Pull quote', [0.9, 0.8, 6.4, 2.4],
    `<a:p><a:r><a:rPr lang="en-US" sz="2800" i="1"><a:latin typeface="Georgia"/></a:rPr><a:t>The best dashboards answer the question before it is asked.</a:t></a:r></a:p><a:p><a:pPr algn="r"/><a:r><a:rPr lang="en-US" sz="1600"/><a:t>Pat Example, Head of Data</a:t></a:r></a:p>`)
  + `<p:pic><p:nvPicPr><p:cNvPr id="3" name="Picture 2" descr="Four colour swatches"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:srcRect l="10000" t="5000"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xfrm(8, 0.8, 3, 3, ' rot="5400000"')}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`
  + `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="4" name="Table 3"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${emu(0.9)}" y="${emu(3.8)}"/><a:ext cx="${emu(6.4)}" cy="${emu(1.5)}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1" bandRow="1"/><a:tblGrid><a:gridCol w="${emu(3.2)}"/><a:gridCol w="${emu(3.2)}"/></a:tblGrid>`
  + [['Region', 'ARR'], ['EMEA', '$4.1M'], ['APAC', '$2.7M']].map(row => `<a:tr h="${emu(0.5)}">${row.map(cell => `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>${cell}</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>`).join('')}</a:tr>`).join('')
  + `</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`
  + `<p:sp><p:nvSpPr><p:cNvPr id="5" name="Hidden helper" hidden="1"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm(8, 5, 2, 1)}<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>${solid('accent3')}</p:spPr></p:sp>`
);

const slideRels = (layoutNumber, extra = []) => rels([['rId1', 'slideLayout', `../slideLayouts/slideLayout${layoutNumber}.xml`], ...extra]);

/** The deck as bytes. Deterministic: the same bytes on every call. */
export function buildThirdPartyDeck() {
  const files = {
    '[Content_Types].xml': `${declaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>${[1, 2, 3].map(n => `<Override PartName="/ppt/slideLayouts/slideLayout${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`).join('')}${[1, 2, 3, 4].map(n => `<Override PartName="/ppt/slides/slide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
    '_rels/.rels': rels([['rId1', 'officeDocument', 'ppt/presentation.xml'], ['rId2', 'metadata/core-properties', 'docProps/core.xml']]).replace(`${REL}/metadata/core-properties`, 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties'),
    'docProps/core.xml': `${declaration}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Q3 Product Review</dc:title><dc:creator>Example Author</dc:creator></cp:coreProperties>`,
    'ppt/presentation.xml': presentation,
    'ppt/_rels/presentation.xml.rels': rels([['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'], ...[1, 2, 3, 4].map(n => [`rId${n + 1}`, 'slide', `slides/slide${n}.xml`])]),
    'ppt/slideMasters/slideMaster1.xml': master,
    'ppt/slideMasters/_rels/slideMaster1.xml.rels': rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'slideLayout', '../slideLayouts/slideLayout2.xml'], ['rId3', 'slideLayout', '../slideLayouts/slideLayout3.xml'], ['rId4', 'theme', '../theme/theme1.xml']]),
    'ppt/theme/theme1.xml': theme,
    'ppt/slides/slide1.xml': slide1, 'ppt/slides/_rels/slide1.xml.rels': slideRels(1),
    'ppt/slides/slide2.xml': slide2, 'ppt/slides/_rels/slide2.xml.rels': slideRels(2),
    'ppt/slides/slide3.xml': slide3, 'ppt/slides/_rels/slide3.xml.rels': slideRels(3, [['rId2', 'hyperlink', 'https://status.example.com/', 'External']]),
    'ppt/slides/slide4.xml': slide4, 'ppt/slides/_rels/slide4.xml.rels': slideRels(3, [['rId2', 'image', '../media/image1.png']]),
    'ppt/media/image1.png': PNG
  };
  layouts.forEach((xml, index) => {
    files[`ppt/slideLayouts/slideLayout${index + 1}.xml`] = xml;
    files[`ppt/slideLayouts/_rels/slideLayout${index + 1}.xml.rels`] = rels([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']]);
  });
  const parts = Object.fromEntries(Object.entries(files).map(([path, value]) => [path, typeof value === 'string' ? encoder.encode(value) : value]));
  return zipSync(parts, {mtime: new Date(1980, 0, 1)});
}
