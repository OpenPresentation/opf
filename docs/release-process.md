# OPF Release Process

This document is the release runbook for the public JavaScript package,
[`@openpresentation/opf`](https://www.npmjs.com/package/@openpresentation/opf).

The canonical release path is:

1. Merge the release commit to `main`.
2. Push a semver tag whose name matches the package version.
3. Let GitHub Actions publish to npm through npm trusted publishing.
4. Verify npm and create GitHub release notes.

## Release Preconditions

Before tagging, confirm that the release commit on `main` already contains:

- `packages/javascript/package.json` with the intended version.
- `CHANGELOG.md` with the matching release section.
- Passing `OPF CI` on the release commit.

The publish workflow validates the tag name against
`packages/javascript/package.json`, so the tag must point at the release commit.

## Tag And Publish

Use the `opf-vX.Y.Z` tag form for the package release:

```sh
git checkout main
git pull origin main
grep '"version"' packages/javascript/package.json
git tag opf-vX.Y.Z
git push origin opf-vX.Y.Z
```

For example, version `0.3.0` used:

```sh
git tag opf-v0.3.0
git push origin opf-v0.3.0
```

Pushing the tag triggers `.github/workflows/npm-publish.yml`. The workflow:

- runs on tags matching `opf-v*` or `@openpresentation/opf@v*`
- installs dependencies with pnpm on Node 24
- verifies the tag matches `packages/javascript/package.json`
- runs typecheck and tests
- runs the npm package dry-run check
- publishes from `packages/javascript` with `npm publish --access public`

Do not rerun a successful publish for the same version. npm package versions are
immutable; a second publish for an already-published version should fail.

## Trusted Publishing

npm publishing is configured to use GitHub Actions OIDC trusted publishing, not
a long-lived npm token.

Expected npm package trusted-publisher settings:

| Setting | Value |
|---|---|
| Package | `@openpresentation/opf` |
| Publisher | GitHub Actions |
| Organization/repository | `OpenPresentation/opf` |
| Workflow filename | `npm-publish.yml` |
| Environment | empty, unless the workflow is later moved behind a GitHub Environment |
| Permission | `npm publish` |

Expected workflow settings:

```yaml
permissions:
  contents: read
  id-token: write
```

The publish step should not set `NODE_AUTH_TOKEN`:

```yaml
- name: Publish to npm
  working-directory: packages/javascript
  run: npm publish --access public
```

If a future release fails with npm authentication errors, check the npm
trusted-publisher settings first. Only use an `NPM_TOKEN` repository secret as a
temporary fallback, and remove or revoke it once OIDC publishing works again.

## Verify The Release

After the workflow completes, verify npm:

```sh
npm view @openpresentation/opf version
```

The output should equal the package version that was tagged.

Spot-check the validator API from a clean project or temporary directory:

```sh
npm install @openpresentation/opf@X.Y.Z
node --input-type=module -e "import {validatePresentation} from '@openpresentation/opf'; console.log(validatePresentation({name:'t', narrative:'not-a-real-id', slides:[{title:'t'}]}).warnings)"
```

The expected result is one warning about an unknown narratives catalog id.

## GitHub Release Notes

The tag flow publishes npm but does not automatically create a GitHub Release.
After npm is verified, create a release for the existing tag:

```sh
gh release create opf-vX.Y.Z \
  --repo OpenPresentation/opf \
  --title '@openpresentation/opf X.Y.Z' \
  --notes-file /path/to/release-notes.md
```

Use the matching `## X.Y.Z` section from `CHANGELOG.md` as the release notes.

## Troubleshooting

If the tag/version check fails, the tag does not point at the release commit or
the tag name does not match `packages/javascript/package.json`. Delete the bad
local and remote tag, fetch `main`, and tag the correct commit:

```sh
git push origin :refs/tags/opf-vX.Y.Z
git tag -d opf-vX.Y.Z
git checkout main
git pull origin main
git tag opf-vX.Y.Z
git push origin opf-vX.Y.Z
```

If tests fail, fix the code on `main`, create a new release commit, and move the
tag only if npm has not already published that version.

If npm publish fails with `ENEEDAUTH`, confirm:

- npm has a trusted publisher for `OpenPresentation/opf`
- the trusted publisher uses workflow filename `npm-publish.yml`
- `.github/workflows/npm-publish.yml` has `id-token: write`
- the publish job is running on a modern Node/npm toolchain

If npm publish fails after the version is already present on npm, do not retry
the same publish. Verify the package and treat the failure as a duplicate
publish attempt.
