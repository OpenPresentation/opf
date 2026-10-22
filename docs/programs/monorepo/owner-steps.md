# Monorepo: owner steps

Every action in the monorepo program that only the owner can take, in the order it is needed. Each step says what it unblocks, the exact settings, how to check that it worked and how to undo it. Program, decisions and item IDs: [README.md](README.md) (sections 3, 5, 6, 7 and 9, and the OWNER action list); tracker: [burndown.md](burndown.md). Agents never change an npm setting, a ruleset, an App permission, a secret or an archive (Resume protocol, step 5); they prepare the values here and stop. Written in MR-02, checked against GitHub and the npm CLI on 2026-10-21. GitHub and npm change their labels now and then: where a button name differs, the command given next to it is the authority.

Conventions: `gh` is logged in as the owner (`michaeljgrimm`, repository admin on the four old repositories and `OpenPresentation/opf`); commands are copy and paste. `<S>` and `<SHA>` in the MR-22 section are filled in by the agent in its hand-off message.

## The order, at a glance

| # | Step | Needed by (blocks) | Time | Can start |
| --- | --- | --- | --- | --- |
| O1 | npm trusted publishers: add five entries, check core's | MR-41 (canary) | 10 min each | now |
| O2 | Optional "restrict updates" ruleset on the four old repos | MR-20 (freeze), before the MR-21 re-run | 5 min | when the freeze PRs have merged |
| O3 | Push the verified import to `main` (two options) | MR-22 | 10 min | when the agent says the import is verified |
| O4 | Create the GitHub App, install it, store its two secrets | MR-41 (bypass), MR-52 (sites) | 20 min | now |
| O5 | Add the App as a bypass actor on the current `main` ruleset | MR-41 (the release commit to `main`) | 2 min | after O4 |
| O6 | Switch the ruleset: no merge queue, `verify` only, squash only; repository merge settings | MR-33 | 10 min | after MR-32 |
| O7 | Optional tag ruleset for `v*` | MR-40 | 3 min | after O3 |
| O8 | Site repositories: install the App, add its two secrets | MR-52 | 5 min each | after O4 |
| O9 | Approve the issue transfer | MR-51 | 2 min | after O3 |
| O10 | Archive the four old repos, remove old publisher entries and loose secrets | MR-60 | 30 min | after the soak (MR-53) |

## Findings of 2026-10-21 that change the plan's wording

Read these first; each is repeated at its step.

