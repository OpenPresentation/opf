// The Keynote check set: small OPF decks that cover the main features. Source of truth for the decks;
// build.mjs exports them with the published @openpresentation/opf-pptx and writes manifest.json.
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// The core checkout's gallery (this file sits in docs/evidence/mac-checks-20261002/keynote/lib/); OPF_GALLERY overrides.
const GALLERY = process.env.OPF_GALLERY ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../examples/gallery');
const gallery = (rel) => JSON.parse(readFileSync(path.join(GALLERY, rel), 'utf8'));
const table = (columns, rows) => ({table: {columns, rows}});
const cols = (...c) => c;

const svg = (body, w = 320, h = 200) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const svgUri = (s) => 'data:image/svg+xml;base64,' + Buffer.from(s).toString('base64');
const sampleSvg = svg('<rect width="320" height="200" fill="#EEF2FF"/><circle cx="90" cy="100" r="60" fill="#2563EB"/><rect x="170" y="50" width="110" height="100" rx="12" fill="#F59E0B"/><text x="160" y="185" font-family="Arial" font-size="18" text-anchor="middle" fill="#111827">SVG with PNG fallback</text>');

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const series = {columns: ['Month', 'North', 'South'], rows: months.map((m, i) => [m, 10 + i * 3, 14 + ((i * 5) % 9)])};
const single = {columns: ['Region', 'Revenue'], rows: [['Americas', 42], ['EMEA', 31], ['APAC', 24], ['LatAm', 11]]};
const chart = (type, data = series, extra = {}) => ({chart: {type, data, ...extra}});

