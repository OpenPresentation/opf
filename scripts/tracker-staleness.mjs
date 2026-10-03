// RR-46: how a stale generated tracker (gallery-tracker.*, font-tracker.*) is reported.
//
// The trackers are derived from committed data and are regenerated after merge (.github/workflows/tracker-refresh.yml),
// so a pull request need not commit them. CI sets OPF_TRACKER_STALE=warn on pull_request events: a stale tracker is
// then a warning annotation, not a failure. Everywhere else (a local `pnpm test`, main, the merge queue, the release
// workflows) the default applies and a stale tracker fails.
export function staleMode(env = process.env) {
  const value = env.OPF_TRACKER_STALE ?? 'fail';
  if (value !== 'warn' && value !== 'fail') throw new Error(`OPF_TRACKER_STALE must be "warn" or "fail" (got "${value}")`);
  return value;
}

// Prints the message and returns true when the caller must fail.
export function reportStale(message, env = process.env, log = console) {
  if (staleMode(env) === 'warn') {
    log.log(`::warning title=Generated tracker is stale::${message} It is regenerated after merge; a pull request need not commit it (CONTRIBUTING.md, Generated trackers).`);
    return false;
  }
  log.error(message);
  return true;
}
