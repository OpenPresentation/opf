import * as pptx from '@openpresentation/opf-pptx';
import * as svgEngine from '@openpresentation/opf-render/svg';
import {validate} from '@openpresentation/opf';
import {unzipSync} from 'fflate';
import {defaultCatalog} from '@openpresentation/opf/catalog';
// OPF 0.15: the gallery ids these documents name resolve from the registered default catalog (no built-in records).
const host = options => ({catalogs: [defaultCatalog], ...options});
const toPptx = (deck, options) => pptx.toPptx(deck, host(options)), fromPptx = (bytes, options) => pptx.fromPptx(bytes, host(options));
const toSvg = (deck, options) => svgEngine.toSvg(deck, host(options)), resolvePresentation = (deck, options) => svgEngine.resolvePresentation(deck, host(options));

const output = document.querySelector('pre');
let checks = 0;
const check = (value, message) => {if (!value) throw new Error(message); checks++;};
const xml = value => new DOMParser().parseFromString(value, 'application/xml');
const elements = (node, tag) => [...node.getElementsByTagName(tag)];
try {
  const source = {design: {fontScheme: 'roboto'}, slides: [
    {title: 'Metric', metric: {value: '42%', label: 'Measured result'}},
    {title: 'Quote', quote: {text: 'Keep the source visible.', attribution: 'Reviewer', source: 'Interview'}},
    {title: 'Code', code: {language: 'python', source: 'approve(change)'}},
    {title: 'Timeline', timeline: {events: [{when: 'Q1', what: 'Pilot'}, {when: 'Q2', what: 'Rollout'}]}},
  ]};
  // Exercise browser-default measurement on both sides. Loaded-font/native fidelity
  // is checked separately; this is the actual browser conversion/formatting boundary.
  const svgs = toSvg(source);
  const bytes = await toPptx(source), entries = unzipSync(bytes);
  for (const [index, svg] of svgs.entries()) {
    const native = xml(new TextDecoder().decode(entries[`ppt/slides/slide${index + 1}.xml`]));
    check(!native.querySelector('parsererror'), 'Native XML parses in the browser');
    for (const text of elements(xml(svg), 'text')) {
      const value = text.textContent;
      if (!value || value === source.slides[index].title) continue;
      const shape = elements(native, 'p:sp').find(item => elements(item, 'a:t').map(node => node.textContent).join('') === value);
      check(!!shape, 'Native payload line matches preview: ' + value);
      const properties = elements(shape, 'a:rPr')[0];
      check(Math.abs(Number(properties.getAttribute('sz')) / 100 - Number(text.getAttribute('font-size')) * .75) < .02, 'Measured font size: ' + value);
    }
    if (index === 3) check(elements(native, 'a:prstGeom').filter(node => node.getAttribute('prst') === 'ellipse').length === 2, 'Timeline has two editable native markers');
  }
  const imported = await fromPptx(bytes);
  check(validate(imported, {only: ['format']}).valid, 'Browser reimport validates');
  check(imported.slides.length === source.slides.length, 'Slide count survives');
  // The root quote payload returns as the slide's own field (content topology).
  check(JSON.stringify(imported.slides[1].quote) === JSON.stringify(source.slides[1].quote) && imported.slides[1].blocks === undefined, 'Quote text, attribution and source survive browser export/reimport (FF-57)');
  document.querySelector('main').innerHTML = svgs[1];
  check(document.querySelector('main').textContent.includes('Reviewer - Interview'), 'Quote attribution/source appears in actual preview DOM');
  for(const width of [1280,540])for(const heading of ['title','subtitle','tag']) {
    const quote={design:{fontScheme:'roboto',dimensions:{widthInches:width/96,heightInches:(width===540?960:720)/96}},slides:[{[heading]:'Known heading',quote:{text:'Keep the complete body line. '.repeat(6),attribution:'Reviewer',source:'Interview'}}]};
    const layout=resolvePresentation(quote).slides[0].geometry.items.find(item=>item.quoteLayout).quoteLayout;
    const expected=layout.parts.flatMap(part=>part.fit.lines.filter(Boolean).map(text=>({type:'text',text:[{
      text,...(part.role==='body'?{bold:true}:{}),fontSize:Math.round(part.fit.fontSize*75)/100,
      fontFamily:'Roboto',color:part.role==='body'?'#FFFFFF':'#F0F0F0'
    }]})));
    const restored=(await fromPptx(await toPptx(quote))).slides[0];
    for(const field of ['title','subtitle','tag'])check(restored[field]===(field===heading?'Known heading':undefined),'Absent heading roles stay absent: '+field);
    check(JSON.stringify(restored.quote)===JSON.stringify(quote.slides[0].quote)&&restored.blocks===undefined,'The quote payload is restored and no body/footer line is lost or promoted (FF-57)');
  }
  output.textContent = JSON.stringify({passed: true, checks, measurement: 'browser-default; loaded fonts and native rasters verified separately'}, null, 2);
  document.title = 'PASS: native content layout';
} catch (error) {
  output.textContent = error.stack;
  document.title = 'FAIL: native content layout';
  console.error(error);
}
