// Background colours are ColorRefs: a `var:` variable, a colour-scheme slot (accent2) or role (primary) resolves as it
// does in a table fill or a run colour, instead of silently painting white. A name the deck theme holds exactly is
// written as a:schemeClr (FF-24); a variable, or a name the theme does not hold, as the resolved literal. Text contrast
// follows the resolved colour, so a dark variable gets light text exactly like the same literal colour.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';

const decode = bytes => new TextDecoder().decode(bytes);
const scheme = {accent1: '#00AA00', accent2: '#0000CC', dark1: '#111111', light1: '#FFFFFF', primary: '#AA0000'};
const base = background => ({
  name: 'Background colours',
  variables: {brand: '#FF0000', night: '#101010'},
  design: {colorScheme: scheme, background},
  slides: [{title: 'Title', text: 'Body'}],
});
async function slideXml(deck) {
  const diagnostics = [];
  const bytes = await toPptx(deck, {provenance: false, onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {xml: decode(unzipSync(bytes)['ppt/slides/slide1.xml']), bytes, diagnostics};
}
const background = xml => xml.match(/<p:bg>[\s\S]*?<\/p:bg>/)[0];
const fillOf = xml => background(xml).replace(/<\/?p:bg>|<\/?p:bgPr>|<a:effectLst\/>/g, '');
const withoutBackground = xml => xml.replace(/<p:bg>[\s\S]*?<\/p:bg>/, '');

let checked = 0;
const solid = async (color, expected, extra = {}) => {
  const {xml} = await slideXml(base({type: 'solid', color, ...extra}));
  assert.equal(fillOf(xml), expected, `solid ${color}`);
  checked++;
};

// Solid: a held slot is a scheme colour, everything else the resolved literal.
await solid('accent2', '<a:solidFill><a:schemeClr val="accent2"></a:schemeClr></a:solidFill>');
await solid('var:brand', '<a:solidFill><a:srgbClr val="FF0000"></a:srgbClr></a:solidFill>');
await solid('primary', '<a:solidFill><a:srgbClr val="AA0000"></a:srgbClr></a:solidFill>'); // the primary role override is not accent1 in the theme
await solid('#FF0000', '<a:solidFill><a:srgbClr val="FF0000"></a:srgbClr></a:solidFill>');
await solid('var:brand', '<a:solidFill><a:srgbClr val="FF0000"><a:alpha val="50000"/></a:srgbClr></a:solidFill>', {opacity: 0.5});
await solid('accent2', '<a:solidFill><a:schemeClr val="accent2"><a:alpha val="25000"/></a:schemeClr></a:solidFill>', {opacity: 0.25});
await solid('#12345680', '<a:solidFill><a:srgbClr val="123456"><a:alpha val="50196"/></a:srgbClr></a:solidFill>');
// An unresolvable reference keeps the previous result (the slide background fallback), without throwing.
await solid('var:missing', '<a:solidFill><a:srgbClr val="FFFFFF"></a:srgbClr></a:solidFill>');

// Gradient stops and pattern colours resolve the same way.
{
  const {xml} = await slideXml(base({type: 'gradient', gradient: {angle: 90, stops: [{color: 'accent1', position: 0}, {color: 'var:brand', position: 1}]}}));
  assert.match(fillOf(xml), /<a:gs pos="0"><a:schemeClr val="accent1"><\/a:schemeClr><\/a:gs><a:gs pos="100000"><a:srgbClr val="FF0000"><\/a:srgbClr><\/a:gs>/);
  checked++;
}
{
  const {xml} = await slideXml(base({type: 'pattern', pattern: {preset: 'pct50', foregroundColor: 'accent2', backgroundColor: 'var:brand'}}));
  assert.equal(fillOf(xml), '<a:pattFill prst="pct50"><a:fgClr><a:schemeClr val="accent2"></a:schemeClr></a:fgClr><a:bgClr><a:srgbClr val="FF0000"></a:srgbClr></a:bgClr></a:pattFill>');
  checked++;
}

// A role resolves through the colour scheme alone, never through the exporter's contrast-derived chrome colours (the slide's
// default `text` is light on a dark background): a dark `text` background stays the scheme's dark text colour.
await solid('text', '<a:solidFill><a:schemeClr val="tx1"></a:schemeClr></a:solidFill>');
await solid('surface', '<a:solidFill><a:schemeClr val="bg2"></a:schemeClr></a:solidFill>');

// Text contrast follows the resolved background: a dark variable or slot gets the same text as the same literal.
for (const [reference, literal] of [['var:night', '#101010'], ['dark1', '#111111']]) {
  const byReference = withoutBackground((await slideXml(base({type: 'solid', color: reference}))).xml);
  const byLiteral = withoutBackground((await slideXml(base({type: 'solid', color: literal}))).xml);
  const onWhite = withoutBackground((await slideXml(base({type: 'solid', color: '#FFFFFF'}))).xml);
  assert.equal(byReference.replace(/<a:schemeClr val="[^"]*"/g, '<a:srgbClr val="X"'), byLiteral.replace(/<a:schemeClr val="[^"]*"/g, '<a:srgbClr val="X"'), `${reference}: slide content matches the literal`);
  assert.notEqual(byLiteral, onWhite, 'a dark background changes the text colour (the control is meaningful)');
  checked++;
}

// A slide's own background override resolves against that slide's colour scheme and the deck variables.
{
  const deck = base({type: 'solid', color: '#FFFFFF'});
  deck.slides = [{title: 'A'}, {title: 'B', design: {background: {type: 'solid', color: 'var:brand'}}}];
  const bytes = unzipSync(await toPptx(deck, {provenance: false}));
  assert.equal(fillOf(decode(bytes['ppt/slides/slide1.xml'])), '<a:solidFill><a:srgbClr val="FFFFFF"></a:srgbClr></a:solidFill>');
  assert.equal(fillOf(decode(bytes['ppt/slides/slide2.xml'])), '<a:solidFill><a:srgbClr val="FF0000"></a:srgbClr></a:solidFill>');
  checked++;
}

// The native fill is editable and survives re-import as the colour it paints.
for (const [color, expected] of [['accent2', '#0000CC'], ['var:brand', '#FF0000']]) {
  const {bytes} = await slideXml(base({type: 'solid', color}));
  const imported = await fromPptx(bytes);
  assert.deepEqual(imported.design?.background ?? imported.slides[0].design?.background, {type: 'solid', color: expected}, `${color} re-imports as its colour`);
  checked++;
}

console.log(`Background ColorRef export checks passed (${checked}).`);
