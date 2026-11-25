// NT-04b tests: small .pptx files built in memory from a few XML parts (no binary deck in the repository). Only what
// inspect.mjs reads is written: presentation, one master and layout with list styles, slides, notes, charts.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const { zipSync, strToU8 } = createRequire(path.join(root, 'packages/pptx/package.json'))('fflate');

const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const emu = (points) => Math.round(points * 12700);
const xmlText = (text) => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');

export const xfrm = ([x, y, w, h], tag = 'a:xfrm', child = null) =>
  `<${tag}><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/>${child ? `<a:chOff x="${emu(child[0])}" y="${emu(child[1])}"/><a:chExt cx="${emu(child[2])}" cy="${emu(child[3])}"/>` : ''}</${tag}>`;
const nvPr = (ph) => (ph ? `<p:nvPr><p:ph${ph.type ? ` type="${ph.type}"` : ''}${ph.idx ? ` idx="${ph.idx}"` : ''}/></p:nvPr>` : '<p:nvPr/>');
const cNvPr = (id, name, { link, title } = {}) => `<p:cNvPr id="${id}" name="${xmlText(name)}"${title ? ` title="${xmlText(title)}"` : ''}>${link ? `<a:hlinkClick r:id="${link}"${link.startsWith('rSlide') ? ' action="ppaction://hlinksldjump"' : ''}/>` : ''}</p:cNvPr>`;

/** A paragraph: a string, or { text, bullet: "char"|"num"|"none", lvl, field, link } (link: a relationship id). */
function paragraph(entry) {
  const p = typeof entry === 'string' ? { text: entry } : entry;
  const bullet = p.bullet === 'char' ? '<a:buChar char="•"/>' : p.bullet === 'num' ? '<a:buAutoNum type="arabicPeriod"/>' : p.bullet === 'none' ? '<a:buNone/>' : '';
  const pPr = bullet || p.lvl ? `<a:pPr${p.lvl ? ` lvl="${p.lvl}"` : ''}>${bullet}</a:pPr>` : '';
  const link = p.link ? `<a:hlinkClick r:id="${p.link}"${p.link.startsWith('rSlide') ? ' action="ppaction://hlinksldjump"' : ''}/>` : '';
  const run = p.field ? `<a:fld id="{1}" type="${p.field}"><a:rPr/><a:t>${xmlText(p.text)}</a:t></a:fld>` : p.text === '' ? '' : `<a:r><a:rPr>${link}</a:rPr><a:t>${xmlText(p.text)}</a:t></a:r>`;
  return `<a:p>${pPr}${run}</a:p>`;
}

/** p:sp. options: ph, box, prst ("rect" default; "custGeom"), paragraphs (strings or objects), fill ("none"|"solid"), line, link. */
export function sp(id, name, { ph, box, prst = 'rect', paragraphs, fill, line, link, title } = {}) {
  const geometry = prst === 'custGeom' ? '<a:custGeom><a:pathLst/></a:custGeom>' : prst ? `<a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>` : '';
  const fillXml = fill === 'none' ? '<a:noFill/>' : fill === 'solid' ? '<a:solidFill><a:srgbClr val="336699"/></a:solidFill>' : '';
  const lineXml = line ? '<a:ln w="12700"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln>' : '';
  const body = paragraphs ? `<p:txBody><a:bodyPr/><a:lstStyle/>${paragraphs.map(paragraph).join('')}</p:txBody>` : '';
  return `<p:sp><p:nvSpPr>${cNvPr(id, name, { link, title })}<p:cNvSpPr/>${nvPr(ph)}</p:nvSpPr><p:spPr>${box ? xfrm(box) : ''}${geometry}${fillXml}${lineXml}</p:spPr>${body}</p:sp>`;
}

/** p:pic. options: box, crop ({l, t, r, b} in 1/1000 %), prst, title (Keynote writes a picture's title before its name). */
export function pic(id, name, { box = [10, 10, 100, 100], crop, prst = 'rect', title, link } = {}) {
  const src = crop ? `<a:srcRect${Object.entries(crop).map(([key, value]) => ` ${key}="${value}"`).join('')}/>` : '';
  const geometry = prst === 'custGeom' ? '<a:custGeom><a:pathLst/></a:custGeom>' : `<a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>`;
  return `<p:pic><p:nvPicPr>${cNvPr(id, name, { title, link })}<p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rImage"/>${src}<a:stretch/></p:blipFill><p:spPr>${xfrm(box)}${geometry}</p:spPr></p:pic>`;
}