1. **The ecosystem GitHub App does not exist yet.** The plan (section 6, OWNER action 6) says to "reuse the ecosystem App" and extend it. `gh api orgs/OpenPresentation/installations` lists only three installations (`claude`, `cursor`, `chatgpt-codex-connector`), `OpenPresentation/opf` has no `ECOSYSTEM_APP_ID` variable and no `ECOSYSTEM_APP_PRIVATE_KEY` secret, and opf#298 (the issue that asked for it) is still open. O4 therefore creates the App. If you created one under another account and it is simply not installed on the organization, skip the creation and do the rest of O4.
2. **The three site repositories cannot take rulesets or branch protection today.** They are private repositories in `Data-Advantage`, an organization on the Free plan: `gh api repos/Data-Advantage/<repo>/rulesets` and `.../branches/main/protection` both return 403 "Upgrade to GitHub Pro or make this repository public". Without a required check, `gh pr merge --auto` has nothing to wait for and merges at once, and the "Allow auto-merge" setting is gated on the same feature. **Decided (D19, owner, 2026-10-21): each site's own CI merges the bump pull request after its `build-and-smoke` job passes, with the App's token; no ruleset or auto-merge setting is needed.** O8 lists what is left for you.
3. **`v5` is not a usable dist-tag.** The plan (OWNER action 10) suggests a dist-tag `v5` pointing at gallery 5.0.0. npm refuses it ("Tag name must not be a valid SemVer range", `semver.validRange("v5")` is `>=5.0.0 <6.0.0-0`; checked in the npm 11.19.0 source). O10 uses `legacy-v5`.
4. **A tag ruleset may restrict creation of `v*` only with the App on its bypass list.** MR-40 changed the design: `release.yml` pushes the tag `vX.Y.Z` with the App's token (a tag pushed with `GITHUB_TOKEN` starts no workflow, and `npm-publish.yml` must start from the tag push to be the trusted publisher, because npm checks the top-level workflow, not a reusable one). O7 therefore keeps the App in the bypass list; restricting updates and deletions is what the plan needs, and creation can stay open so the pull-request fallback (a person pushes the tag) works.
5. **"Allow auto-merge" is off on `OpenPresentation/opf`** (`allow_auto_merge: false`). Without the merge queue, `pr-gate.mjs --merge` and every agent merge rely on GitHub auto-merge, so O6 turns it on.
6. **`OpenPresentation/opf` has an unused `NPM_TOKEN` secret.** No workflow reads it (the plan's invariant is "no `NPM_TOKEN`"). O10 removes it after two OIDC releases.
7. The current `main` ruleset (id 24382980) has **no bypass actors**, so nobody, the owner included, can push to `main` directly today. O3 and O5 add bypass actors.

---

## O1. npm trusted publishers (MR-41 needs them; start any time)

**What and why.** The single `npm-publish.yml` in `OpenPresentation/opf` publishes all six packages through GitHub OIDC. npm accepts a publish only if the package has a trusted-publisher entry that names exactly that repository and workflow file. Add the new entry **beside** the old one (npm allows up to 10 per package) and keep the old entries until O10, so a failed canary needs no owner action. npm does not validate an entry when you save it; a typo shows up only at publish time, which is why MR-41 publishes a canary first.

**The values, identical for all six** (the plan chose no environment, D7):

| Field | Value |
| --- | --- |
| Publisher | GitHub Actions |
| Organization or user | `OpenPresentation` |
| Repository | `opf` |
| Workflow filename | `npm-publish.yml` (the filename only, no `.github/workflows/`) |
| Environment name | leave empty |
| Allowed actions | publish (`--allow-publish` on the command line). Do not tick "stage publish" |

| Package | Existing entry today (leave it) | What to do |
| --- | --- | --- |
| `@openpresentation/opf` | `OpenPresentation/opf` / `npm-publish.yml` | Do not add. **Check** it is exactly the values above, with no environment |
| `@openpresentation/cli` | `OpenPresentation/opf` / `cli-publish.yml` | Add the new entry |
| `@openpresentation/opf-render` | `OpenPresentation/opf-render` / `npm-publish.yml` | Add |
| `@openpresentation/opf-pptx` | `OpenPresentation/opf-pptx` / `release.yml` | Add |
| `@openpresentation/opf-editor` | `OpenPresentation/opf-editor` / `release.yml` | Add |
| `@openpresentation/gallery` | `OpenPresentation/gallery` / `gallery-publish.yml` | Add (new for this plan: the gallery moves repository and workflow) |

**Steps, browser** (per package; you need an npm account with publish rights on the package and your 2FA device):

1. Open `https://www.npmjs.com/package/<package-name>/access` (for example `https://www.npmjs.com/package/@openpresentation/opf-render/access`), or open the package, then **Settings**.
2. Find the section **Trusted Publisher**. If an entry is already listed, it stays; use the form to add another.
3. Choose **GitHub Actions**. Fill the four fields from the table: Organization or user `OpenPresentation`, Repository `opf`, Workflow filename `npm-publish.yml`, Environment empty. Tick the box that allows `npm publish` if the form shows one.
4. Click **Set up connection** and confirm with your 2FA code.

**Steps, command line** (same effect; needs npm 11.10 or later, the local one is 11.19.0). It asks for your one-time password each time:

```sh
npm login                                  # once, in a terminal of your own
for p in cli opf-render opf-pptx opf-editor gallery; do
  npm trust github "@openpresentation/$p" --repo OpenPresentation/opf --file npm-publish.yml --allow-publish
done
```

**Verify.**

```sh
for p in opf cli opf-render opf-pptx opf-editor gallery; do echo "== $p"; npm trust list "@openpresentation/$p"; done
```

Every package must list an entry with repository `OpenPresentation/opf` and file `npm-publish.yml`, no environment; the four packages with old entries list two. The proof that the values are right is the canary in MR-41 (`npm view @openpresentation/<p>@0.26.0-rc.0 gitHead` and the provenance statement naming `npm-publish.yml` on the tag). A wrong entry shows as `E404`/`E403 ... not a trusted publisher` in the publish job; fix the entry and re-run the workflow, nothing else changes.

**Undo.** `npm trust list @openpresentation/<p>` shows each entry's id; `npm trust revoke @openpresentation/<p> --id <id>` removes it (browser: the entry's **Delete** button). Removing only the new entry returns the package to today's state.

---

## O2. Optional: freeze the old repositories (MR-20)

**What and why.** The MR-20 freeze pull requests (banner, no scheduled workflows, no Dependabot config) are agent work. This ruleset is the belt on top: after it, nothing can reach an old repository's `main` except by you. It is optional because the freeze window is short; do it if an unattended agent or a Dependabot rebase could otherwise land a commit after the import rehearsal.

