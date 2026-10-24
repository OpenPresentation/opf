# Site-side workflows for the OPF bump pull requests (MR-52, D19)

Drafts, not installed. `bump-sites.yml` in this repository opens a "bump to vX.Y.Z" pull request in each of the three site repositories
after a stable release and labels it `auto-merge` (a patch bump) or `needs-review` (a minor or major bump). It never merges one. The sites
are private repositories in a Free-plan organization, so they have no ruleset, no required check and no auto-merge: **each site's own CI
merges an `auto-merge` bump after its build and smoke checks passed, with the GitHub App's token** (decision D19). These files are that
merge, one per site. MR-52 installs them (a pull request per site, no deploy) after the App exists.

| Site (repository, default branch) | Files to copy to `.github/workflows/` | Required checks |
| --- | --- | --- |
| `Data-Advantage/openpresentation-site` (`main`) | `openpresentation-site/opf-bump-merge.yml` | `site` (the job of `site-ci.yml`) |
| `Data-Advantage/pptx-gallery` (`main`) | `pptx-gallery/opf-bump-merge.yml` and `pptx-gallery/build-and-smoke.yml` | `build-and-smoke` (new; pptx-gallery has no pull request CI for an arbitrary change) |
| `Data-Advantage/pptx-dev` (`master`) | `pptx-dev/opf-bump-merge.yml` | `verify (ubuntu-latest)` (application-ci.yml) and `build` (cloudflare-build.yml) |

## What `opf-bump-merge.yml` does

It runs on `workflow_run` when the site's pull request CI completes (so it executes the default branch's copy and no code from the bump
branch) and merges only if every condition holds; otherwise it stops with a notice and the pull request stays open:

1. the completed run succeeded, was a `pull_request` run, and its branch is a `bot/opf-v*` branch of this repository (no fork);
2. an open pull request exists for that branch, its head is the commit that run tested, it targets the default branch and is titled
   `bump to vX.Y.Z`;
3. it carries the label `auto-merge` and not `needs-review`;
4. it changes only manifests, the lockfile and the files a site mirrors its pins in (`ALLOWED_FILES`);
5. every check in `REQUIRED_CHECKS` is `success` for the head commit (the last completion decides: an earlier one finds a check pending);
6. then `gh pr merge --squash --delete-branch --match-head-commit <sha>` with the App's token, so the merge is a push by the App and starts
   the site's push and deploy workflows (a merge with `GITHUB_TOKEN` starts none).

The deploy path is the site's own and unchanged; nothing here deploys, logs in to a host or touches DNS.

## Install notes (owner steps O4 and O8 first)

1. **The App** (`docs/programs/monorepo/owner-steps.md`, O4 and O8): installed on the three site repositories with Contents and Pull
   requests read and write, and the secrets `ECOSYSTEM_APP_ID` and `ECOSYSTEM_APP_PRIVATE_KEY` set in each site repository. Two things to
   confirm on the first dry run: `bump-sites.yml` creates the labels `auto-merge` and `needs-review` in each site (if GitHub answers 403
   for the label call, add Issues: write to the App, or create the two labels by hand), and the App can merge (it has no branch protection
   to get past).
2. **Copy the files** by one pull request per site (MR-52). Each file's header says where it goes. Check the workflow names in `workflows:`
   and the check names in `REQUIRED_CHECKS` against the site's CI on the day: a renamed job or workflow silently never merges (it fails
   closed). If MR-52 renames a site's job to `build-and-smoke`, change the two names together.
3. **The site scripts** (`pnpm opf:bump <X.Y.Z>`, `scripts/opf-bump.mjs` in each site). `bump-site.mjs` runs the script of the site it is pointed at;
   it does the whole bump of that site, so the pull request needs no human edit to be green:
   `openpresentation-site` sets the pins of the root and the starters and `opfSource` (the commit of the tag), refreshes the lockfile, updates
   `data/releases.json` from the registry and the GitHub release notes of the tag, syncs `.opf-source` and regenerates
   `public/homepage-details/manifest.json`; `pptx-gallery` sets the pins, refreshes the lockfile, runs `sync-preview-fonts --core-repo <checkout>
   --core-ref <commit>`, the catalog and preview syncs and `build-chart-previews`, vendors the editor bundle and schema reference
   (`public/opf-editor`, `data/opf-spec.json`) with `scripts/vendor-gallery-editor.mjs` of the checkout at the tag, and runs the checks of its CI that
   read them; `pptx-dev` sets the pins, `opf-reference-layer-pins.json` and the lockfile. The checkout of this repository is `--opf <dir>`
   (`bump-sites.yml` passes its own, with the tag fetched), else `$OPF_CHECKOUT`, else a shallow clone of the tag. By hand, on the default branch
   of a site: `pnpm opf:bump 0.26.2` (it needs network access to the registry and GitHub). `ALLOWED_FILES` in each merge workflow lists the files
   a bump may change, which is exactly what that site's script writes; extend it in the same pull request when the script learns a new output. A release that changes behavior a site's tests assert, or an advisory published
   after the lockfile was resolved, still turns the site's CI red and the pull request stays open for a person.
4. **Rollback.** Delete the workflow files from the sites (and disable `bump-sites.yml`); the labels and pull requests are harmless.
5. **Dry run before the first release:** Actions, **Bump sites**, **Run workflow** in OpenPresentation/opf with an already published
   version (dry-run is true by default: the edits and the lockfile diff are shown in the job summary and nothing is pushed), then once
   with `dry-run` false for one site (`sites` input) on a patch version to see a pull request opened, checked and merged.
