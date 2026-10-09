// RR-66 (opf#466): the packed CLI tests install the CLI into an isolated global prefix and then run `npm exec --package
// @openpresentation/cli@<version> -- opf ...`. On Windows npm puts a global prefix's packages in <prefix>/node_modules, so an npm exec
// run inside the prefix took them for its project's and looked for the `opf` shim in <prefix>/node_modules/.bin, which a global
// install does not have. These cases check the layout of both platforms on every OS.
import assert from 'node:assert/strict';
import test from 'node:test';
import {assertExecOutsideGlobal, globalPrefixLayout} from '../../../scripts/global-prefix.mjs';

test('a global prefix lays out packages and shims per platform', () => {
  assert.deepEqual(globalPrefixLayout('C:\\Temp\\opf cli\\global', 'win32'), {prefix: 'C:\\Temp\\opf cli\\global', modules: 'C:\\Temp\\opf cli\\global\\node_modules', bin: 'C:\\Temp\\opf cli\\global'});
  assert.deepEqual(globalPrefixLayout('/tmp/opf cli/global', 'linux'), {prefix: '/tmp/opf cli/global', modules: '/tmp/opf cli/global/lib/node_modules', bin: '/tmp/opf cli/global/bin'});
});

test('npm exec inside a Windows global prefix is refused (opf#466)', () => {
  // The layout opf#466 failed with: the prefix was the npm exec folder (and the parent of packed-files.mjs's npx folder).
  const windows = globalPrefixLayout('C:\\Temp\\opf-cli-installed-1', 'win32');
  assert.throws(() => assertExecOutsideGlobal('C:\\Temp\\opf-cli-installed-1', windows, 'win32'), /opf#466/);
  assert.throws(() => assertExecOutsideGlobal('C:\\Temp\\opf-cli-installed-1\\npx-a', windows, 'win32'), /opf#466/);
  // Windows paths compare without case.
  assert.throws(() => assertExecOutsideGlobal('c:\\temp\\OPF-CLI-INSTALLED-1', windows, 'win32'), /opf#466/);
  // The same folders are safe on macOS and Linux, where the packages are under lib/node_modules.
  assert.doesNotThrow(() => assertExecOutsideGlobal('/tmp/opf-cli-installed-1', globalPrefixLayout('/tmp/opf-cli-installed-1', 'linux'), 'linux'));
});

test('a prefix in a folder of its own keeps npm exec out of it on every platform', () => {
  for (const [platform, temp, sep] of [['win32', 'C:\\Temp\\opf cli-1', '\\'], ['linux', '/tmp/opf cli-1', '/'], ['darwin', '/private/var/folders/x/opf cli-1', '/']]) {
    const layout = globalPrefixLayout(`${temp}${sep}global`, platform);
    assert.doesNotThrow(() => assertExecOutsideGlobal(temp, layout, platform), platform);
    assert.doesNotThrow(() => assertExecOutsideGlobal(`${temp}${sep}npx-a`, layout, platform), platform);
  }
});