**When.** After the coordinator says the freeze pull requests and the last wanted merges (editor 0.25.1 and so on) are in, and **before** the MR-21 re-run on the frozen repositories. Repeat for `opf-render`, `opf-pptx`, `opf-editor` and `gallery`.

**Steps** (`https://github.com/OpenPresentation/<repo>/settings/rules/new?target=branch`, or Settings, Rules, Rulesets, **New ruleset**, **New branch ruleset**):

1. Ruleset name: `freeze: moved to OpenPresentation/opf (MR-20)`.
2. Enforcement status: **Active**.
3. Bypass list: **Add bypass**, role **Repository admin**, mode **Always allow** (this keeps your emergency path for a hotfix; section 7 of the plan).
4. Target branches: **Add target**, **Include default branch**.
5. Branch rules: tick **Restrict updates** ("Only allow users with bypass permission to update matching refs"), **Restrict deletions** and **Block force pushes**. Leave everything else unticked.
6. **Create**.

Also check that Dependabot security updates are off, so nothing reopens a pull request: `gh api repos/OpenPresentation/<repo> --jq .security_and_analysis.dependabot_security_updates.status` should print `disabled` (it does for all four today). If it prints `enabled`: Settings, Advanced Security (Code security), Dependabot, **Dependabot security updates**, Disable.

**Verify.** `gh api repos/OpenPresentation/<repo>/rulesets --jq '.[]|[.name,.enforcement]|@tsv'` prints the ruleset as `active`. A push of a test commit by anybody without bypass is rejected with `GH013: Repository rule violations`.

**Undo.** Settings, Rules, Rulesets, the ruleset, **Enforcement status: Disabled** (or **Delete ruleset**). Do this before merging a hotfix without bypass, and before the README pointer pull requests of MR-60 if you did not add yourself as bypass.

---

## O3. MR-22: land the verified import on `main`

**What and why.** The import is a history merge of about 833 commits and 157 tags (plan section 3). GitHub cannot show a pull request that large, and it must never be squashed or rebased. The agent builds the merge in a scratch clone (`<S>/merged`, branch `monorepo/import`, push URL deliberately broken) and proves it with `scripts/verify-import.mjs` (output committed as `docs/programs/monorepo/import-verification.md`). You then publish **exactly that commit**. Two ways; use **Option A** unless it fails.

**The agent's hand-off message gives you** `<S>` (the scratch directory, for example `/private/tmp/.../scratchpad/import`) and `<SHA>` (the 40-character commit that `monorepo/import` points at and that `verify-import.mjs` approved). Do not start if either is missing, if the verifier was not all green, or if the old repositories are not frozen (MR-20).

### Option A (recommended): push the commit under a ruleset bypass

Result: `main` of `OpenPresentation/opf` moves forward by fast-forward to `<SHA>`, the SHA the verifier approved, with no extra commit, no PR and no change to merge settings.

**A1. Give yourself bypass** (the ruleset has no bypass actors today). Settings, Rules, Rulesets, **main: cross-platform checks required (RR-04)** (id 24382980), section **Bypass list**, **Add bypass**, tick the role **Repository admin**, mode **Always allow**, **Add selected**, **Save changes**.

Save a backup of the ruleset first: `gh api repos/OpenPresentation/opf/rulesets/24382980 > ~/opf-ruleset-24382980-before-mr22.json`.

**A2. Check that nothing moved and the commit is the verified one:**

```sh
cd "<S>/merged"
git fetch origin main
test "$(git rev-parse monorepo/import)" = "<SHA>" && echo "same commit as approved"
git merge-base --is-ancestor origin/main monorepo/import && echo "fast-forward from current main"
```

Both lines must print. If the second does not, core's `main` moved after the verification: stop and tell the agent (it re-runs the delta import and gives a new `<SHA>`; this takes under a minute).

**A3. Point the push URL at GitHub** (the agent disabled it so no stray push could happen) and look at what will be sent:

```sh
git remote set-url --push origin https://github.com/OpenPresentation/opf.git
git push --dry-run origin monorepo/import:refs/heads/main
git push --dry-run origin 'refs/tags/*:refs/tags/*' | grep -c 'new tag'
```

