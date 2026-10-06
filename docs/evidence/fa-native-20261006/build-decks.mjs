// Builds every native-verification deck with each item's own linked opf-pptx (src/index.js of C:\opf-work\fa-NN\opf-pptx).
import {readFileSync, writeFileSync} from 'node:fs';
import {exportDeck, loadFflate, pngDataUri, OUT} from './build-lib.mjs';

const only = process.argv.slice(2);
const want = id => only.length === 0 || only.includes(id);
const built = [];
const note = (name, r) => { built.push(name); console.log(name, r.bytes.length, 'bytes', r.diagnostics.map(d => d.code).join(',') || '-'); };
const sidecar = (name, data) => writeFileSync(`${OUT}/${name}.expect.json`, JSON.stringify(data, null, 2) + '\n');

// ---------------------------------------------------------------------------------------------------------- FA-05
if (want('fa-05')) {
  const design = {theme: 'classic', fontScheme: 'roboto', colorScheme: {id: 'cool-horizon', hyperlink: '#AA3311'}};
  const doc = {
    name: 'FA-05 color roles and link colors', design,
    slides: [
      {title: 'Link with no color', text: [{text: 'Visit the '}, {text: 'OPF docs', link: 'https://example.com/docs'}, {text: ' for details.'}]},
      {title: 'Text on saturated red', design: {background: '#FF0000'}, text: [{text: 'Body text on red'}]},
      {title: 'Color roles', text: [{text: 'ref-accent ', color: 'accent'}, {text: 'ref-accent3 ', color: 'accent3'}, {text: 'ref-accent1 ', color: 'accent1'}, {text: 'ref-primary ', color: 'primary'}]},
    ],
  };
  const r = await exportDeck('fa-05', 'fa-05-color-roles', doc); note('fa-05-color-roles', r);
}

// ---------------------------------------------------------------------------------------------------------- FA-09
if (want('fa-09')) {
  const data = {columns: ['Quarter', 'North', 'South'], rows: [['Q1', 10, 5], ['Q2', 20, 8], ['Q3', 15, 12]]};
  const wf = {columns: ['Step', 'Value'], rows: [['Start', 10], ['Up', 20], ['Down', -8], ['End', 22]]};
  const altText = 'Revenue grew from 10 in Q1 to 20 in Q2 and fell to 15 in Q3.';
  const wfAlt = 'Waterfall from 10 up 20 down 8 to 22.';
  const doc = {
    name: 'FA-09 chart alt', design: {fontScheme: 'roboto'},
    slides: [
      {title: 'Classic column with alt', chart: {type: 'column', alt: altText, data}},
      {title: 'Waterfall (chartex) with alt', chart: {type: 'waterfall', alt: wfAlt, data: wf}},
      {title: 'Decorative column', chart: {type: 'column', alt: '', data}},
      {title: 'Existing extLst, alt text', chart: {type: 'column', data}},
      {title: 'Existing extLst, decorative', chart: {type: 'column', data}},
    ],
  };
  const r = await exportDeck('fa-09', 'fa-09-chart-alt', doc);
  // Slides 4 and 5: a chart frame whose p:cNvPr already carries an a:extLst (PowerPoint writes a16:creationId there). The
  // exporter never writes one itself, so the frame is built here and then passed through the item's own writeFrameAlt.
  const {unzipSync, zipSync, strFromU8, strToU8} = await loadFflate('fa-09');
  const {writeFrameAlt} = await import('file:///C:/opf-work/fa-09/opf-pptx/src/chart-alt.js');
  const entries = unzipSync(r.bytes);
  const creation = '<a:extLst><a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}"><a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" id="{00000000-0000-4000-8000-000000000001}"/></a:ext></a:extLst>';
  const patch = (slide, alt) => {
    const path = `ppt/slides/slide${slide}.xml`;
    let xml = strFromU8(entries[path]);
    xml = xml.replace(/<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/, frame => {
      const withExt = frame.replace(/(<p:cNvPr\b[^>]*?)\/>/, `$1>${creation}</p:cNvPr>`);
      if (withExt === frame) throw new Error('no self-closing cNvPr in slide ' + slide);
      return writeFrameAlt(withExt, alt);
    });
    entries[path] = strToU8(xml);
  };
  patch(4, 'Chart whose frame already had an extLst.');
  patch(5, '');
  const bytes = zipSync(entries, {level: 6, mtime: new Date('2026-10-06T00:00:00Z')});
  writeFileSync(`${OUT}/fa-09-chart-alt.pptx`, bytes);
  r.bytes = bytes;
  sidecar('fa-09-chart-alt', {alts: [altText, wfAlt, '', 'Chart whose frame already had an extLst.', '']});
  note('fa-09-chart-alt', r);
}

// ---------------------------------------------------------------------------------------------------------- FA-11
if (want('fa-11')) {
  const roadmap = JSON.parse(readFileSync('C:/opf-work/fa-11/opf/skills/opf-author/assets/roadmap-status.opf.json', 'utf8'));
  const tl = roadmap.slides[0].timeline;
  const doc = {
    name: 'FA-11 timeline status', design: roadmap.design,
    slides: [
      {title: 'Where the rollout stands', timeline: tl},
      {title: 'Same roadmap on a dark slide', design: {background: '#10151C'}, timeline: tl},
    ],
  };
  const r = await exportDeck('fa-11', 'fa-11-timeline-status', doc); note('fa-11-timeline-status', r);
  sidecar('fa-11-timeline-status', {events: tl.events.map(e => ({what: e.what, status: e.status}))});
}

