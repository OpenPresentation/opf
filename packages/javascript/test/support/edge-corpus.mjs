// CE-01: the documents the edge tests validate under every schema engine (the function that validates one is edge-evaluate.mjs).
// Not a test: it lives below test/ so that scripts/run-tests.mjs (which runs test/*.mjs only) never runs it.
//
// The corpus is every example deck of examples/ (JSON and Markdown), a sample of the default catalog's records (layouts, themes and
// the other kinds validate against their own schemas), and deterministic mutants of both: one or two random edits each (a key
// dropped, a value of the wrong type, an unknown key, a null). The mutants are what reach the error paths: the verbose errors, the
// best match of a oneOf and the definition each finding links to.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { records } from './catalog.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

function walk(directory) {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const file = path.join(directory, entry.name);
		return entry.isDirectory() ? walk(file) : [file];
	});
}

/** mulberry32: a small seeded generator, so the same mutants come out of every run and every engine. */
function random(seed) {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const hash = (text) => [...text].reduce((sum, character) => (Math.imul(sum, 31) + character.charCodeAt(0)) >>> 0, 7);

const WRONG = { string: [42, null, ['x']], number: ['12', null, {}], boolean: ['yes', 1, null], object: [[], 'text', null], array: [{}, 'text', 3] };
const kind = (value) => (Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value);

/** Every object and array of `value` with the path to it. */
function containers(value, trail = [], found = []) {
	if (value && typeof value === 'object') {
		found.push(trail);
		for (const [key, child] of Object.entries(value)) containers(child, [...trail, key], found);
	}
	return found;
}

/** One random edit of a copy of `document`; returns the copy. */
function mutate(document, next) {
	const copy = structuredClone(document);
	const places = containers(copy);
	const trail = places[Math.floor(next() * places.length)];
	const parent = trail.reduce((node, key) => node[key], copy);
	const keys = Object.keys(parent);
	const operation = Math.floor(next() * 4);
	if (operation === 0 && keys.length) {
		const key = keys[Math.floor(next() * keys.length)];
		if (Array.isArray(parent)) parent.splice(Number(key), 1);
		else delete parent[key];
	} else if (operation === 1 && keys.length) {
		const key = keys[Math.floor(next() * keys.length)];
		const options = WRONG[kind(parent[key])] ?? ['x', 3, []];
		parent[key] = options[Math.floor(next() * options.length)];
	} else if (operation === 2 && !Array.isArray(parent)) parent.unknownKeyForCE01 = 1;
	else if (keys.length) parent[keys[Math.floor(next() * keys.length)]] = null;
	return copy;
}

/**
 * @param {{ mutants?: number, records?: number }} options mutants per document (default 2), catalog records per kind (default 6)
 * @returns {{ id: string, filename: string, text: string }[]} the documents; `filename` tells `parse` the form of Markdown ones
 */
export function corpus({ mutants = 2, records: perKind = 6 } = {}) {
	const documents = walk(path.join(repoRoot, 'examples'))
		.filter((file) => /\.opf\.(json|md)$/.test(file))
		.sort()
		.map((file) => ({ id: path.relative(repoRoot, file).split(path.sep).join('/'), filename: path.basename(file), text: readFileSync(file, 'utf8') }));
	for (const name of ['layouts', 'themes', 'colorSchemes', 'fontSchemes', 'narratives', 'audiences', 'purposes', 'tones', 'chartTypes', 'languages', 'socialPlatforms'])
		for (const record of records(name).slice(0, perKind)) documents.push({ id: `catalog/${name}/${record.id}`, filename: `${record.id}.json`, text: JSON.stringify(record) });
	const all = [...documents];
	for (const document of documents) {
		// Markdown decks are parsed first, so a mutant of one is a mutant of the parsed deck.
		const base = document.filename.endsWith('.json') ? JSON.parse(document.text) : undefined;
		if (!base) continue;
		for (let index = 0; index < mutants; index++) {
			const next = random(hash(document.id) + index);
			let edited = mutate(base, next);
			if (next() < 0.4) edited = mutate(edited, next);
			all.push({ id: `${document.id}#mutant${index + 1}`, filename: document.filename, text: JSON.stringify(edited) });
		}
	}
	return all;
}