The first dry run must show a plain update `<old>..<SHA>  monorepo/import -> main`, never `+` (forced) or `rejected`. The second count must equal the number of imported tags the agent states (157 in the rehearsal, gallery's five renamed `gallery-v1.0.0` to `gallery-v5.0.0` among them, plus any tags created in the old repositories since).

**A4. Push, branch first, tags second** (never `--force`):

```sh
git push origin monorepo/import:refs/heads/main
git push origin 'refs/tags/*:refs/tags/*'
```

Two pushes on purpose. GitHub creates no push events when more than three tags are pushed at once, and none of the imported names matches the existing publish triggers anyway (`opf-v*`, `@openpresentation/opf@v*`, `cli-v*`), but the branch push does start the normal push CI of `main`, which is expected.

If the first push is rejected with `remote: error: GH013: Repository rule violations found for refs/heads/main`, the bypass of A1 is missing or not saved. Nothing was changed; fix A1 and repeat A4.

**A5. Take the bypass off again.** Same ruleset, Bypass list, the **Repository admin** row, **...** (or the trash icon), **Remove**, **Save changes**. (If you want an owner emergency path afterwards, keep it and say so; the plan does not require it.)

**A6. Verify.**

```sh
git ls-remote origin refs/heads/main                       # prints <SHA>
git ls-remote --tags origin | grep -vc '\^{}'              # tag count: core's existing tags plus the imported ones (235 in the rehearsal)
gh api repos/OpenPresentation/opf/rulesets/24382980 --jq '.bypass_actors'   # [] once A5 is done
gh run list -R OpenPresentation/opf --event push --limit 5  # one push run for main; none for the tags
```

Then tell the agent "pushed". It re-runs the verifier against a fresh clone of GitHub and continues with MR-23. Delete `<S>` when it says so.

**Undo (Option A).** Never force-push `main` and never move a tag. Before MR-23 the plan's rollback is `git revert -m 1 <import merge>` for each of the four import merges (the agent prepares it as a pull request; a later re-import needs "revert the revert"). The imported tags have names that exist nowhere else, so if they must go the agent gives you the list and `git push origin ':refs/tags/<name>'` per tag.

### Option B (fallback): a pull request with a temporary merge-commit allowance

Use only if A1 to A4 cannot be done. Cost: GitHub creates one more merge commit (so the final SHA is not `<SHA>`; the agent re-verifies the tree and the history), the merge queue must be switched off for the duration, and the Windows and macOS required checks must report on the pull request.

**B1. Backup:** `gh api repos/OpenPresentation/opf/rulesets/24382980 > ~/opf-ruleset-24382980-before-mr22.json` (also: ruleset page, **...**, **Export ruleset**).

**B2. Push the branch and the tags** (a pull request carries no tags):

```sh
cd "<S>/merged"
git remote set-url --push origin https://github.com/OpenPresentation/opf.git
git push origin monorepo/import
git push origin 'refs/tags/*:refs/tags/*'
```

**B3. Open the pull request:** `gh pr create -R OpenPresentation/opf --base main --head monorepo/import --title "MR-22: import the history of opf-render, opf-pptx, opf-editor and gallery" --body-file <S>/pr-body.md`. GitHub will say the diff is too large to display; that is expected.

**B4. Ruleset toggles** (Settings, Rules, Rulesets, **main: cross-platform checks required (RR-04)**):

1. Rules: untick **Require merge queue**. (With it on, the only merge method is squash.) Leave **Require status checks to pass** as it is. **Save changes.**
2. Repository Settings, General, Pull Requests: **Allow merge commits** must be ticked (it is today). Do not touch squash or rebase.

**B5. Merge:** wait for the required checks (`Verify OPF packages`, `packages`, `Installed candidates (windows-latest)`, `Installed candidates (macos-latest)`) on the pull request. Open the merge button's dropdown and choose **Create a merge commit**; never **Squash and merge** or **Rebase and merge**. If a required check never reports on a pull request (the Windows and macOS legs normally run in the queue), use A1 for a temporary admin bypass and choose **Merge without waiting for requirements to be met (bypass rules)**, then A5.

**B6. Restore the queue** unless O6 follows within the hour: ruleset, tick **Require merge queue** with exactly these values: merge method **Squash**, build concurrency **4**, minimum group size **1**, maximum group size **4**, wait time to meet the minimum **5 minutes**, grouping **All green**, status check timeout **180 minutes**. Or restore the backup: delete the edited ruleset, then Rulesets, **New ruleset**, **Import a ruleset**, pick the exported JSON.

**B7. Verify:** `gh api repos/OpenPresentation/opf/commits/main --jq '.parents|length'` prints `2` (a merge commit), and tell the agent the merge commit's SHA. **Undo:** as for Option A (revert the merge with `-m 1`, through a pull request).

---

## O4. The GitHub App (before MR-41 for the release commit; before MR-52 for the sites)

**What and why.** One App does two jobs: the `prepare` job of `npm-publish.yml` pushes the release commit to `main` (a bypass actor), and `bump-sites.yml` opens the "bump to vX.Y.Z" pull requests in the three site repositories, and each site's own CI merges a patch bump with the App's token (D19). App-authored pushes and pull requests start workflows; `GITHUB_TOKEN` ones do not. Only `prepare` and `bump-sites.yml` hold the key; `publish` holds no secret. The plan calls this the "ecosystem App"; it does not exist yet (finding 1).

**Create it** (as an organization App: `https://github.com/organizations/OpenPresentation/settings/apps/new`, or Organization settings, Developer settings, **GitHub Apps**, **New GitHub App**):

| Field | Value |
| --- | --- |
| GitHub App name | `OPF release bot` (it must be unique across GitHub; if taken, `OpenPresentation release bot`) |
| Homepage URL | `https://github.com/OpenPresentation/opf` |
| Callback URL, Setup URL | empty; leave "Request user authorization (OAuth) during installation" unticked |
| Webhook | untick **Active** (the App needs no events) |
| Repository permissions | **Contents: Read and write**; **Pull requests: Read and write**; **Metadata: Read-only** (added automatically). Nothing else |
| Organization and account permissions | none |
| Subscribe to events | none |
| Where can this GitHub App be installed? | **Any account** (the three sites live in the `Data-Advantage` organization; an "Only on this account" App cannot be installed there. Any account only means anyone could install it on their own repositories, which gives them nothing: the private key stays yours) |

Click **Create GitHub App**. On the App's General page:

1. Note the **App ID** (a number, shown near the top).
2. **Private keys**, **Generate a private key**: a `.pem` file downloads. Treat it like a password.
3. Left sidebar, **Install App**: next to `OpenPresentation` click **Install**, choose **Only select repositories**, pick `opf`, **Install**. Repeat next to `Data-Advantage` with **Only select repositories** and `openpresentation-site`, `pptx-gallery`, `pptx-dev` (you can do the second installation later, before MR-52).

**Store the two values in `OpenPresentation/opf`** (Settings, Secrets and variables, Actions):

- **Variables** tab, **New repository variable**: Name `ECOSYSTEM_APP_ID`, Value the App ID.
- **Secrets** tab, **New repository secret**: Name `ECOSYSTEM_APP_PRIVATE_KEY`, Value the whole text of the `.pem`, including the `-----BEGIN ... -----` and `-----END ... -----` lines.

(These are the names the existing workflows already read, `ecosystem-roll.yml` and `release-train.yml`, so they keep working until MR-34.) Then delete the downloaded `.pem` or move it into your password manager.

**Verify.**

```sh
gh api repos/OpenPresentation/opf/actions/variables --jq '.variables[].name'   # includes ECOSYSTEM_APP_ID
gh api repos/OpenPresentation/opf/actions/secrets --jq '.secrets[].name'       # includes ECOSYSTEM_APP_PRIVATE_KEY
gh api orgs/OpenPresentation/installations --jq '.installations[].app_slug'    # includes the App's slug
```

The functional proof is the `actions/create-github-app-token` step succeeding in the MR-40 dry run (opf) and in the MR-52 dry-run bump (one per site).

**Undo.** Delete the variable and the secret; App page, **Advanced**, **Delete GitHub App** (or **Install App**, **Configure**, **Uninstall**). Rotate the key any time: General, **Private keys**, generate a new one, replace the secret, delete the old key.

---

## O5. The App as a bypass actor on the current `main` ruleset (before MR-41)

**What and why.** The `prepare` job pushes "release vX.Y.Z" straight to `main`, which the ruleset blocks for everybody. This lets the App (and only the App) do it. It must be in place before the canary dispatch of MR-41, so it is added to the **current** ruleset now and carried over in O6.

**Steps.** Settings, Rules, Rulesets, **main: cross-platform checks required (RR-04)**, **Bypass list**, **Add bypass**, tab **Apps** (or the list shows "OPF release bot" under Apps; it appears only if the App is installed on `opf`, O4 step 3), tick it, mode **Always allow**, **Add selected**, **Save changes**.

**Verify.** `gh api repos/OpenPresentation/opf/rulesets/24382980 --jq '.bypass_actors'` prints one entry with `"actor_type":"Integration"` and `"bypass_mode":"always"`. The functional proof is the MR-40/MR-41 `prepare` job pushing the commit.

**Undo.** The row's **...**, **Remove**, **Save changes**. The PR path of the plan (run `pnpm release:prepare X.Y.Z` locally, merge the pull request, push the `v*` tag) needs no bypass at all.

---

## O6. MR-33: the ruleset switch

**What and why.** Plan decisions D8 and D15: no merge queue, one required check `verify`, squash merges, no "require branches to be up to date". Agents then merge with GitHub auto-merge when `verify` is green.

**One edit, not two.** Removing the merge queue and switching the required check to `verify` happen in the same ruleset save (steps 3 below). `ci.yml` has no `merge_group` trigger (MR-30), so `verify` must never be required while the queue exists (a queue entry would wait for a check that is never reported).

**When.** After MR-32 (20 measured `verify` runs). **Before** the MR-33 pull request that deletes `opf-ci.yml`, `ecosystem-ci.yml`, `cli-windows.yml`, `engines-range.yml` and the four `flake-repeat.yml` merges: those workflows produce the four old required checks, and a required check that never reports blocks every pull request. The agent tells you when. `verify` must have run on at least one pull request in the last 7 days, or GitHub will not offer it in the check picker (then type it).

**Today's ruleset, for the undo** (id 24382980, target the default branch, no bypass): required checks `packages`, `Installed candidates (windows-latest)`, `Installed candidates (macos-latest)`, `Verify OPF packages` (all from GitHub Actions, integration id 15368), strict policy off, "do not enforce on create" off; merge queue: merge method **Squash**, max entries to build **4**, min entries to merge **1**, max entries to merge **4**, wait for minimum **5** minutes, grouping **All green**, check timeout **180** minutes.

**Steps, browser.** First back up: ruleset page, **...**, **Export ruleset** (and `gh api repos/OpenPresentation/opf/rulesets/24382980 > ~/opf-ruleset-24382980-before-mr33.json`). Then edit the same ruleset:

1. Name (optional): `main: verify required (MR-33)`. Enforcement **Active**. Target: default branch, unchanged.
2. Bypass list: keep the App (O5); no one else.
3. Rules:
   - untick **Require merge queue**;
   - tick **Require a pull request before merging**: required approvals **0**; dismiss stale approvals off; require review from Code Owners **off** (a single maintainer cannot approve their own pull request); require conversation resolution off; **Allowed merge methods: Squash only** (untick Merge and Rebase);
   - **Require status checks to pass**: remove `packages`, `Installed candidates (windows-latest)`, `Installed candidates (macos-latest)` and `Verify OPF packages`; **Add checks**, search `verify`, pick the one whose source is **GitHub Actions**; **untick** "Require branches to be up to date before merging"; leave "Do not require status checks on creation" unticked;
   - hardening, optional and invisible to agents: tick **Block force pushes** and **Restrict deletions**.
4. **Save changes.**

**Steps, API** (same result; save as `ruleset-mr33.json`, replace `<APP_ID>` with the App ID from O4, then `gh api --method PUT repos/OpenPresentation/opf/rulesets/24382980 --input ruleset-mr33.json`):

```json
{
  "name": "main: verify required (MR-33)",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [{ "actor_id": <APP_ID>, "actor_type": "Integration", "bypass_mode": "always" }],
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 0, "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false, "require_last_push_approval": false,
        "required_review_thread_resolution": false, "allowed_merge_methods": ["squash"] } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": false, "do_not_enforce_on_create": false,
        "required_status_checks": [{ "context": "verify", "integration_id": 15368 }] } }
  ]
}
```

**Repository settings** (Settings, General, Pull Requests; do these after O3, because O3 Option B needs merge commits):

- **Allow auto-merge**: tick (finding 5; required for every agent merge without a queue).
- **Allow merge commits**: untick. **Allow rebase merging**: untick. **Allow squash merging**: stays ticked, message settings unchanged.
- **Automatically delete head branches**: tick (optional; keeps the branch list short).
- Risk 14 of the plan: confirm nobody else has write access, because the ruleset now governs six packages: `gh api repos/OpenPresentation/opf/collaborators --jq '.[].login'` should list only you (it does on 2026-10-21, and the same for the four old repositories).

**Verify.**

```sh
gh api repos/OpenPresentation/opf/rulesets/24382980 --jq '{types:[.rules[].type], checks:(.rules[]|select(.type=="required_status_checks")|.parameters.required_status_checks|map(.context)), methods:(.rules[]|select(.type=="pull_request")|.parameters.allowed_merge_methods)}'
gh api repos/OpenPresentation/opf --jq '{allow_auto_merge,allow_squash_merge,allow_merge_commit,allow_rebase_merge}'
```

Expected: no `merge_queue` among the types, `checks` is `["verify"]`, `methods` is `["squash"]`, auto-merge and squash true, the other two false. The end-to-end proof: open a docs-only pull request and run `gh pr merge <n> --auto --squash`; it merges by itself when `verify` is green and the pull request page shows no "merge queue" step (`node scripts/pr-gate.mjs --merge` does the same).

**Undo.** Delete or disable the edited ruleset, then Rulesets, **New ruleset**, **Import a ruleset**, pick the exported JSON; or put the table above back by hand. Re-tick "Allow merge commits" if a merge commit is needed again (O3 Option B). The old workflows can be restored by reverting the MR-33 pull request.

---

## O7. Optional: a tag ruleset for release tags (MR-40)

**What and why.** The plan's invariant is "tags are never moved". A tag ruleset enforces it for the release tags. It does not match the imported tags (`opf-render-v*`, `gallery-v*` and so on), which are not `v*`.

**Steps.** Settings, Rules, Rulesets, **New ruleset**, **New tag ruleset**:

1. Name `release tags v* (MR-40)`; Enforcement **Active**.
2. Bypass list: the App (O4), mode **Always allow**; optionally yourself.
3. Target tags: **Add target**, **Include by pattern**, `v*`.
4. Rules: tick **Restrict updates** and **Restrict deletions**. Do **not** tick **Restrict creations** (finding 4: the App, a bypass actor, pushes `vX.Y.Z` in `release.yml`; leaving creation open also keeps the pull-request fallback, where you push the tag, working). Pushing a `v*` tag by hand then still works for you.
5. **Create**.

**Verify.** `gh api repos/OpenPresentation/opf/rulesets --jq '.[]|[.name,.target,.enforcement]|@tsv'` lists it as `tag active`. **Undo.** Disable or delete the ruleset.

---

## O8. The three site repositories (MR-52; needs O4's second installation)

Sites: `Data-Advantage/openpresentation-site` (default branch `main`, workflow `site-ci.yml`), `Data-Advantage/pptx-gallery` (`main`), `Data-Advantage/pptx-dev` (default branch **`master`**). Agents add or rename a job `build-and-smoke` and a final merge step in each site's CI by pull request; the sites keep deploying by their own path.

**Decided (D19, owner, 2026-10-21): the site's own CI merges.** `bump-sites.yml` only opens the "bump to vX.Y.Z" pull request. In each site, the CI step after `build-and-smoke` merges a patch bump with the GitHub App's token (so the merge starts the site's push and deploy workflows; a `GITHUB_TOKEN` merge would not). The sites are private repositories in a Free-plan organization, so there is no ruleset, no required check and no auto-merge setting, and you do not need any: **do not enable "Allow auto-merge" and do not add a ruleset**. Not chosen: upgrading `Data-Advantage` to the Team plan, and no auto-merge.

**Steps, per site** (`openpresentation-site`, `pptx-gallery`, `pptx-dev`; after O4 has created the App and its key):

1. Install the App on the site repository: the `Data-Advantage` installation of the App (O4, step 3), **Configure**, **Only select repositories**, tick the three sites. The App needs **Contents: Read and write** and **Pull requests: Read and write** (already set in O4).
2. Add the App ID and private key as secrets in the site repository, with the same names as in `OpenPresentation/opf` so the workflows read alike: Settings, Secrets and variables, Actions, **Secrets** tab, **New repository secret**: `ECOSYSTEM_APP_ID` (the App ID, stored as a secret here so the site workflow reads both from `secrets`) and `ECOSYSTEM_APP_PRIVATE_KEY` (the whole `.pem`, including the BEGIN and END lines). Or from a terminal, with the key file at hand:

```sh
for r in openpresentation-site pptx-gallery pptx-dev; do
  gh secret set ECOSYSTEM_APP_ID -R Data-Advantage/$r --body "<APP_ID>"
  gh secret set ECOSYSTEM_APP_PRIVATE_KEY -R Data-Advantage/$r < ~/path/to/the-app.private-key.pem
done
```

**Verify.**

```sh
gh api orgs/Data-Advantage/installations --jq '.installations[]|select(.app_slug=="<APP_SLUG>")|.repository_selection'
for r in openpresentation-site pptx-gallery pptx-dev; do
  gh secret list -R Data-Advantage/$r | grep ECOSYSTEM_APP
done
```

Two secrets per site. The proof is the dry-run bump of MR-52: a patch bump pull request opened by the App waits for `build-and-smoke`, is merged by the site's CI, and the site's push workflow starts; a minor one stays open with the `needs-review` label.

**Undo.** Delete the two secrets in each site; uninstall the App from the sites: Organization settings, Installed GitHub Apps, **Configure**, remove the repository; disable `bump-sites.yml` (an agent task).

---

## O9. MR-51: approve the issue transfer

**What and why.** Open issues move into `OpenPresentation/opf` with `gh issue transfer`, which keeps the title, body, comments, author and the labels that exist in the destination. This cannot be rehearsed, and a transfer is visible to anyone watching, so the plan makes it your approval.

**What the agent has ready.** The agent lists the open issues again at MR-51 (15 on 2026-10-21: opf-render 3, opf-pptx 7, opf-editor 3, gallery 2) plus the gallery draft pull request (ported or closed, never transferred). The agent first creates the labels `pkg:core`, `pkg:cli`, `pkg:render`, `pkg:pptx`, `pkg:editor`, `pkg:gallery` and `parked` (`bug`, `enhancement`, `descoped` exist already) and then runs, per issue:

```sh
gh issue transfer <number> OpenPresentation/opf --repo OpenPresentation/<old-repo>
gh issue edit <new-number> --repo OpenPresentation/opf --add-label pkg:<name>
```

**Your step.** Reply "approved: transfer the open issues of opf-render, opf-pptx, opf-editor and gallery" (or name a subset). Do it after O3, and **before** O10: a transfer from an archived repository is impossible.

**Verify.** `gh issue list -R OpenPresentation/<old-repo> --state open` is empty (or only the pinned pointer issue); the old issue URLs redirect to the new ones; references stay repository-qualified (`OpenPresentation/opf-render#190`).

**Undo.** `gh issue transfer <new-number> OpenPresentation/<old-repo> --repo OpenPresentation/opf` moves one back (it gets a new number there).

---

## O10. MR-60: archive and clean up (after the soak, MR-53)

**When.** After two stable monorepo releases and 7 days (D9), the README pointer pull requests of the four old repos merged, MR-51 and MR-52 done. Archiving disables Actions in that repository, so it comes last.

**1. Archive the four repositories** (`OpenPresentation/opf-render`, `opf-pptx`, `opf-editor`, `gallery`). For each: Settings, General, scroll to **Danger Zone**, **Archive this repository**, type the repository name, **I understand the consequences, archive this repository**. If O2's ruleset is still active, it does not matter. Verify: `gh api repos/OpenPresentation/<repo> --jq .archived` prints `true`. Undo: Settings, General, Danger Zone, **Unarchive this repository** (the old publisher entries are still in place until step 2, so a hotfix release from an old repository stays possible).

**2. Remove the old npm trusted-publisher entries** (last, after the archive and after at least one release in which the new entry published; see plan section 7 item 6). Keep core's entry: it is the new one.

```sh
npm trust list @openpresentation/cli          # find the id of the entry with file cli-publish.yml
npm trust revoke @openpresentation/cli --id <id>
# repeat: opf-render (repository opf-render, npm-publish.yml), opf-pptx (opf-pptx, release.yml),
#         opf-editor (opf-editor, release.yml), gallery (gallery, gallery-publish.yml)
```

(Browser: each package's Settings, Trusted Publisher, the old entry's **Delete**.) Verify with `npm trust list`: one entry each, `OpenPresentation/opf` / `npm-publish.yml`. Undo: re-add with `npm trust github @openpresentation/<p> --repo OpenPresentation/<old-repo> --file <old-file> --allow-publish`.

**3. Remove loose variables and secrets.**

- The repository variable `ECOSYSTEM_LOCK_GUARD`, if it exists (none is set at repository level on 2026-10-21; look at organization level too: `https://github.com/organizations/OpenPresentation/settings/variables/actions`).
- The secret `NPM_TOKEN` in `OpenPresentation/opf` (finding 6) and the matching npm access token (npmjs.com, account, **Access Tokens**, revoke the one named for this repository, if you recognize it). No workflow reads it. Keep `ECOSYSTEM_APP_ID` and `ECOSYSTEM_APP_PRIVATE_KEY`: the release and the site bumps use them.

**4. Optional, any time after the first monorepo gallery publish: a dist-tag for the old line** so `npm view @openpresentation/gallery dist-tags` explains 5.0.0:

```sh
npm dist-tag add @openpresentation/gallery@5.0.0 legacy-v5
```

(`v5` is rejected by npm, finding 3.) It does not touch `latest`. Verify: `npm view @openpresentation/gallery dist-tags`. Undo: `npm dist-tag rm @openpresentation/gallery legacy-v5`.

---

## Any rollback

Nothing here needs re-pointing: the old trusted-publisher entries, the old workflows (until archive) and the old repositories themselves stay until O10. To go back before O10: revert the agent's pull requests, restore the ruleset from the exported JSON (O6), unarchive if O10 step 1 was done, and re-add any removed publisher entry. Section 7 item 6 of the plan describes how to regenerate a package's history from the monorepo if the old repository must continue.
