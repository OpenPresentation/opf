import {
	getNodePath,
	parseTree,
	printParseErrorCode,
	type Node,
	type ParseError,
} from 'jsonc-parser';
import type { Finding, FindingLocation } from './generated/types/finding.js';
import { finding, parts, pointer } from './check-document.js';

/**
 * The text half of `validate(string)`: strict JSON syntax, duplicate keys and the source range of any path. Internal
 * module. A string is JSON text and nothing else: it is never sniffed for YAML or Markdown, only hinted about.
 */

export interface ParsedSource {
	/** The parsed document, when the text is JSON. */
	value?: unknown;
	/** `opf/json-syntax` findings. Empty when the text parsed. */
	syntax: Finding[];
	/** `opf/duplicate-key` findings. Empty when the text did not parse. */
	duplicates: Finding[];
	/** The source range of a JSON Pointer, or of its nearest ancestor when the value is missing. Undefined without a tree. */
	locate(path: string): FindingLocation | undefined;
}

const YAML_START = /^[A-Za-z_][\w.-]*\s*:(?:\s|$)/;

/** What the text looks like when it is not JSON, so the finding can point at the right converter. */
function hint(source: string): string {
	const text = source.replace(/^\uFEFF/, '').trimStart();
	if (text.startsWith('{') || text.startsWith('[') || text === '') return '';
	if (text.startsWith('---') || (!text.startsWith('#') && YAML_START.test(text)))
		return ' This looks like YAML: read it with fromYaml, then validate the presentation it returns.';
	if (text.startsWith('#')) return ' This looks like Markdown: read it with fromMarkdown, then validate the presentation it returns.';
	return '';
}

export function parseSource(source: string): ParsedSource {
	const errors: ParseError[] = [],
		tree = parseTree(
			source.startsWith('\uFEFF') ? ' ' + source.slice(1) : source,
			errors,
			{
				disallowComments: true,
				allowTrailingComma: false,
				allowEmptyContent: false,
			},
		);
	const lineStarts = [0];
	for (let i = 0; i < source.length; i++) {
		if (source[i] === '\r') {
			if (source[i + 1] === '\n') i++;
			lineStarts.push(i + 1);
		} else if (source[i] === '\n') lineStarts.push(i + 1);
	}
	const location = (offset: number, length: number): FindingLocation => {
		let lo = 0,
			hi = lineStarts.length;
		while (lo + 1 < hi) {
			const mid = (lo + hi) >> 1;
			if ((lineStarts[mid] ?? 0) <= offset) lo = mid;
			else hi = mid;
		}
		return {
			offset,
			length,
			line: lo + 1,
			column: offset - (lineStarts[lo] ?? 0) + 1,
		};
	};
	if (errors.length || !tree) {
		const note = hint(source);
		return {
			syntax: errors.map((error, index) =>
				finding('opf/json-syntax', {
					path: '',
					message: printParseErrorCode(error.error),
					help: `Repair the JSON syntax at this source range. No content or whitespace has been rewritten.${index === 0 ? note : ''}`,
					location: location(error.offset, error.length),
				}),
			),
			duplicates: [],
			locate: () => undefined,
		};
	}
	const duplicates: Finding[] = [],
		stack: Node[] = [tree];
	while (stack.length) {
		const node = stack.pop();
		if (!node) break;
		if (node.type === 'object') {
			const keys = new Set<string>();
			for (const property of node.children ?? []) {
				const key = property.children?.[0];
				if (!key) continue;
				if (keys.has(key.value))
					duplicates.push(
						finding('opf/duplicate-key', {
							path: pointer(getNodePath(key)),
							message: `Duplicate JSON property ${JSON.stringify(key.value)}.`,
							help: 'Resolve the duplicate explicitly, preserving the intended content from both occurrences. JSON.parse would otherwise hide an earlier value.',
							location: location(key.offset, key.length),
						}),
					);
				keys.add(key.value);
			}
		}
		stack.push(...(node.children ?? []));
	}
	return {
		value: JSON.parse(source.replace(/^\uFEFF/, '')),
		syntax: [],
		duplicates,
		locate(path: string) {
			try {
				let node: Node | undefined = tree;
				const found: Node[] = [];
				const wanted = parts(path);
				for (const part of wanted) {
					const next: Node | undefined =
						node?.type === 'array'
							? node.children?.[Number(part)]
							: node?.type === 'object'
								? node.children?.find(
										(property) => property.children?.[0]?.value === part,
									)?.children?.[1]
								: undefined;
					if (!next) break;
					node = next;
					found.push(next);
				}
				// A finding about a missing field is located at the object that lacks it.
				const target = found.length === wanted.length ? node : (found[found.length - 1] ?? tree);
				return target ? location(target.offset, target.length) : undefined;
			} catch {
				// A path that is not a JSON Pointer has no place in the text.
				return undefined;
			}
		},
	};
}
