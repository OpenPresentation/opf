// LH-07 in the PPTX export and import: the step badges, connectors and flows core composes for a layout's `sequence` region
// (`SlideComposition.steps`, core composition.ts `ComposedSteps`), drawn as native shapes at core's geometry, as the preview draws them:
//
//   chip       a flow entry's card: a rounded rectangle in the card neutral with the card border, under the entry's text
//   connector  one line in the border color through the badge centers of a row or a list's badge column, under the badges
//   badge      an ellipse in the accent (primary) color holding its numeral as its own text: bold body face at core's size, centered,
//              in the scheme color readable on the accent (core readableSchemeColor)
//   arrow      a flow's arrow between two chips: the rightArrow (leftArrow in a right-to-left deck) preset in the accent color
//   check      LH-137: a summary tile's check mark over its badge (an ellipse without text): a custom geometry in the numeral's color
//   numeral    LH-134: a numeral beside a ruled row (core `badge.numeral`): a text box at core's line box holding the numeral, bold body face
//              at core's size, centered, in the tag's color (`context.stepNumeral`), with no fill or line
//
// The text of each step stays the list or text it is, at core's measured lines. Every shape carries an OPF_STEPS_V1 tag naming the
// sequence's path and the shape's role, and import consumes the tagged shapes: they are the layout's drawing of the sequence, which a
// reflowed document gets back from its layout, not content. A badge that draws a list entry's number in place of its marker (core
// `badge.list`) records that number, and import gives it back to the entry (restoreStepNumbers), so the list keeps its numbering.
import {XMLParser} from 'fast-xml-parser';
import {readableSchemeColor} from '@openpresentation/opf/composition';
import {attachTextTags, decodeTextTag} from './code-provenance.js';
import {autoNumScheme} from './numbered-list.js';

