import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  compareVersions,
  defaultBranch,
  editManifestText,
  editPeersText,
  floorChanges,
  floorOf,
  isPrepTitle,
  lockstepFlags,
  lockstepOrder,
  main,
  nextStep,
  npmRegistry,
  packageOf,
  parseSpec,
  plan,
  prep,
  raiseRange,
  removeUnreleasedCoreText,
  runTrain,
  TrainStop,
  tagRelease,
  unpublishedFloors,
  unreleasedCoreOf,
  verify,
} from "./release-train.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha = (label) => createHash("sha1").update(label).digest("hex");
const SLSA = "https://slsa.dev/provenance/v1";
const notFound = (route) => Object.assign(new Error(`GET ${route}: HTTP 404 Not Found`), { status: 404 });

// ---------------------------------------------------------------------------------------------------------------
// Pure helpers

test("versions and ranges", () => {
  assert.equal(compareVersions("0.12.10", "0.12.9"), 1);
  assert.equal(compareVersions("0.12.1", "0.12.1"), 0);
  assert.equal(compareVersions("0.13.0-rc.1", "0.13.0"), -1);
  assert.deepEqual(floorOf("^0.12.0"), { operator: "^", version: "0.12.0" });
  assert.deepEqual(floorOf("0.12.0"), { operator: "", version: "0.12.0" });
  assert.equal(floorOf("workspace:*"), null);
  assert.equal(floorOf("^0.11.0 || ^0.12.0"), null);
  assert.equal(raiseRange("^0.12.0", "0.12.1"), "^0.12.1");
  assert.equal(raiseRange("0.12.0", "0.12.1"), "0.12.1", "an exact devDependency pin moves to the exact new version");
  assert.equal(raiseRange("~0.12.0", "0.12.3"), "~0.12.3");
  assert.equal(raiseRange("^0.12.2", "0.12.1"), null, "a floor is never lowered");
  assert.equal(raiseRange("workspace:*", "0.12.1"), null);
});

test("RR-55: removeUnreleasedCoreText deletes the field in every layout and changes nothing else", () => {
  const field = '"requiresUnreleasedCore": "0.14.0"';
  const cases = {
    "only key, not first property": `{\n  "name": "x",\n  "opf": {\n    ${field}\n  },\n  "version": "1.0.0"\n}\n`,
    "only key, last property": `{\n  "name": "x",\n  "version": "1.0.0",\n  "opf": { ${field} }\n}\n`,
    "only key, first property": `{\n  "opf": {\n    ${field}\n  },\n  "name": "x"\n}\n`,
    "alongside another key": `{\n  "name": "x",\n  "opf": {\n    ${field},\n    "other": 1\n  }\n}\n`,
    "after another key": `{\n  "name": "x",\n  "opf": {\n    "other": 1,\n    ${field}\n  }\n}\n`,
    "the only property": `{ "opf": { ${field} } }\n`,
  };
  for (const [name, text] of Object.entries(cases)) {
    const result = removeUnreleasedCoreText(text);
    assert.equal(result.removed, "0.14.0", name);
    const expected = JSON.parse(text);
    delete expected.opf.requiresUnreleasedCore;
    if (!Object.keys(expected.opf).length) delete expected.opf;
    assert.deepEqual(JSON.parse(result.text), expected, name);
    assert.equal(unreleasedCoreOf(JSON.parse(result.text)), null, name);
    assert.ok(result.text.endsWith("\n"), name);
  }
  assert.equal(removeUnreleasedCoreText(cases["only key, not first property"]).text, '{\n  "name": "x",\n  "version": "1.0.0"\n}\n');
  const none = '{\n  "name": "x"\n}\n';
  assert.deepEqual(removeUnreleasedCoreText(none), { text: none, removed: null });
  assert.equal(unreleasedCoreOf({ opf: {} }), null);
});

test("packages, specs, lockstep order and release-prep titles", () => {
  assert.equal(packageOf("opf").key, "core");
  assert.equal(packageOf("opf-pptx").key, "pptx");
  assert.equal(packageOf("@openpresentation/cli").key, "cli");
  assert.throws(() => packageOf("opf-site"), /unknown package/);
  assert.deepEqual(
    (({ pkg, version }) => [pkg.key, version])(parseSpec("@openpresentation/opf-pptx@0.12.2")),
    ["pptx", "0.12.2"],
  );
  assert.equal(parseSpec("editor").version, undefined);
  assert.deepEqual(
    lockstepOrder({ cli: "0.10.1", editor: "0.11.3", core: "0.12.1", pptx: "0.12.3", render: "0.12.1" }).map((pkg) => pkg.key),
    ["core", "render", "pptx", "editor", "cli"],
  );
  assert.equal(defaultBranch(packageOf("pptx"), "0.12.3"), "codex/release-pptx-0-12-3");
  assert.ok(isPrepTitle(packageOf("core"), "0.12.0", "RR-20: release core 0.12.0"));
  assert.ok(isPrepTitle(packageOf("pptx"), "0.12.2", "RR-17: release opf-pptx 0.12.2"));
  assert.ok(isPrepTitle(packageOf("cli"), "0.10.0", "RR-20: release CLI 0.10.0 (bundles core 0.12.0)"));
  assert.ok(!isPrepTitle(packageOf("core"), "0.12.0", "RR-20: release CLI 0.10.0 (bundles core 0.12.0)"), "the CLI PR is not core's");
  assert.ok(!isPrepTitle(packageOf("core"), "0.12.2", "RR-17: release opf-pptx 0.12.2"), "opf-pptx is not core");
  assert.ok(!isPrepTitle(packageOf("pptx"), "0.12.2", "RR-17: release opf-pptx 0.12.20"));
});

test("floors: only @openpresentation ranges of the train move, with the file's own formatting", () => {
  const text = `{
  "name": "@openpresentation/opf-pptx",
  "version": "0.12.2",
  "dependencies": {
    "@openpresentation/opf": "^0.12.0",
    "jszip": "3.10.1"
  },
  "peerDependencies": { "@openpresentation/opf-render": "^0.12.0" },
  "devDependencies": {
    "@openpresentation/opf-render": "0.12.0",
    "playwright": "1.63.0"
  }
}
`;
  const changes = floorChanges(JSON.parse(text), { "@openpresentation/opf": "0.12.1", "@openpresentation/opf-render": "0.12.1" });
  assert.deepEqual(changes, [
    { field: "dependencies", name: "@openpresentation/opf", from: "^0.12.0", to: "^0.12.1" },
    { field: "peerDependencies", name: "@openpresentation/opf-render", from: "^0.12.0", to: "^0.12.1" },
    { field: "devDependencies", name: "@openpresentation/opf-render", from: "0.12.0", to: "0.12.1" },
  ]);
  const edited = editManifestText(text, { version: "0.12.3", changes });
  assert.equal(
    edited,
    text
      .replace('"version": "0.12.2"', '"version": "0.12.3"')
      .replace('"@openpresentation/opf": "^0.12.0"', '"@openpresentation/opf": "^0.12.1"')
      .replace('{ "@openpresentation/opf-render": "^0.12.0" }', '{ "@openpresentation/opf-render": "^0.12.1" }')
      .replace('"@openpresentation/opf-render": "0.12.0"', '"@openpresentation/opf-render": "0.12.1"'),
  );
  assert.throws(() => editManifestText(text, { changes: [{ field: "dependencies", name: "@openpresentation/opf", from: "^0.11.0", to: "^0.12.1" }] }), /no "@openpresentation\/opf": "\^0.11.0"/);
  const peers = editPeersText('export const PEER_RANGES = { [RENDER_PACKAGE]: "^0.12.0", [PPTX_PACKAGE]: "^0.12.0" } as const;\n', [
    { field: "peerDependencies", name: "@openpresentation/opf-pptx", from: "^0.12.0", to: "^0.12.3" },
  ]);
  assert.equal(peers.text, 'export const PEER_RANGES = { [RENDER_PACKAGE]: "^0.12.0", [PPTX_PACKAGE]: "^0.12.3" } as const;\n');
  assert.deepEqual(peers.applied, ["@openpresentation/opf-pptx"]);
});

