# MCP App SDK security repair

Actual ordinary CI on canonical `6a83630b694ef31d6fb6fe7c99764567e7ba4c5a`
fails [audit job130592648852](https://github.com/OpenPresentation/opf/actions/runs/43041036390/job/130592648852).
The raw first log remains `/tmp/opf-6a-audit.log`; no retry or audit suppression
replaces it. Source/lock pins are **2.0.0**, not the initially reported2.1 label.

The maintainer's [GHSA-6qxp-vccf-f47h](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6qxp-vccf-f47h)
affects client2.0–2.1 and is fixed in2.2.0. Its OAuth client could route stored
credentials to a server-selected authorization server. The separate
[GHSA-6prh-2h8m-c8cw](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6prh-2h8m-c8cw)
affects client before2.3.0; HTTP/OAuth requests could follow cross-origin
redirects carrying custom headers or request bodies. The SDK1 fix floors are
1.31.0 and1.32.0 respectively; the public server already uses1.32.2.

Official npm metadata checked November11 identifies **2.4.0** as `latest` for
both client/core. The [2.4 release](https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/v2.4.0)
and [version policy](https://github.com/modelcontextprotocol/typescript-sdk/blob/v2.4.0/VERSIONING.md)
keep them in one fixed version group. The published client depends exactly on
core2.4.0; both retain Node>=20 and use Zod^4.2.0, compatible with OPF's4.6.7.
[App2.0.4's peer contract](https://github.com/modelcontextprotocol/ext-apps/blob/v2.0.4/package.json)
admits client/core^2.0.0. No App upgrade or optional server2 peer is needed.

The official [client API](https://github.com/modelcontextprotocol/typescript-sdk/blob/v2.4.0/packages/client/src/index.ts)
still exposes the public Protocol surface App extends. Its
[changelog](https://github.com/modelcontextprotocol/typescript-sdk/blob/v2.4.0/packages/client/CHANGELOG.md)
retains the same-origin redirect repair and separates stdio from the browser
root; added Skills/OAuth refresh options are not enabled here. SDK1 classes
remain on the public-server side; only protocol data crosses the View boundary.

The isolated branch starts from freshly fetched main and normally integrates
exact6a. Pinned Node24.21.0/pnpm10.33.2 generated the manifest/lock change with:

```sh
pnpm --filter @openpresentation/mcp add --save-dev --save-exact \
  @modelcontextprotocol/client@2.4.0 @modelcontextprotocol/core@2.4.0 \
  --lockfile-only --ignore-scripts --store-dir /private/tmp/.pnpm-store
```

The resolver exits0 in2.7s. It also materialized its selected dependency graph
(264 modules), without lifecycle scripts/builds; this was not a frozen complete
workspace installation. Its existing editor React peer and unbuilt-bin warnings
are retained. Lock changes replace only the two SDK package/snapshot identities,
MCP importer pins and App peer-resolution key; existing transitive versions and
integrities stay unchanged. No override, audit ignore, server SDK update, CSP
relaxation, frame-limit increase, renderer golden or core/render/PPTX runtime source edit.

## First build and supported CSS successor

The first own frozen offline install passes (305ms), as does the maintained
dependency build (5.316s). The first MCP build is **RED** (0.955s): the unchanged
guard refuses10,544,710 escaped JSON-RPC bytes,58,950 over10,485,760. No candidate
HTML is written, and types/focus/browser/audit remain UNRUN. Original logs and
receipt remain `/tmp/opf-mcp-sdk-security-focus01/`.

One separately authorized diagnostic build on the exact unchanged source also
refuses the same byte count and writes an opt-in esbuild metafile before refusal.
Its777-input graph has9,912,618 script bytes, including212,654 attributed to the
MCP SDK/App inputs. Largest overall input is core's compiled validators1,910,922;
the font define is257,060. These are actual current graph contributions, not a
claim every SDK export or earlier graph difference is dead code. The profile and
first failure remain separate at `/tmp/opf-mcp-sdk-security-profile01/`.

The straightforward raw editor/view CSS inputs total254,824bytes after their
joining newline. The existing compiler's supported CSS whitespace-only pass
(`minifyWhitespace:true`, `minifySyntax:false`, `minifyIdentifiers:false`, UTF8,
`legalComments:'eof'`) measures197,359bytes. Its exact JSON-escaped inline
contribution falls264,326→197,406:66,920saved. This predicts10,477,790frame bytes
and7,970headroom at the same limit; the actual successor build must confirm it.
There are zero legal comments in the current raw inputs, no lost legal notices
and no compiler warnings. Supported options are documented by
[esbuild minification](https://esbuild.github.io/api/#minify),
[legal comments](https://esbuild.github.io/api/#legal-comments) and the
[CSS loader](https://esbuild.github.io/content-types/#css).

SOURCE02 adds a small maintained CSS producer helper called by the existing
builder. JavaScript compiler options, all font bytes/data/registration, CSP and
the frame guard remain untouched. There is no compression/runtime format change,
alias, external asset or dependency. The existing browser's first local-resource
case compares the complete raw concatenated stylesheet's CSSOM rules to the
actually served stylesheet, plus literal/selector/custom-property whitespace.
Remote endpoint mode retains all its existing16capability cases without claiming
its independently supplied View uses the local checkout's exact stylesheet.
Actual-helper Node controls cover legal notices and hostile inline-style literals.
At the SOURCE02 freeze, its build/types/focus/browser/audit were UNRUN; actual
qualification is recorded below.

The existing peer/runtime boundary
test now checks the actually installed pair and exact client→core edge alongside
real App/Protocol and SDK1 server/wire controls. The required resumed batch uses the already frozen installed dependency graph,
one successor MCP build, server/View strict types, existing MCP resource-frame
and UTF-8 controls, full16-scenario restrictive-CSP browser/host-download test,
and public-OPF-only audit. Record actual resource bytes/headroom and bundle/input
hashes; no assertion or budget change may mask growth. The original CI failure,
official metadata and resolver log stay separately retained. Actual builds,
browser behavior and final root integration/CI are separate from source review.

## Actual focused results and CSSOM successor

SOURCE02's own maintained MCP build passes at exactly10,477,790frame bytes,
7,970 below the unchanged10,485,760limit. Both strict server/View types and all
8focused SDK/UTF8/CSS-legal/resource-frame controls pass. All401 non-MCP compiled
JavaScript files in the pinned comparison inventory remain byte-identical.

The first browser attempt retains15/16PASS: its new CSSOM proof selected
CodeMirror's dynamically prepended style rather than the resource stylesheet.
SOURCE03 binds the exact served resource's sole static head style to exactly one
byte-identical live style and reads its actual sheet. That causal attempt also
retains15/16PASS:132 changed parsed rules differ only in optional comma whitespace
which CSSOM preserves in var-containing declarations. Both full logs/receipts
remain separate at `/tmp/opf-mcp-sdk-security-focus02/` and `focus03/`; neither
failure is relabeled. At that point the public audit was UNRUN.

SOURCE04 keeps a structured full CSSOM comparison: rule/selector/group/declaration
order, names, priorities and values remain strict. A small test-only helper admits
only unquoted ASCII whitespace immediately after commas in top-level transition
or box-shadow lists and known max/min/minmax/color-mix/linear-gradient contexts.
Custom properties, strings, escapes, comments, URL/var contents, unknown contexts
and required calc spacing remain exact. Finite controls protect changed values,
shadow/list order, cascade/declaration order, priorities and preserved text.
The reviewed SOURCE04 helper's three focused groups pass (62.7ms); the unchanged
16-case restrictive-CSP/browser/host-download suite passes (18.460s), including
the full actual stylesheet and literal CSSOM proof. One official npm audit of only
the public OPF inventory passes (0.233s):433 dependencies, zero vulnerabilities
at every severity, empty stderr. No private inventory is in this scope.

Existing19 built product artifacts, SDK pins, frame guard, CSP and all scenario
actions/timeouts remain unchanged. The401 non-MCP compiled JavaScript comparison
identities are exact again after the final replay. This is focused local
qualification; root's coherent maintained mapper and exact-head CI remain owed.

### Compact qualification identities

All commands use pinned Node24.21.0/pnpm10.33.2 and the own installed workspace.
The actual two strict type checks and8 SDK/UTF8/CSS-legal/frame controls pass in
focus02; SOURCE04 adds only the reviewed comparator/browser-test changes and
actual-result metadata. There is no later product rebuild or raw-output rewrite.

| Retained artifact | Bytes / SHA-256 |
| --- | --- |
| Original canonical audit failure | 38,540 / `22e031e01d112e79eb8ef2e7c0145b8e7b01dbf96cb6f8219ba0e1921daca211` |
| First browser failure (wrong dynamic sheet) | 260,308 / `d1b1f2766e4cff65662876af745deabfd0f252f42752f572ed8d20c846b49829` |
| Second browser failure (optional comma cssText) | 145,317 / `bcef038fdbe8cca8baa4bc70e1c62adff62f3dde7a776f1d205353e4c59283a5` |
| Qualified public audit JSON | 310 / `1c690b4cac583a4c58d39de2a4f753bd52d544d1990739fe4b8f7233d579f8be` |
| Built/served HTML | 10,114,633 / `7868a87463c7bdb878a2f57eac2edf7378b8e4a00dff9ce2811cd5890fb40cca` |
| Unchanged face manifest | 6,942 / `f3e6f0edc2e595f35bfe811fd20165e50626928bd300d37127eb56b2beb6b961` |

The HTML is10,114,633 raw bytes; its actual escaped JSON-RPC frame is10,477,790,
with7,970 bytes remaining under the unchanged10,485,760 default guard. HTML and
protocol-frame sizes describe different representations.

The first budget RED/profile remain literal under
`/tmp/opf-mcp-sdk-security-focus01/` and `profile01/`; the two browser failures
remain under `focus02/` and `focus03/`. Final actual receipt, three-group log,
16-case log, audit JSON/stderr and artifact/screenshot identities are under
`/tmp/opf-mcp-sdk-security-focus04/`. The frozen reviewed SOURCE04 executable
source identities are recorded by its external `manifest.json`; result metadata
added after qualification does not change those executable bytes. No failure was
replaced or relabeled as a pass. No full mapper, PPTX/golden, native Office or
additional CI run was launched by this lane.