export function cxnSp(id, name, box = [10, 10, 100, 0]) {
  return `<p:cxnSp><p:nvCxnSpPr>${cNvPr(id, name)}<p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr>${xfrm(box)}<a:prstGeom prst="line"><a:avLst/></a:prstGeom></p:spPr></p:cxnSp>`;
}

export function grpSp(id, name, box, child, members) {
  return `<p:grpSp><p:nvGrpSpPr>${cNvPr(id, name)}<p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr>${xfrm(box, 'a:xfrm', child)}</p:grpSpPr>${members.join('')}</p:grpSp>`;
}

const frame = (id, name, box, uri, data) =>
  `<p:graphicFrame><p:nvGraphicFramePr>${cNvPr(id, name)}<p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>${xfrm(box, 'p:xfrm')}<a:graphic><a:graphicData uri="${uri}">${data}</a:graphicData></a:graphic></p:graphicFrame>`;

/** A table: rows of cell texts; a cell may be { text, link } (link: a relationship id). */
export function table(id, name, box, rows, { firstRow = '1' } = {}) {
  const columns = Math.max(...rows.map((row) => row.length));
  const cell = (entry) => {
    const c = typeof entry === 'string' ? { text: entry } : entry;
    const link = c.link ? `<a:hlinkClick r:id="${c.link}"${c.link.startsWith('rSlide') ? ' action="ppaction://hlinksldjump"' : ''}/>` : '';
    return `<a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr>${link}</a:rPr><a:t>${xmlText(c.text)}</a:t></a:r></a:p></a:txBody></a:tc>`;
  };
  const tbl = `<a:tbl><a:tblPr firstRow="${firstRow}"/><a:tblGrid>${'<a:gridCol w="1000"/>'.repeat(columns)}</a:tblGrid>${rows.map((row) => `<a:tr h="100">${row.map(cell).join('')}</a:tr>`).join('')}</a:tbl>`;
  return frame(id, name, box, 'http://schemas.openxmlformats.org/drawingml/2006/table', tbl);
}

export const chartFrame = (id, name, box, rid = 'rChart1') =>
  frame(id, name, box, 'http://schemas.openxmlformats.org/drawingml/2006/chart', `<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="${rid}"/>`);
export const diagramFrame = (id, name, box) =>
  frame(id, name, box, 'http://schemas.openxmlformats.org/drawingml/2006/diagram', '<dgm:relIds xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" r:dm="rDm"/>');
export const alternate = (choice, fallback) => `<mc:AlternateContent><mc:Choice Requires="p14">${choice}</mc:Choice><mc:Fallback>${fallback}</mc:Fallback></mc:AlternateContent>`;

/** A chart part: { type: "lineChart", grouping: "stacked", series: [{ name, points }], legend: true }. */
export function chartXml({ type = 'barChart', grouping = 'clustered', barDir, series = [{ name: 'A', points: 3 }], legend = true }) {
  const ser = series
    .map(
      (entry, index) =>
        `<c:ser><c:idx val="${index}"/><c:tx><c:strRef><c:strCache><c:pt idx="0"><c:v>${xmlText(entry.name)}</c:v></c:pt></c:strCache></c:strRef></c:tx><c:val><c:numRef><c:numCache><c:ptCount val="${entry.points}"/>${Array.from({ length: entry.points }, (_, point) => `<c:pt idx="${point}"><c:v>${point}</c:v></c:pt>`).join('')}</c:numCache></c:numRef></c:val></c:ser>`,
    )
    .join('');
  return `<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart><c:plotArea><c:${type}>${barDir ? `<c:barDir val="${barDir}"/>` : ''}<c:grouping val="${grouping}"/>${ser}</c:${type}></c:plotArea>${legend ? '<c:legend><c:legendPos val="r"/></c:legend>' : ''}</c:chart></c:chartSpace>`;
}

const rels = (entries) =>
  `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${entries
    .map((entry) => `<Relationship Id="${entry.id}" Type="${REL}/${entry.type}" Target="${xmlText(entry.target)}"${entry.external ? ' TargetMode="External"' : ''}/>`)
    .join('')}</Relationships>`;