test("the lockstep rule is flagged for every sibling whose core floor stays below the new core, never decided", () => {
  const floors = { render: { spec: "^0.12.0", planned: "^0.12.1" }, pptx: { spec: "^0.12.0" }, editor: { spec: "^0.12.0", planned: "^0.12.0" } };
  const flags = lockstepFlags({ core: "0.12.1", render: "0.12.1", editor: "0.11.3" }, floors, ["changes/x.md"]);
  assert.equal(flags.length, 2);
  assert.match(flags[0], /^opf-pptx: its core floor is \^0\.12\.0 and opf-pptx is not in the train\. If core 0\.12\.1 moves geometry/);
  assert.match(flags[0], /Hints in core's notes: changes\/x\.md/);
  assert.match(flags[1], /^opf-editor: its core floor stays \^0\.12\.0 in its release 0\.11\.3/);
  assert.deepEqual(lockstepFlags({ pptx: "0.12.3" }, floors), [], "no core in the train, no flag");
});

// ---------------------------------------------------------------------------------------------------------------
// A fake GitHub and npm

/**
 * One repository: `commits` are manifest-changing commits, newest first: [{ sha, files: { path: text } }]. Every
 * commit's files are what `contents?ref=<sha>` serves; `head` serves the newest.
 */
function manifestText(name, version, extra = {}) {
  return `${JSON.stringify({ name, version, ...extra }, null, 2)}\n`;
}

function fakeWorld() {
  const world = {
    repos: {},
    npm: {},
    attestations: {},
    distTags: {},
    writes: [],
    calls: [],
    clock: 0,
    onRunsPoll: null,
  };
  world.repo = (name, { required = [] } = {}) => {
    world.repos[name] ??= { head: null, files: {}, history: {}, commitPulls: {}, openPulls: [], tags: {}, required, checkRuns: {}, runs: [], releases: {}, offMain: new Set() };
    return world.repos[name];
  };
  /** Adds a commit on main that sets `files` (others are inherited from the previous head). */
  world.commit = (repoName, label, files, { pull } = {}) => {
    const repo = world.repo(repoName);
    const id = sha(`${repoName}:${label}`);
    repo.files[id] = { ...(repo.head ? repo.files[repo.head] : {}), ...files };
    for (const file of Object.keys(files)) {
      repo.history[file] ??= [];
      repo.history[file].unshift(id);
    }
    repo.head = id;
    if (pull) repo.commitPulls[id] = [{ number: pull, html_url: `https://github.com/OpenPresentation/${repoName}/pull/${pull}`, title: `release ${pull}`, merged_at: "2026-10-03T00:00:00Z", base: { ref: "main" } }];
    return id;
  };
  world.green = (repoName, commit, names = ["CI"]) => {
    world.repo(repoName).checkRuns[commit] = names.map((name) => ({ name, status: "completed", conclusion: "success", started_at: "2026-10-03T00:00:00Z" }));
  };
  /** Publishes name@version from repo@commit as the repository's workflow would. */
  world.publish = (pkgKey, version, commit, { workflowRef, workflowPath } = {}) => {
    const pkg = packageOf(pkgKey);
    const integrityBytes = createHash("sha512").update(`${pkg.name}@${version}`).digest();
    const url = `https://registry.npmjs.org/-/npm/v1/attestations/${pkg.name.replace("/", "%2f")}@${version}`;
    world.npm[`${pkg.name}@${version}`] = { name: pkg.name, version, gitHead: commit, dist: { integrity: `sha512-${integrityBytes.toString("base64")}`, attestations: { url, provenance: { predicateType: SLSA } } } };
    const statement = {
      subject: [{ name: `pkg:npm/${pkg.name}@${version}`, digest: { sha512: integrityBytes.toString("hex") } }],
      predicate: {
        buildDefinition: {
          externalParameters: { workflow: { ref: workflowRef ?? `refs/tags/${pkg.tagPrefix}${version}`, repository: `https://github.com/OpenPresentation/${pkg.repo}`, path: workflowPath ?? `.github/workflows/${pkg.workflow}` } },
          resolvedDependencies: [{ uri: "git+https://github.com/x", digest: { gitCommit: commit } }],
        },
        runDetails: { metadata: { invocationId: "https://github.com/OpenPresentation/x/actions/runs/1/attempts/1" } },
      },
    };
    world.attestations[url] = { attestations: [{ predicateType: SLSA, bundle: { dsseEnvelope: { payload: Buffer.from(JSON.stringify(statement)).toString("base64") } } }] };
    world.distTags[pkg.name] = { latest: version };
    if (pkg.githubRelease) world.repo(pkg.repo).releases[`${pkg.tagPrefix}${version}`] = { html_url: `https://github.com/OpenPresentation/${pkg.repo}/releases/tag/${pkg.tagPrefix}${version}`, draft: false };
  };
  world.audit = (name, version) => ({ ok: true, report: { invalid: [], missing: [], verified: [{ name, version, attestations: { url: "x" } }] } });

  /** GET routes below /repos/OpenPresentation/<repo>/: [pattern, (match, repo, route) => response]. */
  const routes = [
    [/^git\/ref\/heads\/main$/, (_, repo) => ({ object: { sha: repo.head } })],
    [
      /^contents\/(.+)\?ref=([^&]+)$/,
      ([, path, ref], repo, route) => {
        const files = repo.files[decodeURIComponent(ref) === "main" ? repo.head : decodeURIComponent(ref)];
        const file = decodeURIComponent(path);
        if (!files) throw notFound(route);
        if (file in files) return { encoding: "base64", content: Buffer.from(files[file]).toString("base64") };
        const listing = Object.keys(files).filter((name) => name.startsWith(`${file}/`)).map((name) => ({ type: "file", name: name.slice(file.length + 1) }));
        if (listing.length) return listing;
        throw notFound(route);
      },
    ],
    [
      /^commits\?sha=([0-9a-f]{40})&path=([^&]+)&/,
      ([, head, file], repo) => {
        const history = repo.history[decodeURIComponent(file)] ?? [];
        return history.slice(Math.max(0, history.indexOf(head))).map((id) => ({ sha: id }));
      },
    ],
    [/^commits\/([0-9a-f]{40})\/pulls$/, ([, id], repo) => repo.commitPulls[id] ?? []],
    [/^pulls\?state=open/, (_, repo) => repo.openPulls],
    [
      /^git\/ref\/tags\/(.+)$/,
      ([, encoded], repo, route) => {
        const tag = decodeURIComponent(encoded);
        if (!repo.tags[tag]) throw notFound(route);
        return { ref: `refs/tags/${tag}`, object: { type: "commit", sha: repo.tags[tag] } };
      },
    ],
    [/^rules\/branches\/main$/, (_, repo) => (repo.required.length ? [{ type: "required_status_checks", parameters: { required_status_checks: repo.required.map((context) => ({ context })) } }] : [])],
    [/^commits\/([0-9a-f]{40})\/check-runs/, ([, id], repo) => ({ check_runs: repo.checkRuns[id] ?? [] })],
    [/^commits\/[0-9a-f]{40}\/status$/, () => ({ statuses: [] })],
    [/^compare\/([0-9a-f]{40})\.\.\.main$/, ([, id], repo) => ({ status: repo.offMain.has(id) ? "diverged" : "ahead", ahead_by: 0, behind_by: 0 })],
    [
      /^actions\/workflows\/([\w.-]+)\/runs\?/,
      ([, workflow], repo) => {
        world.onRunsPoll?.(workflow);
        return { workflow_runs: repo.runs };
      },
    ],
    [
      /^releases\/tags\/(.+)$/,
      ([, tag], repo, route) => {
        const release = repo.releases[decodeURIComponent(tag)];
        if (!release) throw notFound(route);
        return release;
      },
    ],
  ];
  const api = async (route, { method = "GET", body } = {}) => {
    world.calls.push(`${method} ${route}`);
    const scope = /^\/repos\/OpenPresentation\/([\w-]+)\/(.*)$/.exec(route);
    if (!scope) throw new Error(`unexpected ${method} ${route}`);
    const [, name, rest] = scope;
    const repo = world.repos[name];
    if (!repo) throw notFound(route);
    if (method === "POST" && rest === "git/refs") {
      world.writes.push({ repo: name, ref: body.ref, sha: body.sha });
      if (body.ref.startsWith("refs/tags/")) repo.tags[body.ref.slice(10)] = body.sha;
      return { ref: body.ref, object: { sha: body.sha } };
    }
    if (method === "POST" && rest === "pulls") {
      world.writes.push({ repo: name, pull: body });
      const number = 900 + world.writes.length;
      return { number, html_url: `https://github.com/OpenPresentation/${name}/pull/${number}` };
    }
    if (method === "GET") {
      for (const [pattern, handle] of routes) {
        const match = pattern.exec(rest);
        if (match) return handle(match, repo, route);
      }
    }
    throw new Error(`unexpected ${method} ${route}`);
  };
  const npm = {
    manifest: async (name, version) => world.npm[`${name}@${version}`] ?? null,
    distTags: async (name) => world.distTags[name] ?? {},
    attestations: async (url) => world.attestations[url] ?? null,
    auditSignatures: (name, version) => world.audit(name, version),
  };
  const logs = [];
  world.logs = logs;
  world.deps = {
    api,
    npm,
    now: () => world.clock,
    sleep: async (ms) => {
      world.clock += ms;
    },
    log: (line) => logs.push(line),
  };
  return world;
}

/** The published 0.12.0 set, as on the registry after the RR-20 train. */
function publishedWorld() {
  const world = fakeWorld();
  const coreRelease = world.commit("opf", "core-0.12.0", {
    "packages/javascript/package.json": manifestText("@openpresentation/opf", "0.12.0"),
    "packages/cli/package.json": manifestText("@openpresentation/cli", "0.10.0", { devDependencies: { "@openpresentation/opf": "workspace:*", "@openpresentation/opf-render": "0.12.0", "@openpresentation/opf-pptx": "0.12.0" }, peerDependencies: { "@openpresentation/opf-render": "^0.12.0", "@openpresentation/opf-pptx": "^0.12.0" } }),
    "CHANGELOG.md": "# Changelog\n\n## Unreleased\n\n## 0.12.0 (2026-10-02)\n\n- Cover composition moves title geometry.\n",
    "changes/README.md": "readme",
  }, { pull: 280 });
  world.repo("opf").required = ["packages", "Verify OPF packages"];
  world.green("opf", coreRelease, ["packages", "Verify OPF packages", "Cursor Bugbot"]);
  world.repo("opf").tags["opf-v0.12.0"] = coreRelease;
  world.publish("core", "0.12.0", coreRelease);
  const render = world.commit("opf-render", "render-0.12.0", { "package.json": manifestText("@openpresentation/opf-render", "0.12.0", { dependencies: { "@openpresentation/opf": "^0.12.0" } }) }, { pull: 110 });
  world.green("opf-render", render);
  world.repo("opf-render").tags["opf-render-v0.12.0"] = render;
  world.publish("render", "0.12.0", render);
  const pptx = world.commit("opf-pptx", "pptx-0.12.2", { "package.json": manifestText("@openpresentation/opf-pptx", "0.12.2", { dependencies: { "@openpresentation/opf": "^0.12.0" }, peerDependencies: { "@openpresentation/opf-render": "^0.12.0" }, devDependencies: { "@openpresentation/opf-render": "0.12.0" } }) }, { pull: 155 });
  world.green("opf-pptx", pptx);
  world.repo("opf-pptx").tags["opf-pptx-v0.12.2"] = pptx;
  world.publish("pptx", "0.12.2", pptx);
  const editor = world.commit("opf-editor", "editor-0.11.2", { "package.json": manifestText("@openpresentation/opf-editor", "0.11.2", { dependencies: { "@openpresentation/opf": "^0.12.0" }, peerDependencies: { "@openpresentation/opf-render": "^0.12.0" }, devDependencies: { "@openpresentation/opf-render": "^0.12.0", "@openpresentation/opf-pptx": "^0.12.0" } }) }, { pull: 85 });
  world.green("opf-editor", editor);
  world.repo("opf-editor").tags["opf-editor-v0.11.2"] = editor;
  world.publish("editor", "0.11.2", editor);
  return world;
}

const isWrite = (call) => !call.startsWith("GET ");

// ---------------------------------------------------------------------------------------------------------------
// verify

test("verify passes for a published package and checks gitHead, provenance, audit signatures and the release", async () => {
  const world = publishedWorld();
  const result = await verify(world.deps, packageOf("pptx"), "0.12.2");
  assert.equal(result.ok, true, JSON.stringify(result.checks, null, 2));
  assert.deepEqual(result.checks.map((check) => check.name), ["npm version", "tag", "gitHead", "tag on main", "version at tag", "dist.attestations", "SLSA provenance", "npm audit signatures", "GitHub release", "dist-tag"]);
  const core = await verify(world.deps, packageOf("core"), "0.12.0");
  assert.equal(core.ok, true);
  assert.match(core.checks.find((check) => check.name === "GitHub release").detail, /releases\/tag\/opf-v0\.12\.0/);
  assert.ok(!world.calls.some(isWrite), "verify only reads");
});

test("verify fails on a gitHead that is not the tag, foreign provenance, a missing release or a failed audit", async () => {
  const world = publishedWorld();
  world.npm["@openpresentation/opf-pptx@0.12.2"].gitHead = sha("elsewhere");
  const failed = (result) => result.checks.filter((check) => !check.ok).map((check) => check.name);
  assert.deepEqual(failed(await verify(world.deps, packageOf("pptx"), "0.12.2")), ["gitHead"]);

  const foreign = publishedWorld();
  foreign.publish("render", "0.12.0", foreign.repos["opf-render"].head, { workflowRef: "refs/heads/main" });
  const provenance = await verify(foreign.deps, packageOf("render"), "0.12.0");
  assert.deepEqual(failed(provenance), ["SLSA provenance"]);
  assert.match(provenance.checks.find((check) => check.name === "SLSA provenance").detail, /ref refs\/heads\/main/);

  const noRelease = publishedWorld();
  noRelease.repos.opf.releases = {};
  noRelease.audit = (name) => ({ ok: true, report: { invalid: [], missing: [], verified: [{ name, version: "0.12.0" }] } });
  assert.deepEqual(failed(await verify(noRelease.deps, packageOf("core"), "0.12.0")), ["npm audit signatures", "GitHub release"]);

  const missing = await verify(fakeWorld().deps, packageOf("editor"), "9.9.9");
  assert.deepEqual(failed(missing), ["npm version"]);
});

// ---------------------------------------------------------------------------------------------------------------
// verify: npm propagation (RR-51, the first live use for core 0.12.1)

const failedChecks = (result) => result.checks.filter((check) => !check.ok).map((check) => check.name);
const BUNDLE = "https://registry.npmjs.org/-/npm/v1/attestations/@openpresentation%2fopf-render@0.12.0";

/** The attestation bundle answers HTTP 404 (null) for the first `times` fetches, as the registry did minutes after publish. */
function bundleAppearsAfter(world, times) {
  const bundle = world.attestations[BUNDLE];
  let fetches = 0;
  world.deps.npm.attestations = async () => {
    fetches += 1;
    return fetches > times ? bundle : null;
  };
  return () => fetches;
}

test("verify with a wait retries a 404 attestation bundle until it appears, and fails fast without one", async () => {
  const world = publishedWorld();
  const fetches = bundleAppearsAfter(world, 2);
  const result = await verify(world.deps, packageOf("render"), "0.12.0", { waitMinutes: 15, pollSeconds: 30 });
  assert.equal(result.ok, true, JSON.stringify(result.checks, null, 2));
  assert.equal(fetches(), 3);
  assert.equal(world.clock, 60_000, "two polls of 30 s");
  assert.equal(world.logs.filter((line) => /waiting for npm to propagate the attestation bundle of @openpresentation\/opf-render@0\.12\.0 \(HTTP 404/.test(line)).length, 2);

  const fast = publishedWorld();
  bundleAppearsAfter(fast, 1);
  const result404 = await verify(fast.deps, packageOf("render"), "0.12.0");
  assert.deepEqual(failedChecks(result404), ["SLSA provenance"]);
  assert.match(result404.checks.find((check) => check.name === "SLSA provenance").detail, /not served yet \(HTTP 404\)$/);
  assert.equal(fast.clock, 0, "standalone verify does not wait unless asked");
});

test("verify with a wait retries a notarget scratch install until npm can serve the version", async () => {
  const world = publishedWorld();
  let installs = 0;
  world.deps.npm.auditSignatures = (name, version) => {
    installs += 1;
    if (installs <= 2) return { ok: false, pending: true, error: `npm install failed: npm error code ETARGET npm error notarget No matching version found for ${name}@${version}.` };
    return world.audit(name, version);
  };
  const result = await verify(world.deps, packageOf("render"), "0.12.0", { waitMinutes: 15, pollSeconds: 30 });
  assert.equal(result.ok, true, JSON.stringify(result.checks, null, 2));
  assert.equal(installs, 3);
  assert.equal(world.clock, 60_000);

  const fast = publishedWorld();
  fast.deps.npm.auditSignatures = () => ({ ok: false, pending: true, error: "npm install failed: notarget" });
  assert.deepEqual(failedChecks(await verify(fast.deps, packageOf("render"), "0.12.0")), ["npm audit signatures"]);
  assert.equal(fast.clock, 0);
});

test("verify fails at once on provenance that is present but wrong, an invalid signature or an unrelated install failure, even with a wait", async () => {
  const foreign = publishedWorld();
  foreign.publish("render", "0.12.0", foreign.repos["opf-render"].head, { workflowRef: "refs/heads/main" });
  const provenance = await verify(foreign.deps, packageOf("render"), "0.12.0", { waitMinutes: 15, pollSeconds: 30 });
  assert.deepEqual(failedChecks(provenance), ["SLSA provenance"]);
  assert.match(provenance.checks.find((check) => check.name === "SLSA provenance").detail, /does not match: ref refs\/heads\/main/);
  assert.equal(foreign.clock, 0, "no wait");

  const wrongCommit = publishedWorld();
  wrongCommit.publish("render", "0.12.0", sha("another commit"));
  assert.match((await verify(wrongCommit.deps, packageOf("render"), "0.12.0", { waitMinutes: 15 })).checks.find((check) => check.name === "SLSA provenance").detail, /source commit/);
  assert.equal(wrongCommit.clock, 0);

  const noSlsa = publishedWorld();
  noSlsa.attestations[BUNDLE] = { attestations: [{ predicateType: "https://github.com/npm/attestation/tree/main/specs/publish/v0.1", bundle: {} }] };
  const missingSlsa = await verify(noSlsa.deps, packageOf("render"), "0.12.0", { waitMinutes: 15 });
  assert.match(missingSlsa.checks.find((check) => check.name === "SLSA provenance").detail, /no SLSA provenance in the attestation bundle/);
  assert.equal(noSlsa.clock, 0, "a bundle that arrived without SLSA is final");

  const invalid = publishedWorld();
  invalid.audit = (name, version) => ({ ok: false, report: { invalid: [{ name, version }], missing: [], verified: [] } });
  assert.deepEqual(failedChecks(await verify(invalid.deps, packageOf("render"), "0.12.0", { waitMinutes: 15 })), ["npm audit signatures"]);
  assert.equal(invalid.clock, 0);

  const other = publishedWorld();
  other.deps.npm.auditSignatures = () => ({ ok: false, error: "npm install failed: EAI_AGAIN getaddrinfo" });
  assert.deepEqual(failedChecks(await verify(other.deps, packageOf("render"), "0.12.0", { waitMinutes: 15 })), ["npm audit signatures"]);
  assert.equal(other.clock, 0);
});

test("verify times out with a failing check that says the bundle or install never propagated", async () => {
  const world = publishedWorld();
  const fetches = bundleAppearsAfter(world, Infinity);
  world.deps.npm.auditSignatures = () => ({ ok: false, pending: true, error: "npm install failed: notarget No matching version found" });
  const result = await verify(world.deps, packageOf("render"), "0.12.0", { waitMinutes: 2, pollSeconds: 30 });
  assert.deepEqual(failedChecks(result), ["SLSA provenance", "npm audit signatures"]);
  assert.equal(fetches(), 5, "probes at 0, 30, 60, 90 and 120 s");
  assert.equal(world.clock, 240_000, "two minutes for the bundle, then two for the install");
  assert.match(result.checks.find((check) => check.name === "SLSA provenance").detail, /still not propagated after 2 min/);
  assert.match(result.checks.find((check) => check.name === "npm audit signatures").detail, /notarget.*still not propagated after 2 min/);
});

test("npmRegistry flags a notarget install as pending and any other install failure as final", () => {
  const exec = (stderr) => (_command, args) => ({ status: args[0] === "install" ? 1 : 0, stdout: "", stderr });
  const scratch = mkdtempSync(path.join(os.tmpdir(), "rt-audit-"));
  try {
    const lag = npmRegistry({ exec: exec("npm error code ETARGET\nnpm error notarget No matching version found for @openpresentation/opf@0.12.1.") }).auditSignatures("@openpresentation/opf", "0.12.1", { scratch });
    assert.deepEqual([lag.ok, lag.pending], [false, true]);
    const real = npmRegistry({ exec: exec("npm error code EINTEGRITY\nnpm error sha512 mismatch") }).auditSignatures("@openpresentation/opf", "0.12.1", { scratch });
    assert.deepEqual([real.ok, real.pending], [false, false]);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("tag --execute waits for the attestation bundle after the version appears, and --attest-wait-minutes 0 does not", async () => {
  const { world, release } = readyWorld();
  world.onRunsPoll = () => {
    world.repos["opf-pptx"].runs = [{ id: 7, head_branch: "opf-pptx-v0.12.3", head_sha: release, status: "completed", conclusion: "success", html_url: "https://github.com/run/7" }];
    world.publish("pptx", "0.12.3", release);
    const bundle = world.attestations["https://registry.npmjs.org/-/npm/v1/attestations/@openpresentation%2fopf-pptx@0.12.3"];
    let fetches = 0;
    world.deps.npm.attestations = async () => (++fetches > 3 ? bundle : null);
  };
  const result = await tagRelease(world.deps, packageOf("pptx"), "0.12.3", { pptx: "0.12.3" }, { execute: true });
  assert.equal(result.status, "released");
  assert.equal(world.clock, 90_000, "three 30 s polls waited for the bundle");

  const impatient = readyWorld();
  impatient.world.onRunsPoll = () => {
    impatient.world.repos["opf-pptx"].runs = [{ id: 7, head_branch: "opf-pptx-v0.12.3", head_sha: impatient.release, status: "completed", conclusion: "success", html_url: "https://github.com/run/7" }];
    impatient.world.publish("pptx", "0.12.3", impatient.release);
    impatient.world.deps.npm.attestations = async () => null;
  };
  await assert.rejects(
    tagRelease(impatient.world.deps, packageOf("pptx"), "0.12.3", { pptx: "0.12.3" }, { execute: true, attestWaitMinutes: 0 }),
    (error) => error instanceof TrainStop && /is on npm but did not verify/.test(error.message),
  );
  assert.equal(impatient.world.clock, 0);
});

test("main: verify --wait <minutes> retries propagation, and a negative wait is refused", async () => {
  const world = publishedWorld();
  bundleAppearsAfter(world, 2);
  assert.equal(await main(["verify", "render@0.12.0", "--wait", "5", "--attest-poll-seconds", "10"], world.deps), 0);
  assert.equal(world.clock, 20_000);
  const fast = publishedWorld();
  bundleAppearsAfter(fast, 2);
  assert.equal(await main(["verify", "render@0.12.0"], fast.deps), 1);
  assert.equal(fast.clock, 0);
  await assert.rejects(main(["verify", "render@0.12.0", "--wait", "-1"], fast.deps), /--wait must be a non-negative number/);
});

// ---------------------------------------------------------------------------------------------------------------
// plan

test("plan for a next patch reports every missing release-prep PR, the upstream waits and the next command", async () => {
  const world = publishedWorld();
  const train = { core: "0.12.1", render: "0.12.1", pptx: "0.12.3", editor: "0.11.3", cli: "0.10.1" };
  const result = await plan(world.deps, train);
  assert.deepEqual(result.states.map((state) => [state.key, state.step]), [
    ["core", "prep-needed"],
    ["render", "prep-needed"],
    ["pptx", "prep-needed"],
    ["editor", "prep-needed"],
    ["cli", "prep-needed"],
  ]);
  assert.deepEqual(result.states.find((s) => s.key === "pptx").waitsFor, ["@openpresentation/opf@0.12.1", "@openpresentation/opf-render@0.12.1"]);
  assert.deepEqual(
    result.states.find((s) => s.key === "cli").floorChanges.map((c) => `${c.field} ${c.name} ${c.to}`),
    ["peerDependencies @openpresentation/opf-render ^0.12.1", "peerDependencies @openpresentation/opf-pptx ^0.12.3", "devDependencies @openpresentation/opf-render 0.12.1", "devDependencies @openpresentation/opf-pptx 0.12.3"],
  );
  assert.deepEqual(result.flags, [], "every sibling raises its core floor in this train");
  assert.equal(nextStep(result), "node scripts/release-train.mjs prep core --core 0.12.1 --render 0.12.1 --pptx 0.12.3 --editor 0.11.3 --cli 0.10.1 --execute");
  assert.ok(!world.calls.some(isWrite));
});

test("plan flags siblings left on the old core floor and reads geometry hints from core's fragments", async () => {
  const world = publishedWorld();
  world.commit("opf", "fragment", { "changes/rr-99-cover.md": "---\ntype: changed\npackages: [opf]\n---\nRR-99: cover composition moves the title geometry.\n", "changes/rr-98-docs.md": "---\ntype: changed\npackages: []\n---\nRR-98: docs only.\n" });
  const result = await plan(world.deps, { core: "0.12.1", pptx: "0.12.3" });
  assert.equal(result.flags.length, 2);
  assert.match(result.flags[0], /^opf-render: its core floor is \^0\.12\.0 and opf-render is not in the train/);
  assert.match(result.flags[0], /Hints in core's notes: changes\/rr-99-cover\.md\.$/);
  assert.match(result.flags[1], /^opf-editor:/);
});

test("opf#498: an optional peer on a later package of the train, at the train's version, is not an unpublished floor", async () => {
  const published = new Set(["@openpresentation/opf-render@0.16.0", "@openpresentation/opf-pptx@0.16.1"]);
  const deps = { npm: { manifest: async (name, version) => (published.has(`${name}@${version}`) ? { name, version } : null) } };
  const core = {
    name: "@openpresentation/opf",
    version: "0.17.0",
    peerDependencies: { "@openpresentation/opf-pptx": "^0.17.0", "@openpresentation/opf-render": "^0.17.0" },
    peerDependenciesMeta: { "@openpresentation/opf-pptx": { optional: true }, "@openpresentation/opf-render": { optional: true } },
  };
  const train = { core: "0.17.0", render: "0.17.0", pptx: "0.17.0" };
  assert.deepEqual(await unpublishedFloors(deps, core, packageOf("core"), train), []);
  // Not in the train, at another version than the train's, or not optional: still unpublished.
  assert.deepEqual(await unpublishedFloors(deps, core, packageOf("core"), { core: "0.17.0", render: "0.17.0" }), ["peerDependencies @openpresentation/opf-pptx ^0.17.0"]);
  assert.deepEqual(await unpublishedFloors(deps, core, packageOf("core"), { ...train, pptx: "0.17.1" }), ["peerDependencies @openpresentation/opf-pptx ^0.17.0"]);
  const required = { ...core, peerDependenciesMeta: { "@openpresentation/opf-pptx": { optional: true } } };
  assert.deepEqual(await unpublishedFloors(deps, required, packageOf("core"), train), ["peerDependencies @openpresentation/opf-render ^0.17.0"]);
  // A later stage only: the renderer's dependency on a core that is not on npm stays a problem in any train.
  const render = { name: "@openpresentation/opf-render", version: "0.17.0", dependencies: { "@openpresentation/opf": "^0.17.0" } };
  assert.deepEqual(await unpublishedFloors(deps, render, packageOf("render"), train), ["dependencies @openpresentation/opf ^0.17.0"]);
});

test("plan: a merged release-prep PR on a green commit is ready to tag; red or lagging floors are reported", async () => {
  const world = publishedWorld();
  const release = world.commit("opf-pptx", "pptx-0.12.3", { "package.json": manifestText("@openpresentation/opf-pptx", "0.12.3", { dependencies: { "@openpresentation/opf": "^0.12.0" } }) }, { pull: 160 });
  world.commit("opf-pptx", "later", { "README.md": "later" });
  world.repos["opf-pptx"].history["package.json"] = [release, ...world.repos["opf-pptx"].history["package.json"].filter((id) => id !== release)];
  world.green("opf-pptx", release);
  let result = await plan(world.deps, { pptx: "0.12.3" });
  const state = result.states[0];
  assert.equal(state.step, "ready-to-tag");
  assert.equal(state.release.sha, release);
  assert.equal(state.release.pull.number, 160);
  assert.match(state.notes.join("\n"), /main moved on after the release commit/);
  assert.equal(nextStep(result), "node scripts/release-train.mjs tag pptx --pptx 0.12.3 --execute");

  // A failed Dependabot update job on the release commit is advisory (its own cooldown, not the release's code).
  world.repos["opf-pptx"].checkRuns[release] = [{ name: "CI", status: "completed", conclusion: "success", started_at: "1" }, { name: "Dependabot", status: "completed", conclusion: "failure", started_at: "1" }];
  assert.equal((await plan(world.deps, { pptx: "0.12.3" })).states[0].step, "ready-to-tag");

  world.repos["opf-pptx"].checkRuns[release] = [{ name: "CI", status: "completed", conclusion: "failure", started_at: "1" }];
  result = await plan(world.deps, { pptx: "0.12.3" });
  assert.match(result.states[0].problems.join("\n"), /checks on the release commit [0-9a-f]{12}: red \(failing: CI\)/);

  world.green("opf-pptx", release);
  result = await plan(world.deps, { core: "0.12.0", pptx: "0.12.3" });
  assert.deepEqual(result.states[1].problems, []);
  world.publish("core", "0.12.1", world.repos.opf.head);
  result = await plan(world.deps, { core: "0.12.1", pptx: "0.12.3" });
  assert.match(result.states.find((s) => s.key === "pptx").problems.join("\n"), /keeps dependencies @openpresentation\/opf \^0\.12\.0, below the train's 0\.12\.1/);
});

test("RR-55: plan flags a release commit that still carries opf.requiresUnreleasedCore, and notes it on a pending package", async () => {
  const world = publishedWorld();
  const carrying = (version) => manifestText("@openpresentation/opf-pptx", version, { opf: { requiresUnreleasedCore: "0.14.0" }, dependencies: { "@openpresentation/opf": "^0.12.0" } });
  world.commit("opf-pptx", "declares", { "package.json": carrying("0.12.2") });
  let result = await plan(world.deps, { pptx: "0.12.3" });
  assert.equal(result.states[0].step, "prep-needed");
  assert.match(result.states[0].notes.join("\n"), /declares opf\.requiresUnreleasedCore 0\.14\.0; the release-prep PR deletes it/);
  assert.deepEqual(result.states[0].problems, []);

  const release = world.commit("opf-pptx", "pptx-0.12.3", { "package.json": carrying("0.12.3") }, { pull: 161 });
  world.green("opf-pptx", release);
  result = await plan(world.deps, { pptx: "0.12.3" });
  assert.equal(result.states[0].step, "ready-to-tag");
  assert.match(result.states[0].problems.join("\n"), /the release commit keeps opf\.requiresUnreleasedCore 0\.14\.0 in package\.json/);
  await assert.rejects(tagRelease(world.deps, packageOf("pptx"), "0.12.3", { pptx: "0.12.3" }, { execute: true }));
  assert.ok(!world.calls.some(isWrite));
});

// ---------------------------------------------------------------------------------------------------------------
// tag

function readyWorld() {
  const world = publishedWorld();
  const release = world.commit("opf-pptx", "pptx-0.12.3", { "package.json": manifestText("@openpresentation/opf-pptx", "0.12.3", { dependencies: { "@openpresentation/opf": "^0.12.0" } }) }, { pull: 160 });
  world.green("opf-pptx", release);
  return { world, release };
}

test("tag is a dry run by default: it re-verifies and writes nothing", async () => {
  const { world, release } = readyWorld();
  const result = await tagRelease(world.deps, packageOf("pptx"), "0.12.3", { pptx: "0.12.3" });
  assert.deepEqual([result.status, result.sha, result.tag], ["dry-run", release, "opf-pptx-v0.12.3"]);
  assert.ok(!world.calls.some(isWrite));
  assert.match(world.logs.join("\n"), /would create refs\/tags\/opf-pptx-v0\.12\.3 on OpenPresentation\/opf-pptx@[0-9a-f]{40}/);
});

test("tag --execute creates the tag on the release commit, waits for the publish run and the registry, then verifies", async () => {
  const { world, release } = readyWorld();
  let polls = 0;
  world.onRunsPoll = (workflow) => {
    assert.equal(workflow, "release.yml");
    polls += 1;
    const repo = world.repos["opf-pptx"];
    if (polls === 1) repo.runs = [];
    else if (polls === 2) repo.runs = [{ id: 7, head_branch: "opf-pptx-v0.12.3", head_sha: release, status: "in_progress", html_url: "https://github.com/run/7" }];
    else {
      repo.runs = [{ id: 7, head_branch: "opf-pptx-v0.12.3", head_sha: release, status: "completed", conclusion: "success", html_url: "https://github.com/run/7" }];
      world.publish("pptx", "0.12.3", release);
    }
  };
  const result = await tagRelease(world.deps, packageOf("pptx"), "0.12.3", { pptx: "0.12.3" }, { execute: true, pollSeconds: 60 });
  assert.equal(result.status, "released");
  assert.deepEqual(world.writes, [{ repo: "opf-pptx", ref: "refs/tags/opf-pptx-v0.12.3", sha: release }]);
  assert.equal(polls, 3);
  assert.equal(world.clock, 120_000, "two polls waited");
  assert.equal(result.verified.ok, true);

  // Idempotent: the version is on npm now, so a second run writes nothing.
  world.writes.length = 0;
  assert.equal((await tagRelease(world.deps, packageOf("pptx"), "0.12.3", { pptx: "0.12.3" }, { execute: true })).status, "published");
  assert.deepEqual(world.writes, []);
});

test("RR-20: tag --checks-wait-minutes waits for checks that are not reported yet or still running, then tags; red stops at once", async () => {
  // Right after the merge no check is reported on the release commit, then CI runs, then it is green.
  let { world, release } = readyWorld();
  const repo = world.repos["opf-pptx"];
  repo.checkRuns[release] = [];
  const states = [[{ name: "CI", status: "in_progress", started_at: "1" }], [{ name: "CI", status: "completed", conclusion: "success", started_at: "1" }]];
  let sleeps = 0;
  world.deps.sleep = async (ms) => {
    world.clock += ms;
    sleeps += 1;
    if (states.length) repo.checkRuns[release] = states.shift();
  };
  world.onRunsPoll = () => {
    repo.runs = [{ id: 9, head_branch: "opf-pptx-v0.12.3", head_sha: release, status: "completed", conclusion: "success", html_url: "https://github.com/run/9" }];
    world.publish("pptx", "0.12.3", release);
  };
  const result = await tagRelease(world.deps, packageOf("pptx"), "0.12.3", { pptx: "0.12.3" }, { execute: true, pollSeconds: 60, checksWaitMinutes: 30 });
  assert.equal(result.status, "released");
  assert.equal(sleeps, 2, "polled twice: not reported, then running, then green");
  assert.deepEqual(world.writes, [{ repo: "opf-pptx", ref: "refs/tags/opf-pptx-v0.12.3", sha: release }]);
  assert.match(world.logs.join("\n"), /waiting for the checks on opf-pptx@[0-9a-f]{12} \(pending \(no checks reported\)\)/);

  // Checks that go red while it waits stop it, and nothing is tagged.
  ({ world, release } = readyWorld());
  world.repos["opf-pptx"].checkRuns[release] = [{ name: "CI", status: "in_progress", started_at: "1" }];
  world.deps.sleep = async (ms) => {
    world.clock += ms;
    world.repos["opf-pptx"].checkRuns[release] = [{ name: "CI", status: "completed", conclusion: "cancelled", started_at: "1" }];
  };
  await assert.rejects(
    tagRelease(world.deps, packageOf("pptx"), "0.12.3", { pptx: "0.12.3" }, { execute: true, checksWaitMinutes: 30 }),
    (error) => error instanceof TrainStop && /checks on opf-pptx@[0-9a-f]{12} are red \(failing: CI\)/.test(error.message),
  );
  assert.deepEqual(world.writes, []);

  // Checks still pending after the wait stop it with a timeout; a dry run never waits.
  ({ world, release } = readyWorld());
  world.repos["opf-pptx"].checkRuns[release] = [{ name: "CI", status: "in_progress", started_at: "1" }];
  await assert.rejects(
    tagRelease(world.deps, packageOf("pptx"), "0.12.3", { pptx: "0.12.3" }, { execute: true, pollSeconds: 120, checksWaitMinutes: 10 }),
    (error) => error instanceof TrainStop && /timed out after 10 min waiting for the checks on opf-pptx@/.test(error.message),
  );
  assert.equal(world.clock, 600_000);
  assert.deepEqual(world.writes, []);
  world.clock = 0;
  await assert.rejects(tagRelease(world.deps, packageOf("pptx"), "0.12.3", { pptx: "0.12.3" }, { checksWaitMinutes: 10 }), /are pending \(running: CI\)/);
  assert.equal(world.clock, 0);
});

test("tag refuses red checks, an upstream not on npm, a commit off main or a tag elsewhere; a failed publish is never re-tagged", async () => {
  const stop = async (world, train, pattern, options = { execute: true }) => {
    await assert.rejects(tagRelease(world.deps, packageOf("pptx"), "0.12.3", train, options), (error) => error instanceof TrainStop && pattern.test(error.message));
    assert.deepEqual(world.writes, []);
  };
  let { world, release } = readyWorld();
  world.repos["opf-pptx"].checkRuns[release] = [{ name: "CI", status: "in_progress", started_at: "1" }];
  await stop(world, { pptx: "0.12.3" }, /checks on opf-pptx@[0-9a-f]{12} are pending \(running: CI\)/);

  ({ world, release } = readyWorld());
  await stop(world, { core: "0.12.1", pptx: "0.12.3" }, /keeps dependencies @openpresentation\/opf \^0\.12\.0, below the train's 0\.12\.1/);

  ({ world, release } = readyWorld());
  world.repos["opf-pptx"].offMain.add(release);
  await stop(world, { pptx: "0.12.3" }, /is not on opf-pptx main \(diverged\)/);

  ({ world, release } = readyWorld());
  world.repos["opf-pptx"].tags["opf-pptx-v0.12.3"] = sha("other");
  await stop(world, { pptx: "0.12.3" }, /the tag opf-pptx-v0\.12\.3 exists on [0-9a-f]{12}, not on the release commit/);

  ({ world, release } = readyWorld());
  world.repos["opf-pptx"].tags["opf-pptx-v0.12.3"] = release;
  world.repos["opf-pptx"].runs = [{ id: 8, head_branch: "opf-pptx-v0.12.3", head_sha: release, status: "completed", conclusion: "failure", html_url: "https://github.com/run/8" }];
  await stop(world, { pptx: "0.12.3" }, /ended failure: https:\/\/github\.com\/run\/8\. Do not move or re-push the tag\. .*gh run rerun 8 --failed -R OpenPresentation\/opf-pptx/);
});

// ---------------------------------------------------------------------------------------------------------------
// run

test("run over a published set only verifies; a train stops at an open release-prep PR with the resume command", async () => {
  const world = publishedWorld();
  const done = await runTrain(world.deps, { core: "0.12.0", render: "0.12.0", pptx: "0.12.2", editor: "0.11.2" }, { execute: true });
  assert.deepEqual(done.done, ["@openpresentation/opf@0.12.0", "@openpresentation/opf-render@0.12.0", "@openpresentation/opf-pptx@0.12.2", "@openpresentation/opf-editor@0.11.2"]);
  assert.ok(!world.calls.some(isWrite), "a published version is never tagged or published again");

  world.repos["opf-pptx"].openPulls = [{ number: 161, html_url: "https://github.com/OpenPresentation/opf-pptx/pull/161", title: "RR-51: release opf-pptx 0.12.3", head: { ref: "codex/rr-51-pptx", sha: sha("pr") } }];
  await assert.rejects(
    runTrain(world.deps, { pptx: "0.12.3", editor: "0.11.3" }, { execute: true, item: "RR-51" }),
    (error) => error instanceof TrainStop && /release-prep PR https:\/\/github\.com\/OpenPresentation\/opf-pptx\/pull\/161 is open\. .*node scripts\/release-train\.mjs run --pptx 0\.12\.3 --editor 0\.11\.3 --execute --item RR-51$/.test(error.message),
  );
  assert.ok(!world.calls.some(isWrite));
});

test("main: plan exits 1 while something is missing and 0 when the train is on npm; verify exits by its result", async () => {
  const world = publishedWorld();
  assert.equal(await main(["plan", "--pptx", "0.12.3"], world.deps), 1);
  assert.match(world.logs.join("\n"), /release-prep PR missing/);
  assert.equal(await main(["plan", "--pptx", "0.12.2", "--editor", "0.11.2"], world.deps), 0);
  assert.equal(await main(["verify", "@openpresentation/opf-editor@0.11.2"], world.deps), 0);
  assert.equal(await main(["verify", "editor@0.11.9"], world.deps), 1);
  assert.equal(await main(["tag", "pptx@0.12.2", "--execute"], world.deps), 0);
  assert.ok(!world.calls.some(isWrite));
  await assert.rejects(main(["plan", "--pptx", "latest"], world.deps), /--pptx latest: not a version/);
});

// ---------------------------------------------------------------------------------------------------------------
// prep, against a local git remote

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", env: gitEnv });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}
const gitEnv = { ...process.env, GIT_AUTHOR_NAME: "Test", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test", GIT_COMMITTER_EMAIL: "test@example.com", GIT_CONFIG_NOSYSTEM: "1" };

/** A bare "origin" for opf-editor with a manifest, lockfile, changelog and one fragment, mirrored in the fake API. */
function prepFixture({ declare = null } = {}) {
  const base = mkdtempSync(path.join(os.tmpdir(), "release-train-test-"));
  const work = path.join(base, "seed");
  mkdirSync(path.join(work, "changes"), { recursive: true });
  mkdirSync(path.join(work, "scripts"));
  copyFileSync(path.join(root, "scripts", "changelog-fragments.mjs"), path.join(work, "scripts", "changelog-fragments.mjs"));
  const manifest = `{
  "name": "@openpresentation/opf-editor",
  "version": "0.11.2",${declare ? `
  "opf": {
    "requiresUnreleasedCore": "${declare}"
  },` : ""}
  "dependencies": {
    "@openpresentation/opf": "^0.12.0"
  },
  "devDependencies": {
    "@openpresentation/opf-pptx": "^0.12.0"
  }
}
`;
  const files = {
    "package.json": manifest,
    "package-lock.json": `${JSON.stringify({ name: "@openpresentation/opf-editor", version: "0.11.2", lockfileVersion: 3 }, null, 2)}\n`,
    "CHANGELOG.md": "# Changelog\n\n## Unreleased\n\n## 0.11.2 (2026-10-02)\n\n- Earlier.\n",
    "README.md": "Version 0.11.2 requires core ^0.12.0.\n",
    "changes/README.md": "Fragments.\n",
    "changes/config.json": `${JSON.stringify({ default: "", targets: { "": "CHANGELOG.md" }, codePaths: ["src/"] })}\n`,
    "changes/rr-99-fix.md": "---\ntype: fixed\n---\nRR-99: a fix.\n",
  };
  for (const [file, text] of Object.entries(files)) writeFileSync(path.join(work, file), text);
  git(base, "init", "-q", "--bare", "-b", "main", "origin.git");
  git(work, "init", "-q", "-b", "main");
  git(work, "add", "-A");
  git(work, "commit", "-q", "-m", "seed");
  git(work, "push", "-q", path.join(base, "origin.git"), "main");
  const world = publishedWorld();
  const pptx = world.commit("opf-pptx", "pptx-0.12.3", { "package.json": manifestText("@openpresentation/opf-pptx", "0.12.3") });
  world.publish("pptx", "0.12.3", pptx);
  world.commit("opf-editor", "seed", { "package.json": manifest });
  const commands = [];
  const exec = (command, args, options = {}) => {
    commands.push([command, ...args].join(" "));
    if (command === "npm" || command === "pnpm") {
      // The lockfile refresh: npm writes the new root version into package-lock.json.
      const lock = JSON.parse(readFileSync(path.join(options.cwd, "package-lock.json"), "utf8"));
      lock.version = JSON.parse(readFileSync(path.join(options.cwd, "package.json"), "utf8")).version;
      writeFileSync(path.join(options.cwd, "package-lock.json"), `${JSON.stringify(lock, null, 2)}\n`);
      return { status: 0, stdout: "", stderr: "" };
    }
    const result = spawnSync(command, args, { cwd: options.cwd, env: gitEnv, encoding: "utf8" });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  };
  Object.assign(world.deps, { exec, env: gitEnv, cloneUrl: () => path.join(base, "origin.git"), scratch: base });
  return { world, base, commands };
}

test("prep: a dry run prepares the release-prep change in a scratch clone and pushes nothing", async (t) => {
  const { world, base, commands } = prepFixture();
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const result = await prep(world.deps, packageOf("editor"), { pptx: "0.12.3", editor: "0.11.3" }, { date: "2026-10-04", item: "RR-51" });
  assert.equal(result.status, "dry-run");
  assert.equal(result.title, "RR-51: release opf-editor 0.11.3");
  assert.deepEqual(result.changed.sort(), ["CHANGELOG.md", "changes/rr-99-fix.md", "package-lock.json", "package.json"]);
  const manifest = JSON.parse(readFileSync(path.join(result.dir, "package.json"), "utf8"));
  assert.equal(manifest.version, "0.11.3");
  assert.equal(manifest.devDependencies["@openpresentation/opf-pptx"], "^0.12.3");
  assert.equal(manifest.dependencies["@openpresentation/opf"], "^0.12.0", "core is not in this train");
  assert.match(readFileSync(path.join(result.dir, "CHANGELOG.md"), "utf8"), /## Unreleased\n\n## 0\.11\.3 \(2026-10-04\)\n\n### Fixed\n\n- RR-99: a fix\.|## 0\.11\.3 \(2026-10-04\)[\s\S]*RR-99: a fix\./);
  assert.match(result.body, /Prose that names 0\.11\.2 \(review by hand[^)]*\): `README\.md:1`/);
  assert.ok(commands.includes("npm install --package-lock-only --ignore-scripts --no-audit --no-fund"));
  assert.ok(!commands.some((command) => command.includes(" push ")));
  assert.equal(git(base, "--git-dir", path.join(base, "origin.git"), "branch", "--list", "codex/*"), "");
  assert.ok(!world.calls.some(isWrite));
});

test("prep --execute commits, pushes the branch and opens the PR; it refuses before the upstream is on npm", async (t) => {
  const { world, base } = prepFixture();
  t.after(() => rmSync(base, { recursive: true, force: true }));
  await assert.rejects(prep(world.deps, packageOf("editor"), { pptx: "0.12.4", editor: "0.11.3" }, { execute: true }), /waits for @openpresentation\/opf-pptx@0\.12\.4 on npm/);
  const result = await prep(world.deps, packageOf("editor"), { pptx: "0.12.3", editor: "0.11.3" }, { execute: true, date: "2026-10-04" });
  assert.equal(result.status, "opened");
  const pull = world.writes.find((write) => write.pull).pull;
  assert.deepEqual([pull.title, pull.head, pull.base], ["release opf-editor 0.11.3", "codex/release-editor-0-11-3", "main"]);
  assert.match(pull.body, /\| `devDependencies` \| `@openpresentation\/opf-pptx` \| `\^0\.12\.0` \| `\^0\.12\.3` \|/);
  assert.match(pull.body, /## Resume/);
  const origin = path.join(base, "origin.git");
  assert.deepEqual(git(base, "--git-dir", origin, "diff", "--name-only", "main", "codex/release-editor-0-11-3").split("\n").sort(), ["CHANGELOG.md", "changes/rr-99-fix.md", "package-lock.json", "package.json"]);
  assert.equal(git(base, "--git-dir", origin, "log", "-1", "--format=%s", "codex/release-editor-0-11-3"), "release opf-editor 0.11.3");

  // Idempotent: the open PR is found and nothing is written again.
  world.repos["opf-editor"].openPulls = [{ number: 901, html_url: "https://github.com/OpenPresentation/opf-editor/pull/901", title: pull.title, head: { ref: pull.head, sha: sha("x") } }];
  const writes = world.writes.length;
  assert.equal((await prep(world.deps, packageOf("editor"), { pptx: "0.12.3", editor: "0.11.3" }, { execute: true })).status, "open");
  assert.equal(world.writes.length, writes);
});

test("RR-55: prep deletes opf.requiresUnreleasedCore, says so in the PR, and leaves the rest of the manifest alone", async (t) => {
  const { world, base } = prepFixture({ declare: "0.14.0" });
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const result = await prep(world.deps, packageOf("editor"), { pptx: "0.12.3", editor: "0.11.3" }, { date: "2026-10-04" });
  assert.equal(result.status, "dry-run");
  assert.equal(result.removedField, "0.14.0");
  const manifest = JSON.parse(readFileSync(path.join(result.dir, "package.json"), "utf8"));
  assert.equal(unreleasedCoreOf(manifest), null);
  assert.deepEqual(Object.keys(manifest), ["name", "version", "dependencies", "devDependencies"], "the emptied opf object is gone too");
  assert.equal(manifest.version, "0.11.3");
  assert.match(result.body, /`opf\.requiresUnreleasedCore` \(0\.14\.0\) deleted/);
  assert.deepEqual(result.changed.sort(), ["CHANGELOG.md", "changes/rr-99-fix.md", "package-lock.json", "package.json"]);
});

test("RR-55: prep refuses a field above the core of the train and a field that is not a version", async (t) => {
  const high = prepFixture({ declare: "0.14.0" });
  t.after(() => rmSync(high.base, { recursive: true, force: true }));
  await assert.rejects(prep(high.world.deps, packageOf("editor"), { core: "0.12.0", pptx: "0.12.3", editor: "0.11.3" }), /declares opf\.requiresUnreleasedCore 0\.14\.0, above core 0\.12\.0 of this train/);
  const bad = prepFixture({ declare: "latest" });
  t.after(() => rmSync(bad.base, { recursive: true, force: true }));
  await assert.rejects(prep(bad.world.deps, packageOf("editor"), { pptx: "0.12.3", editor: "0.11.3" }), /requiresUnreleasedCore latest, which is not a version/);
  const equal = prepFixture({ declare: "0.12.0" });
  t.after(() => rmSync(equal.base, { recursive: true, force: true }));
  assert.equal((await prep(equal.world.deps, packageOf("editor"), { core: "0.12.0", pptx: "0.12.3", editor: "0.11.3" })).removedField, "0.12.0");
});

// ---------------------------------------------------------------------------------------------------------------
// The workflow

test("the workflow is dispatch-only, plan-only without the App, and never publishes", () => {
  const workflow = readFileSync(path.join(root, ".github/workflows/release-train.yml"), "utf8");
  assert.match(workflow, /^ {2}workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^ {2}(push|schedule|pull_request|repository_dispatch):/m);
  assert.match(workflow, /default: plan/);
  assert.match(workflow, /if: inputs\.mode == 'execute' && steps\.app\.outputs\.token == ''/);
  assert.match(workflow, /Run the train\n\s+if: inputs\.mode == 'execute' && steps\.app\.outputs\.token != ''/);
  assert.match(workflow, /GH_TOKEN: \$\{\{ steps\.app\.outputs\.token \}\}\n/, "execute runs only with the App token");
  assert.doesNotMatch(workflow, /^\s+(?:- )?run:.*npm publish|id-token: write/m, "publishing stays in each repository's own workflow");
  assert.match(workflow, /cancel-in-progress: false/);
});
