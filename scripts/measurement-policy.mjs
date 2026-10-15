// RR-68: the Editor's scheduled flake-repeat workflow explicitly measures rather than gates.
// Names alone never grant this exception. Missing, inaccessible or changed identity stays gating.
const REPO = 'OpenPresentation/opf-editor';
export const MEASUREMENT_JOB = 'Repeat the browser suites';

/** One authenticated identity read per candidate run and commit for this observer's lifetime. */
export function measurementClassifier(readRun) {
  const cache = new Map();
  return async ({ repo, sha, name, appId, appSlug, suiteId, runId, url, workflow, event, suite = false }) => {
    if (repo !== REPO || (!suite && name !== MEASUREMENT_JOB) || appId !== 15368 || appSlug !== 'github-actions' || !suiteId) return false;
    if (suite && (workflow !== 'Flake measurement' || event !== 'schedule')) return false;
    // REST check runs lack workflowRun; use their canonical URL only to locate metadata,
    // then independently bind that response to the check suite, repository and commit.
    const match = /^https:\/\/github\.com\/OpenPresentation\/opf-editor\/actions\/runs\/([1-9]\d*)(?:\/job\/[1-9]\d*)?$/.exec(url ?? '');
    const id = runId ?? (match ? Number(match[1]) : null);
    if (!Number.isSafeInteger(id) || id <= 0 || !/^[a-f0-9]{40}$/.test(sha ?? '')) return false;
    const key = `${repo}:${sha}:${id}`;
    if (!cache.has(key)) cache.set(key, Promise.resolve().then(() => readRun(`repos/${repo}/actions/runs/${id}`)).catch(() => null));
    const run = await cache.get(key);
    return Boolean(run && run.id === id && run.repository?.full_name === REPO && run.head_repository?.full_name === REPO &&
      run.workflow_id === 373564717 && run.path === '.github/workflows/flake-repeat.yml' && run.name === 'Flake measurement' &&
      run.event === 'schedule' && run.head_branch === 'main' && run.head_sha === sha &&
      (typeof suiteId === 'number' ? run.check_suite_id === suiteId : run.check_suite_node_id === suiteId));
  };
}


/** Advisory classification needs a positively readable branch policy, including its required contexts. */
export function knownBranchRules(rules) {
  return Array.isArray(rules) && rules.every(rule => rule && typeof rule.type === 'string' && rule.type.length > 0 &&
    (rule.type !== 'required_status_checks' || (Array.isArray(rule.parameters?.required_status_checks) &&
      rule.parameters.required_status_checks.every(check => typeof check?.context === 'string' && check.context.length > 0))));
}
