import { inlineDatasets } from './chart-data.js';
import { walkCitationRuns } from './annotations.js';
import { lonePayload } from './composition.js';
import { HALF_STEPPED } from './composition-metadata.js';
import { hasBuiltinDependency } from './variables.js';
import type { Composed, CompositionMemo } from './rule-slides.js';
import type { Rec } from './rule-design.js';
import type { ValidateOptions } from './validation-types.js';

// Logical retention budgets, not a promise about a JavaScript engine's heap accounting. Keys are shared once per
// current deck, never concatenated prefixes. Cached plain-data snapshots cannot retain old document closures.
const MAX_ENTRIES = 64;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_KEY_BYTES = 2 * 1024 * 1024;

export interface ValidationCacheInfo {
	readonly entries: number;
	/** Conservative logical weight of retained keys/plain data; measure the host heap separately. */
	readonly bytes: number;
	readonly maxEntries: number;
	readonly maxBytes: number;
}

interface Snapshot {
	context: string;
	opaque: unknown[];
	raw: string[];
	data: string[];
	upstream: string[];
	prefix: symbol[];
	bytes: number;
}
interface Entry { prefix: symbol; data: string; value: Composed; bytes: number }

/** Collision-free typed encoding. Unsupported/accessor/cyclic values decline caching; validation still runs cold. */
function key(value: unknown, opaque?: unknown[]): string {
	let bytes = 0;
	const seen = new Set<object>();
	const part = (text: string) => {
		bytes += text.length * 2;
		if (bytes > MAX_KEY_BYTES) throw new RangeError('Review cache key budget exceeded.');
		return text;
	};
	const walk = (node: unknown, depth: number): string => {
		if (depth > 128) throw new RangeError('Review cache key depth exceeded.');
		if (node === null) return part('null;');
		if (node === undefined) return part('undefined;');
		if (typeof node === 'string') return part(`s${JSON.stringify(node)}`);
		if (typeof node === 'boolean') return part(node ? 'true;' : 'false;');
		if (typeof node === 'number' && Number.isFinite(node)) return part(`n${Object.is(node, -0) ? '-0' : node};`);
		if (typeof node === 'function' && opaque) { opaque.push(node); return part(`f${opaque.length};`); }
		if (typeof node !== 'object' || seen.has(node) || (!Array.isArray(node) && ![Object.prototype, null].includes(Object.getPrototypeOf(node)))) throw new TypeError('Opaque review cache input.');
		seen.add(node);
		const descriptors = Object.getOwnPropertyDescriptors(node);
		if (Array.isArray(node) ? Reflect.ownKeys(node).length !== node.length + 1 || Object.keys(node).some((name, i) => name !== String(i)) : Object.values(descriptors).some(descriptor => !descriptor.enumerable)) throw new TypeError('Non-JSON review cache input.');
		if (Reflect.ownKeys(node).some(name => typeof name === 'symbol') || Object.values(descriptors).some(descriptor => !('value' in descriptor))) throw new TypeError('Opaque review cache input.');
		const result = Array.isArray(node)
			? part('a[') + Array.from({ length: node.length }, (_, i) => Object.hasOwn(node, i) ? walk(node[i], depth + 1) : part('hole;')).join('') + part(']')
			: part('o{') + Object.keys(node).map(name => part(JSON.stringify(name)) + walk((node as Rec)[name], depth + 1)).join('') + part('}');
		seen.delete(node);
		return result;
	};
	return walk(value, 0);
}

// Called only after the exact key guard accepted these data. Never invoke an unknown host/catalog callable.
const hasCallable = (value: unknown): boolean => typeof value === 'function' || !!value && typeof value === 'object' && Object.values(value).some(hasCallable);

/** Extra eligibility guard for the NEW dependency walk, including otherwise unkeyed unused datasets. */
function boundedDependencyInput(value: unknown): boolean {
	let bytes = 0;
	const seen = new Set<object>();
	const charge = (count: number) => { bytes += count; if (bytes > MAX_KEY_BYTES) throw new RangeError('Dependency input budget exceeded.'); };
	const walk = (node: unknown, depth: number): void => {
		if (depth > 128) throw new RangeError('Dependency input depth exceeded.');
		if (typeof node === 'string') { charge(node.length * 2 + 8); return; }
		if (node === null || node === undefined || typeof node === 'boolean' || typeof node === 'number' && Number.isFinite(node)) { charge(16); return; }
		if (typeof node !== 'object' || seen.has(node)) throw new TypeError('Opaque dependency input.');
		const array = Array.isArray(node);
		if (array ? Object.getPrototypeOf(node) !== Array.prototype : ![Object.prototype, null].includes(Object.getPrototypeOf(node))) throw new TypeError('Opaque dependency prototype.');
		seen.add(node); charge(16);
		const length = array ? Object.getOwnPropertyDescriptor(node, 'length')?.value : 0;
		if (array && (!Number.isSafeInteger(length) || length < 0 || length * 8 > MAX_KEY_BYTES - bytes)) throw new RangeError('Dependency input count exceeded.');
		const names = Reflect.ownKeys(node);
		if (names.length * 8 > MAX_KEY_BYTES - bytes || array && names.length !== length + 1) throw new RangeError('Dependency input count exceeded.');
		let index = 0;
		for (const name of names) {
			if (typeof name !== 'string') throw new TypeError('Opaque dependency key.');
			const descriptor = Object.getOwnPropertyDescriptor(node, name);
			if (!descriptor || !('value' in descriptor)) throw new TypeError('Accessor dependency input.');
			if (array && name === 'length') continue;
			if (!descriptor.enumerable || array && name !== String(index++)) throw new TypeError('Non-JSON dependency input.');
			charge(name.length * 2 + 8);
			walk(descriptor.value, depth + 1);
		}
		seen.delete(node);
	};
	try { walk(value, 0); return true; } catch { return false; }
}

