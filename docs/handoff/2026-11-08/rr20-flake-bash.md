# RR20 advisory flake-measurement shell correction

Nightly 42465224170 completed overall successfully, but advisory job 128685635359 failed before measurement: the Playwright container defaulted to `sh`, and the repeat step's Bash `${DIR//\//-}` substitution reported `Bad substitution`. No flake software/browser tests ran in that job. This is separate from the actual Release workflow and does not change its result or gate policy.

The minimal workflow correction is `shell: bash` on the existing “Repeat the suites” step. Existing advisory `continue-on-error`, job/matrix/routes, repeat input, suite selection, thresholds and reporting exclusions remain unchanged. No new job or CI watcher is added.

The regression reads the actual YAML step and matrix, checks explicit shell/environment routing and executes that exact run body under Bash with a `node` argv-capture function. It verifies every existing matrix suite's dir/suite/repeat/output arguments without launching flake-repeat, browser suites or network commands. The new control fails before the one-line fix; all 20 workflow controls pass afterward. Literal original/focused/required-check receipts are archived alongside this handoff.

Vetoable decision: select the shell the existing script requires, preserving the advisory contract. This derived 0.34 fix does not mutate a folded branch or an active Release run.

Required changed-scope check:82.0seconds;10steps pass, typecheck is unselected, and only existing strict gallery-tracker freshness fails (17/18controls). No warning-mode override or tracker regeneration. Literal evidence preserves all logs. Package/schema/example trees are byte-identical to the approved base.
