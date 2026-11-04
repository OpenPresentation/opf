// LH-135, LH-136: the PPTX export writes a pricing tier's label as an editable run with cap="all" and letter spacing, in the eyebrow color, one
// native card per tier; and a one-word pillar title's accent rule as a native line shape of core's thickness (never a picture).
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {gallery} from '@openpresentation/gallery';
import {toPptx} from '../dist/index.js';

const tier = (label, value, bullets, region) => ({region, composition: {mode: 'column'}, blocks: [{metric: {value, label, description: 'per user, per month'}}, {bullets}]});
const design = {background: {type: 'solid', color: '#FFFFFF'}};
const plans = {design, slides: [{layout: 'three-column', title: 'Plans', blocks: [tier('Starter', '$12', ['Up to 10 users', 'Email support'], 'first'), tier('Team', '$29', ['Unlimited users', 'Single sign-on'], 'second'), tier('Enterprise', 'Custom', ['Audit logs', 'Roadmap input'], 'third')]}]};
const word = (title, description) => ({region: 'pillars', items: [{text: title, description}]});
const promises = {design, slides: [{layout: 'pillars', title: 'Promises', blocks: [word('Fast', 'Support answers in four minutes.'), word('Fair', 'One flat rate per user.'), word('Local', 'Engineers in your time zone.')]}]};
const xmlOf = async deck => {
  const entries = unzipSync(new Uint8Array(await toPptx(deck, {catalogs: [gallery]})));
  const xml = strFromU8(entries['ppt/slides/slide1.xml']);
  assert.equal(XMLValidator.validate(xml), true, 'slide XML');
  return {xml, entries};
};

const tiers = await xmlOf(plans);
for (const label of ['Starter', 'Team', 'Enterprise']) {
  const run = [...tiers.xml.matchAll(/<a:r>([\s\S]*?)<\/a:r>/g)].map(match => match[1]).find(body => body.includes(`<a:t>${label}</a:t>`));
  assert.ok(run, `${label} is an editable text run, as authored`);
  assert.match(run, /cap="all"/, `${label} is drawn in capitals by PowerPoint`);
  assert.match(run, /spc="\d+"/, `${label} carries its letter spacing`);
  assert.match(run, /b="1"/, `${label} is bold`);
}
assert.equal([...tiers.xml.matchAll(/<p:pic>/g)].length, 0, 'no picture');
const cards = [...tiers.xml.matchAll(/name="OPF card[^"]*"/g)].length;
assert.equal(cards, 3, 'one native card per tier');

const pillars = await xmlOf(promises);
const rules = [...pillars.xml.matchAll(/<p:(?:cxnSp|sp)>(?:(?!<\/p:(?:cxnSp|sp)>)[\s\S])*?name="OPF list rule[^"]*"(?:(?!<\/p:(?:cxnSp|sp)>)[\s\S])*?<\/p:(?:cxnSp|sp)>/g)].map(match => match[0]);
assert.equal(rules.length, 3, 'one native accent rule per pillar');
for (const rule of rules) {
  assert.match(rule, /prstGeom prst="line"/, 'a line shape');
  const width = +rule.match(/<a:ln w="(\d+)"/)[1];
  assert.ok(width >= 30000, `a rule, not a hairline (${width} EMU)`);
}
assert.equal([...pillars.xml.matchAll(/name="OPF card[^"]*"/g)].length, 0, 'no card');
assert.equal([...pillars.xml.matchAll(/<p:pic>/g)].length, 0, 'no picture');
console.log('LH-135, LH-136: tier eyebrow runs and cards, pillar accent rules as native lines (PPTX).');
