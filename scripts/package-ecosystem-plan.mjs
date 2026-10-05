// RR-45: the command list behind scripts/test-package-ecosystem.mjs, as data, so the three `packages` CI shards
// (docs/programs/release-readiness/ci-cd.md, section 2) provably run exactly the commands of the unsharded run.
//
//   (no flag)            every step, in the original order: the local developer run and the unsharded reference.
//   --siblings <a,b>     only the listed siblings' own suites (opf-render, opf-editor, opf-pptx), nothing of core's.
//   --skip-siblings      everything except the siblings' own suites.
//   --tier full|contract RR-53, consumer-driven contracts (ci-cd.md, section 3). `full` (the default) runs each sibling's
//                        whole `npm run test`. `contract` runs its `npm run test:contract` instead: the part of its suite
//                        that exercises core's APIs (test/suites.json `contractExclude` lists what it leaves out). Core's
//                        pull-request checks use `contract`; merge_group, push to main, the nightly run and manual runs use
//                        `full` (scripts/ecosystem-scope.mjs, tierForEvent). A sibling at a commit that predates
//                        `test:contract` runs its full `test` instead (resolveStep), so a stale lock only costs time.
export const siblingNames = ['opf-render', 'opf-editor', 'opf-pptx'];

const coreTasks = ['test:skills', 'test:ecosystem', 'test:pagination', 'test:layout', 'test:lists', 'test:rich-text', 'test:data', 'test:fonts', 'test:slide-images'];

/** One step is {command, args, sibling?}: `sibling` names the checkout the command runs in (default: core). */
function siblingSteps(name, tier = 'full') {
  const steps = [];
  for (const task of ['typecheck', 'validate', 'test']) {
    if (task === 'test' && tier === 'contract') steps.push({ command: 'npm', args: ['run', 'test:contract'], sibling: name, fallback: { command: 'npm', args: ['run', 'test'] } });
    else steps.push({ command: 'npm', args: ['run', task], sibling: name });
  }
  if (name !== 'opf-editor') steps.push({ command: 'npm', args: ['run', 'test:code'], sibling: name });
  if (name === 'opf-render') steps.push({ command: 'npm', args: ['run', 'test:font-preparation'], sibling: name });
  if (name !== 'opf-editor') steps.push({ command: 'npm', args: ['run', 'test:font-variants'], sibling: name });
  return steps;
}

export const tiers = ['full', 'contract'];

/** Parse the shard flags: {siblings: string[] | null, skipSiblings: boolean, tier}. Throws on anything unknown. */
export function parseShardArguments(argv) {
  let siblings = null;
  let skipSiblings = false;
  let tier = 'full';
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--skip-siblings') skipSiblings = true;
    else if (arg === '--tier' || arg.startsWith('--tier=')) {
      tier = arg === '--tier' ? argv[++index] : arg.slice('--tier='.length);
      if (!tiers.includes(tier)) throw new Error(`Unknown tier ${tier}; expected ${tiers.join(' or ')}`);
    }
    else if (arg === '--siblings' || arg.startsWith('--siblings=')) {
      const value = arg === '--siblings' ? argv[++index] : arg.slice('--siblings='.length);
      siblings = (value ?? '').split(',').map((name) => name.trim()).filter(Boolean);
      if (siblings.length === 0) throw new Error('--siblings needs a comma-separated list of sibling names');
      for (const name of siblings) if (!siblingNames.includes(name)) throw new Error(`Unknown sibling ${name}; expected ${siblingNames.join(', ')}`);
    } else throw new Error(`Unknown argument ${arg}`);
  }
  if (siblings && skipSiblings) throw new Error('--siblings and --skip-siblings cannot be combined');
  return { siblings, skipSiblings, tier };
}

export function planEcosystem(argv = []) {
  const { siblings, skipSiblings, tier } = parseShardArguments(argv);
  const runCore = siblings === null;
  const runSiblings = !skipSiblings;
  const steps = [];
  if (runCore) steps.push({ command: 'node', args: ['scripts/test-ecosystem-links.mjs'] });
  if (runSiblings) {
    // The original sibling order, whatever order --siblings lists them in.
    for (const name of siblingNames) if (siblings === null || siblings.includes(name)) steps.push(...siblingSteps(name, tier));
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

/**
 * The step to run for a planned step. A contract step falls back to its full suite when the sibling checkout has no
 * `test:contract` script (a lock that predates RR-53): never a skip, only slower. `scriptsOf(sibling)` returns the
 * sibling's package.json `scripts`.
 */
export function resolveStep(step, scriptsOf) {
  if (!step.fallback) return { step, fellBack: false };
  const target = step.args.at(-1);
  if (scriptsOf(step.sibling)?.[target]) return { step, fellBack: false };
  return { step: { ...step, ...step.fallback, fallback: undefined }, fellBack: true, missing: target };
}
