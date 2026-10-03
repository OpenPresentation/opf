// Public-package checks: no private sites, credentials, or hosted APIs required.
// `packages` CI runs this in shards (--siblings <names> / --skip-siblings); see scripts/package-ecosystem-plan.mjs.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {packageManagerInvocation} from './package-manager.mjs';
import {planEcosystem} from './package-ecosystem-plan.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
function run(command, args, cwd = root) {
  if (command === 'npm' || command === 'pnpm') ({command,args}=packageManagerInvocation(command,args));
  else if (command === 'node') command=process.execPath;
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (${result.status})`);
}
for (const {command, args, sibling} of planEcosystem(process.argv.slice(2))) run(command, args, sibling ? path.resolve(root, '..', sibling) : root);
