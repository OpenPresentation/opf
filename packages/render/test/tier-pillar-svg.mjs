// LH-135, LH-136: the preview draws a pricing tier's label as an eyebrow (capitals, letter spacing, the tag's color) over its price, one card
// per tier, and a one-word pillar title as a display word over an accent rule (a line of core's thickness in the tag's color), no card.
import assert from 'node:assert/strict';
import { toSvg } from './catalog-harness.mjs';

const tier = (label, value, bullets, region) => ({ region, composition: { mode: 'column' }, blocks: [{ metric: { value, label, description: 'per user, per month' } }, { bullets }] });
const design = { background: { type: 'solid', color: '#FFFFFF' } };
const plans = { design, slides: [{ layout: 'three-column', title: 'Plans', blocks: [tier('Starter', '$12', ['Up to 10 users', 'Email support'], 'first'), tier('Team', '$29', ['Unlimited users', 'Single sign-on'], 'second'), tier('Enterprise', 'Custom', ['Audit logs', 'Roadmap input'], 'third')] }] };
const word = (title, description) => ({ region: 'pillars', items: [{ text: title, description }] });
const promises = { design, slides: [{ layout: 'pillars', title: 'Promises', blocks: [word('Fast', 'Support answers in four minutes.'), word('Fair', 'One flat rate per user.'), word('Local', 'Engineers in your time zone.')] }] };

const tiers = toSvg(plans, 1);
// The label is an eyebrow: its capitals are drawn (the authored text stays "Starter" in the content), with core's letter spacing.
for (const label of ['STARTER', 'TEAM', 'ENTERPRISE']) assert.match(tiers, new RegExp(`<text\\b[^>]*letter-spacing="[\\d.]+"[^>]*>[\\s\\S]*?${label}`), `${label} drawn as an eyebrow`);
assert.ok(!tiers.includes('>Starter<'), 'the label is drawn in capitals, not as written');
// One card per tier: three rounded rectangles behind the content, not six.
const cards = [...tiers.matchAll(/<rect\b[^>]*\brx="[\d.]+"/g)].length;
assert.equal(cards, 3, 'one card per tier');
assert.ok(tiers.includes('$12') && tiers.includes('$29') && tiers.includes('Custom'), 'the prices are drawn');

const pillars = toSvg(promises, 1);
const lines = [...pillars.matchAll(/<line\b[^>]*\bstroke-width="([\d.]+)"[^>]*>/g)];
assert.equal(lines.length, 3, 'one accent rule per pillar');
assert.ok(lines.every(line => +line[1] > 2), 'a rule, not a hairline');
assert.equal([...pillars.matchAll(/<rect\b[^>]*\brx="[\d.]+"/g)].length, 0, 'no card');
for (const text of ['Fast', 'Fair', 'Local']) assert.ok(pillars.includes(`>${text}<`), `${text} drawn as written`);
console.log('LH-135, LH-136: tier eyebrows and cards, pillar words over accent rules (SVG).');
