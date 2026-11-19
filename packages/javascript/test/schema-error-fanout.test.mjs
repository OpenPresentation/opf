// An object written in the wrong shape is one schema finding at its own path, not one error per rejected union branch per key per
// array entry: four table columns written { key, label } gave 24 findings, list items with metric fields 11 and a "did you mean
// level?" for `label`.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { validate } from "../dist/index.js";
import { describeFinding } from "../dist/source.js";

const schemaErrors = (deck) => validate(deck, { only: ["format"] }).findings.filter((finding) => finding.ruleId === "opf/schema");
const deck = (block) => ({ name: "Shapes", slides: [{ title: "Shapes", blocks: [block] }] });

describe("a wrong object is one finding", () => {
	test("table columns written { key, label } are one finding at the first column, naming the other columns and the column forms", () => {
		const columns = ["region", "q1", "q2", "growth"].map((key) => ({ key, label: key.toUpperCase() }));
		const errors = schemaErrors(deck({ table: { columns, rows: [["North", "12", "14", "+17%"]] } }));
		assert.equal(errors.length, 1);
		const [error] = errors;
		assert.equal(error.path, "/slides/0/blocks/0/table/columns/0");
		assert.equal(error.message, 'none of its forms has "key" or "label"; the same in entries 1, 2 and 3 of this list');
		assert.equal(error.validation.keyword, "oneOf");
		assert.deepEqual(error.validation.params.properties, ["key", "label"]);
		assert.deepEqual(error.validation.params.alsoAt, ["/slides/0/blocks/0/table/columns/1", "/slides/0/blocks/0/table/columns/2", "/slides/0/blocks/0/table/columns/3"]);
		assert.ok(error.validation.alternatives.includes("DataColumn: { name, format }"));
		assert.ok(error.validation.alternatives.some((form) => form.startsWith("StyledTableCell: { value,")));
		assert.equal(error.fixes, undefined, "no 'Add value' or 'Add name' fix for a form the author did not mean");
	});

	test("list items with metric fields say they are a metric's fields, with no rename to `level`", () => {
		const items = [
			{ label: "Revenue", value: "$4.2M", delta: "+12%" },
			{ label: "Churn", value: "3.1%", delta: "-0.4pt" },
			{ label: "NPS", value: 61 },
		];
		const document = deck({ items });
		const errors = schemaErrors(document);
		assert.equal(errors.length, 1);
		const [error] = errors;
		assert.equal(error.path, "/slides/0/blocks/0/items/0");
		assert.equal(error.message, 'none of its forms has "label", "value" or "delta" (those are fields of "metric"); the same in entries 1 and 2 of this list');
		assert.deepEqual(error.validation.params.belongsTo, ["metric"]);
		assert.match(error.help, /"metric"/);
		assert.equal(error.suggestions, undefined);
		const text = describeFinding(error, { document });
		assert.match(text.message, /`label`, `value`, `delta`, which none of its forms has; those are fields of `metric`/);
	});

	test("a partial match still names the one wrong property", () => {
		const column = schemaErrors(deck({ table: { columns: [{ name: "region", label: "Region" }, "B"], rows: [["a", "b"]] } }));
		assert.deepEqual(column.map((error) => [error.path, error.message]), [["/slides/0/blocks/0/table/columns/0/label", "must NOT have additional properties"]]);
		const item = schemaErrors(deck({ items: [{ text: "x", label: "y" }] }));
		assert.deepEqual(item.map((error) => [error.path, error.message]), [["/slides/0/blocks/0/items/0/label", "must NOT have additional properties"]]);
		assert.equal(item[0].suggestions, undefined, "`label` is not a respelling of `level`");
	});

	test("a respelled field is not a foreign object: the typo keeps its did-you-mean", () => {
		const errors = schemaErrors(deck({ items: [{ Text: "x" }] }));
		const typo = errors.find((error) => error.path === "/slides/0/blocks/0/items/0/Text");
		assert.equal(typo?.suggestions?.[0]?.value, "text");
	});

	test("wrong objects in one array merge with every key named, a near miss beside them stays its own finding, a lone one names no other entry", () => {
		const errors = schemaErrors(deck({ table: { columns: [{ key: "a" }, "B", { title: "C" }, { name: "d", label: "D" }], rows: [["a", "b", "c", "d"]] } }));
		assert.deepEqual(errors.map((error) => error.path), ["/slides/0/blocks/0/table/columns/0", "/slides/0/blocks/0/table/columns/3/label"]);
		assert.deepEqual(errors[0].validation.params.properties, ["key", "title"]);
		assert.deepEqual(errors[0].validation.params.alsoAt, ["/slides/0/blocks/0/table/columns/2"]);
		const lone = schemaErrors(deck({ quote: { content: "Hello", who: "Ann" } }));
		assert.deepEqual(lone.map((error) => [error.path, error.message]), [["/slides/0/blocks/0/quote", 'none of its forms has "content" or "who"']]);
		assert.equal(lone[0].validation.params.alsoAt, undefined);
	});
});
