import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  child,
  currentGallerySource,
  comparisonInputSource,
  cliInvocation,
  validateCliOutput,
  captureCliAttempt,
  validateAuthority,
  verifyConsumer,
  resolveInstalledImport,
  installedInventory,
  loadRecovery,
  makePlan,
  sourceLayoutRecords,
  sheetSvg,
  parseOptions,
  sha,
  PACKAGES,
  PILOT_COMMIT,
} from "./e1-current-after.mjs";

const temporary = (fn, temporaryParent = os.tmpdir()) => {
  // macOS may advertise /var while realpath returns /private/var. Fixtures enter the same strict boundary as real consumers.
  const parent = fs.realpathSync(temporaryParent);
  const root = fs.mkdtempSync(path.join(parent, "opf-e1-control-"));
  assert.equal(fs.realpathSync(root), root, "The fixture must satisfy the consumer's canonical path contract");
  try {
    return fn(root);
  } finally {
    const relative = path.relative(parent, path.resolve(root));
    assert.ok(
      relative &&
        !relative.startsWith("..") &&
        !path.isAbsolute(relative) &&
        path.basename(root).startsWith("opf-e1-control-"),
      "Delete only the exact owned temporary fixture",
    );
    fs.rmSync(root, { recursive: true, force: true });
  }
};
test("owned fixture canonicalizes an aliased temporary parent before strict consumer admission", () =>
  temporary((root) => {
    const target = path.join(root, "target"), alias = path.join(root, "alias");
    fs.mkdirSync(target);
    fs.symlinkSync(target, alias, process.platform === "win32" ? "junction" : "dir");
    try {
      temporary((inner) => {
        assert.equal(path.dirname(inner), target);
        assert.equal(fs.realpathSync(inner), inner);
      }, alias);
      assert.deepEqual(fs.readdirSync(target), [], "Only the exact inner fixture was removed");
      assert.equal(fs.lstatSync(alias).isSymbolicLink(), true, "The owned parent alias stays a link");
    } finally {
      fs.unlinkSync(alias); // Remove only the owned link, never recurse through its target.
    }
  }));
const write = (root, name, data) => {
  const file = path.join(root, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof data === "string" || Buffer.isBuffer(data) ? data : JSON.stringify(data));
  return file;
};
const authority = () => ({
  release: "0.33.0",
  commit: "a".repeat(40),
  verifiedAt: "2026-11-08T10:00:00Z",
  packages: [...PACKAGES, "@openpresentation/mcp"].map((name) => ({
    name,
    version: "0.33.0",
    gitHead: "a".repeat(40),
    integrity: "sha512-unit-control-" + name,
    tarball: "https://registry.npmjs.org/" + name + "/unit-only.tgz",
    attestations: {
      provenance: { predicateType: "https://slsa.dev/provenance/v1" },
    },
  })),
});
const gallery = {
  source: "https://www.pptx.gallery",
  layouts: { cover: { role: "cover" }, text: { role: "body" } },
};
const deck = () => ({
  name: "Preserve content",
  language: "en",
  catalogs: {
    default: {
      source: gallery.source,
      layouts: { cover: { historical: true } },
    },
  },
  design: { footer: { start: { text: "Authored" } } },
  slides: [
    {
      id: "s02",
      layout: "cover",
      title: "Never shrink or rewrite",
      notes: "Keep exactly",
    },
    {
      id: "s01",
      blocks: [{ text: "Original order" }, { image: { src: "data:image/png;base64,exact" } }],
      hidden: true,
    },
  ],
});

