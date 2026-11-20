// A title's percent names a value the way its label shows it: through the section of a `;` number format that formats the value.
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { chartTitleFocus, resolveChartData } from "../dist/composition.js";
import { formatDataNumber } from "../dist/index.js";

describe("a title's percent matches the value through the section that formats it", () => {
  const focus = (format, text, rows) => {
    const chart = { type: "column", data: { columns: ["Cause", { name: "Share", format }], rows } };
    return chartTitleFocus(chart, resolveChartData(chart), { text });
  };
  const rows = [["Battery", 0.2], ["Brakes", 0.5], ["Tires", 0.3]];
  test("a percent section formats the positive value: the title's 20% names the 0.2 row", () => {
    assert.deepEqual(focus("0%;(0%)", "Faults are 20% of downtime", rows)?.categories, [0]);
  });
  test("a positive section without a percent sign prints 0.2, so a title's 20% names nothing", () => {
    assert.equal(formatDataNumber(0.2, "0.0;0%"), "0.2");
    assert.equal(focus("0.0;0%", "Faults are 20% of downtime", rows)?.categories, undefined);
  });
  test("one section is unchanged", () => {
    assert.deepEqual(focus("0%", "Faults are 20% of downtime", rows)?.categories, [0]);
    assert.equal(focus("0.0", "Faults are 20% of downtime", rows)?.categories, undefined);
  });
});
