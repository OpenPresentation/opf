// FA-07: TextRun.link is http(s), mailto or tel (core schema pattern). The SVG preview links all three;
// any other target is not a valid link and draws as plain text.
import assert from 'node:assert/strict';
import { renderSlideSvg } from '../dist/index.js';

const deck = link => ({ name: 'Links', slides: [{ title: 'Links', text: [{ text: 'contact us', link }] }] });
for (const link of ['https://acme.com/a?b=c', 'http://acme.com', 'mailto:hello@acme.com', 'tel:+15551234567']) {
  const svg = renderSlideSvg(deck(link), 0);
  assert.ok(svg.includes(`<a href="${link}"`), `${link} becomes an anchor`);
  assert.ok(svg.includes('rel="noopener noreferrer"'), `${link} is opened without an opener`);
}
// A scheme the schema does not allow is a validation error at the boundary and draws no anchor without validation.
for (const link of ['ftp://acme.com', 'javascript:alert(1)', 'readme.md']) {
  assert.throws(() => renderSlideSvg(deck(link), 0), error => error.code === 'invalid-opf', `${link} is rejected`);
  assert.equal(renderSlideSvg(deck(link), 0, { validate: false }).includes('<a href='), false, `${link} is not linked`);
}
console.log('Text run links passed: http, https, mailto and tel link in the SVG preview; other targets are rejected and never linked.');
