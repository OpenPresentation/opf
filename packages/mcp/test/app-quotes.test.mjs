// The viewer's quote pass (scripts/app-quotes.mjs): string literals move from double to single quotes only where the JSON-RPC
// frame gets shorter, every value stays the same, and nothing outside a string literal changes.
import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { transform } from "esbuild";
import { DECK_APP_HTML } from "../dist/index.js";
import { assertSameProgram, cheaperQuotes, jsonTextBytes, singleQuoted } from "../scripts/app-quotes.mjs";

const values = ["plain", "", "it's", 'say "hi"', "both ' and \"", "back\\slash", "line\nbreak  ", "tab\t", "Καλημέρα 日本語 🙂", "\ud800", "</script>", "\0x", "\x7f", "''''\"", '"""\''];

test("singleQuoted keeps the value of every literal esbuild writes", async () => {
	const { code } = await transform(`globalThis.values = ${JSON.stringify(values)};`, { minify: true, charset: "utf8" });
	const requoted = cheaperQuotes(code);
	await assertSameProgram(code, requoted.code);
	const context = {};
	runInNewContext(requoted.code, context);
	assert.deepEqual(Array.from(context.values), values);
	for (const value of values) {
		const raw = JSON.stringify(value);
		assert.equal(runInNewContext(singleQuoted(raw)), value, raw);
	}
	assert.equal(singleQuoted('"a\\"b\'c"'), "'a\"b\\'c'");
	assert.throws(() => singleQuoted("'a'"), /not a double-quoted literal/);
});

test("only string literals that get shorter as JSON text are rewritten", () => {
	const source = [
		'var a="plain",b="it\'s",c="say \\"hi\\"",d="\'\'\'\\"";',
		'var r=/"[^"]*"/g,t=`"${a}"`;',
		'/* "comment" */ var o={"quoted-key":1,[a]:"x"};',
		"var s='already';",
	].join("\n");
	const { code, rewritten } = cheaperQuotes(source);
	assert.equal(
		code,
		[
			"var a='plain',b=\"it's\",c='say \"hi\"',d=\"'''\\\"\";",
			'var r=/"[^"]*"/g,t=`"${a}"`;',
			"/* \"comment\" */ var o={'quoted-key':1,[a]:'x'};",
			"var s='already';",
		].join("\n"),
	);
	assert.equal(rewritten, 4);
	assert.ok(jsonTextBytes(code) < jsonTextBytes(source));
});

test("a changed program and a source that does not parse both stop the pass", async () => {
	await assert.rejects(assertSameProgram('var a="x";', "var a='y';"), /not the same program/);
	assert.throws(() => cheaperQuotes('var a="x"; var = ;'), /does not parse as JavaScript/);
});

test("the served viewer carries no literal the pass would still shorten", () => {
	const start = DECK_APP_HTML.indexOf(">", DECK_APP_HTML.indexOf('<script type="module">')) + 1;
	const script = DECK_APP_HTML.slice(start, DECK_APP_HTML.lastIndexOf("</script>"));
	const { rewritten, literals } = cheaperQuotes(script);
	assert.ok(literals > 100_000, `the viewer has ${literals} string literals`);
	assert.equal(rewritten, 0);
});
