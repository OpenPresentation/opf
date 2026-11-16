import { createRequire } from "node:module";
import { transform } from "esbuild";

const require = createRequire(import.meta.url);

// The viewer reaches a client as the text of one JSON-RPC message, where every `"` costs two bytes (`\"`) and every `'` one.
// esbuild writes string literals in double quotes whenever that needs no more escapes than another quote, so about 130,000
// literals in the minified script pay for their delimiters twice. This pass rewrites a double-quoted literal in single quotes
// when that makes the JSON text shorter; nothing but the delimiters and the escapes they need changes, so every value is the same.
// The literals are found by TypeScript's parser (a JavaScript parse, not a scan, so a quote inside a regular expression, a
// template or a comment is never touched), and the build proves the result is the same program (sameProgram below).

/** The bytes `text` takes inside a JSON string, without the enclosing quotes. */
export const jsonTextBytes = (text) => Buffer.byteLength(JSON.stringify(text)) - 2;

/** The same string literal in single quotes: `\"` becomes `"` and `'` becomes `\'`; every other escape stays as written. */
export function singleQuoted(raw) {
	if (raw[0] !== '"' || raw.at(-1) !== '"') throw new Error(`app-quotes: not a double-quoted literal: ${raw.slice(0, 40)}`);
	const body = raw.slice(1, -1);
	let out = "'";
	for (let i = 0; i < body.length; i++) {
		const c = body[i];
		if (c === "\\") {
			const next = body[i + 1];
			out += next === '"' ? '"' : c + next;
			i++;
		} else out += c === "'" ? "\\'" : c;
	}
	return `${out}'`;
}

/** Rewrite the double-quoted string literals of `script` that are shorter as JSON text in single quotes. */
export function cheaperQuotes(script) {
	const ts = require("typescript");
	const source = ts.createSourceFile("deck-app.js", script, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
	if (source.parseDiagnostics.length) {
		const [first] = source.parseDiagnostics;
		throw new Error(`app-quotes: the bundle does not parse as JavaScript (${ts.flattenDiagnosticMessageText(first.messageText, " ")} at ${first.start}); review the quote pass.`);
	}
	const literals = [];
	const visit = (node) => {
		if (node.kind === ts.SyntaxKind.StringLiteral) literals.push([node.getStart(source), node.end]);
		ts.forEachChild(node, visit);
	};
	visit(source);
	let code = "";
	let at = 0;
	let rewritten = 0;
	for (const [start, end] of literals) {
		const raw = script.slice(start, end);
		if (raw[0] !== '"') continue;
		const next = singleQuoted(raw);
		if (jsonTextBytes(next) >= jsonTextBytes(raw)) continue;
		code += script.slice(at, start) + next;
		at = end;
		rewritten += 1;
	}
	code += script.slice(at);
	return { code, literals: literals.length, rewritten, saved: jsonTextBytes(script) - jsonTextBytes(code) };
}

/** Fail unless `before` and `after` are the same program: esbuild prints both from its syntax tree, which keeps no quote style. */
export async function assertSameProgram(before, after) {
	const options = { minify: true, format: "esm", target: "es2022", charset: "utf8", legalComments: "eof" };
	const [a, b] = await Promise.all([transform(before, options), transform(after, options)]);
	if (a.code !== b.code) {
		let at = 0;
		while (a.code[at] === b.code[at]) at += 1;
		throw new Error(`app-quotes: the requoted bundle is not the same program (first difference at ${at}: ${JSON.stringify(a.code.slice(at, at + 60))} vs ${JSON.stringify(b.code.slice(at, at + 60))}).`);
	}
}
