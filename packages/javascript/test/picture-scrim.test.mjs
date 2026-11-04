import assert from 'node:assert/strict';
import test from 'node:test';
import { colorContrast, composeSlide, luminanceGrid, sampledGrays, scrimGeometry, scrimOpacity, textInkBox } from '../dist/composition.js';
import { resolveSlideContext, validate } from '../dist/index.js';

// LH-02: text on a picture background gets an automatic scrim in the slide background color, at the lowest opacity that keeps the text
// at 4.5:1 over any picture (the gray ramp from black to white), unless the author set an overlay or turned it off with `overlay: false`.

const deck = (slides, design = {}) => ({ $schema: 'https://openpresentation.org/schema/opf/v1', name: 'Scrims', language: 'en-US', design, slides });
const picture = (extra = {}) => ({ background: { type: 'image', src: 'https://example.com/photo.jpg', ...extra } });
const composed = (document, index = 0, options = {}) => {
  const context = resolveSlideContext(document, index);
  return { context, result: composeSlide(context.slide, { ...context.options, ...options }) };
};
const hex = (value) => `#${[value, value, value].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
const over = (color, under, alpha) => `#${[1, 3, 5].map((at) => Math.round(Number.parseInt(color.slice(at, at + 2), 16) * alpha + Number.parseInt(under.slice(at, at + 2), 16) * (1 - alpha)).toString(16).padStart(2, '0')).join('')}`;
/** The worst contrast of `text` over every gray from black to white seen through the scrim. */
const worstOverRamp = (text, scrim) => Math.min(...Array.from({ length: 256 }, (_, gray) => colorContrast(text, over(scrim.color, hex(gray), scrim.opacity))));
const inside = (box, area) => box.x >= area.x - 0.5 && box.y >= area.y - 0.5 && box.x + box.width <= area.x + area.width + 0.5 && box.y + box.height <= area.y + area.height + 0.5;

test('a cover over a photo passes 4.5:1 on the worst-case gray ramp with no author overlay, in both variants', () => {
  for (const tone of [undefined, 'dark', 'light']) {
    const document = deck([{ title: 'Shipping, rebuilt', subtitle: 'The harbor plan for 2027', design: picture(tone ? { tone } : {}) }]);
    const { context, result } = composed(document);
    const scrim = result.backgroundImage.scrims?.[0];
    assert.ok(scrim, `${tone}: a scrim`);
    assert.equal(scrim.color, context.options.roles.background, `${tone}: in the slide background color`);
    assert.equal(scrim.basis, 'worst-case');
    assert.ok(worstOverRamp(context.options.roles.text, scrim) >= 4.5, `${tone}: ${worstOverRamp(context.options.roles.text, scrim)}`);
    // The lowest such opacity: one hundredth less fails somewhere on the ramp.
    assert.ok(worstOverRamp(context.options.roles.text, { ...scrim, opacity: scrim.opacity - 0.01 }) < 4.5, `${tone}: the lowest opacity`);
    for (const item of result.items) assert.ok(inside(textInkBox(item), scrim.text), `${tone}: ${item.field} lies under the solid part`);
    assert.ok(scrim.stops.every((stop, index) => stop.opacity >= 0 && stop.opacity <= scrim.opacity && (index === 0 || stop.position >= scrim.stops[index - 1].position)), 'stops ascend and never pass the opacity');
    assert.ok(scrim.stops.some((stop) => stop.opacity === scrim.opacity), 'solid over the text');
  }
});

