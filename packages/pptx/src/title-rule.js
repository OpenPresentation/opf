// LH-130 in the PPTX export and import: the short accent rule core sets above a cover's or section's title (`SlideComposition.titleRule`,
// core composition.ts), drawn as one native rectangle at core's box, as the preview draws it, in the tag's color (the primary, or the
// text color where the primary is under 4.5:1 on the slide). The shape carries an OPF_TITLE_RULE_V1 tag naming the title's path, and
// import consumes the tagged shape: it is the layout's drawing of the heading, which a reflowed document gets back from its layout, not
// content.
import {XMLParser} from 'fast-xml-parser';
import {attachTextTags, decodeTextTag} from './code-provenance.js';

const RULE_TAG = 'OPF_TITLE_RULE_V1', REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
const decoder = new TextDecoder('utf-8', {fatal: true}), array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];

/** Draw a slide's title rule (core `geometry.titleRule`) in `color` (a PptxGenJS color); `tags` collects its name and record. */
export function addTitleRule(slide, rule, color, tags) {
  if (!rule) return;
  const objectName = `OPF title rule ${rule.path}`;
  slide.addShape('rect', {objectName, x: rule.box.x / 96, y: rule.box.y / 96, w: rule.box.width / 96, h: rule.box.height / 96, fill: {color}, line: {type: 'none'}});
  tags.set(objectName, {v: 1, path: rule.path});
}

/** Bind each title rule to its title with a native tag (export, after the package is written). */
export function attachTitleRuleTags(entries, tags) {
  attachTextTags(entries, tags, RULE_TAG, 'opfTitleRule', 'title rule');
}

/** Import: the shapes of a slide that carry a valid OPF_TITLE_RULE_V1 tag (consumed: the layout's drawing, not content). */
export function importTitleRules(shapes, relationships, entries) {
  const consumed = new Set();
  for (const shape of shapes) {
    for (const link of array(shape['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst']?.['p:tags'])) {
      const rel = relationships.get(link['r:id']);
      if (rel?.type !== REL || rel.targetMode === 'External' || !entries[rel.path]) continue;
      try {
        for (const tag of array(parser.parse(decoder.decode(entries[rel.path]))['p:tagLst']?.['p:tag'])) {
          if (String(tag.name ?? '').toUpperCase() !== RULE_TAG) continue;
          const record = decodeTextTag(tag.val);
          if (record?.v === 1 && typeof record.path === 'string') consumed.add(shape);
        }
      } catch { /* an unreadable tag leaves the shape as ordinary content */ }
    }
  }
  return consumed;
}