const STEPS_TAG = 'OPF_STEPS_V1', REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
const decoder = new TextDecoder('utf-8', {fatal: true}), array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const hex = value => String(value).replace(/^#/, '').slice(0, 6).toUpperCase();

/**
 * Draw a slide's sequences (core `geometry.steps`) before its content, in core's paint order. `context` is the slide's export context
 * (colors, roles, fonts); `tags` collects each shape's name and record for attachStepTags.
 */
// LH-146: a badge or numeral label of Latin letters, digits and punctuation ("1", "01", "iv"), written as an en-US run in a right-to-left deck.
const LATIN_NUMERAL = /^[\p{Script=Latin}\d .,:;+*/()#-]+$/u;
export function addSteps(slide, steps, context, tags, rtl = false) {
  if (!steps?.length) return;
  const accent = hex(context.colors.accent), numeral = hex(context.roles ? readableSchemeColor(`#${accent}`, context.roles).hex : '#FFFFFF');
  const card = hex(context.roles?.neutrals?.card?.hex ?? `#${context.colors.surface}`), cardBorder = hex(context.roles?.neutrals?.cardBorder?.hex ?? `#${context.colors.border}`);
  const inches = value => value / 96, box = area => ({x: inches(area.x), y: inches(area.y), w: inches(area.width), h: inches(area.height)});
  for (const [sequence, step] of steps.entries()) {
    const name = (role, index) => `OPF steps ${step.path} ${role}${index === undefined ? '' : ` ${index}`}`;
    const tag = (objectName, role, extra = {}) => tags.set(objectName, {v: 1, path: step.path, form: step.form, sequence, role, ...extra});
    for (const [index, chip] of (step.chips ?? []).entries()) {
      const objectName = name('chip', index);
      slide.addShape('roundRect', {...box(chip.box), rectRadius: inches(chip.radius), fill: {color: card}, line: {color: cardBorder, width: .75}, objectName});
      tag(objectName, 'chip', {entry: chip.path});
    }
    if (step.connector) {
      const {x1, y1, x2, y2} = step.connector, objectName = name('connector');
      // A line's box runs from its smaller to its larger coordinates; core's connector runs in reading order (right to left in RTL).
      slide.addShape('line', {x: inches(Math.min(x1, x2)), y: inches(Math.min(y1, y2)), w: inches(Math.abs(x2 - x1)), h: inches(Math.abs(y2 - y1)), line: {color: hex(context.colors.border), width: step.lineWidth * .75}, objectName});
      tag(objectName, 'connector');
    }
    for (const [index, badge] of step.badges.entries()) {
      if (badge.numeral) {
        const objectName = name('numeral', index);
        slide.addText(badge.label, {...box(badge.numeral), color: context.stepNumeral ?? accent, fontFace: context.fonts.body, fontSize: badge.fontSize * .75, bold: true,
          align: 'center', valign: 'top', margin: 0, fit: 'none', wrap: false, lineSpacingMultiple: 1, paraSpaceAfter: 0, objectName,
          // LH-146, for LH-134's numerals too: a Latin numeral in a right-to-left deck is an en-US run, drawn in the bold body face.
          ...(rtl && LATIN_NUMERAL.test(badge.label) ? {lang: 'en-US'} : {})});
        tag(objectName, 'numeral', {entry: badge.path, label: badge.label, ...(badge.list ? {list: badge.list} : {})});
        continue;
      }
      const objectName = name('badge', index);
      // LH-137: a check-mark badge (a summary list's tile): the accent ellipse, and core's check polygon over it as a custom geometry in
      // the numeral's color (points relative to its own box, in inches), each tagged as the badge's drawing.
      if (badge.check) {
        slide.addShape('ellipse', {x: inches(badge.cx - badge.radius), y: inches(badge.cy - badge.radius), w: inches(2 * badge.radius), h: inches(2 * badge.radius), fill: {color: accent}, line: {type: 'none'}, objectName});
        tag(objectName, 'badge', {entry: badge.path});
        const xs = badge.check.map(([x]) => x), ys = badge.check.map(([, y]) => y), left = Math.min(...xs), top = Math.min(...ys), checkName = name('check', index);
        slide.addShape('custGeom', {x: inches(left), y: inches(top), w: inches(Math.max(...xs) - left), h: inches(Math.max(...ys) - top),
          points: [...badge.check.map(([x, y]) => ({x: inches(x - left), y: inches(y - top)})), {close: true}], fill: {color: numeral}, line: {type: 'none'}, objectName: checkName});
        tag(checkName, 'check', {entry: badge.path});
        continue;
      }
      slide.addText(badge.label, {shape: 'ellipse', x: inches(badge.cx - badge.radius), y: inches(badge.cy - badge.radius), w: inches(2 * badge.radius), h: inches(2 * badge.radius),
        fill: {color: accent}, line: {type: 'none'}, color: numeral, fontFace: context.fonts.body, fontSize: badge.fontSize * .75, bold: true,
        align: 'center', valign: 'middle', margin: 0, fit: 'none', wrap: false, objectName,
        // LH-146: in a right-to-left deck a Latin numeral is an en-US run, not the deck language's: PowerPoint draws the digits of a run tagged
        // with a right-to-left language in the complex-script font (smaller and lighter than the bold body face the preview draws), and runs
        // name no cs face (FF-05). Left-to-right decks keep their bytes.
        ...(rtl && LATIN_NUMERAL.test(badge.label) ? {lang: 'en-US'} : {})});
      tag(objectName, 'badge', {entry: badge.path, label: badge.label, ...(badge.list ? {list: badge.list} : {})});
    }
    for (const [index, arrow] of (step.arrows ?? []).entries()) {
      const objectName = name('arrow', index);
      slide.addShape(arrow.direction === 'left' ? 'leftArrow' : 'rightArrow', {...box(arrow.box), fill: {color: accent}, line: {type: 'none'}, objectName});
      tag(objectName, 'arrow');
    }
  }
}

/** Bind each generated shape to its sequence with a native tag (export, after the package is written). */
export function attachStepTags(entries, tags) {
  attachTextTags(entries, tags, STEPS_TAG, 'opfSteps', 'step badge');
}

/**
 * Import: the shapes of a slide that carry a valid OPF_STEPS_V1 tag (consumed: the layout's drawing, not content) and the list numbers
 * their badges drew, by list path and entry index.
 */
export function importStepShapes(shapes, relationships, entries) {
  const consumed = new Set(), numbers = new Map();
  for (const shape of shapes) {
    for (const link of array(shape['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst']?.['p:tags'])) {
      const rel = relationships.get(link['r:id']);
      if (rel?.type !== REL || rel.targetMode === 'External' || !entries[rel.path]) continue;
      try {
        for (const tag of array(parser.parse(decoder.decode(entries[rel.path]))['p:tagLst']?.['p:tag'])) {
          if (String(tag.name ?? '').toUpperCase() !== STEPS_TAG) continue;
          const record = decodeTextTag(tag.val);
          if (record?.v !== 1 || typeof record.path !== 'string' || typeof record.role !== 'string') continue;
          consumed.add(shape);
          const list = record.list, number = list?.number;
          if (typeof list?.path === 'string' && Number.isInteger(list.index) && list.index >= 0 && Number.isInteger(number?.value) && number.value >= 1 && typeof number.style === 'string' && typeof number.suffix === 'string') {
            if (!numbers.has(list.path)) numbers.set(list.path, new Map());
            numbers.get(list.path).set(list.index, number);
          }
        }
      } catch { /* an unreadable tag leaves the shape as ordinary content */ }
    }
  }
  return {consumed, numbers};
}

/**
 * Import: give each list whose numbers its step badges drew (importStepShapes `numbers`) its native numbers back, as the auto-numbers
 * its entries would have had without the badges, so the list imports with its `numbering`. `items` are the slide's items once its
 * tagged list lines are merged (one paragraph per entry, named for the list's path).
 */
export function restoreStepNumbers(items, numbers) {
  if (!numbers?.size) return items;
  return items.map(item => {
    const path = /^OPF list (.+) line \d+$/.exec(item.name ?? '')?.[1], entries = path === undefined ? undefined : numbers.get(path);
    if (!entries || !item.paragraphs?.length) return item;
    // A style or suffix this exporter never writes (an edited tag) gives no scheme: the list keeps what was read.
    const schemeOf = number => { const type = autoNumScheme(number.style, number.suffix); return type.includes('undefined') ? undefined : type; };
    if ([...entries.values()].some(number => !schemeOf(number))) return item;
    return {...item, paragraphs: item.paragraphs.map((paragraph, index) => entries.has(index) ? {...paragraph, bullet: true, number: {type: schemeOf(entries.get(index)), value: entries.get(index).value}} : paragraph)};
  });
}
