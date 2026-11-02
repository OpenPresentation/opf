import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {colorContrast, emphasisSurface} from '@openpresentation/opf/composition';
import {resolveSlideContext} from '@openpresentation/opf';
import {defaultCatalog, fromPptx, toPptx, toSvg} from './helpers/default-catalog.mjs';
import {colorsInXml, themeColorsOf, clrMapOf} from './helpers/scheme-colors.mjs';

// LH-06: the PPTX draws the emphasis surface as the preview does: a tagged card frame (`OPF card <path>`, no line) at core's box and radius
// in core's emphasisSurface fill, under the items on it, whose text is written in the surface's roles. The frame is recognized on import
// as decoration (content-card-reflow), the text comes back as ordinary text and an authored emphasis comes back on its block.
const decoder = new TextDecoder();
const long = 'Easton University Library should focus the next cycle on shifting the library from stacks-first to research services first.';
const slides = [
  {title: 'Foot band', blocks: [{text: long}, {text: long}, {text: 'Next step: name the pilot lead.'}]},
  {title: 'Pill', blocks: [{text: long}, {text: 'Signal'}]},
  {title: 'Authored group', layout: 'pillars', blocks: [{text: long}, {emphasis: true, blocks: [{metric: {value: '42%', label: 'Adoption'}}, {text: 'Up from 30% in the pilot.'}]}]},
];
let checked = 0;
for (const design of [{theme: 'classic'}, {theme: 'classic', variant: 'dark1'}]) {
  const deck = {name: 'Emphasis', design, slides};
  const zip = unzipSync(await toPptx(deck));
  const theme = themeColorsOf(decoder.decode(zip['ppt/theme/theme1.xml'])), master = clrMapOf(decoder.decode(zip['ppt/slideMasters/slideMaster1.xml']));
  const svgs = toSvg(deck, {trace: true});
  for (const [index, slide] of slides.entries()) {
    const label = `${JSON.stringify(design)} slide ${index + 1}`;
    const xml = decoder.decode(zip[`ppt/slides/slide${index + 1}.xml`]);
    const override = /<p:clrMapOvr><a:overrideClrMapping ([^>]*)\/?>/.exec(xml);
    const map = override ? Object.fromEntries([...override[1].matchAll(/(\w+)="(\w+)"/g)].map(([, key, value]) => [key, value])) : master;
    const {resolved} = resolveSlideContext(deck, index, {catalogs: [defaultCatalog]});
    const surface = emphasisSurface(resolved.colorScheme, resolved.roles);
    const path = index === 2 ? 'slides.2.blocks.1' : `slides.${index}.blocks.${slide.blocks.length - 1}`;
    const shapes = xml.split('<p:sp>');
    const frameAt = shapes.findIndex(shape => shape.includes(`name="OPF card ${path}"`));
    assert.ok(frameAt > 0, `${label}: the surface frame is exported`);
    const frame = shapes[frameAt];
    assert.match(frame, /prst="roundRect"/);
    assert.equal(colorsInXml(/<a:solidFill>([\s\S]*?)<\/a:solidFill>/.exec(frame)[1], theme, map)[0].hex, surface.fill.slice(1), `${label}: in core's fill`);
    assert.doesNotMatch(/<a:ln[^>]*>([\s\S]*?)<\/a:ln>/.exec(frame)?.[1] ?? '', /solidFill/, `${label}: no line`);
    // The text after the frame that belongs to the surface reads at 4.5:1 on its fill, and the preview draws the same fill.
    const text = shapes.slice(frameAt + 1).filter(shape => shape.includes(path) && /<a:t>/.test(shape));
    assert.ok(text.length, `${label}: text on the surface`);
    for (const shape of text) for (const run of shape.match(/<a:rPr[\s\S]*?<\/a:rPr>/g) ?? []) {
      const color = colorsInXml(run, theme, map)[0];
      if (color) assert.ok(colorContrast(`#${color.hex}`, surface.fill) >= 4.5, `${label}: ${color.hex} on ${surface.fill}`);
    }
    assert.match(svgs[index], new RegExp(`fill="${surface.fill}"[^>]*data-opf-path="${path.replaceAll('.', '\\.')}"|data-opf-path="${path.replaceAll('.', '\\.')}"[^>]*fill="${surface.fill}"`, 'i'), `${label}: the preview draws the same surface`);
    checked++;
  }
  const diagnostics = [];
  const imported = await fromPptx(await toPptx(deck), {onDiagnostic: entry => diagnostics.push(entry.code)});
  assert.equal(imported.slides.length, slides.length);
  assert.ok(diagnostics.includes('content-card-reflow'));
  assert.ok(!diagnostics.includes('invalid-card-provenance'));
  // The authored emphasis comes back through the content topology; the automatic ones are not written back.
  assert.equal(imported.slides[2].blocks[1].emphasis, true);
  assert.ok(imported.slides.slice(0, 2).every(slide => slide.blocks.every(block => block.emphasis === undefined)));
}
assert.equal(checked, 6);
console.log(`emphasis surface export: ${checked} slides`);