/** What a later slide's composition can read of this slide, beyond the global ID/order/count key. */
function upstreamKey(slide: Rec, raw: string, conservative: boolean): string {
	try {
		// This is messageKind's first necessary condition, shared with the actual surface resolver. Preserve the
		// WHOLE slide for every lone-text body, even when its length/subtitle/background/layout rules out a surface.
		// Its measured size may decide alternation; do not predict that size or classify by a catalog ID.
		if (conservative || lonePayload(slide)?.field === 'text') return raw;
		const notes: unknown[] = [];
		// The same ordered walker numberSlide uses: path, cited IDs and rich footnotes all affect later numbering.
		walkCitationRuns(slide, '', entry => { notes.push([entry.path, entry.cite, entry.footnote]); });
		// Explicit accents depend on the prior slide's design and resolved layout (including a later slide's theme).
		// Section stays conservative; current built-in resolution reads the current slide's own string, not its title.
		return key(['non-message-upstream', slide.section, slide.design, slide.layout, notes]);
	} catch { return raw; }
}

/** Plain snapshots only: no measurements, getters, functions, or shared references into a prior document. */
function snapshotValue(value: Composed): { value: Composed; bytes: number } | undefined {
	try {
		// Arrangement comparisons need this private marker while composing (including across shallow copies).
		// Review rules consume only the finished public geometry. Omit exactly that engine-owned descriptor;
		// every other symbol/accessor/prototype remains visible to the strict plain-data guard below.
		let candidate = value;
		const rootDescriptors = Object.getOwnPropertyDescriptors(value);
		const composition = rootDescriptors.composition;
		if (composition && 'value' in composition && composition.value && Object.hasOwn(composition.value, HALF_STEPPED)) {
			const marker = Object.getOwnPropertyDescriptor(composition.value, HALF_STEPPED);
			const paths = marker && 'value' in marker ? marker.value : undefined;
			if (marker?.enumerable && paths && typeof paths === 'object' && Object.getPrototypeOf(paths) === Set.prototype && Reflect.ownKeys(paths).length === 0 && Array.from(Set.prototype.values.call(paths)).every(path => typeof path === 'string')) {
				const descriptors = Object.getOwnPropertyDescriptors(composition.value);
				Reflect.deleteProperty(descriptors, HALF_STEPPED);
				rootDescriptors.composition = { ...composition, value: Object.create(Object.getPrototypeOf(composition.value), descriptors) };
				candidate = Object.create(Object.getPrototypeOf(value), rootDescriptors) as Composed;
			}
		}
		const encoded = key(candidate);
		// Allow overhead for the detached objects/arrays/slots as well as their strings. This is a bounded logical
		// policy, not engine-specific retained-heap measurement. Oversized compositions simply stay uncached.
		return { value: structuredClone(candidate), bytes: encoded.length * 4 + 256 };
	} catch { return undefined; }
}

export class ValidationCompositionCache {
	private snapshot?: Snapshot;
	private entries = new Map<number, Entry>();
	private valueBytes = 0;

	get info(): ValidationCacheInfo {
		return { entries: this.entries.size, bytes: (this.snapshot?.bytes ?? 0) + this.valueBytes, maxEntries: MAX_ENTRIES, maxBytes: MAX_BYTES };
	}
	clear(): void { this.snapshot = undefined; this.entries.clear(); this.valueBytes = 0; }
	private drop(index: number): void {
		const entry = this.entries.get(index);
		if (entry) this.valueBytes -= entry.bytes;
		this.entries.delete(index);
	}
	private trim(): void {
		while (this.entries.size > MAX_ENTRIES || this.info.bytes > MAX_BYTES) {
			const oldest = this.entries.keys().next().value;
			if (oldest === undefined) break;
			this.drop(oldest);
		}
	}

