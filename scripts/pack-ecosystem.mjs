// Prepare coordinated, locally installable prereleases without changing registry state.
import { cp, mkdir, readFile, writeFile, rm, realpath } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const out = path.join(root, "artifacts/npm");
const packages = [
  ["opf", "packages/javascript", "0.4.0-preview.11"],
  ["opf-render", "../opf-render", "0.1.0-preview.11"],
  ["opf-editor", "../opf-editor", "0.1.0-preview.11"],
  ["opf-pptx", process.env.OPF_PPTX_ROOT ?? "../opf-pptx", "0.1.0-preview.11"],
];
const versions = Object.fromEntries(
  packages.map(([name, , version]) => [`@openpresentation/${name}`, version]),
);
const artifacts = [];
await mkdir(out, { recursive: true });
const actualRoot = await realpath(root), actualOut = await realpath(out);
if (!actualOut.startsWith(actualRoot + path.sep)) throw new Error('Package artifacts must remain inside this checkout');
for (const [name, source, version] of packages) {
  const directory = path.resolve(root, source),
    stage = path.join(out, "staging", name);
  const actualStage = await realpath(stage).catch(error => { if (error.code === 'ENOENT') return path.resolve(stage); throw error; });
  const actualStageParent = await realpath(path.dirname(stage)).catch(error => { if (error.code === 'ENOENT') return path.resolve(path.dirname(stage)); throw error; });
  if (!actualStage.startsWith(actualOut + path.sep) || !actualStageParent.startsWith(actualOut + path.sep)) throw new Error('Refusing a staging path outside package artifacts');
  await rm(stage, { recursive: true, force: true });
  await mkdir(stage, { recursive: true });
  const manifest = JSON.parse(
    await readFile(path.join(directory, "package.json"), "utf8"),
  );
  manifest.version = version;
  for (const section of [
    "dependencies",
    "peerDependencies",
    "optionalDependencies",
  ])
    for (const dependency of Object.keys(manifest[section] ?? {}))
      if (versions[dependency])
        manifest[section][dependency] = versions[dependency];
  // The stage contains built distributables, so packing never executes a missing source build.
  delete manifest.scripts;
  delete manifest.devDependencies;
  // Preserve every declared distributable, including vendored runtime/license
  // files. Source package file lists currently contain literal relative paths.
  for (const file of new Set([...(manifest.files ?? ['dist']), 'README.md', 'LICENSE'])) {
    if (typeof file !== 'string' || path.isAbsolute(file) || file.split(/[/\\]/).includes('..') || /[*?\[\]{}!]/.test(file)) throw new Error(`Expected a literal contained package file: ${file}`);
    await cp(path.join(directory, file), path.join(stage, file), { recursive: true });
  }
  await writeFile(
    path.join(stage, "package.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  const packArgs = [
      "pack",
      "--json",
      "--ignore-scripts",
      "--pack-destination",
      out,
      "--cache",
      path.join(out, 'cache'),
    ];
  let npmCommand = 'npm';
  if (process.platform === 'win32') {
    const npmEntry = process.env.npm_execpath?.endsWith('npm-cli.js') ? process.env.npm_execpath : (process.env.PATH ?? '').split(path.delimiter).flatMap(directory => [
      path.join(directory, 'node_modules/npm/bin/npm-cli.js'),
      path.resolve(directory, '../npm/bin/npm-cli.js'),
    ]).find(existsSync);
    if (!npmEntry || !existsSync(npmEntry)) throw new Error('Cannot locate the npm JavaScript entrypoint');
    npmCommand = process.execPath;
    packArgs.unshift(npmEntry);
  }
  const result = spawnSync(
    npmCommand,
    packArgs,
    { cwd: stage, encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  const packed = JSON.parse(result.stdout)[0],
    bytes = await readFile(path.join(out, packed.filename));
  artifacts.push({
    name: manifest.name,
    version,
    file: packed.filename,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
  });
}
await writeFile(
  path.join(out, "manifest.json"),
  JSON.stringify({ published: false, artifacts }, null, 2) + "\n",
);
await writeFile(
  path.join(out, "README.md"),
  `# OPF local preview packages\n\nThese coordinated prereleases are installable tarballs; they have not been published to npm.\n\nRun this in your application directory:\n\n\`\`\`sh\nnpm install ${artifacts.map((item) => JSON.stringify(path.join(out, item.file))).join(" \\\n  ")}\n\`\`\`\n\nThe canvas is exported by \`@openpresentation/opf-editor/canvas\`; browser font loading is exported by \`@openpresentation/opf-render/fonts-browser\`. See the repository's [live editor guide](../../docs/live-editor.md) for usage and current limits. The manifest records SHA-256 digests.\n`,
);
console.log(JSON.stringify(artifacts, null, 2));
