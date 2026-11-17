// A waterfall with a sectioned column format (`+0.0;(0.0)`): its labels carry the format's own signs, in both engines.
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { waterfallLabelText, waterfallSignedFormat } from "../dist/composition.js";
import { toExcelNumberFormat } from "../dist/index.js";

describe("waterfall labels with a sectioned column format", () => {
  test("a format with sections carries its own signs, for steps and totals alike", () => {
    const format = "+0.0;(0.0)";
    assert.equal(waterfallLabelText(4.5, format, "increase"), "+4.5");
    assert.equal(waterfallLabelText(-2.5, format, "decrease"), "(2.5)");
    assert.equal(waterfallLabelText(10, format, "total"), "+10.0");
    assert.equal(waterfallLabelText(0, format, "increase"), "+0.0");
  });
  test("with three sections a zero step takes the third", () => {
    assert.equal(waterfallLabelText(0, "+0;-0;0 flat", "increase"), "0 flat");
  });
  test("no sections: the label still adds the sign", () => {
    assert.equal(waterfallLabelText(4.5, "0.0", "increase"), "+4.5");
    assert.equal(waterfallLabelText(-2.5, "0.0", "decrease"), "−2.5");
    assert.equal(waterfallLabelText(10, "0.0", "total"), "10.0");
  });
  test("the native label format is the column's sections as written, never the doubled-sign form", () => {
    assert.equal(waterfallSignedFormat(toExcelNumberFormat("+0.0;(0.0)")), "+0.0;(0.0)");
    assert.equal(waterfallSignedFormat("0.0"), '"+"0.0;"−"0.0;0.0');
    assert.equal(waterfallSignedFormat(undefined), '"+"General;"−"General;General');
  });
});
