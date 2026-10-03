// Public-package checks: no private sites, credentials, or hosted APIs required.
// `packages` CI runs this in shards (--siblings <names> / --skip-siblings) and in two tiers (--tier contract|full, RR-53); see
// scripts/package-ecosystem-plan.mjs.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {packageManagerInvocation} from './package-manager.mjs';
import {planEcosystem, resolveStep} from './package-ecosystem-plan.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
function run(command, args, cwd = root) {
  if (command === 'npm' || command === 'pnpm') ({command,args}=packageManagerInvocation(command,args));
  else if (command === 'node') command=process.execPath;
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (${result.status})`);
}
const scriptsOf = (sibling) => JSON.parse(readFileSync(path.resolve(root, '..', sibling, 'package.json'), 'utf8')).scripts;
for (const planned of planEcosystem(process.argv.slice(2))) {
  const {step, fellBack, missing} = resolveStep(planned, scriptsOf);
  if (fellBack) console.log(`::warning title=Contract suite missing::${step.sibling} has no \`${missing}\` script at this commit (the lock predates RR-53); running its full \`${step.args.join(' ')}\` instead.`);
  const {command, args, sibling} = step;
  run(command, args, sibling ? path.resolve(root, '..', sibling) : root);
}