test('the form follows where the text sits: a gradient from the bottom, the top or the side, else a band', () => {
  // Text in the lower part of the slide: a gradient up from the bottom edge, solid from just above the text, fading out above it.
  const bottom = scrimGeometry({ x: 60, y: 520, width: 900, height: 120 }, 1280, 720, 24);
  assert.deepEqual([bottom.form, bottom.edge, bottom.axis], ['gradient', 'bottom', 'vertical']);
  assert.equal(bottom.box.y + bottom.box.height, 720, 'down to the slide edge');
  assert.deepEqual(bottom.solid, [496, 720]);
  assert.ok(bottom.box.y < 496, 'it fades out above the text');
  // A narrow column at the right: a gradient across from the right edge.
  const right = scrimGeometry({ x: 760, y: 120, width: 460, height: 480 }, 1280, 720, 24);
  assert.deepEqual([right.edge, right.axis, right.box.x + right.box.width], ['right', 'horizontal', 1280]);
  // Composed: a title and a short text at the top fade down from the top edge (at the role sizes, in place: LH-48 would center the
  // short text, and LH-147 move the title down with it).
  const top = composed(deck([{ title: 'What we heard', text: 'Shorter waits at the pier.', design: picture() }]), 0, { fill: false }).result.backgroundImage.scrims?.[0];
  assert.deepEqual([top.edge, top.box.y, top.stops[0].opacity, top.stops.at(-1).opacity], ['top', 0, top.opacity, 0]);
  // A centered cover title: a band across the text that fades out above and below.
  // Wave 5: LH-129 grows a cover title to its 75 px display size, which stays a band (below); the band's proportions are pinned at the
  // 54 px role size (fill: false), where its fade is longer than the solid part.
  assert.equal(composed(deck([{ title: 'Part two', design: { ...picture(), titleAlignment: 'center' } }])).result.backgroundImage.scrims?.[0].form, 'band');
  const band = composed(deck([{ title: 'Part two', design: { ...picture(), titleAlignment: 'center' } }]), 0, { fill: false }).result.backgroundImage.scrims?.[0];
  assert.equal(band.form, 'band');
  assert.equal(band.edge, undefined);
  assert.deepEqual([band.stops[0].opacity, band.stops.at(-1).opacity], [0, 0]);
  assert.equal(band.box.width, 1280);
  // The band is solid over the text and about half a line around it only, and fades out over at least the text's height, eased.
  assert.ok(band.text.y > band.box.y + band.text.height - 1 && band.box.y + band.box.height > band.text.y + band.text.height * 2 - 1, 'fades over at least the text height');
  const rising = band.stops.slice(0, band.stops.findIndex((stop) => stop.opacity === band.opacity) + 1);
  assert.ok(rising.length >= 5, 'several stops per fade');
  assert.ok(rising[1].opacity < band.opacity * rising[1].position / rising.at(-1).position, 'the fade starts gently (eased, not linear)');
  // Centered text below the middle: a gradient rising from the bottom edge instead of a band.
  const low = scrimGeometry({ x: 400, y: 420, width: 480, height: 80 }, 1280, 720, 24, 30);
  assert.deepEqual([low.form, low.edge], ['gradient', 'bottom']);
  // A left-aligned cover title and subtitle in the left half: a gradient across from the left edge.
  // Wave 5: at LH-129's grown sizes this cover's title spans more than the left half, so it takes a band across it; at its role sizes
  // (fill: false) the title and subtitle are a column in the left half.
  assert.equal(composed(deck([{ title: 'Shipping, rebuilt', subtitle: 'The plan', design: picture() }])).result.backgroundImage.scrims?.[0].form, 'band');
  const side = composed(deck([{ title: 'Shipping, rebuilt', subtitle: 'The plan', design: picture() }]), 0, { fill: false }).result.backgroundImage.scrims?.[0];
  assert.deepEqual([side.edge, side.axis, side.box.x, side.box.height], ['left', 'horizontal', 0, 720]);
});

