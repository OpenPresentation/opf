import {exportDeck} from './build-lib.mjs';
const doc = {name: 'FA-10 rich headings', language: 'en-US', references: [{id: 'src1', text: 'Company filings, 2026'}],
  slides: [
    {title: [{text: 'Revenue grew '}, {text: '28%', bold: true, color: 'accent2'}, {text: ' in Q3', cite: 'src1'}], subtitle: [{text: 'Driven by '}, {text: 'enterprise', italic: true}], text: 'Body text.'},
    {quote: {text: [{text: 'The new deck format '}, {text: 'saved us a week', bold: true, color: 'accent1'}, {text: ' per launch.', footnote: 'Customer interview, Sept 2026'}], attribution: 'Dana Lee'}},
  ]};
const r = await exportDeck('fa-10', 'fa-10-rich-headings', doc);
console.log(r.file, r.bytes.length, r.diagnostics.map(d => d.code).join(','));
