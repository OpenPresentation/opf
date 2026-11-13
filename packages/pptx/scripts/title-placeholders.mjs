#!/usr/bin/env node
// RR-105 (opf#1291): how many slides of an exported deck have a real title placeholder, the shape PowerPoint's Accessibility Checker,
// Outline view and Keynote read as the slide title. Reads PPTX files only; it does not export.
//
//   node packages/pptx/scripts/title-placeholders.mjs [--json] [--slides] <file.pptx | folder>...
//
// Per deck: slides, slides with an OPF title (a shape named `OPF heading slides.N.title line ...`), slides whose title is bound to a
// Title or Center Title placeholder (`p:ph type="title"` or `"ctrTitle"`) by tier, and the slides whose OPF title is free text boxes
// (with --slides). Tiers: one-line (a single line, no wrap), soft-wrap (native wrap, `wrap="square"`), fixed-breaks (core's lines
// joined by `a:br`). A slide without an OPF title is counted as untitled, never as missing. Folders are read for *.pptx, not recursively.
import {readdirSync, readFileSync, statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {strFromU8, unzipSync} from 'fflate';

const shapesOf = xml => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape);
const nameOf = shape => shape.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1] ?? '';
const TITLE_PLACEHOLDER = /<p:ph\b[^>]*\btype="(?:title|ctrTitle)"/;
export const TIERS = ['one-line', 'soft-wrap', 'fixed-breaks'];

/**
 * The title facts of one slide part: `titled` (an OPF title is drawn), `bound` (a title placeholder holds text), `tier` (the bound
 * title's tier, see the header) and `boxes` (title line shapes).
 */
export function slideTitle(xml) {
  const shapes = shapesOf(xml);
  const titleShapes = shapes.filter(shape => /^OPF heading slides\.\d+\.title line \d+$/.test(nameOf(shape)));
  const placeholder = shapes.find(shape => TITLE_PLACEHOLDER.test(shape) && /<a:t>[^<]*\S[^<]*<\/a:t>/.test(shape));
  const tier = !placeholder ? undefined : /<a:br\b/.test(placeholder) ? 'fixed-breaks' : /<a:bodyPr\b[^>]*\bwrap="square"/.test(placeholder) ? 'soft-wrap' : 'one-line';
  return {titled: titleShapes.length > 0 || !!placeholder, bound: !!placeholder, ...(tier ? {tier} : {}), boxes: titleShapes.length};
}

/** Per-deck counts for one PPTX: {slides, titled, bound, tiers: {one-line, soft-wrap, fixed-breaks}, unbound: [slide numbers whose title is free boxes]}. */
export function deckTitles(bytes) {
  const entries = unzipSync(bytes, {filter: file => /^ppt\/slides\/slide\d+\.xml$/.test(file.name)});
  const numbers = Object.keys(entries).map(name => Number(/slide(\d+)\.xml$/.exec(name)[1])).sort((a, b) => a - b);
  const result = {slides: numbers.length, titled: 0, bound: 0, tiers: Object.fromEntries(TIERS.map(tier => [tier, 0])), unbound: []};
  for (const number of numbers) {
    const facts = slideTitle(strFromU8(entries[`ppt/slides/slide${number}.xml`]));
    if (facts.titled) result.titled++;
    if (facts.bound) {
      result.bound++;
      result.tiers[facts.tier]++;
    } else if (facts.titled) result.unbound.push(number);
  }
  return result;
}

function files(args) {
  return args.flatMap(arg => statSync(arg).isDirectory() ? readdirSync(arg).filter(name => name.endsWith('.pptx')).sort().map(name => path.join(arg, name)) : [arg]);
}

function main(argv) {
  const json = argv.includes('--json'), slides = argv.includes('--slides');
  const inputs = files(argv.filter(arg => !arg.startsWith('--')));
  if (!inputs.length) {
    console.error('usage: title-placeholders.mjs [--json] [--slides] <file.pptx | folder>...');
    process.exitCode = 2;
    return;
  }
  const rows = inputs.map(file => ({deck: path.basename(file, '.pptx'), ...deckTitles(readFileSync(file))}));
  if (json) {
    process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
    return;
  }
  const sum = key => rows.reduce((total, row) => total + row[key], 0);
  const tier = name => rows.reduce((total, row) => total + row.tiers[name], 0);
  console.log(`| Deck | Slides | Titled | Title placeholder | One-line | Soft wrap | Fixed breaks | Free boxes |${slides ? ' Free boxes on |' : ''}`);
  console.log(`| --- | --- | --- | --- | --- | --- | --- | --- |${slides ? ' --- |' : ''}`);
  for (const row of rows) {
    const cells = [row.deck, row.slides, row.titled, row.bound, ...TIERS.map(name => row.tiers[name]), row.titled - row.bound, ...(slides ? [row.unbound.join(', ')] : [])];
    console.log(`| ${cells.join(' | ')} |`);
  }
  const totals = [`total (${rows.length} decks)`, sum('slides'), sum('titled'), sum('bound'), ...TIERS.map(tier), sum('titled') - sum('bound'), ...(slides ? [''] : [])];
  console.log(`| ${totals.join(' | ')} |`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