test('an overlay of the author\'s, full-frame or a band, replaces the scrim, and overlay: false turns it off; neither moves content', () => {
  const slide = (background) => [{ title: 'Quarterly results', text: 'Revenue rose', design: picture(background) }];
  for (const background of [{ overlay: { color: 'dark1', opacity: 0.2 } }, { overlay: { color: 'dark1', opacity: 0.7, edge: 'bottom' } }, { overlay: false }])
    assert.equal(composed(deck(slide(background))).result.backgroundImage.scrims?.[0], undefined, JSON.stringify(background));
  assert.equal(validate(deck(slide({ overlay: false }))).valid, true, 'overlay: false is valid');
  assert.equal(validate(deck(slide({ overlay: true }))).valid, false, 'only false');
  const plain = composed(deck(slide({ overlay: false }))).result, scrimmed = composed(deck(slide())).result;
  assert.ok(scrimmed.backgroundImage.scrims?.[0]);
  assert.deepEqual(scrimmed.items.map((item) => [item.box, item.text?.fontSize]), plain.items.map((item) => [item.box, item.text?.fontSize]), 'the scrim moves and resizes nothing');
  // A deck-level picture is controlled by the deck's overlay.
  assert.equal(composed(deck([{ title: 'T' }], { background: { type: 'image', src: 'asset:x', overlay: false } })).result.backgroundImage.scrims?.[0], undefined);
  assert.equal(composed(deck([{ title: 'T' }], { background: { type: 'image', src: 'asset:x' } })).result.backgroundImage.scrims?.[0].path, 'design.background.overlay');
});

test('a slide with no text on the picture, and text on a card, get no scrim', () => {
  assert.equal(composed(deck([{ design: picture() }])).result.backgroundImage?.scrims?.[0], undefined);
  const carded = composed(deck([{ blocks: [{ text: 'On a card' }], design: { ...picture(), contentBox: true } }])).result;
  assert.ok(carded.items.every((item) => item.frameBox));
  assert.equal(carded.backgroundImage.scrims?.[0], undefined);
});

test('header and footer text get scrims of their own at their edges, and the muted color reads too', () => {
  const { context, result } = composed(deck([{ title: 'The trails are busier than ever', design: { ...picture({ tone: 'dark' }), titleAlignment: 'center', header: { left: { text: 'Parks review' } }, footer: { left: { text: 'Parks department' } } } }]));
  const scrims = result.backgroundImage.scrims;
  assert.equal(scrims.length, 3, 'the body\'s, the header\'s and the footer\'s');
  assert.deepEqual(scrims.map((scrim) => scrim.edge ?? scrim.form), ['band', 'top', 'bottom']);
  assert.ok(new Set(scrims.map((scrim) => scrim.opacity)).size === 1, 'one opacity');
  for (const part of result.furniture.parts) if (part.type === 'text') assert.ok(scrims.some((scrim) => inside(part.box, scrim.text)), `the ${part.kind} lies under a scrim`);
  assert.ok(worstOverRamp(context.options.roles.textSecondary, scrims[0]) >= 4.5, 'the muted color reads too');
  // Scrims along one axis whose solid parts meet are one: a title at the top and a header share the top scrim.
  const top = composed(deck([{ title: 'Results', text: 'Revenue rose.', design: { ...picture(), header: { left: { text: 'Quarterly review' } } } }]), 0, { fill: false }).result.backgroundImage.scrims;
  assert.deepEqual(top.map((scrim) => scrim.edge), ['top']);
  // A quote's attribution is drawn in the muted color.
  const quote = composed(deck([{ blocks: [{ quote: { text: 'The trails are busier than ever.', attribution: 'Park ranger' } }], design: picture({ tone: 'dark' }) }]));
  assert.ok(worstOverRamp(quote.context.options.roles.textSecondary, quote.result.backgroundImage.scrims[0]) >= 4.5);
});

