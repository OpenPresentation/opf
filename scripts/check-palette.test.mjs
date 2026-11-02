import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkDirectory, checkScheme, contrast, loadKnownFailures, markdownSummary, oklch } from "./check-palette.mjs";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "check-palette.mjs");

// A scheme that passes every rule: toned neutrals, accents that differ in lightness, no red/green pair.
const good = {
  id: "good",
  accent1: "#0B3C5D", accent2: "#E0A030", accent3: "#7A3B3B", accent4: "#2E8B57", accent5: "#D9D9D9", accent6: "#9A7BD0",
  dark1: "#111418", dark2: "#1B2A41", light1: "#FAFAF7", light2: "#E8EDF3",
};
const rules = (record) => checkScheme({ ...good, ...record }).map((f) => `${f.level}:${f.rule}`);

test("the reference scheme passes every rule", () => {
  assert.deepEqual(checkScheme(good), []);
});

test("colour maths matches known values", () => {
  assert.equal(Math.round(contrast("#000000", "#FFFFFF")), 21);
  assert.ok(Math.abs(oklch("#FFFFFF").L - 1) < 1e-3);
  assert.ok(Math.abs(oklch("#000000").L) < 1e-3);
  assert.ok(Math.abs(oklch("#FF0000").h - 29) < 1);
});

test("contrast-base fails when dark1 on light1 is under 7:1", () => {
  // dark1 and light1 also carry the text on light2 and dark2, so a weak one fails the surface rule as well
  assert.ok(rules({ dark1: "#777777" }).includes("fail:contrast-base"));
  assert.ok(rules({ light1: "#444444" }).includes("fail:contrast-base"));
});

test("contrast-surface fails for a dark2 or light2 background under 4.5:1 with its text slot", () => {
  assert.deepEqual(rules({ dark2: "#8A8A8A" }), ["fail:contrast-surface"]);
  assert.deepEqual(rules({ light2: "#777777" }), ["fail:contrast-surface"]);
});

test("accent-lightness fails for accent1 and accent2 of one lightness, not for a distinct hue alone", () => {
  assert.deepEqual(rules({ accent1: "#997929", accent2: "#C15937" }), ["fail:accent-lightness", "report:accent-close"]);
});

test("accent-close only reports (any accent pair within 0.05 of lightness)", () => {
  const found = checkScheme({ ...good, accent3: "#4A8F6B", accent4: "#4A8F6A" });
  assert.deepEqual(found.map((f) => `${f.level}:${f.rule}`), ["report:accent-close"]);
  assert.match(found[0].message, /accent3\/accent4/);
});

test("pure-neutral only reports pure white light1 and pure black dark1", () => {
  assert.deepEqual(rules({ light1: "#FFFFFF" }), ["report:pure-neutral"]);
  const both = checkScheme({ ...good, light1: "#FFFFFF", dark1: "#000000" });
  assert.equal(both.length, 1);
  assert.match(both[0].message, /pure white.*pure black/);
});

test("red-green reports a red and green accent1/accent2 of similar lightness, either order", () => {
  const red = "#C0392B";
  const green = "#2E8B3D";
  assert.ok(rules({ accent1: red, accent2: green }).includes("report:red-green"));
  assert.ok(rules({ accent1: green, accent2: red }).includes("report:red-green"));
  // a dark red with a light green differ in lightness, so the pair is distinguishable
  assert.ok(!rules({ accent1: "#7A1010", accent2: "#A8E6A1" }).includes("report:red-green"));
});

test("a missing or malformed slot fails", () => {
  const { accent3, ...rest } = good;
  assert.deepEqual(checkScheme(rest).map((f) => f.rule), ["slots"]);
  assert.deepEqual(checkScheme({ ...good, dark1: "black" }).map((f) => f.rule), ["slots"]);
});

function catalogWith(records) {
  const dir = mkdtempSync(path.join(tmpdir(), "palette-"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "index.json"), "{}");
  for (const r of records) writeFileSync(path.join(dir, `${r.id}.json`), JSON.stringify(r));
  return dir;
}

test("a directory run fails on a failing scheme, passes on a clean one and skips index.json", () => {
  const clean = catalogWith([good]);
  const bad = catalogWith([good, { ...good, id: "bad", dark1: "#777777" }]);
  try {
    assert.equal(checkDirectory(clean, []).ok, true);
    const result = checkDirectory(bad, []);
    assert.equal(result.ok, false);
    assert.ok(result.failures.some((f) => f.id === "bad" && f.rule === "contrast-base"));
    assert.ok(result.failures.every((f) => f.id === "bad"));
    assert.equal(spawnSync(process.execPath, [script, "--dir", clean, "--quiet"]).status, 0);
    assert.equal(spawnSync(process.execPath, [script, "--dir", bad, "--quiet"]).status, 1);
  } finally {
    rmSync(clean, { recursive: true, force: true });
    rmSync(bad, { recursive: true, force: true });
  }
});

test("a known failure is accepted, and a stale entry fails", () => {
  const dir = catalogWith([{ ...good, id: "weak", accent2: "#0E4266" }]);
  try {
    assert.equal(checkDirectory(dir, [{ id: "weak", rule: "accent-lightness", reason: "x" }]).ok, true);
    const stale = checkDirectory(dir, [{ id: "weak", rule: "accent-lightness", reason: "x" }, { id: "weak", rule: "contrast-base", reason: "x" }]);
    assert.equal(stale.ok, false);
    assert.equal(stale.stale.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("report-only findings do not fail and appear in the markdown summary", () => {
  const dir = catalogWith([{ ...good, id: "plain", light1: "#FFFFFF" }]);
  try {
    const result = checkDirectory(dir, []);
    assert.equal(result.ok, true);
    assert.match(markdownSummary(result), /\| plain \| pure-neutral \|/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("every entry of the known-failure list carries a reason", () => {
  for (const k of loadKnownFailures()) assert.ok(k.id && k.rule && k.reason?.length > 20, `${k.id}: needs a reason`);
});

test("today's gallery catalog passes", () => {
  const result = checkDirectory();
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.stale, []);
});