test("only verified default layout snapshots are removed; authored bytes/structure/order remain explicit", () => {
  const d = deck(),
    raw = Buffer.from(JSON.stringify(d)),
    unchanged = Buffer.from(raw),
    result = currentGallerySource(raw, gallery);
  const expected = structuredClone(d);
  delete expected.catalogs;
  assert.deepEqual(result.deck, expected);
  assert.ok(raw.equals(unchanged));
  assert.deepEqual(
    result.deck.slides.map((s) => s.id),
    ["s02", "s01"],
  );
  assert.equal(result.authoredSlidesSha256, sha(JSON.stringify(d.slides)));
  assert.equal(result.removed.length, 1);
  assert.equal(result.removed[0].sha256, sha(JSON.stringify(d.catalogs.default.layouts.cover)));
  assert.deepEqual(JSON.parse(result.bytes), expected);
});
for (const [name, mutate] of [
  [
    "custom catalog",
    (d) => {
      d.catalogs.mine = { source: "custom", layouts: {} };
    },
  ],
  [
    "custom layout",
    (d) => {
      d.catalogs.default.layouts.custom = {};
    },
  ],
  [
    "font records",
    (d) => {
      d.catalogs.default.fontSchemes = { chosen: {} };
    },
  ],
  [
    "wrong catalog source",
    (d) => {
      d.catalogs.default.source = "other";
    },
  ],
  [
    "duplicate ids",
    (d) => {
      d.slides[1].id = "s02";
    },
  ],
  [
    "path id",
    (d) => {
      d.slides[0].id = "../escape";
    },
  ],
  [
    "missing explicit id",
    (d) => {
      delete d.slides[0].id;
    },
  ],
])
  test("refuse " + name + " rather than silently rewrite", () => {
    const d = deck();
    mutate(d);
    const raw = Buffer.from(JSON.stringify(d));
    assert.throws(() => currentGallerySource(raw, gallery));
    assert.deepEqual(JSON.parse(raw), d);
  });
test("no embedded catalog is a supported unchanged current-gallery deck", () => {
  const d = deck();
  delete d.catalogs;
  assert.deepEqual(currentGallerySource(Buffer.from(JSON.stringify(d)), gallery).deck, d);
});

