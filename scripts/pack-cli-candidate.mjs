// RR-62: the candidate tarballs of the CLI and the core it depends on, for the packed-install tests.
//
// `@openpresentation/cli` depends on `@openpresentation/opf` (a regular dependency whose `/node` engine the commands run, so the CLI and an
// application that imports core run one core). In a lockstep release the CLI's range names the core that publishes
// with it, which is not on npm while the candidate is tested, so an offline install of the CLI tarball cannot resolve it.
// This packs the core and the CLI as they are and, only when the candidate core does not satisfy the CLI's range, stages the
// CLI with that one range set to the candidate core's exact version (nothing else in the tarball changes). The tests then
// install both tarballs together, and the install holds exactly one core. The range the CLI publishes is the one in its
// manifest, which the tests assert separately.
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { satisfies } from './unreleased-gate.mjs';

export const CORE = '@openpresentation/opf';

/**
 * Pack core and the CLI into `destination`. `run(command, args, cwd)` runs a command and returns its stdout; `npmArgs` are extra
 * `npm pack` arguments (a cache directory). Returns { core, cli, coreTarball, cliTarball, range, restaged }, where `core` and `cli`
 * are the `npm pack --json` entries.
 */
export async function packCliCandidate({ cliDirectory, coreDirectory, destination, run, npmArgs = [] }) {
  await mkdir(destination, { recursive: true });
  const manifest = JSON.parse(await readFile(path.join(cliDirectory, 'package.json'), 'utf8'));
  const coreManifest = JSON.parse(await readFile(path.join(coreDirectory, 'package.json'), 'utf8'));
  const range = manifest.dependencies?.[CORE];
  if (!range) throw new Error(`${manifest.name} declares no dependency on ${CORE}`);
  const pack = (directory) => JSON.parse(run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', destination, ...npmArgs], directory))[0];
  const core = pack(coreDirectory);
  const restaged = !satisfies(coreManifest.version, range);
  let cli;
  if (!restaged) cli = pack(cliDirectory);
  else {
    const stage = await mkdtemp(path.join(tmpdir(), 'opf-cli-candidate-'));
    try {
      for (const entry of manifest.files) await cp(path.join(cliDirectory, entry), path.join(stage, entry), { recursive: true });
      await writeFile(path.join(stage, 'package.json'), `${JSON.stringify({ ...manifest, dependencies: { ...manifest.dependencies, [CORE]: coreManifest.version } }, null, 2)}\n`);
      cli = pack(stage);
    } finally {
      await rm(stage, { recursive: true, force: true });
    }
    console.log(`${manifest.name} asks for ${CORE}@${range} and the candidate core is ${coreManifest.version}: the candidate CLI tarball depends on ${coreManifest.version} for this local-tarball install.`);
  }
  return { core, cli, coreTarball: path.join(destination, core.filename), cliTarball: path.join(destination, cli.filename), range, restaged };
}
