import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkRepo, FONT_CDN_HOSTS, scanFile, scanText } from "./check-font-hotlinks.mjs";

const host = (...parts) => parts.join(".");
const googleCss = `https://${host("fonts", "googleapis", "com")}/css2?family=Inter&display=swap`;
const gstatic = `https://${host("fonts", "gstatic", "com")}/s/inter/v1/a.woff2`;

test("flags each kind of font CDN reference", () => {
  const samples = [
    `<link rel="stylesheet" href="${googleCss}">`,
    `@font-face{src:url(${gstatic})}`,
    `<script src="https://${host("use", "typekit", "net")}/abc1def.js"></script>`,
    `<link href="https://${host("fonts", "bunny", "net")}/css?family=inter">`,
    `<link href="https://${host("cdnjs", "cloudflare", "com")}/ajax/libs/font-awesome/6.5.0/css/all.min.css">`,
    `<link href="https://${host("cdn", "jsdelivr", "net")}/npm/@fontsource/inter/index.css">`,
    `@import url("https://example.test/fo${"nts"}/inter.css");`,
    `@font-face{font-family:X;src:url("https://example.test/assets/x.wo${"ff2"}")}`,
    `const face = await fetch("https://example.test/assets/x.wo${"ff2"}");`,
    `const mod = await import('https://example.test/assets/x.tt${"f"}');`,
    `xhr.open("GET", "https://example.test/assets/x.ot${"f"}");`,
    `new FontFace("X", await fetch(new URL("https://example.test/x.wo${"ff"}")));`,
    `<link href="https://${host("api", "fontshare", "com")}/v2/css?f[]=satoshi@1">`,
    `<script src="https://${host("ajax", "googleapis", "com")}/ajax/libs/webfont/1.6.26/webfont.js"></script>`,
    `WebFont.load({
  goo${"gle"}: { families: ["Inter"] },
});`,
    `WebFont.load({ typek${"it"}: { id: "abc" } });`,
    `<link href="https://${host("cdn", "jsdelivr", "net")}/gh/rsms/inter@v4/docs/font-files/InterVariable.wo${"ff2"}">`,
    `import "https://${host("cdn", "jsdelivr", "net")}/gh/user/repo@1/dist/Brand.wo${"ff"}";`,
    `<link href="https://${host("unpkg", "com")}/some-pkg/dist/Brand.tt${"f"}">`,
  ];
  for (const sample of samples) assert.ok(scanText(sample).length > 0, `not flagged: ${sample}`);
  assert.ok(FONT_CDN_HOSTS.length >= 11);
});

test("does not flag bundled files, data URLs or provenance strings", () => {
  const clean = [
    `@font-face{font-family:X;src:url("./files/x.woff2") format("woff2")}`,
    `@font-face{font-family:X;src:url("data:font/ttf;base64,AAAA")}`,
    `import "@fontsource/inter/400.css";`,
    `"source": "https://github.com/googlefonts/roboto/raw/main/Roboto.ttf"`,
    `@import "./local.css";`,
    `const face = await fetch("./assets/x.wo${"ff2"}");`,
    `const face = await fetch("/fonts/x.wo${"ff2"}");`,
    `"url": "https://raw.githubusercontent.com/google/fonts/23e54b51ddffbc7713c583748e3bd86f62b1fa4a/ofl/carlito/Carlito-Regular.tt${"f"}"`,
    `WebFont.load({ custom: { families: ["Local"], urls: ["/fonts.css"] } });`,
    `import fontUrl from "./fonts/x.wo${"ff2"}?url";`,
  ];
  for (const sample of clean) assert.deepEqual(scanText(sample), [], `false positive: ${sample}`);
});

