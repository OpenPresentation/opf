// Exercise the built engine at its real filesystem boundary, with deterministic concurrent creation after staging.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { deckStem, OPFApiError, writeFiles } from "../dist/node-engine.js";

import { convert } from "../dist/index.js";

const originalWriteFile = fs.writeFile;
const originalOpen = fs.open;
const originalLink = fs.link;
const bytes = (text) => new TextEncoder().encode(text);

async function scratch(run) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "opf-publication-"));
  try {
    await run(dir);
  } finally {
    fs.writeFile = originalWriteFile;
    fs.open = originalOpen;
    fs.link = originalLink;
    syncBuiltinESMExports();
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function afterStaging(action) {
  let called = false;
  fs.open = async (file, ...args) => {
    const handle = await originalOpen(file, ...args);
    if (!called && String(file).endsWith(".tmp")) {
      called = true;
      const write = handle.writeFile.bind(handle);
      handle.writeFile = async (...values) => {
        const result = await write(...values);
        await action();
        return result;
      };
    }
    return handle;
  };
  syncBuiltinESMExports();
}

test("no-overwrite retains a concurrently created output and reports output-exists", async () => {
  for (const flags of [true, false]) {
    await scratch(async (dir) => {
      const file = path.join(dir, "deck.json");
      afterStaging(() => originalWriteFile(file, "concurrent owner's bytes", { flag: "wx" }));
      await assert.rejects(writeFiles([{ file, bytes: bytes("export bytes") }], false, flags), (error) => {
        assert.ok(error instanceof OPFApiError);
        assert.equal(error.code, "output-exists");
        assert.deepEqual(error.details, { path: file });
        assert.match(error.message, flags ? /Use --force/ : /Pass overwrite: true/);
        return true;
      });
      assert.equal(await fs.readFile(file, "utf8"), "concurrent owner's bytes");
      assert.deepEqual(await fs.readdir(dir), ["deck.json"], "staged sibling is cleaned up");
    });
  }
});

test("no-overwrite also refuses a directory created after the preflight", async () => {
  await scratch(async (dir) => {
    const file = path.join(dir, "deck.json");
    afterStaging(() => fs.mkdir(file));
    await assert.rejects(writeFiles([{ file, bytes: bytes("export bytes") }], false), { code: "output-exists" });
    assert.equal((await fs.lstat(file)).isDirectory(), true);
    assert.deepEqual(await fs.readdir(dir), ["deck.json"]);
  });
});

test("a filesystem that refuses hardlinks fails closed without publishing or leaving staging files", async () => {
  await scratch(async (dir) => {
    fs.link = async () => { throw Object.assign(new Error("hardlinks unavailable"), { code: "EPERM" }); };
    syncBuiltinESMExports();
    await assert.rejects(writeFiles([{ file: path.join(dir, "deck.json"), bytes: bytes("export bytes") }], false), { code: "EPERM" });
    assert.deepEqual(await fs.readdir(dir), []);
  });
});

test("successful no-overwrite and explicit overwrite publish complete bytes and clean staging files", async () => {
  await scratch(async (dir) => {
    const a = path.join(dir, "a.json");
    const b = path.join(dir, "b.json");
    await writeFiles([{ file: a, bytes: bytes("A") }, { file: b, bytes: bytes("B") }], false);
    assert.equal(await fs.readFile(a, "utf8"), "A");
    assert.equal(await fs.readFile(b, "utf8"), "B");
    await writeFiles([{ file: a, bytes: bytes("replacement") }], true);
    assert.equal(await fs.readFile(a, "utf8"), "replacement");
    await assert.rejects(writeFiles([{ file: a, bytes: bytes("refused") }], false), { code: "output-exists" });
    assert.equal(await fs.readFile(a, "utf8"), "replacement");
    assert.deepEqual(await fs.readdir(dir), ["a.json", "b.json"]);
  });
});


test("export basenames sanitize both separators, including the input-stem fallback", () => {
  for (const filename of ["safe\\..\\..\\outside", "safe/../../outside"]) {
    assert.equal(deckStem({ filename }, "-"), "safe-..-..-outside");
    assert.equal(deckStem({}, `${filename}.opf.json`).includes("\\"), false);
  }
  assert.equal(deckStem({}, "\\.opf.json"), "deck");
  assert.equal(deckStem({ filename: "Quarterly_2026.É.PPTX" }, "input.json"), "Quarterly_2026.É");
  assert.equal(deckStem({}, "input.opf.json"), "input");
});

test("a real SVG conversion puts safe flat names into its ZIP local and central headers", async () => {
  for (const [filename, expected] of [["safe\\..\\..\\outside", "safe-..-..-outside-1.svg"], ["Quarterly_2026", "Quarterly_2026-1.svg"]]) {
    const result = await convert({ name: "Output name control", filename, slides: [{ title: "One" }] }, { format: "svg", zip: true, text: "system" });
    assert.equal(result.files.length, 1);
    const file = result.files[0];
    assert.equal(file.name, expected.replace(/-1\.svg$/, ".zip"));
    assert.deepEqual(file.entries, [expected]);
    const zip = Buffer.from(file.bytes);
    assert.equal(zip.readUInt32LE(0), 0x04034b50);
    const localName = zip.subarray(30, 30 + zip.readUInt16LE(26)).toString("utf8");
    const end = zip.length - 22;
    assert.equal(zip.readUInt32LE(end), 0x06054b50);
    const central = zip.readUInt32LE(end + 16);
    assert.equal(zip.readUInt32LE(central), 0x02014b50);
    const centralName = zip.subarray(central + 46, central + 46 + zip.readUInt16LE(central + 28)).toString("utf8");
    assert.equal(localName, expected);
    assert.equal(centralName, expected);
    for (const platform of [path.posix, path.win32]) {
      assert.equal(platform.basename(localName), localName);
      assert.equal(platform.isAbsolute(localName), false);
    }
  }
});


test("a partial staging write is closed and removed before any output is published", async () => {
  await scratch(async (dir) => {
    const a = path.join(dir, "a.json");
    const b = path.join(dir, "b.json");
    let staged = 0;
    let failedHandle;
    fs.open = async (file, ...args) => {
      const handle = await originalOpen(file, ...args);
      if (String(file).endsWith(".tmp") && ++staged === 2) {
        failedHandle = handle;
        const write = handle.writeFile.bind(handle);
        handle.writeFile = async () => {
          await write("partial bytes");
          throw Object.assign(new Error("staging space exhausted"), { code: "ENOSPC" });
        };
      }
      return handle;
    };
    syncBuiltinESMExports();
    await assert.rejects(writeFiles([{ file: a, bytes: bytes("A") }, { file: b, bytes: bytes("B") }], false), { code: "ENOSPC" });
    assert.equal(staged, 2, "failure follows a completed first staging write");
    assert.equal(failedHandle.fd, -1, "failed write handle was closed");
    assert.deepEqual(await fs.readdir(dir), [], "neither staged siblings nor final outputs remain");
  });
});

test("an exclusive temporary-name collision never removes another owner's file", async () => {
  await scratch(async (dir) => {
    let collision;
    fs.open = async (file, ...args) => {
      if (String(file).endsWith(".tmp")) {
        collision = file;
        await originalWriteFile(file, "other owner's temporary bytes", { flag: "wx" });
      }
      return originalOpen(file, ...args);
    };
    syncBuiltinESMExports();
    await assert.rejects(writeFiles([{ file: path.join(dir, "deck.json"), bytes: bytes("export bytes") }], false), { code: "EEXIST" });
    assert.equal(await fs.readFile(collision, "utf8"), "other owner's temporary bytes");
    assert.deepEqual(await fs.readdir(dir), [path.basename(collision)]);
  });
});
