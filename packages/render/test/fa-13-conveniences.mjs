import assert from 'node:assert/strict';
import {colorContrast, codeHighlightColors} from '@openpresentation/opf';
import {renderSvg} from '../dist/svg.js';

// FA-13: code.highlight, Watermark.text, TextRun.code, TextRun.lang and the 1:1, 4:5 and 9:16 presets in the SVG preview.

const svg = (document, options = {}) => renderSvg(document, {slideIndex: 0, trace: true, ...options});
const source = ['const a = 1;', 'const b = 2;', 'const c = a + b;', '', 'console.log(c);', 'return c;'].join('\n');
const codeDeck = highlight => ({design: {fontScheme: 'roboto'}, slides: [{title: 'Highlight', code: {source, language: 'ts', ...(highlight ? {highlight} : {})}}]});

// --- presets -------------------------------------------------------------------------------------------------------------
for (const [preset, width, height] of [['1:1', 720, 720], ['4:5', 720, 900], ['9:16', 720, 1280]]) {
  for (const dimensions of [preset, {preset}]) {
    const out = svg({design: {dimensions}, slides: [{title: 'Social', text: 'A post.'}]});
    assert.match(out, new RegExp(`viewBox="0 0 ${width} ${height}"`), preset);
  }
}

// --- code.highlight ------------------------------------------------------------------------------------------------------
{
  const plain = svg(codeDeck());
  assert.equal(plain.includes('data-opf-code-highlight'), false, 'no band without the field');
  assert.equal(svg(codeDeck(), {trace: false}), svg({...codeDeck()}, {trace: false}), 'deterministic');
  const marked = svg(codeDeck([2, [3, 3], 5]));
  const bands = [...marked.matchAll(/<rect [^>]*data-opf-code-highlight="true"[^>]*>/g)].map(match => match[0]);
  assert.equal(bands.length, 2, 'lines 2-3 are one band and line 5 another');
  const colors = codeHighlightColors({});
  for (const band of bands) assert.match(band, /fill="#[0-9A-F]{6}"/);
  const bandFill = bands[0].match(/fill="(#[0-9A-F]{6})"/)[1];
  // The bands sit between the panel and the text.
  const panel = marked.indexOf('fill="#111827"'), firstBand = marked.indexOf('data-opf-code-highlight'), firstText = marked.indexOf('data-opf-code-role="body"');
  assert.ok(panel < firstBand && firstBand < firstText, 'panel, then bands, then text');
  // Every painted colour of a marked line is >= 4.5:1 on the band, every other line >= 4.5:1 on the panel.
  const bodyLines = marked.split('<text ').slice(1).filter(chunk => chunk.slice(0, chunk.indexOf('>')).includes('data-opf-code-role="body"')).map(chunk => {
    const head = chunk.slice(0, chunk.indexOf('>') + 1), inner = head.endsWith('/>') ? '' : chunk.slice(head.length, chunk.indexOf('</text>'));
    return [head + inner, head.match(/data-opf-text-start="(\d+)"/)[1], head + inner];
  });
  assert.equal(bodyLines.length, 6);
  const lineNumber = start => source.slice(0, Number(start)).split('\n').length;
  for (const [, start, inner] of bodyLines) {
    const isMarked = [2, 3, 5].includes(lineNumber(start));
    const paints = [...inner.matchAll(/fill="(#[0-9A-F]{6})"/g)].map(match => match[1]);
    for (const paint of paints) assert.ok(colorContrast(paint, isMarked ? bandFill : '#111827') >= 4.5, `line ${lineNumber(start)} ${paint}`);
  }
  const paintsOf = number => [...bodyLines.filter(([, start]) => lineNumber(start) === number)[0][0].matchAll(/fill="(#[0-9A-F]{6})"/g)].map(match => match[1]);
  assert.notDeepEqual(paintsOf(2), paintsOf(1), 'a marked line is not painted like an unmarked one');
  assert.ok(colors.band);
  // Language-less code is dimmed and lit too.
  const plainLanguage = svg({slides: [{code: {source: 'a\nb\nc', highlight: [2]}}]});
  assert.equal(plainLanguage.match(/data-opf-code-highlight/g).length, 1);
  // Out of range marks nothing and draws nothing extra.
  assert.equal(svg(codeDeck([40])).includes('data-opf-code-highlight'), false);
  assert.equal(svg(codeDeck([40])).replace(/\s+/g, ' '), plain.replace(/\s+/g, ' '), 'an ignored highlight leaves the preview as it was');
}