export const decks = [
  {
    id: '01-latin-rich-text', title: 'Latin text and rich runs',
    checks: 'Title, subtitle and tag keep their roles; bold/italic/underline/strike runs, a colored run, a hyperlink, superscript and subscript survive; line wrapping is not changed; the heading and body fonts are the Georgia/Aptos scheme named in the manifest (a substituted font is a finding).',
    doc: {name: 'Latin text and rich runs', language: 'english-us', design: {theme: 'classic', fontScheme: 'georgia', colorScheme: 'corporate-blue'}, slides: [
      {layout: 'title', title: 'Keynote check: Latin text', subtitle: 'Fonts, runs and wrapping', tag: 'CHECK 01'},
      {title: 'Rich text runs', text: ['Plain, ', {text: 'bold', bold: true}, ', ', {text: 'italic', italic: true}, ', ', {text: 'underlined', underline: true}, ', ', {text: 'struck', strike: true}, ', ', {text: 'blue', color: '#2563EB'}, ' and a ', {text: 'link', href: 'https://openpresentation.org'}, '. Water is H', {text: '2', subscript: true}, 'O and E = mc', {text: '2', superscript: true}, '.']},
      {title: 'A long paragraph that must wrap in the same places', text: 'Open Presentation Format keeps text editable. This sentence is long enough that it wraps over several lines inside the text box, so any change of font metrics shows up as a different line break or an overflow below the box.'},
    ]},
  },
  {
    id: '02-fonts-serif-mono-code', title: 'Serif body, monospace code, quote and metric',
    checks: 'Georgia body, Courier New code lines (monospace, fixed line positions), a quote with attribution, a metric. Record every font Keynote reports as missing or substituted.',
    doc: {name: 'Serif, code, quote and metric', design: {theme: 'minimal', fontScheme: 'times-new-roman', colorScheme: 'forest-green'}, slides: [
      {title: 'Code in a monospace face', code: {source: 'function total(items) {\n  return items.reduce((a, b) => a + b, 0);\n}', language: 'javascript', filename: 'total.js'}},
      {title: 'A quote', quote: {text: 'Make the work visible before it becomes urgent.', attribution: 'Ada Example', source: 'Operations review'}},
      {title: 'A metric', metric: {value: 98, unit: '%', label: 'Retention'}},
    ]},
  },
  {
    id: '03-cjk-japanese', title: 'Japanese (East Asian script)',
    checks: 'Japanese text renders (no tofu boxes), uses the East Asian font named in the manifest (Meiryo; Keynote will substitute it, record what it picked), keeps line breaks, and the slide language is ja-JP.',
    doc: {name: '日本語のスライド', language: 'japanese', design: {theme: 'minimal'}, slides: [
      {layout: 'title', title: '市場参入の概要', subtitle: '日本市場における第一段階'},
      {title: '優先事項', items: ['顧客の課題を特定する', '現地パートナーと協力する', '四半期ごとに成果を確認する']},
      {title: '数値', table: {columns: ['地域', '売上'], rows: [['東京', '120'], ['大阪', '86'], ['名古屋', '54']]}},
    ]},
  },
  {
    id: '04-devanagari-hindi', title: 'Hindi (Devanagari, complex script)',
    checks: 'Devanagari conjuncts and matras shape correctly (no broken ligatures), the complex-script font in the manifest (Mangal) is used or replaced by a Devanagari-capable one, bullets still align.',
    doc: {name: 'हिंदी स्लाइड', language: 'hindi', design: {theme: 'minimal'}, slides: [
      {layout: 'title', title: 'ग्रामीण भुगतान परियोजना', subtitle: 'पहला चरण'},
      {title: 'मुख्य बिंदु', items: ['किसानों के लिए सरल भुगतान', 'स्थानीय बैंकों के साथ साझेदारी', 'हर महीने प्रगति की समीक्षा']},
      {title: 'संक्षेप', text: 'यह स्लाइड संयुक्ताक्षर और मात्राओं की जाँच करती है: क्षत्रिय, ज्ञान, श्री, द्वारा।'},
    ]},
  },
  {
    id: '05-rtl-arabic', title: 'Arabic (right-to-left)',
    checks: 'Paragraph direction is RTL (bullets on the right, text right-aligned), Arabic letters join, the table columns run right to left, numbers keep their order. Fonts: Arabic Typesetting (substitution expected).',
    doc: {name: 'عرض عربي', language: 'arabic', design: {theme: 'minimal'}, slides: [
      {layout: 'title', title: 'الخدمات الرقمية', subtitle: 'ملخص تنفيذي'},
      {title: 'النقاط الرئيسية', items: ['تبسيط الخدمات للمواطنين', 'تقليل وقت المعالجة إلى 5 أيام', 'قياس الرضا كل ربع سنة']},
      {title: 'المؤشرات', table: {columns: ['المؤشر', 'القيمة'], rows: [['الطلبات', '1200'], ['الرضا', '92%']]}},
    ]},
  },
  {
    id: '06-rtl-hebrew', title: 'Hebrew (right-to-left)',
    checks: 'RTL paragraph direction, bullets on the right, a Latin word and a number inside Hebrew text keep their visual order, font David or a Hebrew-capable substitute.',
    doc: {name: 'מצגת בעברית', language: 'hebrew', design: {theme: 'classic'}, slides: [
      {layout: 'title', title: 'סקירת רבעון', subtitle: 'תוצאות ותוכניות'},
      {title: 'נקודות עיקריות', items: ['ההכנסות עלו ב-18%', 'השקנו את OPF בשלושה שווקים', 'היעד הבא: 2027']},
      {title: 'ציטוט', quote: {text: 'התכנון הטוב ביותר הוא זה שנראה לעין.', attribution: 'דנה לוי'}},
    ]},
  },
  {
    id: '07-bullets-numbered', title: 'Bullets, nesting and numbered lists',
    checks: 'Bullet characters and indents per level; nested levels; native numbered lists keep their numbering style (1. / I. / a) / A.) and start values rather than literal text.',
    doc: {name: 'Bullets and numbering', design: {theme: 'minimal', fontScheme: 'arial'}, slides: [
      {title: 'Nested bullets', items: ['First level one', {text: 'Second level under one', level: 1}, {text: 'Third level', level: 2}, 'First level two']},
      {title: 'Arabic numerals', items: ['Plan', 'Build', 'Ship'], numbering: 'arabic'},
      {title: 'Roman and alphabetic', blocks: [{items: ['Alpha', 'Beta', 'Gamma'], numbering: 'roman-upper'}, {items: ['One', 'Two', 'Three'], numbering: {style: 'alpha-lower', suffix: 'paren'}}]},
      {title: 'Numbering from 4', items: ['Fourth', 'Fifth', 'Sixth'], numbering: {style: 'arabic', start: 4}},
    ]},
  },
  {
    id: '08-tables', title: 'Tables',
    checks: 'Native tables (not pictures): header row styled, column count and row count, right-aligned numbers, cell text, column widths; second slide has a wider table with a long cell that must wrap.',
    doc: {name: 'Tables', design: {theme: 'minimal', fontScheme: 'calibri'}, slides: [
      {title: 'Quarter snapshot', ...table(['Metric', 'Q3', 'Q4'], [['Revenue', '$12.4M', '$18.1M'], ['Gross margin', '68%', '72%'], ['Pipeline', '$31M', '$44M']])},
      {title: 'Wide table with wrapping', ...table(['Region', 'Owner', 'Risk', 'Mitigation'], [['Americas', 'Ana', 'Hiring slips', 'Use contractors for the first two months while the permanent search finishes'], ['EMEA', 'Ben', 'Regulation', 'Engage counsel early'], ['APAC', 'Chi', 'FX', 'Hedge quarterly']])},
    ]},
  },
  {
    id: '09-charts-core', title: 'Native chart families (core)',
    checks: 'Each slide holds a native chart object (not a picture): column, bar, line, pie, doughnut, area, scatter, radar. Keynote converts charts on import; record, per slide, whether the chart is still a chart, its type, category labels, series names, legend and axis titles. The first slide has axis titles, legend at the bottom and data labels.',
    doc: {name: 'Core charts', design: {theme: 'minimal', fontScheme: 'aptos'}, slides: [
      {title: 'Column with options', ...chart('column', series, {axisTitles: {category: 'Month', value: 'Units'}, legend: 'bottom', dataLabels: true})},
      {title: 'Bar', ...chart('bar', single)},
      {title: 'Line', ...chart('line', series)},
      {title: 'Pie', ...chart('pie', single)},
      {title: 'Doughnut', ...chart('doughnut', single)},
      {title: 'Area', ...chart('area', series)},
      {title: 'Scatter', ...chart('scatter', {columns: ['X', 'Y'], rows: [[1, 2], [2, 4], [3, 5], [4, 9], [5, 11]]})},
      {title: 'Radar', ...chart('radar', {columns: ['Skill', 'Team A', 'Team B'], rows: [['Speed', 4, 3], ['Quality', 5, 4], ['Cost', 3, 5], ['Safety', 4, 4], ['Scale', 2, 4]]})},
    ]},
  },
  {
    id: '10-charts-variants', title: 'Native chart variants (stacked, percent, markers, filled)',
    checks: 'Stacked and 100% stacked columns keep their grouping, markers on the line, filled radar, stacked area, combo-style 2x/3x series. Record the series count and grouping Keynote reports.',
    doc: {name: 'Chart variants', design: {theme: 'minimal', fontScheme: 'aptos'}, slides: [
      {title: 'Stacked column', ...chart('stacked-column-2x', series)},
      {title: '100% stacked column', ...chart('100pct-stacked-column-2x', series)},
      {title: 'Line with markers', ...chart('line-with-markers', series)},
      {title: 'Stacked area', ...chart('stacked-area-2x', series)},
      {title: 'Filled radar', ...chart('filled-radar', {columns: ['Skill', 'Team A', 'Team B'], rows: [['Speed', 4, 3], ['Quality', 5, 4], ['Cost', 3, 5], ['Safety', 4, 4]]})},
      {title: 'Clustered bar', ...chart('clustered-bar-2x', series)},
    ]},
  },
  {
    id: '11-charts-chartex', title: 'Office 2016 chartex families',
    checks: 'Waterfall, funnel, treemap, histogram, Pareto and box-and-whisker are chartex (cx:) parts. Keynote has no such chart types: record per slide what survives (editable chart, picture of the chart, or nothing), the slide title and whether the PNG/graphic fallback is shown. This deck is expected to degrade; the finding is how.',
    doc: {name: 'Chartex families', design: {theme: 'minimal', fontScheme: 'aptos'}, slides: [
      {title: 'Waterfall', ...chart('waterfall', {columns: ['Step', 'Change'], rows: [['Start', 100], ['Gain', 40], ['Loss', -25], ['Gain', 15]]})},
      {title: 'Funnel', ...chart('funnel', {columns: ['Stage', 'Count'], rows: [['Visit', 1000], ['Signup', 400], ['Trial', 150], ['Paid', 60]]})},
      {title: 'Treemap', ...chart('treemap', {columns: ['Segment', 'Share'], rows: [['A', 40], ['B', 30], ['C', 20], ['D', 10]]})},
      {title: 'Histogram', ...chart('histogram', {columns: ['Value'], rows: [[1], [2], [2], [3], [3], [3], [4], [4], [5], [8]]})},
      {title: 'Pareto', ...chart('pareto', {columns: ['Cause', 'Count'], rows: [['Late', 40], ['Wrong', 25], ['Damaged', 15], ['Other', 5]]})},
      {title: 'Box and whisker', ...chart('box-and-whisker', {columns: ['Team', 'Cycle time'], rows: [['Alpha', 5], ['Alpha', 7], ['Alpha', 9], ['Beta', 8], ['Beta', 12], ['Beta', 16]]})},
    ]},
  },
  {
    id: '12-svg-png-fallback', title: 'SVG picture with PNG fallback',
    checks: 'The picture appears (PowerPoint stores a PNG fallback plus an SVG part). Keynote does not read the SVG extension, so it should show the PNG fallback: confirm that it is shown, crisp enough, with the right aspect ratio and alt text. A PNG picture and a caption follow.',
    doc: {name: 'SVG and PNG pictures', design: {theme: 'minimal', fontScheme: 'aptos'}, slides: [
      {title: 'SVG picture', image: {src: svgUri(sampleSvg), alt: 'Blue circle and amber square with a label'}},
      {title: 'Captioned SVG', image: {src: svgUri(sampleSvg), alt: 'Shapes figure'}, caption: 'Figure 1. Shapes'},
    ]},
  },
  {
    id: '13-header-footer-numbers', title: 'Native header, footer and slide numbers',
    checks: 'Header (section name center, date right), footer (organization left, custom text center, slide number right) are present on slides 1-2, and absent on slide 3 (suppressed). Slide numbers are fields that count 1, 2, 3.',
    doc: {name: 'Header and footer', organization: [{id: 'acme', name: 'Acme Corp', role: 'primary'}], design: {theme: 'classic', fontScheme: 'calibri', header: {center: {section: true}, right: {date: '2026-10-02'}}, footer: {left: {organization: true}, center: {text: 'Confidential check deck'}, right: {slideNumber: true}}}, slides: [
      {section: 'Alpha', title: 'Furniture on', text: 'Header, footer and slide number are drawn.'},
      {section: 'Beta', title: 'Furniture again', items: ['The section name changes in the header', 'The slide number advances']},
      {section: 'Gamma', title: 'Furniture suppressed', design: {header: false, footer: false}, text: 'No header or footer on this slide.'},
    ]},
  },
  {
    id: '14-speaker-notes', title: 'Speaker notes',
    checks: 'Notes pages survive: slide 1 notes (two paragraphs), slide 2 notes with a leading tab and repeated spaces, slide 3 has none. Keynote exports presenter notes; compare the text exactly.',
    doc: {name: 'Speaker notes', design: {theme: 'minimal'}, slides: [
      {title: 'Notes slide one', text: 'See the presenter notes.', notes: 'First paragraph of notes.\nSecond paragraph, with a trailing sentence.'},
      {title: 'Notes slide two', text: 'Whitespace in notes.', notes: '\tIndented note  with  double spaces.'},
      {title: 'No notes here', text: 'This slide has no speaker notes.'},
    ]},
  },
  {
    id: '15-backgrounds', title: 'Slide backgrounds: solid, gradient, pattern, image',
    checks: 'Slide 1 solid light blue, slide 2 two-stop gradient at 45 degrees, slide 3 hatched pattern (wdUpDiag), slide 4 pattern (smGrid), slide 5 image background. Keynote may flatten patterns to a picture or a solid color; record which. Text must stay readable.',
    doc: {name: 'Backgrounds', design: {theme: 'minimal', fontScheme: 'aptos', colorScheme: {id: 'cool-horizon', primary: '#2563EB', accent: '#14B8A6', background: '#F8FAFC', text: '#0F172A'}}, slides: [
      {title: 'Solid background', design: {background: {type: 'solid', color: '#DBEAFE'}}, text: 'A solid light blue fill.'},
      {title: 'Gradient background', design: {background: {type: 'gradient', gradient: {angle: 45, stops: [{color: '#1D4ED8', position: 0}, {color: '#14B8A6', position: 1}]}}}, text: 'Two stops at 45 degrees.'},
      {title: 'Pattern: wide upward diagonal', design: {background: {type: 'pattern', pattern: {preset: 'wdUpDiag', foregroundColor: '#94A3B8', backgroundColor: '#FFFFFF'}}}, text: 'wdUpDiag, slate on white.'},
      {title: 'Pattern: small grid', design: {background: {type: 'pattern', pattern: {preset: 'smGrid', foregroundColor: '#F59E0B', backgroundColor: '#FFFBEB'}}}, text: 'smGrid, amber on cream.'},
      {title: 'Image background', design: {background: {type: 'image', image: {src: svgUri(sampleSvg), fit: 'cover'}, opacity: 0.35}}, text: 'A picture fill behind the text.'},
    ]},
  },
  {
    id: '16-footnotes-captions', title: 'Footnotes, citations and captions',
    checks: 'Superscript markers 1 and 2 after the runs, a footnote area at the bottom of slide 1 listing "1 ..." and "2 ...", the cited source listed. Slide 2: a chart caption below the chart and a table caption above the table.',
    doc: {name: 'Footnotes and captions', references: [{id: 'src-a', text: 'Example Research, Market Guide, 2026'}], design: {theme: 'minimal', fontScheme: 'georgia'}, slides: [
      {title: 'Claims with notes', text: [{text: 'Adoption doubled', cite: 'src-a'}, ' in 2025', {text: ' and keeps growing.', footnote: 'Internal forecast, not audited.'}, {text: ' Churn fell.', footnote: 'Measured on paid accounts only.'}]},
      {title: 'Captions', blocks: [{chart: {type: 'column', data: single}, caption: 'Figure 1. Revenue by region'}, {table: {columns: ['Region', 'Revenue'], rows: [['Americas', '42'], ['EMEA', '31']]}, caption: {text: 'Table 1. Source figures', position: 'above'}}]},
    ]},
  },
  {id: '17-gallery-bold', title: 'Gallery theme: bold', checks: 'Gallery example "seed-pitch-for-climate-risk-api" (theme bold, pastel-red, Tahoma, 4:3, dark background, right-aligned titles). Compare colors, 4:3 slide size and chart slide.', doc: gallery('presentation-types/seed-pitch-for-climate-risk-api.opf.json')},
  {id: '18-gallery-classic', title: 'Gallery theme: classic', checks: 'Gallery example "monthly-board-update" (theme classic). Compare colors, fonts and slide structure.', doc: gallery('presentation-types/monthly-board-update.opf.json')},
  {id: '19-gallery-dark', title: 'Gallery theme: dark', checks: 'Gallery example "fy27-budget-tradeoff-deck" (theme dark). Dark background must survive; text stays light on dark.', doc: gallery('business-functions/fy27-budget-tradeoff-deck.opf.json')},
  {id: '20-gallery-minimal-indic', title: 'Gallery theme: minimal (international example)', checks: 'Gallery example "india-rural-payments-pilot" (theme minimal, Aptos with Indic content). Check complex-script text and slide structure.', doc: gallery('international/india-rural-payments-pilot.opf.json')},
];