	begin(document: Rec, options: ValidateOptions): CompositionMemo | undefined {
		let next: Snapshot;
		try {
			if (![Object.prototype, null].includes(Object.getPrototypeOf(document)) || Reflect.ownKeys(document).length !== Object.keys(document).length || Object.values(Object.getOwnPropertyDescriptors(document)).some(descriptor => !('value' in descriptor))) throw new TypeError('Non-JSON review document.');
			const { slides, datasets, ...metadata } = document;
			const opaque: unknown[] = [];
			// Guard and budget the COMPLETE original global input before considering any comparison projection.
			const ids = slides.map((slide: Rec) => slide.id);
			const rawContext = key([metadata, ids, options], opaque);
			const raw = slides.map((slide: Rec) => key(slide));
			const inlined = datasets ? inlineDatasets({ datasets, slides }).slides : slides;
			const data = datasets ? inlined.map((slide: Rec) => key(slide)) : raw;
			// Measurement callbacks retain the existing deterministic-until-clear contract. Other opaque callables
			// (for example a catalog loader) keep the old full-raw prefix policy instead of assuming dependencies.
			const otherOptions = Object.fromEntries(Object.entries(options).filter(([name]) => name !== 'fonts'));
			// A declared text variable may expand to rich runs with citations, or a list/group can change payload
			// shape. Do not approximate that expansion from the raw slide; preserve the old prefix for that deck.
			const conservative = metadata.variables !== undefined || metadata.template === true || options.values !== undefined || options.template !== undefined
				|| hasCallable(metadata) || hasCallable(otherOptions);
			const upstream = slides.map((slide: Rec, i: number) => upstreamKey(slide, raw[i], conservative));
			const bytes = 256 + rawContext.length * 2 + raw.reduce((sum: number, text: string) => sum + text.length * 2 + 32, 0)
				+ (data === raw ? 0 : data.reduce((sum: number, text: string) => sum + text.length * 2 + 16, 0))
				+ upstream.reduce((sum: number, text: string, i: number) => sum + (text === raw[i] ? 16 : text.length * 2 + 16), 0) + opaque.length * 16;
			if (bytes > MAX_KEY_BYTES) throw new RangeError('Review cache shared key budget exceeded.');
			let context = rawContext;
			// Core geometry has no implicit deck-name heading. The shared variable resolver is the only route from
			// that field to drawn content. Follow its actual direct/transitive builtin reads without expansion;
			// declared/template/opaque modes keep the complete key. Unrelated builtins can stay unchanged.
			// Already-resolved text/furniture remains exact in the own-slide/global-design keys. SVG accessible
			// titles and export metadata are generated afresh outside this finished-composition cache.
			if (!conservative && metadata.template === undefined) {
				let nameUnused = false;
				try {
					// The old cache keys only consumed datasets. Bound/guard the ENTIRE raw dependency walk too;
					// an oversized or opaque unused dataset simply retains the original full-name comparison.
					if (boundedDependencyInput(document)) {
						key(document); // Only now can the existing encoder copy a bounded raw domain; it still checks encoded weight.
						nameUnused = !hasBuiltinDependency(document, 'deck.name');
					}
				} catch { /* Keep the complete original key when the dependency domain is unproven. */ }
				if (nameUnused) {
					const { name: _name, ...geometryMetadata } = metadata;
					context = key([geometryMetadata, ids, options], []);
					// Only this shorter comparison string is retained. Keep the COMPLETE original key's weight above.
				}
			}
			const previous = this.snapshot;
			const same = previous?.context === context && previous.opaque.length === opaque.length && opaque.every((value, i) => value === previous.opaque[i]);
			if (!same) this.clear();
			let prefixEqual = !!same;
			const prefix = upstream.map((text: string, i: number) => {
				prefixEqual = prefixEqual && text === previous?.upstream[i];
				return (prefixEqual && previous?.prefix[i]) || Symbol();
			});
			next = { context, opaque, raw, data, upstream, prefix, bytes };
		} catch { this.clear(); return undefined; }
		this.snapshot = next;
		for (const [i, entry] of this.entries) if (entry.prefix !== next.prefix[i] || entry.data !== next.data[i]) this.drop(i);
		this.trim();
		return (index, compute) => {
			if (this.snapshot !== next) return compute();
			const hit = this.entries.get(index);
			if (hit) {
				this.entries.delete(index);
				this.entries.set(index, hit);
				return structuredClone(hit.value);
			}
			const value = compute();
			// A failure stays cold: recovery may involve a host's newly available lazy engine/resources.
			const saved = !value.layoutError && !value.layoutDiagnostics.some(entry => entry.strict) && snapshotValue(value);
			const data = next.data[index], prefix = next.prefix[index];
			if (saved && data !== undefined && prefix !== undefined && this.snapshot === next) {
				const bytes = saved.bytes + data.length * 2 + 64;
				if (bytes + next.bytes <= MAX_BYTES) {
					this.entries.set(index, { prefix, data, value: saved.value, bytes });
					this.valueBytes += bytes;
					this.trim();
				}
			}
			return value;
		};
	}
}