// ---------------------------------------------------------------------------------------------------------- FA-12
if (want('fa-12')) {
  const quote = (w, h, who) => ({text: 'The migration took a weekend, not a quarter.', attribution: who, role: 'Head of Platform, Acme', photo: {src: pngDataUri(w, h), alt: `${who} at her desk`}});
  const doc = {
    name: 'FA-12 quote photo', design: {fontScheme: 'roboto'},
    slides: [
      {title: 'Customers (portrait photo 200x300)', quote: quote(200, 300, 'Priya Raman')},
      {title: 'Customers (landscape photo 300x200)', quote: quote(300, 200, 'Dana Okafor')},
    ],
  };
  const r = await exportDeck('fa-12', 'fa-12-quote-photo', doc); note('fa-12-quote-photo', r);
  sidecar('fa-12-quote-photo', {photos: [{alt: 'Priya Raman at her desk', width: 200, height: 300}, {alt: 'Dana Okafor at her desk', width: 300, height: 200}]});
}

// ---------------------------------------------------------------------------------------------------------- FA-13
if (want('fa-13')) {
  const source = ['const a = 1;', 'const b = 2;', 'const c = a + b;', '', 'console.log(c);', 'return c;'].join('\n');
  const doc = {
    name: 'FA-13 conveniences', language: 'en-US',
    design: {fontScheme: 'roboto', watermark: {text: 'DRAFT', opacity: 0.15}},
    slides: [
      {title: 'Text watermark', text: 'The watermark sits behind this slide.'},
      {title: 'Code highlight', code: {source, language: 'ts', highlight: [2, [3, 3], 5]}},
      {title: 'Per-run language', text: [{text: 'Default English. '}, {text: 'Bonjour le monde. ', lang: 'fr-FR'}, {text: '\u3053\u3093\u306b\u3061\u306f', lang: 'ja-JP'}]},
      {title: 'Watermark on white', text: 'White background slide.', design: {background: '#FFFFFF'}},
    ],
  };
  const r = await exportDeck('fa-13', 'fa-13-conveniences', doc); note('fa-13-conveniences', r);
  for (const [preset, tag] of [['1:1', '1x1'], ['4:5', '4x5'], ['9:16', '9x16']]) {
    const p = await exportDeck('fa-13', `fa-13-preset-${tag}`, {name: `FA-13 preset ${preset}`, design: {fontScheme: 'roboto', dimensions: preset}, slides: [{title: `Social ${preset}`, text: 'A social-feed post.'}]});
    note(`fa-13-preset-${tag}`, p);
  }
}

// ---------------------------------------------------------------------------------------------------------- FA-14
if (want('fa-14')) {
  const data = {columns: ['Quarter', 'North', 'South'], rows: [['Q1', 10, 5], ['Q2', 20, 8], ['Q3', 15, 12], ['Q4', 22, 9]]};
  const pie = {columns: ['Region', 'Share'], rows: [['EMEA', 40], ['APAC', 35], ['AMER', 25]]};
  const doc = {
    name: 'FA-14 chart highlight', design: {fontScheme: 'roboto'},
    slides: [
      {title: 'Series highlight (North)', chart: {type: 'column', data, highlight: {series: ['North']}}},
      {title: 'Category highlight (Q2)', chart: {type: 'column', data, highlight: {categories: ['Q2']}}},
      {title: 'Pie highlight (APAC)', chart: {type: 'pie', data: pie, highlight: {categories: ['APAC']}}},
      {title: 'Line, category highlight (Q3)', chart: {type: 'line', data, highlight: {categories: ['Q3']}}},
    ],
  };
  const r = await exportDeck('fa-14', 'fa-14-chart-highlight', doc); note('fa-14-chart-highlight', r);
  const {unzipSync, strFromU8} = await loadFflate('fa-14');
  const entries = unzipSync(r.bytes);
  const fills = {};
  for (let s = 1; s <= 4; s++) {
    const xml = strFromU8(entries[`ppt/charts/chart${s}.xml`]);
    const sers = [...xml.matchAll(/<c:ser>([\s\S]*?)<\/c:ser>/g)].map(m => m[1]);
    const fill = body => /<c:spPr>\s*<a:solidFill>(<a:(?:schemeClr|srgbClr) val="\w+"\/>)/.exec(body)?.[1];
    fills[`chart${s}`] = sers.map(ser => ({series: fill(ser), points: [...ser.matchAll(/<c:dPt>([\s\S]*?)<\/c:dPt>/g)].map(m => ({idx: Number(/<c:idx val="(\d+)"\/>/.exec(m[1])[1]), fill: fill(m[1])}))}));
  }
  fills.muted = /val="(\w+)"/.exec(fills.chart1[1].series)[1];
  sidecar('fa-14-chart-highlight', fills);
}

// ---------------------------------------------------------------------------------------------------------- FA-15
if (want('fa-15')) {
  const columns = ['Quarter', {name: 'Revenue', format: '$#,##0.0'}, {name: 'Margin', format: '0%'}];
  const rows = [['Q1', 12.4, 0.31], ['Q2', 18.1, 0.34], ['Q3', 21.7, 0.29], ['Q4', 26.3, 0.37]];
  const doc = {
    name: 'FA-15 combo chart', design: {fontScheme: 'roboto'},
    slides: [
      {title: 'Revenue and margin (secondary axis)', chart: {type: 'combo', data: {columns, rows}, secondaryAxis: ['Margin'], axisTitles: {category: 'Quarter', value: 'Revenue ($M)', secondary: 'Margin (%)'}, dataLabels: true, legend: 'bottom'}},
    ],
  };
  const r = await exportDeck('fa-15', 'fa-15-combo-chart', doc); note('fa-15-combo-chart', r);
}
console.log('built', built.length, 'decks');
