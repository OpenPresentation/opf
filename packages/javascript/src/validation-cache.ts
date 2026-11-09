import { inlineDatasets } from './chart-data.js';
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

/** Plain snapshots only: no measurements, getters, functions, or shared references into a prior document. */
function snapshotValue(value: Composed): { value: Composed; bytes: number } | undefined {
	try {
		const encoded = key(value);
		// Allow overhead for the detached objects/arrays/slots as well as their strings. This is a bounded logical
		// policy, not engine-specific retained-heap measurement. Oversized compositions simply stay uncached.
		return { value: structuredClone(value), bytes: encoded.length * 4 + 256 };
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
			// All global IDs matter even when a link targets a later slide. Other slide-context dependencies are
			// conservative prefix tokens: section inheritance, citation numbering and alternating message surfaces.
			const context = key([metadata, slides.map((slide: Rec) => slide.id), options], opaque);
			const raw = slides.map((slide: Rec) => key(slide));
			const inlined = datasets ? inlineDatasets({ datasets, slides }).slides : slides;
			const data = datasets ? inlined.map((slide: Rec) => key(slide)) : raw;
			const bytes = 256 + context.length * 2 + raw.reduce((sum: number, text: string) => sum + text.length * 2 + 32, 0)
				+ (data === raw ? 0 : data.reduce((sum: number, text: string) => sum + text.length * 2 + 16, 0)) + opaque.length * 16;
			if (bytes > MAX_KEY_BYTES) throw new RangeError('Review cache shared key budget exceeded.');
			const previous = this.snapshot;
			const same = previous?.context === context && previous.opaque.length === opaque.length && opaque.every((value, i) => value === previous.opaque[i]);
			if (!same) this.clear();
			let prefixEqual = !!same;
			const prefix = raw.map((text: string, i: number) => {
				prefixEqual = prefixEqual && text === previous?.raw[i];
				return (prefixEqual && previous?.prefix[i]) || Symbol();
			});
			next = { context, opaque, raw, data, prefix, bytes };
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