// --- Watermark.text ------------------------------------------------------------------------------------------------------
{
  const deck = (watermark, slideDesign) => ({design: {fontScheme: 'roboto', ...(watermark === undefined ? {} : {watermark})}, slides: [{title: 'One', text: 'First', ...(slideDesign ? {design: slideDesign} : {})}, {title: 'Two', text: 'Second'}]});
  const out = svg(deck({text: 'DRAFT', opacity: 0.1}));
  assert.match(out, /<g [^>]*opacity="0\.1"[^>]*transform="rotate\(-30 640 360\)"/);
  assert.match(out, /<text [^>]*font-weight="700"[^>]*text-anchor="middle"[^>]*>DRAFT<\/text>/);
  assert.equal(out.indexOf('>DRAFT<') < out.indexOf('>First<'), true, 'beneath the content');
  assert.equal((out.match(/>DRAFT</g) ?? []).length, 1);
  const size = Number(out.match(/<text [^>]*font-size="([\d.]+)"[^>]*>DRAFT/)[1]);
  assert.ok(size <= 720 * 0.3 + 0.01);
  const own = svg(deck({text: 'DRAFT', opacity: 0.1}, {watermark: {text: 'FINAL', opacity: 0.2}}));
  assert.match(own, />FINAL</);
  assert.equal(own.includes('>DRAFT<'), false);
  assert.equal(svg(deck({text: 'DRAFT', opacity: 0.1}, {watermark: false})).includes('>DRAFT<'), false);
  assert.equal(svg(deck({text: 'DRAFT', opacity: 0.1}), {slideIndex: 1}).includes('>DRAFT<'), true);
  // Portrait slides keep the stamp inside the slide.
  const portrait = svg({design: {dimensions: '9:16', watermark: {text: 'CONFIDENTIAL', opacity: 0.1}}, slides: [{title: 'T'}]});
  assert.match(portrait, /rotate\(-30 360 640\)/);
  assert.ok(Number(portrait.match(/<text [^>]*font-size="([\d.]+)"[^>]*>CONFIDENTIAL/)[1]) * 7 <= 720, 'twelve capital letters fit in 70% of the width');
  // An image watermark still draws as before.
  const image = svg({design: {watermark: {src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>', opacity: 0.3}}, slides: [{title: 'T'}]});
  assert.equal(image.includes('rotate(-30'), false);
}

// --- TextRun.code and TextRun.lang ----------------------------------------------------------------------------------------
{
  const deck = text => ({design: {fontScheme: 'roboto'}, slides: [{title: 'Runs', text}]});
  const out = svg(deck(['Run ', {text: 'npm install', code: true}, ' now']));
  const run = out.match(/<(?:text|tspan) [^>]*>npm install<\/(?:text|tspan)>/)[0];
  assert.match(run, /font-family="[^"]*Roboto Mono[^"]*monospace/, 'the code family with a monospace generic');
  assert.doesNotMatch(out.match(/<(?:text|tspan) [^>]*>Run <\/(?:text|tspan)>/)[0], /Roboto Mono/);
  const own = svg(deck([{text: 'x', code: true, fontFamily: 'Courier New'}]));
  assert.match(own.match(/<(?:text|tspan) [^>]*>x<\/(?:text|tspan)>/)[0], /Courier New/);
  // Lists and tables take the code family too.
  const list = svg({design: {fontScheme: 'roboto'}, slides: [{title: 'L', items: ['Use ', ].length ? [['Use ', {text: 'git', code: true}]] : []}]});
  assert.match(list.match(/<(?:text|tspan) [^>]*>git<\/(?:text|tspan)>/)[0], /Roboto Mono/);
  const table = svg({design: {fontScheme: 'roboto'}, slides: [{title: 'T', table: {columns: ['Command'], rows: [[[{text: 'ls -la', code: true}]]]}}]});
  assert.match(table.match(/<(?:text|tspan) [^>]*>ls -la<\/(?:text|tspan)>/)[0], /Roboto Mono/);

  const languages = svg({language: 'en-US', design: {fontScheme: 'roboto'}, slides: [{title: 'Lang', text: ['Hello ', {text: 'bonjour', lang: 'fr-FR'}, ' ', {text: '日本語', lang: 'ja-JP'}, ' ', {text: '中文', lang: 'zh-CN'}]}]});
  assert.match(languages, /lang="fr-FR"[^>]*>[^<]*bonjour/);
  assert.match(languages, /<svg [^>]*lang="en-US"/, 'the deck language stays on the root');
  const ja = languages.match(/<(?:text|tspan) [^>]*lang="ja-JP"[^>]*>[\s\S]*?日本語/)[0], zh = languages.match(/<(?:text|tspan) [^>]*lang="zh-CN"[^>]*>[\s\S]*?中文/)[0];
  assert.match(ja, /Noto Sans JP/, 'Han text in a Japanese run takes the Japanese face');
  assert.match(zh, /Noto Sans SC/, 'Han text in a Simplified Chinese run takes the Simplified face');
  assert.equal(languages.match(/>Hello </) !== null && !/<[^>]*lang="[^"]*"[^>]*>Hello </.test(languages.replace(/<svg [^>]*>/, '')), true, 'a run without lang declares none of its own');
  // A run in the deck language needs no override.
  assert.equal((svg({language: 'fr-FR', slides: [{title: 'T', text: [{text: 'salut', lang: 'fr-FR'}]}]}).match(/lang="fr-FR"/g) ?? []).length >= 1, true);
}

console.log('FA-13: presets, code highlight, text watermark, inline code and run language render in the SVG preview.');
