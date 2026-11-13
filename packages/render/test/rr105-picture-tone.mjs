// RR-105 (coverage findings 17 and 18): a picture background that names no tone takes the one its recolor and overlay imply, so the
// preview draws light text over a darkened picture, as the PPTX export does (its color map is dk1 on bg1); an explicit tone wins.
import assert from 'node:assert/strict';
import { toSvg } from '../dist/index.js';

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const deck = (background) => ({ $schema: 'https://openpresentation.org/schema/opf/v1', language: 'en-US', design: { background: 'light1' }, slides: [{ title: 'Harbor title', design: { background: { type: 'image', src: PIXEL, alt: 'Harbor', ...background } } }] });
const titleFill = (document) => toSvg(document, 1).match(/<text fill="([^"]+)"[^>]*>Harbor/)?.[1];

const duotone = { recolor: { dark: 'dark2', light: 'accent1' }, overlay: { color: 'dark1', opacity: 0.6, edge: 'bottom', size: 0.5 } };
assert.equal(titleFill(deck(duotone)), '#FFFFFF', 'a dark duotone draws light text');
assert.equal(titleFill(deck({ ...duotone, tone: 'light' })), '#000000', 'an explicit tone wins');
assert.equal(titleFill(deck({ overlay: { color: 'dark1', opacity: 0.4 } })), '#FFFFFF', 'a dark full-frame overlay draws light text');
assert.equal(titleFill(deck({ overlay: false })), '#000000', 'a photograph with nothing over it keeps dark text');
console.log('rr105-picture-tone: ok');
