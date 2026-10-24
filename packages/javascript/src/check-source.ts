import {
	getNodePath,
	parseTree,
	printParseErrorCode,
	type Node,
	type ParseError,
} from 'jsonc-parser';
import type { Finding, FindingLocation } from './generated/types/finding.js';
import { finding, parts, pointer } from './check-document.js';
import { analyzeJsonSyntax } from './json-syntax.js';
import { createLocator } from './source-text.js';

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
	const location = createLocator(source);
	if (errors.length || !tree) {
		// One finding per root cause, in plain words (the recovery analyzer, src/json-syntax.ts). If the analyzer finds nothing in
		// text the parser rejects, the parser's own errors are reported instead, so a syntax error is never silent.
		const problems = analyzeJsonSyntax(source);
		return {
			syntax: problems.length
				? problems.map((problem) =>
						finding('opf/json-syntax', {
							path: '',
							message: problem.message,
							help: problem.next,
							location: problem.range,
						}),
					)
				: errors.map((error) =>
						finding('opf/json-syntax', {
							path: '',
							message: printParseErrorCode(error.error),
							help: 'Repair the JSON syntax at this source range. No content or whitespace has been rewritten.',
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