// Exact affected objects from the retained pilot033 input bc1f4d001e04450b…; other slots are placeholders,
// not a claim of a new full43 validation. Historical source JSON and images are never modified.
const pilotRegionSlides = {
  "36": {
    "id": "dynamic-promoted-columns",
    "title": "What the pilot asks of us",
    "left": {
      "text": "The pilot shows a clear gain in completion with modest effort."
    },
    "center+right": {
      "items": [
        "Two teams must release a lead at 20%",
        "Weekly reviews need a fixed slot",
        "Analytics needs read access to both workflows"
      ]
    }
  },
  "37": {
    "id": "dynamic-promoted-grid",
    "title": "From baseline to decision in six weeks",
    "top:left": {
      "metric": {
        "value": 52,
        "label": "Participants"
      }
    },
    "top:center": {
      "metric": {
        "value": "84%",
        "label": "Completion"
      }
    },
    "top:right": {
      "metric": {
        "value": "6.2",
        "unit": "min",
        "label": "Median time"
      }
    },
    "middle+bottom:left+center+right": {
      "timeline": {
        "events": [
          {
            "when": "Week 1",
            "what": "Baseline"
          },
          {
            "when": "Weeks 2–5",
            "what": "Pilot"
          },
          {
            "when": "Week 6",
            "what": "Review and decide"
          }
        ]
      }
    }
  },
  "42": {
    "id": "dynamic-chart-quote",
    "title": "The numbers and the voice agree",
    "left+center": {
      "chart": {
        "type": "column",
        "axisTitles": {
          "category": "Week",
          "value": "Task completion"
        },
        "data": {
          "columns": [
            "Week",
            {
              "name": "Task completion",
              "format": "0%"
            }
          ],
          "rows": [
            [
              "1",
              0.68
            ],
            [
              "2",
              0.72
            ],
            [
              "3",
              0.76
            ],
            [
              "4",
              0.84
            ]
          ]
        }
      }
    },
    "right": {
      "quote": {
        "text": "The weekly review keeps the next step clear.",
        "attribution": "Product lead",
        "source": "Illustrative quotation"
      }
    }
  }
};
const projectionSchema = () => JSON.parse(fs.readFileSync(new URL("../spec/schemas/opf.schema.json", import.meta.url)));
const pilotShape = () => {
  const d = deck();
  d.design.footer = { left: { text: "Illustrative example • fictional data" }, right: { text: "{{slide.number}}" } };
  d.slides = Array.from({ length: 43 }, (_, i) => ({ id: "control-" + i }));
  for (const [i, slide] of Object.entries(pilotRegionSlides)) d.slides[Number(i)] = structuredClone(slide);
  return d;
};
test("034 comparison projection changes exactly the nine retained pilot typed keys, not their values", () => {
  const d = pilotShape(), raw = Buffer.from(JSON.stringify(d)), before = Buffer.from(raw),
    result = comparisonInputSource(raw, gallery, "0.34.0", projectionSchema());
  const paths = [
    ["/design/footer/left", "/design/footer/start"], ["/design/footer/right", "/design/footer/end"],
    ["/slides/36/left", "/slides/36/start"], ["/slides/36/center+right", "/slides/36/center+end"],
    ["/slides/37/top:left", "/slides/37/top:start"], ["/slides/37/top:right", "/slides/37/top:end"],
    ["/slides/37/middle+bottom:left+center+right", "/slides/37/middle+bottom:start+center+end"],
    ["/slides/42/left+center", "/slides/42/start+center"], ["/slides/42/right", "/slides/42/end"],
  ];
  assert.deepEqual(result.projection.changes, paths.map(([from, to]) => ({ from, to })));
  const at = (v, pointer) => pointer.split("/").slice(1).reduce((value, key) => value[key], v);
  for (const [from, to] of paths) assert.deepEqual(at(result.deck, to), at(d, from));
  assert.ok(raw.equals(before));
  assert.equal(result.projection.originalSha256, sha(raw));
  assert.equal(result.projection.currentGallerySha256, sha(currentGallerySource(raw, gallery).bytes));
  assert.equal(result.projection.projectedSha256, sha(result.bytes));
  assert.equal(result.authoredSlidesSha256, sha(JSON.stringify(d.slides)), "Original authored identity remains explicit");
  assert.deepEqual(JSON.parse(result.bytes), result.deck);
});
test("033 takes the exact existing path, including stale historical keys and bytes", () => {
  const raw = Buffer.from(JSON.stringify(pilotShape()));
  assert.deepEqual(comparisonInputSource(raw, gallery, "0.33.0"), currentGallerySource(raw, gallery));
});
test("034 only visits schema-owned property names; literals, data, code, extensions and physical coordinates stay exact", () => {
  const d = deck();
  d.design.header = false;
  d.slides[0].design = { header: { left: { text: "slides.0.left" } }, footer: false };
  d.slides[1].blocks = [{ type: "code", code: "slides.0.left = 'right';" },
    { chart: { data: { columns: ["left", "right"], rows: [["left", 7]] } } }];
  d.slides[1].extensions = { left: "right", nested: { lang: "ar-SA", left: { right: 9 } }, text: "slides.0.left" };
  d.slides[1].shapes = [{ x: 12, y: 24, width: 100, height: 30, padding: { left: 9, right: 4 } }];
  const r = comparisonInputSource(Buffer.from(JSON.stringify(d)), gallery, "0.34.1", projectionSchema());
  assert.deepEqual(r.projection.changes, [{ from: "/slides/0/design/header/left", to: "/slides/0/design/header/start" }]);
  assert.deepEqual(r.deck.slides[1], d.slides[1]);
  assert.equal(r.deck.slides[0].design.header.start.text, "slides.0.left");
  assert.equal(r.deck.design.header, false);
  assert.equal(r.deck.slides[0].design.footer, false);
});
for (const [name, mutate] of [
  ["old/new region collision", d => { d.slides[36].start = d.slides[36].left; }],
  ["old/new furniture collision", d => { d.design.footer.start = d.design.footer.left; }],
  ["unknown region", d => { d.slides[36]["left+right"] = { text: "Keep" }; }],
  ["mixed region spelling", d => { d.slides[36]["left+end"] = { text: "Keep" }; }],
  ["unknown furniture slot", d => { d.design.footer.middle = { text: "Keep" }; }],
  ["direct Slide furniture is not a schema owner", d => { d.slides[36].footer = { left: { text: "Keep" } }; }],
  ["malformed furniture", d => { d.design.footer = "left"; }],
]) test("034 refuses " + name, () => {
  const d = pilotShape(); mutate(d);
  const raw = Buffer.from(JSON.stringify(d)), before = Buffer.from(raw);
  assert.throws(() => comparisonInputSource(raw, gallery, "0.34.0", projectionSchema()));
  assert.ok(raw.equals(before));
});
test("unbound/future versions and different schema domains cannot authorize the 034 projection", () => {
  const raw = Buffer.from(JSON.stringify(pilotShape()));
  for (const release of ["0.34.0-dev", "0.35.0", "0.32.0", "034", undefined])
    assert.throws(() => comparisonInputSource(raw, gallery, release, projectionSchema()));
  assert.throws(() => comparisonInputSource(raw, gallery, "0.34.0"));
  const schema = projectionSchema(); schema.$defs.Slide.properties.left = { $ref: "#/$defs/ContentPayload" };
  assert.throws(() => comparisonInputSource(raw, gallery, "0.34.0", schema));
  const furniture = projectionSchema(); furniture.$defs.HeaderFooter.properties.left = furniture.$defs.HeaderFooter.properties.start;
  assert.throws(() => comparisonInputSource(raw, gallery, "0.34.0", furniture));
});

