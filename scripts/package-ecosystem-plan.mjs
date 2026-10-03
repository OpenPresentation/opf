// RR-45: the command list behind scripts/test-package-ecosystem.mjs, as data, so the three `packages` CI shards
// (docs/programs/release-readiness/ci-cd.md, section 2) provably run exactly the commands of the unsharded run.
//
//   (no flag)            every step, in the original order: the local developer run and the unsharded reference.
//   --siblings <a,b>     only the listed siblings' own suites (opf-render, opf-editor, opf-pptx), nothing of core's.
//   --skip-siblings      everything except the siblings' own suites.
export const siblingNames = ['opf-render', 'opf-editor', 'opf-pptx'];

const coreTasks = ['test:skills', 'test:ecosystem', 'test:pagination', 'test:layout', 'test:lists', 'test:rich-text', 'test:data', 'test:fonts', 'test:slide-images'];

/** One step is {command, args, sibling?}: `sibling` names the checkout the command runs in (default: core). */
function siblingSteps(name) {
  const steps = [];
  for (const task of ['typecheck', 'validate', 'test']) steps.push({ command: 'npm', args: ['run', task], sibling: name });
  if (name !== 'opf-editor') steps.push({ command: 'npm', args: ['run', 'test:code'], sibling: name });
  if (name === 'opf-render') steps.push({ command: 'npm', args: ['run', 'test:font-preparation'], sibling: name });
  if (name !== 'opf-editor') steps.push({ command: 'npm', args: ['run', 'test:font-variants'], sibling: name });
  return steps;
}

/** Parse the shard flags: {siblings: string[] | null, skipSiblings: boolean}. Throws on anything unknown. */
export function parseShardArguments(argv) {
  let siblings = null;
  let skipSiblings = false;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--skip-siblings') skipSiblings = true;
    else if (arg === '--siblings' || arg.startsWith('--siblings=')) {
      const value = arg === '--siblings' ? argv[++index] : arg.slice('--siblings='.length);
      siblings = (value ?? '').split(',').map((name) => name.trim()).filter(Boolean);
      if (siblings.length === 0) throw new Error('--siblings needs a comma-separated list of sibling names');
      for (const name of siblings) if (!siblingNames.includes(name)) throw new Error(`Unknown sibling ${name}; expected ${siblingNames.join(', ')}`);
    } else throw new Error(`Unknown argument ${arg}`);
  }
  if (siblings && skipSiblings) throw new Error('--siblings and --skip-siblings cannot be combined');
  return { siblings, skipSiblings };
}

export function planEcosystem(argv = []) {
  const { siblings, skipSiblings } = parseShardArguments(argv);
  const runCore = siblings === null;
  const runSiblings = !skipSiblings;
  const steps = [];
  if (runCore) steps.push({ command: 'node', args: ['scripts/test-ecosystem-links.mjs'] });
  if (runSiblings) {
    // The original sibling order, whatever order --siblings lists them in.
    for (const name of siblingNames) if (siblings === null || siblings.includes(name)) steps.push(...siblingSteps(name));
  }
  if (runCore) {
    for (const task of coreTasks) steps.push({ command: 'pnpm', args: [task] });
    steps.push(
      { command: 'pnpm', args: ['demo:editor'] },
      { command: 'node', args: ['scripts/build-rich-table-browser.mjs'] },
      { command: 'pnpm', args: ['pack:ecosystem'] },
      { command: 'pnpm', args: ['test:packed-ecosystem'] },
      { command: 'pnpm', args: ['test:cli:packed'] },
    );
  }
  return steps;
}