const LAYOUT = `<p:sldLayout ${NS}><p:cSld name="Title and Content"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${sp(2, 'Title 1', { ph: { type: 'title' }, box: [40, 30, 880, 60] })}${sp(3, 'Content 2', { ph: { idx: '1' }, box: [40, 120, 880, 380] })}</p:spTree></p:cSld></p:sldLayout>`;
const MASTER = `<p:sldMaster ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${sp(2, 'Title', { ph: { type: 'title' } })}${sp(3, 'Body', { ph: { type: 'body', idx: '1' } })}</p:spTree></p:cSld><p:txStyles><p:titleStyle><a:lvl1pPr><a:buNone/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:buChar char="•"/></a:lvl1pPr><a:lvl2pPr><a:buChar char="–"/></a:lvl2pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr/></p:otherStyle></p:txStyles></p:sldMaster>`;

/**
 * makePptx({ slides: [{ shapes: [xml], hidden?, notes?, links?: { rId: url | "slide:<n>" }, charts?: { rId: chartXml options } }] })
 * -> Uint8Array. Relationship ids for links: a URL, or "slide:<n>" (use an id starting with "rSlide" so the jump action is written).
 */
export function makePptx({ slides, size = [960, 540] }) {
  const files = {};
  const put = (name, text) => {
    files[name] = strToU8(text);
  };
  put('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  put('ppt/slideMasters/slideMaster1.xml', MASTER);
  put('ppt/slideMasters/_rels/slideMaster1.xml.rels', rels([{ id: 'rL', type: 'slideLayout', target: '../slideLayouts/slideLayout1.xml' }]));
  put('ppt/slideLayouts/slideLayout1.xml', LAYOUT);
  put('ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels([{ id: 'rM', type: 'slideMaster', target: '../slideMasters/slideMaster1.xml' }]));
  let chartNumber = 0;
  slides.forEach((slide, position) => {
    const number = position + 1;
    const slideRels = [{ id: 'rLayout', type: 'slideLayout', target: '../slideLayouts/slideLayout1.xml' }, { id: 'rImage', type: 'image', target: '../media/image1.png' }];
    for (const [id, target] of Object.entries(slide.links ?? {})) {
      if (target.startsWith('slide:')) slideRels.push({ id, type: 'slide', target: `slide${target.slice(6)}.xml` });
      else slideRels.push({ id, type: 'hyperlink', target, external: true });
    }
    for (const [id, options] of Object.entries(slide.charts ?? {})) {
      chartNumber += 1;
      put(`ppt/charts/chart${chartNumber}.xml`, chartXml(options));
      slideRels.push({ id, type: 'chart', target: `../charts/chart${chartNumber}.xml` });
    }
    if (slide.notes !== undefined) {
      slideRels.push({ id: 'rNotes', type: 'notesSlide', target: `../notesSlides/notesSlide${number}.xml` });
      put(`ppt/notesSlides/notesSlide${number}.xml`, `<p:notes ${NS}><p:cSld><p:spTree>${sp(2, 'Slide Image', { ph: { type: 'sldImg' } })}${sp(3, 'Notes', { ph: { type: 'body', idx: '1' }, paragraphs: slide.notes.split('\n') })}</p:spTree></p:cSld></p:notes>`);
    }
    put(
      `ppt/slides/slide${number}.xml`,
      `<?xml version="1.0" encoding="UTF-8"?><p:sld ${NS}${slide.hidden ? ' show="0"' : ''}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${slide.shapes.join('')}</p:spTree></p:cSld></p:sld>`,
    );
    put(`ppt/slides/_rels/slide${number}.xml.rels`, rels(slideRels));
  });
  put(
    'ppt/presentation.xml',
    `<p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rMaster"/></p:sldMasterIdLst><p:sldIdLst>${slides.map((_, position) => `<p:sldId id="${256 + position}" r:id="rSlide${position + 1}"/>`).join('')}</p:sldIdLst><p:sldSz cx="${emu(size[0])}" cy="${emu(size[1])}"/><p:defaultTextStyle><a:lvl1pPr/></p:defaultTextStyle></p:presentation>`,
  );
  put(
    'ppt/_rels/presentation.xml.rels',
    rels([{ id: 'rMaster', type: 'slideMaster', target: 'slideMasters/slideMaster1.xml' }, ...slides.map((_, position) => ({ id: `rSlide${position + 1}`, type: 'slide', target: `slides/slide${position + 1}.xml` }))]),
  );
  return zipSync(files);
}
