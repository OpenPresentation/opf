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
  packageOf,
  parseSpec,
  plan,
  prep,
  raiseRange,
  runTrain,
  TrainStop,
  tagRelease,
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
function prepFixture() {
  const base = mkdtempSync(path.join(os.tmpdir(), "release-train-test-"));
  const work = path.join(base, "seed");
  mkdirSync(path.join(work, "changes"), { recursive: true });
  mkdirSync(path.join(work, "scripts"));
  copyFileSync(path.join(root, "scripts", "changelog-fragments.mjs"), path.join(work, "scripts", "changelog-fragments.mjs"));
  const manifest = `{
  "name": "@openpresentation/opf-editor",
  "version": "0.11.2",
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