test("installed CLI receives exact supported flags with no font override, force or pagination", () => {
  const i = cliInvocation("C:/consumer/opf.js", "C:/source in/deck.json", "C:/fresh out", {
    scale: 0.5,
    date: "2026-11-08",
  });
  assert.equal(i.command, process.execPath);
  assert.deepEqual(i.args, [
    "C:/consumer/opf.js",
    "convert",
    "C:/source in/deck.json",
    path.join("C:/fresh out", "slide-{n}.png"),
    "--scale",
    "0.5",
    "--date",
    "2026-11-08",
    "--keep-slides",
    "--include-hidden",
  ]);
  for (const scale of [0, 9, NaN, Infinity])
    assert.throws(() => cliInvocation("a", "b", "c", { scale, date: "2026-11-08" }));
  for (const date of ["2026-02-30", "now", "2026-11-8"])
    assert.throws(() => cliInvocation("a", "b", "c", { scale: 1, date }));
});
test("unsafe output paths and duplicate/unsupported options refuse", () => {
  for (const p of ["../escape", "/escape", "C:/escape", "a\\b", "a//b", "./a", "a/../b"])
    assert.throws(() => child("C:/safe", p));
  assert.equal(parseOptions(["--date", "2026-11-08"]).mode, "plan");
  assert.throws(() => parseOptions(["--scale", "1", "--scale", "2"]));
  assert.throws(() => parseOptions(["--fonts", "stub"]));
  assert.throws(() => parseOptions(["--out"]));
});

function consumerFixture(root) {
  const proof = authority(),
    lock = { lockfileVersion: 3, packages: { "": {} } },
    manifest = { dependencies: {} };
  for (const p of proof.packages.filter((p) => PACKAGES.includes(p.name))) {
    manifest.dependencies[p.name] = "0.33.0";
    lock.packages["node_modules/" + p.name] = {
      version: p.version,
      integrity: p.integrity,
      resolved: p.tarball,
    };
    write(root, "node_modules/" + p.name + "/package.json", {
      name: p.name,
      version: p.version,
      ...(p.name === "@openpresentation/cli" ? { bin: { opf: "./dist/index.js" } } : {}),
    });
    write(root, "node_modules/" + p.name + "/dist/index.js", "// inert unit fixture, not a renderer");
  }
  write(root, "package.json", manifest);
  write(root, "package-lock.json", lock);
  return { proof, lock, manifest };
}
test("genuine-consumer boundary compares exact pinned authority/SRI and leaves every byte immutable", () =>
  temporary((root) => {
    const { proof } = consumerFixture(root),
      before = installedInventory(path.join(root, "node_modules"));
    const verified = verifyConsumer(root, proof);
    assert.equal(verified.packages.length, 6);
    assert.equal(verified.cli, path.join(root, "node_modules/@openpresentation/cli/dist/index.js"));
    assert.deepEqual(installedInventory(path.join(root, "node_modules")), before);
  }));
for (const [name, mutate] of [
  [
    "mixed release",
    (p) => {
      p.packages[0].version = "0.32.1";
    },
  ],
  [
    "wrong gitHead",
    (p) => {
      p.packages[0].gitHead = "b".repeat(40);
    },
  ],
  [
    "unverified",
    (p) => {
      p.verifiedAt = "";
    },
  ],
  [
    "no provenance",
    (p) => {
      delete p.packages[0].attestations;
    },
  ],
  [
    "duplicate package",
    (p) => {
      p.packages[1] = p.packages[0];
    },
  ],
])
  test("publication authority refuses " + name, () => {
    const p = authority();
    mutate(p);
    assert.throws(() => validateAuthority(p));
  });
for (const [name, mutate] of [
  [
    "wrong SRI",
    (f) => {
      f.lock.packages["node_modules/@openpresentation/opf"].integrity = "sha512-other";
    },
  ],
  [
    "file link",
    (f) => {
      f.lock.packages["node_modules/@openpresentation/opf"].link = true;
    },
  ],
  [
    "file dependency",
    (f) => {
      f.lock.packages["node_modules/@openpresentation/opf"].resolved = "file:../other";
    },
  ],
  [
    "second core",
    (f) => {
      f.lock.packages["node_modules/other/node_modules/@openpresentation/opf"] = {};
    },
  ],
  [
    "unbounded pin",
    (f) => {
      f.manifest.dependencies["@openpresentation/opf"] = "^0.33.0";
    },
  ],
])
  test("consumer refuses " + name, () =>
    temporary((root) => {
      const f = consumerFixture(root);
      mutate(f);
      write(root, "package.json", f.manifest);
      write(root, "package-lock.json", f.lock);
      assert.throws(() => verifyConsumer(root, f.proof));
    }),
  );

