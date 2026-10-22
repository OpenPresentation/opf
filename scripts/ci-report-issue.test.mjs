// MR-30: the failure reporter of nightly.yml and ci.yml (a red main): open once, comment while red, close when green.
import assert from 'node:assert/strict';
import test from 'node:test';
import { failing, messageFor, report, run } from './ci-report-issue.mjs';

const needs = (results) => Object.fromEntries(Object.entries(results).map(([job, result]) => [job, { result }]));
const recorder = (open = '') => {
  const calls = [];
  const gh = (args) => {
    calls.push(args);
    return args[1].includes('/issues?') ? open : '';
  };
  return { calls, gh };
};
const base = { label: 'nightly-red', title: 'Nightly checks are red', repo: 'OpenPresentation/opf', sha: '0123456789abcdef', runUrl: 'https://example.test/run/1', event: 'schedule' };

test('failure and cancelled count, skipped and success do not, ignored jobs never do', () => {
  assert.deepEqual(failing(needs({ a: 'success', b: 'failure', c: 'cancelled', d: 'skipped' })), [{ job: 'b', result: 'failure' }, { job: 'c', result: 'cancelled' }]);
  assert.deepEqual(failing(needs({ a: 'failure', b: 'failure' }), ['a']), [{ job: 'b', result: 'failure' }]);
  assert.deepEqual(failing(undefined), []);
});

test('red with no open issue opens one with the label, the failing jobs and the run URL', () => {
  const { calls, gh } = recorder('');
  const result = report({ ...base, needs: needs({ windows: 'failure', macos: 'success' }), gh });
  assert.equal(result.action, 'opened');
  const labelCall = calls.find((args) => args[3] === 'repos/OpenPresentation/opf/labels' || args.includes('repos/OpenPresentation/opf/labels'));
  assert.ok(labelCall, 'the label is created before the issue');
  assert.ok(calls.indexOf(labelCall) < calls.length - 1);
  const create = calls.at(-1);
  assert.deepEqual(create.slice(0, 2), ['api', 'repos/OpenPresentation/opf/issues']);
  assert.ok(create.includes('labels[]=nightly-red'));
  assert.ok(create.includes('title=Nightly checks are red'));
  const body = create.find((arg) => arg.startsWith('body='));
  assert.match(body, /`windows`: failure/);
  assert.doesNotMatch(body, /macos/);
  assert.match(body, /https:\/\/example\.test\/run\/1/);
  assert.match(body, /012345678/);
});

test('red with an open issue comments on it and opens nothing', () => {
  const { calls, gh } = recorder('42\n');
  const result = report({ ...base, needs: needs({ windows: 'failure' }), gh });
  assert.deepEqual([result.action, result.issue], ['commented', '42']);
  assert.equal(calls.length, 2);
  assert.equal(calls[1][1], 'repos/OpenPresentation/opf/issues/42/comments');
});

test('green with an open issue comments and closes it; green with none does nothing', () => {
  const open = recorder('42');
  assert.equal(report({ ...base, needs: needs({ windows: 'success', macos: 'skipped' }), gh: open.gh }).action, 'closed');
  assert.deepEqual(open.calls.at(-1), ['api', '-X', 'PATCH', 'repos/OpenPresentation/opf/issues/42', '-f', 'state=closed']);
  const none = recorder('');
  assert.equal(report({ ...base, needs: needs({ windows: 'success' }), gh: none.gh }).action, 'none');
  assert.equal(none.calls.length, 1, 'only the lookup');
});

test('messageFor names the event and the short sha', () => {
  const text = messageFor({ failed: [{ job: 'x', result: 'failure' }], event: 'push', sha: 'abcdef0123456', runUrl: 'u', label: 'main-red' });
  assert.match(text.red, /push run is red at abcdef012/);
  assert.match(text.green, /Green again on push at abcdef012/);
});

test('run: reads NEEDS and the repository, supports --dry-run and --ignore, and refuses incomplete input', () => {
  const env = { NEEDS: JSON.stringify(needs({ a: 'failure', flake: 'failure' })), GITHUB_REPOSITORY: 'OpenPresentation/opf', GITHUB_SHA: 'abc', GITHUB_RUN_ID: '9', EVENT: 'schedule' };
  const dry = run(['--label', 'nightly-red', '--title', 'T', '--dry-run'], env);
  assert.equal(dry.action, 'opened');
  assert.equal(dry.calls.length, 3, 'the lookup, the label and the issue, nothing sent');
  const ignored = run(['--label', 'nightly-red', '--title', 'T', '--ignore', 'a,flake', '--dry-run'], env);
  assert.equal(ignored.action, 'none');
  assert.equal(run(['--label', 'nightly-red', '--title', 'T', '--dry-run'], { ...env, DRY_RUN_OPEN: '7' }).action, 'commented');
  assert.throws(() => run(['--label', 'x'], env), /--label and --title are required/);
  assert.throws(() => run(['--label', 'x', '--title', 'T'], { ...env, NEEDS: 'nope' }), /NEEDS must be the JSON/);
  assert.throws(() => run(['--label', 'x', '--title', 'T'], { NEEDS: '{}' }), /GITHUB_REPOSITORY/);
  assert.throws(() => run(['--bogus'], env), /unknown argument/);
});

test('a failing label creation (it exists, or no permission) does not stop the issue from being opened', () => {
  const calls = [];
  const gh = (args) => {
    calls.push(args);
    if (args.includes('repos/OpenPresentation/opf/labels')) throw new Error('gh api failed (1): HTTP 422');
    return args[1].includes('/issues?') ? '' : '';
  };
  assert.equal(report({ ...base, needs: needs({ a: 'failure' }), gh }).action, 'opened');
  assert.equal(calls.at(-1)[1], 'repos/OpenPresentation/opf/issues');
});
