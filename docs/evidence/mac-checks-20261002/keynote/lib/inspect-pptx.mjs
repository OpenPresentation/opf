// Read the facts the Keynote comparison needs out of a .pptx (an opf-pptx export or a Keynote export):
// slide order, per-slide paragraphs, tables, charts (native c: or chartex cx:), pictures, speaker notes,
// background kind, and the font families and languages used.
import path from 'node:path';

const decode = (s) => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const norm = (s) => s.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

/** Paragraph texts in document order; a:br is a space, a:fld contributes its cached text. */
export function paragraphs(xml, {raw = false} = {}) {
  const out = [];
  for (const match of xml.matchAll(/<a:p[ >][\s\S]*?<\/a:p>/g)) {
    let text = '';
    for (const part of match[0].matchAll(/<a:t>([\s\S]*?)<\/a:t>|<a:t\/>|<a:br\b[^>]*\/?>(?:<\/a:br>)?/g)) text += part[1] === undefined ? (part[0].startsWith('<a:br') ? (raw ? '\n' : ' ') : '') : decode(part[1]);
    if (!raw) text = norm(text);
    if (text) out.push(text);
  }
  return out;
}

async function text(zip, name) { const f = zip.file(name); return f ? f.async('string') : null; }
function resolve(from, target) { return target.startsWith('/') ? target.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(from), target)); }
function relationships(xml) { return xml ? [...xml.matchAll(/<Relationship\b[^>]*>/g)].map((m) => ({id: /\bId="([^"]*)"/.exec(m[0])?.[1], type: /\bType="([^"]*)"/.exec(m[0])?.[1] ?? '', target: /\bTarget="([^"]*)"/.exec(m[0])?.[1] ?? ''})) : []; }

export function chartKinds(xml) {
  if (/<cx:chartSpace/.test(xml)) return {family: 'chartex', kinds: [...new Set([...xml.matchAll(/layoutId="([^"]+)"/g)].map((m) => m[1]))]};
  const kinds = [];
  for (const m of xml.matchAll(/<c:(area|area3D|bar|bar3D|bubble|doughnut|line|line3D|ofPie|pie|pie3D|radar|scatter|stock|surface|surface3D)Chart>([\s\S]*?)<\/c:\1Chart>/g)) {
    const body = m[2];
    const dir = /<c:barDir val="(\w+)"/.exec(body)?.[1], grouping = /<c:grouping val="(\w+)"/.exec(body)?.[1], style = /<c:radarStyle val="(\w+)"/.exec(body)?.[1];
    kinds.push([m[1], dir, grouping, style].filter(Boolean).join(':'));
  }
  return {family: 'native', kinds};
}

export async function inspectPptx(zip) {
  const presentation = await text(zip, 'ppt/presentation.xml');
  const presRels = relationships(await text(zip, 'ppt/_rels/presentation.xml.rels'));
  const slideParts = [...(presentation ?? '').matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)].map((m) => resolve('ppt/presentation.xml', presRels.find((r) => r.id === m[1])?.target ?? ''));
  const fonts = new Set(), langs = new Set(), slides = [], charts = [];
  let pictures = 0, notesSlides = 0;
  const collect = (xml) => {
    for (const m of xml.matchAll(/<a:(latin|ea|cs)\b[^>]*\btypeface="([^"]+)"/g)) if (!m[2].startsWith('+')) fonts.add(m[2]);
    for (const m of xml.matchAll(/\blang="([A-Za-z-]+)"/g)) langs.add(m[1]);
  };
  for (const [index, part] of slideParts.entries()) {
    const xml = await text(zip, part) ?? '';
    collect(xml);
    const rels = relationships(await text(zip, path.posix.join(path.posix.dirname(part), '_rels', path.posix.basename(part) + '.rels')));
    const tableXml = [...xml.matchAll(/<a:tbl>[\s\S]*?<\/a:tbl>/g)].map((m) => m[0]);
    const tables = tableXml.map((t) => ({rows: (t.match(/<a:tr\b/g) ?? []).length, columns: (t.match(/<a:gridCol\b/g) ?? []).length, cells: [...t.matchAll(/<a:tc\b[\s\S]*?<\/a:tc>/g)].map((c) => paragraphs(c[0]).join(' / '))}));
    const body = xml.replace(/<a:tbl>[\s\S]*?<\/a:tbl>/g, '');
    const slideCharts = [];
    for (const rel of rels) {
      if (/\/chart$|\/chartEx$/.test(rel.type) || /charts\/chart/i.test(rel.target)) {
        const chartPart = resolve(part, rel.target), chartXml = await text(zip, chartPart);
        if (chartXml) { const kinds = chartKinds(chartXml); slideCharts.push(kinds); charts.push({slide: index + 1, ...kinds}); }
      }
    }
    let notes = null, notesExact = null;
    const notesRel = rels.find((r) => /\/notesSlide$/.test(r.type));
    if (notesRel) {
      const nx = await text(zip, resolve(part, notesRel.target)) ?? '';
      notesSlides++;
      // The body placeholder carries the notes; the slide image and number placeholders do not.
      const shapes = [...nx.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map((m) => m[0]).filter((s) => /<p:ph\b[^>]*type="body"/.test(s));
      notes = shapes.flatMap((s) => paragraphs(s));
      notesExact = shapes.flatMap((s) => paragraphs(s, {raw: true}));
    }
    const picturesHere = (xml.match(/<p:pic>/g) ?? []).length;
    pictures += picturesHere;
    const bg = /<p:bg>([\s\S]*?)<\/p:bg>/.exec(xml)?.[1] ?? '';
    const bgKind = !bg ? 'inherit' : /<a:pattFill\b[^>]*prst="(\w+)"/.exec(bg) ? 'pattern:' + /<a:pattFill\b[^>]*prst="(\w+)"/.exec(bg)[1] : /<a:gradFill/.test(bg) ? 'gradient' : /<a:blipFill/.test(bg) ? 'image' : /<a:solidFill/.test(bg) ? 'solid' : /<p:bgRef/.test(bg) ? 'theme' : 'other';
    slides.push({
      paragraphs: paragraphs(body),
      tables,
      charts: slideCharts,
      pictures: picturesHere,
      hasSvgPicture: /asvg:svgBlip/.test(xml),
      notes,
      notesExact,
      background: bgKind,
    });
  }
  for (const name of Object.keys(zip.files)) if (/^ppt\/theme\/theme\d+\.xml$/.test(name)) collect(await text(zip, name));
  return {slideCount: slideParts.length, slides, charts, pictures, notesSlides, fonts: [...fonts].sort(), languages: [...langs].sort()};
}