test("modified recovery map refuses before archive loading or any renderer", () =>
  temporary((root) => {
    write(root, "recovery.json", { schema: "forged-current-map" });
    let calls = 0;
    assert.throws(() =>
      loadRecovery(root, root, () => {
        calls++;
      }),
    );
    assert.equal(calls, 0);
    assert.deepEqual(fs.readdirSync(root), ["recovery.json"]);
  }));

test("plan labels pilot choice honestly and maps current-only IDs without invented before panels", () => {
  const original = Buffer.from(JSON.stringify(deck())),
    fixed = [
      {
        id: "s02",
        ordinal: 1,
        neutral: "n1",
        before: "before",
        claude: "claude",
      },
    ];
  const recovery = {
    assets: new Map([
      ["pilot", original],
      ["batch", original],
    ]),
    record: {
      pilot: {
        slides: fixed,
        sourceCandidates: [
          { commit: "older", source: "pilot" },
          { commit: PILOT_COMMIT, source: "pilot" },
        ],
      },
      corpus: {
        batches: [
          {
            batch: "batch-01",
            source: "batch",
            slides: fixed,
            publishedBatch: true,
          },
        ],
      },
    },
  };
  const current = {
      source: original,
      commit: "release",
      sampler: { slides: [{ id: "s02" }, { id: "new-current" }] },
    },
    plan = makePlan(recovery, current);
  assert.deepEqual(
    plan.map((r) => r.id),
    ["overview", "pilot", "batch-01"],
  );
  assert.equal(plan[0].slides[1].before, undefined);
  assert.match(plan[1].pilotProducerStatus, /NOT a proven/);
  assert.equal(plan[1].sourceCommit, PILOT_COMMIT);
  assert.deepEqual(
    makePlan(recovery, current, "batch-01,pilot").map((r) => r.id),
    ["pilot", "batch-01"],
  );
  assert.throws(() => makePlan(recovery, current, "unknown"));
  assert.throws(() => makePlan(recovery, current, "pilot,pilot"));
});

function outputFixture(root) {
  const png = Buffer.alloc(25);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.writeUInt32BE(640, 16);
  png.writeUInt32BE(360, 20);
  const file = write(root, "slide-1.png", png);
  return {
    result: { status: 0 },
    report: {
      command: "convert",
      ok: true,
      fonts: { pack: "office", substitutionPolicy: "visual", userFonts: [] },
      outputs: [{ file, bytes: png.length, sha256: sha(png), mediaType: "image/png" }],
    },
  };
}
test("actual reported output hashes and physical dimensions bind exactly to authored ordinal", () =>
  temporary((root) => {
    const f = outputFixture(root),
      before = fs.readFileSync(f.report.outputs[0].file);
    const result = validateCliOutput(f.result, f.report, root, 1);
    assert.deepEqual(result[0], {
      ordinal: 1,
      file: "slide-1.png",
      bytes: 25,
      sha256: sha(before),
      width: 640,
      height: 360,
    });
    assert.ok(before.equals(fs.readFileSync(f.report.outputs[0].file)));
  }));
for (const [name, mutate] of [
  [
    "failed CLI",
    (f) => {
      f.result.status = 1;
    },
  ],
  [
    "schema refusal",
    (f) => {
      f.report.ok = false;
    },
  ],
  [
    "font stub",
    (f) => {
      f.report.fonts.pack = "custom";
    },
  ],
  [
    "font override",
    (f) => {
      f.report.fonts.userFonts = ["stub.ttf"];
    },
  ],
  [
    "substitution changed",
    (f) => {
      f.report.fonts.substitutionPolicy = "strict";
    },
  ],
  [
    "rewritten pagination",
    (f) => {
      f.report.pagination = { pages: 2 };
    },
  ],
  [
    "continuation",
    (f) => {
      f.report.continued = [{}];
    },
  ],
  [
    "output hash",
    (f) => {
      f.report.outputs[0].sha256 = "bad";
    },
  ],
  [
    "ordinal mismatch",
    (f) => {
      const old = f.report.outputs[0].file,
        other = path.join(path.dirname(old), "slide-2.png");
      fs.renameSync(old, other);
      f.report.outputs[0].file = other;
    },
  ],
  [
    "lost slide",
    (f) => {
      f.report.outputs = [];
    },
  ],
])
  test("refuse " + name + " without writing or fixing output", () =>
    temporary((root) => {
      const f = outputFixture(root);
      mutate(f);
      const before = fs.readdirSync(root);
      assert.throws(() => validateCliOutput(f.result, f.report, root, 1));
      assert.deepEqual(fs.readdirSync(root), before);
    }),
  );

