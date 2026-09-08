// Public-package checks: no private sites, credentials, or hosted APIs required.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (${result.status})`);
}
for (const name of ['opf-render', 'opf-editor', 'opf-pptx']) {
  const cwd = path.resolve(root, '..', name);
  for (const task of ['typecheck', 'validate', 'test']) run('npm', ['run', task], cwd);
}
for (const task of ['test:skills', 'test:ecosystem', 'test:pagination', 'test:layout', 'test:lists', 'test:rich-text', 'test:data', 'test:fonts']) run('pnpm', [task]);
run('pnpm', ['demo:editor']);
run('node', ['scripts/build-rich-table-browser.mjs']);
run('pnpm', ['pack:ecosystem']);
run('pnpm', ['test:packed-ecosystem']);
run('pnpm', ['test:cli:packed']);
