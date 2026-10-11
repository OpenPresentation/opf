#!/bin/bash
set -euo pipefail
cd /private/tmp/opf-core0184-publish-replay
export PATH='/private/tmp/rr78-npm-11.16/node_modules/.bin:/Users/michael/Library/Application Support/fnm/node-versions/v24.21.0/installation/bin:/Users/michael/Library/pnpm/bin:/usr/bin:/bin'
unset NODE_AUTH_TOKEN NPM_TOKEN
export GITHUB_REF=refs/tags/opf-v0.18.4
export GITHUB_REF_NAME=opf-v0.18.4
export NPM_CONFIG_USERCONFIG=/private/tmp/rr20-core0184-publish-replay.npmrc
printf '%s\n' '//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}' > "$NPM_CONFIG_USERCONFIG"
printf 'commit='; git rev-parse HEAD
printf 'shallow='; git rev-parse --is-shallow-repository
git rev-parse opf-v0.18.3
for task_dist in packages/javascript/dist packages/cli/dist; do test ! -e "$task_dist"; printf 'clean_initial=%s\n' "$task_dist"; done
test -z "${NODE_AUTH_TOKEN+x}"
printf 'NODE_AUTH_TOKEN=unset\nGITHUB_REF=%s\nGITHUB_REF_NAME=%s\nnpmrc=literal token placeholder\n' "$GITHUB_REF" "$GITHUB_REF_NAME"
node --version; npm --version; pnpm --version
test "$(npm --version)" = 11.16.0
node scripts/candidate-gallery.mjs publication
pnpm install --frozen-lockfile
test "$(node -p "require('./packages/javascript/package.json').version")" = 0.18.4
pnpm lint
pnpm typecheck
pnpm test
pnpm check:breaking
pnpm --filter @openpresentation/opf pack:dry-run
pnpm check:examples
pnpm test:skills
node packages/javascript/test/packed-install-smoke.mjs
git diff --exit-code
printf 'REPLAY_TERMINAL_EXIT=0 (publication/tag excluded)\n'
