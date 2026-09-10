// Select TS7 explicitly: tsup still resolves the package-local TS5 compiler API.
// Do not use a bare tsc binary, whose owner depends on package-manager hoisting.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const require = createRequire(import.meta.url);
const manifestPath = require.resolve('@typescript/native/package.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const result = spawnSync(process.execPath, [path.resolve(path.dirname(manifestPath), manifest.bin.tsc), ...process.argv.slice(2)], {stdio: 'inherit'});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
