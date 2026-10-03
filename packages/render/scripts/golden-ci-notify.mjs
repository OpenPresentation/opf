// RR-52: the three GitHub API calls the regenerate-goldens workflow makes after it pushes. Node's fetch only: the
// pinned Playwright image is not guaranteed to ship curl or gh. The token comes from the environment of that one
// step (GITHUB_TOKEN), never from a checkout.
//
//   node scripts/golden-ci-notify.mjs dispatch-ci <branch>            # run ci.yml on the pushed branch
//   node scripts/golden-ci-notify.mjs unlabel <pr-number> <label>     # let the label be applied again
//   node scripts/golden-ci-notify.mjs comment <pr-number> <text>      # one comment with the run link
import assert from 'node:assert/strict';

const [command, ...args] = process.argv.slice(2);
const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repository, GITHUB_API_URL: api = 'https://api.github.com' } = process.env;
assert.ok(token && repository, 'GITHUB_TOKEN and GITHUB_REPOSITORY are required');
const call = async (method, route, body) => {
  const response = await fetch(`${api}/repos/${repository}/${route}`, {
    method, body: body ? JSON.stringify(body) : undefined,
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json' },
  });
  if (!response.ok && !(method === 'DELETE' && response.status === 404)) throw new Error(`${method} ${route}: ${response.status} ${await response.text()}`);
  return response.status;
};
if (command === 'dispatch-ci') {
  // A push made with GITHUB_TOKEN does not start pull_request workflows; workflow_dispatch is the documented exception.
  assert.ok(args[0], 'branch');
  console.log(`dispatch ci.yml on ${args[0]}: ${await call('POST', 'actions/workflows/ci.yml/dispatches', { ref: args[0] })}`);
} else if (command === 'unlabel') {
  assert.ok(args[0] && args[1], 'pr-number and label');
  console.log(`remove label ${args[1]} from #${args[0]}: ${await call('DELETE', `issues/${args[0]}/labels/${encodeURIComponent(args[1])}`)}`);
} else if (command === 'comment') {
  assert.ok(args[0] && args[1], 'pr-number and text');
  console.log(`comment on #${args[0]}: ${await call('POST', `issues/${args[0]}/comments`, { body: args[1] })}`);
} else throw new Error(`Unknown command ${command}`);