test("sheet embeds exact fixed/after bytes and explicitly labels missing historical controls", () => {
  const fixed = Buffer.from("immutable-png-bytes"),
    after = Buffer.from("new-after-png");
  const svg = sheetSvg([
    { label: "1. <title>", before: fixed, after, claude: fixed },
    { label: "2. current-only", after },
  ]);
  assert.equal(svg.split(fixed.toString("base64")).length - 1, 2);
  assert.equal(svg.split(after.toString("base64")).length - 1, 2);
  assert.match(svg, /&lt;title&gt;/);
  assert.equal(svg.split("No historical panel").length - 1, 2);
});
test("first literal CLI failure is retained once without retry, content repair or a success claim", () =>
  temporary((root) => {
    let calls = 0;
    const stdout = '{"ok":false,"findings":[{"code":"schema-error","message":"Keep original"}]}\n',
      stderr = "literal native peer failure\r\n";
    assert.throws(() =>
      captureCliAttempt(root, { command: "inert", args: ["convert", "original.json"] }, root, () => {
        calls++;
        return { status: 1, stdout, stderr };
      }),
    );
    assert.equal(calls, 1);
    assert.equal(fs.readFileSync(path.join(root, "cli.stdout.json"), "utf8"), stdout);
    assert.equal(fs.readFileSync(path.join(root, "cli.stderr.txt"), "utf8"), stderr);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, "cli.exit.json"))).status, 1);
    assert.deepEqual(fs.readdirSync(root).sort(), ["cli.exit.json", "cli.stderr.txt", "cli.stdout.json"]);
  }));

test("import-only examples and ordered Node/default declarations resolve without CJS/private fallback", () =>
  temporary((root) => {
    const name = "@openpresentation/opf",
      dir = "node_modules/" + name;
    write(root, dir + "/package.json", {
      exports: {
        ".": {
          types: "./index.d.ts",
          browser: "./browser.js",
          node: "./node.js",
          default: "./fallback.js",
        },
        "./examples": { types: "./examples.d.ts", import: "./examples.js" },
        "./nested": { node: { import: "./examples.js" } },
        "./escape": { import: "./../outside.js" },
      },
    });
    write(root, dir + "/node.js", "public node");
    write(root, dir + "/examples.js", "public examples");
    const modules = path.join(root, "node_modules");
    assert.equal(resolveInstalledImport(modules, name), path.join(root, dir, "node.js"));
    assert.equal(resolveInstalledImport(modules, name + "/examples"), path.join(root, dir, "examples.js"));
    assert.equal(resolveInstalledImport(modules, name + "/nested"), path.join(root, dir, "examples.js"));
    assert.throws(() => resolveInstalledImport(modules, name + "/private"));
    assert.throws(() => resolveInstalledImport(modules, name + "/escape"));
  }));

test("source gallery follows its index and maintained embeddedCopy contract, never the index as a layout", () => {
  const record = {
      $schema: "schema",
      id: "cover",
      name: "Cover",
      "x-publisher": "metadata",
      regions: [{ name: "body" }],
    },
    index = { kind: "layouts", records: [{ id: "cover", file: "cover.json" }] },
    calls = [];
  const result = sourceLayoutRecords(index, (file) => {
    calls.push(file);
    return record;
  });
  assert.deepEqual(calls, ["cover.json"]);
  assert.deepEqual(result, {
    cover: { name: "Cover", regions: [{ name: "body" }] },
  });
  assert.equal(record.id, "cover");
  assert.throws(() =>
    sourceLayoutRecords({ kind: "layouts", records: [{ id: "cover", file: "../cover.json" }] }, () => record),
  );
  assert.throws(() =>
    sourceLayoutRecords({ kind: "layouts", records: [{ id: "other", file: "cover.json" }] }, () => record),
  );
});