test("allowlist is exact, needs a reason, and goes stale", () => {
  const root = mkdtempSync(path.join(tmpdir(), "font-hotlinks-"));
  try {
    mkdirSync(path.join(root, "docs"));
    writeFileSync(path.join(root, "docs", "policy.md"), `Never load ${host("fonts", "googleapis", "com")} at runtime.\n`);
    writeFileSync(path.join(root, "src.html"), `<link href="${googleCss}">\n`);
    writeFileSync(path.join(root, "ok.css"), `body{font-family:sans-serif}\n`);
    const allowlistFile = path.join(root, "allow.json");
    const files = ["docs/policy.md", "src.html", "ok.css"];

    writeFileSync(allowlistFile, JSON.stringify({ allow: [] }));
    assert.deepEqual(checkRepo({ root, allowlistFile, files }).map((p) => p.file).sort(), ["docs/policy.md", "src.html"]);

    writeFileSync(allowlistFile, JSON.stringify({ allow: [{ path: "docs/policy.md", reason: "policy prose names the forbidden host" }] }));
    assert.deepEqual(checkRepo({ root, allowlistFile, files }).map((p) => p.file), ["src.html"]);

    writeFileSync(allowlistFile, JSON.stringify({ allow: [{ path: "ok.css", reason: "no longer references anything" }] }));
    assert.ok(checkRepo({ root, allowlistFile, files: ["ok.css"] }).some((p) => p.rule === "stale-allowlist-entry"));

    writeFileSync(allowlistFile, JSON.stringify({ allow: [{ path: "docs/*.md", reason: "globs are not accepted" }] }));
    assert.throws(() => checkRepo({ root, allowlistFile, files }), /exact repo-relative path/);
    writeFileSync(allowlistFile, JSON.stringify({ allow: [{ path: "docs/policy.md", reason: "" }] }));
    assert.throws(() => checkRepo({ root, allowlistFile, files }), /needs a reason/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("build output is scanned and never allowlisted", () => {
  const root = mkdtempSync(path.join(tmpdir(), "font-hotlinks-built-"));
  try {
    mkdirSync(path.join(root, "out"));
    writeFileSync(path.join(root, "out", "page.html"), `<link rel="stylesheet" href="${googleCss}">`);
    const allowlistFile = path.join(root, "allow.json");
    writeFileSync(allowlistFile, JSON.stringify({ allow: [] }));
    const problems = checkRepo({ root, allowlistFile, files: [], builtDirs: [path.join(root, "out")] });
    assert.equal(problems.length, 1);
    assert.equal(problems[0].file, "out/page.html");
    assert.ok(checkRepo({ root, allowlistFile, files: [], builtDirs: [path.join(root, "missing")] }).some((p) => p.rule === "built-dir-missing"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("only regular files are scanned: a tracked symlink is skipped, a missing file is not an error", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "font-hotlinks-link-"));
  try {
    mkdirSync(path.join(root, "real"));
    writeFileSync(path.join(root, "real", "page.html"), `<link href="${googleCss}">\n`);
    try {
      symlinkSync("real", path.join(root, "alias"), "dir");
      symlinkSync("real/page.html", path.join(root, "alias.html"));
    } catch {
      t.skip("symlinks are not available here");
      return;
    }
    assert.equal(scanFile(path.join(root, "real", "page.html")).length, 1);
    assert.deepEqual(scanFile(path.join(root, "alias")), []);
    assert.deepEqual(scanFile(path.join(root, "alias.html")), []);
    assert.deepEqual(scanFile(path.join(root, "gone.html")), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("--built directories are relative to --dir, or to the current directory without it", () => {
  const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "check-font-hotlinks.mjs");
  const root = mkdtempSync(path.join(tmpdir(), "font-hotlinks-dir-"));
  try {
    mkdirSync(path.join(root, "packages", "editor", "dist"), { recursive: true });
    writeFileSync(path.join(root, "packages", "editor", "dist", "page.html"), `<link href="${googleCss}">\n`);
    const run = (cwd, ...args) => spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
    const fromPackage = run(path.join(root, "packages", "editor"), "--built", "dist");
    assert.equal(fromPackage.status, 1);
    assert.match(fromPackage.stderr, /dist\/page\.html:1 \[font-cdn-host\]/);
    const withDir = run(root, "--dir", "packages/editor", "--built", "dist");
    assert.equal(withDir.status, 1);
    assert.match(withDir.stderr, /dist\/page\.html:1/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("this repository has no font CDN references", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const problems = checkRepo({ root, allowlistFile: path.join(root, "scripts", "font-hotlink-allowlist.json") });
  assert.deepEqual(problems, []);
});
