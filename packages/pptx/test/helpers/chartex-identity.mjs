// RR-105: what PowerPoint reads of a chartex chart, as digests, so a change to the mc:Fallback can prove the mc:Choice and its
// parts did not change. chartexIdentity(entries) takes fflate's unzipSync output and returns one record per chartex
// mc:AlternateContent, in slide order: the mc:Choice subtree with its drawing id and its chartEx relationship id masked (the two
// ids a change elsewhere on the slide may move), and the exact bytes of the chartEx part, its relationships, its style and
// color parts and the embedded workbook it relates.
import {createHash} from 'node:crypto';
import {strFromU8} from 'fflate';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const CHARTEX = 'http://schemas.microsoft.com/office/2014/relationships/chartEx';

function relationshipsOf(entries, part) {
  const relsPart = part.replace(/([^/]+)$/, '_rels/$1.rels');
  const map = new Map();
  if (!entries[relsPart]) return map;
  for (const [tag] of strFromU8(entries[relsPart]).matchAll(/<Relationship\b[^>]*>/g)) {
    const attribute = name => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];
    const target = attribute('Target'), segments = part.split('/').slice(0, -1);
    for (const segment of target.split('/')) segment === '..' ? segments.pop() : segment !== '.' && segments.push(segment);
    map.set(attribute('Id'), {type: attribute('Type'), path: segments.join('/'), target});
  }
  return map;
}

export function chartexIdentity(entries) {
  const slides = Object.keys(entries).filter(part => /^ppt\/slides\/slide\d+\.xml$/.test(part)).sort((a, b) => Number(/(\d+)\.xml$/.exec(a)[1]) - Number(/(\d+)\.xml$/.exec(b)[1]));
  const records = [];
  for (const slide of slides) {
    const relationships = relationshipsOf(entries, slide);
    for (const [alternate] of strFromU8(entries[slide]).matchAll(/<mc:AlternateContent\b[\s\S]*?<\/mc:AlternateContent>/g)) {
      const choice = /<mc:Choice\b[\s\S]*?<\/mc:Choice>/.exec(alternate)?.[0];
      const relId = choice && /<cx:chart\b[^>]*\br:id="([^"]+)"/.exec(choice)?.[1];
      if (!relId) continue;
      const relationship = relationships.get(relId);
      if (relationship?.type !== CHARTEX) throw new Error(`${slide}: ${relId} is not a chartEx relationship.`);
      const part = relationship.path, own = relationshipsOf(entries, part);
      const related = type => [...own.values()].filter(entry => entry.type.endsWith(`/${type}`)).map(entry => entry.path);
      const [workbook] = related('package'), [style] = related('chartStyle'), [colors] = related('chartColorStyle');
      const masked = choice.replace(/(<p:cNvPr\b[^>]*\bid=")\d+"/, '$1#"').replace(/(<cx:chart\b[^>]*\br:id=")[^"]+"/, '$1#"');
      records.push({
        slide, name: /<p:cNvPr\b[^>]*\bname="([^"]+)"/.exec(choice)?.[1], chartEx: part,
        choice: sha256(masked), part: sha256(entries[part]), rels: sha256(entries[part.replace(/([^/]+)$/, '_rels/$1.rels')]),
        style: style && sha256(entries[style]), colors: colors && sha256(entries[colors]), workbook: workbook && sha256(entries[workbook]),
      });
    }
  }
  return records;
}
