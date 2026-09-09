import {toPptx, fromPptx} from '@openpresentation/opf-pptx';
import {renderSvgDeck} from '@openpresentation/opf-render/svg';
import {validatePresentation} from '@openpresentation/opf';
import {unzipSync} from 'fflate';

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
  const svgs = renderSvgDeck(source);
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
  check(validatePresentation(imported).valid, 'Browser reimport validates');
  check(imported.slides.length === source.slides.length, 'Slide count survives');
  check(JSON.stringify(imported).includes('Reviewer - Interview'), 'Quote source survives browser export/reimport');
  document.querySelector('main').innerHTML = svgs[1];
  check(document.querySelector('main').textContent.includes('Reviewer - Interview'), 'Quote attribution/source appears in actual preview DOM');
  output.textContent = JSON.stringify({passed: true, checks, measurement: 'browser-default; loaded fonts and native rasters verified separately'}, null, 2);
  document.title = 'PASS: native content layout';
} catch (error) {
  output.textContent = error.stack;
  document.title = 'FAIL: native content layout';
  console.error(error);
}
