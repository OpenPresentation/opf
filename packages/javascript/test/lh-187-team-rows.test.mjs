// LH-187: a team of five or six people with side portraits (LH-132) fills its rows: each card takes its whole cell, the portrait
// grows with it (up to PORTRAIT_SIDE_FILL tall for its width) and the text keeps its size, as four people fill the card top (n23).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, PORTRAIT_SIDE_FILL } from '../dist/composition.js';
import { layouts } from './support/template-samples.mjs';

const face = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" width="100" height="140"><rect width="100" height="140" fill="#eee"/><circle cx="50" cy="56" r="22" fill="#a76"/></svg>').toString('base64')}`;
const names = [['Amara Okafor', 'Chief executive', 'Founded the company in 2016.'], ['Daniel Reyes', 'Chief technology officer', 'Leads the platform team.'], ['Mei Tanaka', 'Chief financial officer', 'Joined in 2023.'], ['Samuel Adeyemi', 'Chief operating officer', 'Runs fulfillment.'], ['Lena Fischer', 'Head of customer success', 'Built onboarding.'], ['Tomas Herrera', 'Support operations lead', 'Owns staffing.'], ['Priya Nair', 'Onboarding manager', 'Launched 60 customers.'], ['Jonas Berg', 'Solutions engineer', 'Integrations.']];
const person = ([name, role, line], portrait) => ({ region: 'people', composition: { mode: 'column' }, blocks: [{ image: { src: face, alt: name }, shape: 'ellipse', ...(portrait ? { portrait } : {}) }, { items: [{ text: name, description: `${role}\n${line}` }] }] });
const team = (count, direction) => composeSlide({ title: 'The team', blocks: names.slice(0, count).map((entry) => person(entry)) }, { layout: layouts.team, direction });
const findings = (result) => result.diagnostics.filter((entry) => entry.code === 'text-overflow' || entry.code === 'small-cell');

for (const direction of ['ltr', 'rtl']) {
  for (const count of [5, 6]) {
    test(`LH-187 (${direction}): ${count} people with side portraits take their whole cells`, () => {
      const result = team(count, direction), images = result.items.filter((item) => item.field === 'image');
      assert.equal(images.length, count);
      assert.deepEqual(findings(result), []);
      const frames = images.map((image) => image.frameBox);
      assert.ok(frames.every(Boolean), 'every person is on a card');
      // The cards of a row share one height, and the last row ends at the foot of the people region.
      for (const frame of frames) assert.ok(frames.filter((other) => Math.abs(other.y - frame.y) < 0.5).every((other) => Math.abs(other.height - frame.height) < 0.5));
      const region = result.regions.find((entry) => entry.name === 'people').box, bottom = Math.max(...frames.map((frame) => frame.y + frame.height));
      assert.ok(region.y + region.height - bottom < 2, `cards end ${region.y + region.height - bottom} px above the region's foot`);
      for (const image of images) {
        assert.ok(image.image.box.height <= image.image.box.width / PORTRAIT_SIDE_FILL + 0.5, 'never taller than PORTRAIT_SIDE_FILL');
        assert.ok(image.image.box.y >= image.frameBox.y - 0.5 && image.image.box.y + image.image.box.height <= image.frameBox.y + image.frameBox.height + 0.5, 'inside its card');
      }
    });
  }
}