test('a host that measures the picture sizes the scrim for it: none on a dark photo under light text, less on a mid one', () => {
  const grid = (value) => ({ columns: 4, rows: 4, values: Array(16).fill(value) });
  const document = deck([{ title: 'Night operations', subtitle: 'Dark picture, light title', design: picture({ tone: 'dark' }) }]);
  const worst = composed(document).result.backgroundImage.scrims?.[0];
  assert.equal(composed(document, 0, { pictureLuminance: () => grid(0.01) }).result.backgroundImage.scrims?.[0], undefined, 'a dark picture needs none');
  const mid = composed(document, 0, { pictureLuminance: () => grid(0.3) }).result.backgroundImage.scrims?.[0];
  assert.equal(mid.basis, 'sampled');
  assert.ok(mid.opacity > 0 && mid.opacity < worst.opacity, `${mid.opacity} < ${worst.opacity}`);
  assert.deepEqual(mid.grays.length, 2);
  // A recolored picture is not the one measured: the worst case.
  const recolored = deck([{ title: 'Night operations', design: picture({ tone: 'dark', recolor: 'grayscale' }) }]);
  assert.equal(composed(recolored, 0, { pictureLuminance: () => grid(0.01) }).result.backgroundImage.scrims?.[0].basis, 'worst-case');
  // scrimOpacity itself: white text over black needs nothing; over the full ramp it needs a dark scrim.
  assert.equal(scrimOpacity([{ color: '#FFFFFF', target: 4.5 }], '#000000', ['#000000']).opacity, 0);
  assert.ok(scrimOpacity([{ color: '#FFFFFF', target: 4.5 }], '#000000', [hex(0), hex(255)]).opacity > 0.4);
});

test('opf/text-on-image notes the scrim, and says contrast cannot be guaranteed when it is turned off', () => {
  const findings = (background) => validate(deck([{ title: 'Quarterly results', subtitle: 'Over a photograph', design: picture(background) }]), { only: ['accessibility'] }).findings.filter((finding) => finding.ruleId === 'opf/text-on-image');
  const [note] = findings({});
  assert.match(note.message, /automatic scrim/);
  assert.equal(note.path, '/slides/0/design/background');
  assert.ok(note.measured.scrimOpacity > 0 && note.measured.ratio >= 4.5);
  assert.equal(findings({}).length, 1, 'one note, and no contrast finding');
  const [off] = findings({ overlay: false });
  assert.match(off.message, /cannot be guaranteed/);
  assert.match(off.help, /overlay: false/);
  // The rule reads the slide's own tone: light text on a dark-toned picture.
  const [toned] = findings({ tone: 'dark' });
  assert.equal(toned.measured.textColor.toUpperCase(), '#FFFFFF');
});

test('a right-to-left slide is covered whole', () => {
  const { result } = composed({ ...deck([{ title: 'خطة الميناء', text: 'ثلاثة أطقم وجدول واحد.', design: picture() }]), language: 'ar' });
  assert.equal(result.direction, 'rtl');
  for (const item of result.items) assert.ok(inside(item.box, result.backgroundImage.scrims?.[0].text), item.field);
});

test('luminanceGrid keeps each cell\'s darkest and lightest pixel, so fine black and white detail still asks for the full scrim', () => {
  // 4 x 2 pixels, RGBA: the left half a black-and-white checker, the right half dark gray.
  const pixels = [0, 0, 0, 255, 255, 255, 255, 255, 40, 40, 40, 255, 40, 40, 40, 255, 255, 255, 255, 255, 0, 0, 0, 255, 40, 40, 40, 255, 40, 40, 40, 0];
  const grid = luminanceGrid(pixels, 4, 2, { columns: 2, rows: 1 });
  assert.deepEqual([grid.columns, grid.rows], [2, 1]);
  assert.deepEqual([grid.values[0], grid.high[0]], [0, 1], 'the checker keeps black and white');
  assert.ok(grid.values[1] > 0.02 && grid.values[1] < 0.03, 'dark gray');
  assert.equal(grid.high[1], 1, 'a transparent pixel shows the white canvas');
  assert.deepEqual(sampledGrays(grid, { left: 0, top: 0, right: 0.5, bottom: 1 }), [0, 255]);
  assert.throws(() => luminanceGrid([0, 0, 0], 2, 2), RangeError);
});
