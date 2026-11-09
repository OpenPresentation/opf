import fs from 'node:fs';
import assert from 'node:assert/strict';
const changes=[];
function replace(file,from,to){let s=fs.readFileSync(file,'utf8');assert.ok(s.includes(from),file+': missing original text');s=s.replace(from,to);fs.writeFileSync(file,s);changes.push(file);}
replace('packages/javascript/src/chart-fallback.ts',"  const plan = chartDrawPlan(chart, resolved, options);\n  if (!plan.dropped.length) return [];",`  const plan = chartDrawPlan(chart, resolved, options);
  if (plan.fallback === 'pareto-as-columns') return [{
    code: 'chart-mapping-adapted', severity: 'warning', path: \`\${path}/type\`,
    message: 'a Pareto chart sorts one numeric series and draws its cumulative share; several numeric series are drawn as clustered columns in data order, with every series preserved; use one numeric series for a Pareto chart',
  }];
  if (!plan.dropped.length) return [];`);
replace('packages/javascript/src/chart-fallback.ts'," * The `chart-series-dropped` warning of a chart whose drawn construct leaves a resolved column out", " * The multi-series Pareto type-adaptation warning, or the `chart-series-dropped` warning when a drawn construct leaves a resolved column out");
replace('skills/opf-layout/SKILL.md','The 36 built-ins are named by intent','The 40 built-ins in this source are named by intent');
replace('packages/editor/README.md','groups the 36 built-ins by intent','groups the matching Gallery package’s built-ins by intent (40 in this source)');
replace('llms.txt','map of the 137 JSON example decks plus two Markdown decks outside the bundled catalog','map of the 147 JSON example decks in this source (101 gallery, 46 technical), plus two Markdown decks outside the bundled catalog; published counts follow the installed release');
replace('README.md','for the currently recorded registry pin set: the six packages used by the local workflow (core, renderer, PPTX, editor, CLI and Gallery), all at the shared version 0.33.0. The optional seventh package, `@openpresentation/mcp@0.33.0`, supplies the [MCP server and viewer](docs/mcp.md). The default catalog is supplied by `@openpresentation/gallery@0.33.0`;','for the registry-derived pin set: core, renderer, PPTX, editor, CLI and Gallery use one completed shared release, retained with `--save-exact` and the lockfile. The optional seventh package, `@openpresentation/mcp`, supplies the [MCP server and viewer](docs/mcp.md). The default catalog is supplied by the matching `@openpresentation/gallery` release;');
const quick='docs/quickstart.md';let q=fs.readFileSync(quick,'utf8');const start=q.indexOf('**Published set (0.33.0):**'),end=q.indexOf('```sh',start);assert.ok(start>=0&&end>start);q=q.slice(0,start)+`Use one completed shared stable release for core, CLI, renderer, PPTX, editor
and Gallery. In a checkout, \`node scripts/registry-plan.mjs\` prints these six
packages' current registry versions and \`gitHead\` values. The optional seventh
package, \`@openpresentation/mcp\`, follows the same release and is verified by the
[release workflow](release-process.md); see its [server and viewer guide](mcp.md).

The install below saves exact versions in \`package.json\`; retain
\`package-lock.json\` and confirm the six OPF packages share one release before
using the workflow. For an earlier reproducible run, use the exact versions in
its receipt. The [2026-11-08 published-consumer receipt](handoff/2026-11-08/core-033-currency/post-publication/receipt.json)
records the genuine 0.33.0 run, separately from Office and site qualification.
All packages declare \`engines.node: >=22\`; Node 24 is the verified toolchain.

`+q.slice(end);q=q.replace('npm install @openpresentation/opf@0.33.0','npm install --save-exact @openpresentation/opf').replaceAll('@openpresentation/opf-render@0.33.0','@openpresentation/opf-render').replaceAll('@openpresentation/opf-editor@0.33.0','@openpresentation/opf-editor').replaceAll('@openpresentation/opf-pptx@0.33.0','@openpresentation/opf-pptx').replaceAll('@openpresentation/cli@0.33.0','@openpresentation/cli').replaceAll('@openpresentation/gallery@0.33.0','@openpresentation/gallery');q=q.replace('the 137 JSON decks in `@openpresentation/opf/examples` (101 gallery and 36 technical\ndecks; the two Markdown decks are outside that catalog).','the JSON decks in the installed `@openpresentation/opf/examples` catalog\n(the two Markdown decks are outside that catalog). The [source inventory](compatibility-matrix.md#current-source-inventory) is separate from the installed release.');fs.writeFileSync(quick,q);changes.push(quick);
replace('docs/agent-skills.md','Pin a version, for example `@openpresentation/cli@0.33.0`, when you need a repeatable installation;','For a repeatable installation, pin the exact CLI version recorded in your installed package manifest or release receipt;');
const matrix='docs/compatibility-matrix.md';let m=fs.readFileSync(matrix,'utf8');const a=m.indexOf('**Published set (0.33.0):**'),b=m.indexOf('## Published layout contract',a);assert.ok(a>=0&&b>a);m=m.slice(0,a)+`Core, renderer, PPTX, editor, CLI, Gallery and MCP use one shared release.
\`node scripts/registry-plan.mjs\` prints the six-package consumer set (excluding
MCP) with each registry \`gitHead\`; the [release workflow](release-process.md)
verifies all seven packages. Retain the exact installed versions and lockfile.
The [2026-11-08 registry and quickstart receipts](handoff/2026-11-08/core-033-currency/post-publication/receipt.json)
record the genuine 0.33.0 set at release commit 26fd4de9. Earlier observations
retain their historical identities; source support below is separate from
registry publication and native Office acceptance.

`+m.slice(b);const c=m.indexOf('## Current published package contracts'),d=m.indexOf('## Runtime',c);assert.ok(c>=0&&d>c);m=m.slice(0,c)+`## Shared package contracts

| Package | Version | Dependency contract |
| --- | --- | --- |
| Core | Shared release | Matching Gallery; optional renderer/PPTX in the same release line |
| CLI | Shared release | Matching core/Gallery; optional renderer/PPTX in the same release line |
| Renderer | Shared release | Matching core; optional pinned font/converter peers |
| PPTX | Shared release | Matching core/Gallery; optional renderer in the same release line |
| Editor | Shared release | Matching core; optional renderer in the same release line |
| Gallery | Shared release | Owner of every default catalog record; use the catalog matching the installed release |
| MCP | Shared release | Matching core/Gallery; packaged deck viewer, with hosted availability determined separately |

## Current source inventory

This checkout's v0.34 source contains **147 JSON** example decks (101 gallery,
46 technical), **40 default layouts** and a **53-slide sampler** (40 layouts plus
13 dynamic compositions). Two Markdown decks and the quickstart fixture are
outside the JSON catalog. These counts describe source, not an already-published
v0.34 registry set. The recorded 0.33 release contains 137 JSON examples,
36 layouts and a 49-slide sampler; install a matching set rather than mixing
a source catalog with an older engine.

`+m.slice(d);m=m.replace('## Supported in this set','## Current source capabilities').replace('**137 JSON** decks (101 gallery, 36 technical); the two Markdown decks and quickstart JSON are outside this catalog','**147 JSON** decks in this source (101 gallery, 46 technical); published counts follow the installed release; two Markdown decks and quickstart JSON are outside this catalog');fs.writeFileSync(matrix,m);changes.push(matrix);
replace('docs/mcp.md','and hosted on an edge runtime (the same server definition over Streamable HTTP; a hosted URL at `openpresentation.org/mcp` is coming). The local server is the only one that can measure layout with the real fonts, when `@openpresentation/opf-render` is installed.','and hosted on an edge runtime (the same server definition over Streamable HTTP). The hosted connection target is `https://www.openpresentation.org/mcp`; its deployed version, tools and viewer availability follow that site’s deployment, separately from the npm package. Check the [hosted MCP guide](https://www.openpresentation.org/docs/mcp) for that deployment. The packaged `show_deck` viewer described here does not establish that a hosted deployment offers it. The local server measures layout with real fonts when `@openpresentation/opf-render` is installed.');
replace('docs/mcp.md','Download the versioned bundle and its SHA-256 file from the matching [GitHub release](https://github.com/OpenPresentation/opf/releases) (from 0.34.0). The trusted publish workflow builds and checks the full bundle before attaching it after registry verification.','When the matching [GitHub release](https://github.com/OpenPresentation/opf/releases) lists `opf-<version>.mcpb` and its SHA-256 file, download both assets from that release. Release-bundle publication is planned from 0.34.0; 0.33.0 has no published bundle asset. The trusted publish workflow builds and checks the full bundle before attaching it after registry verification.');
replace('packages/mcp/README.md','Claude Desktop: install `opf-<version>.mcpb` from the matching [GitHub release](https://github.com/OpenPresentation/opf/releases) (from 0.34.0), with its SHA-256 file.','Claude Desktop: when the matching [GitHub release](https://github.com/OpenPresentation/opf/releases) lists `opf-<version>.mcpb` and its SHA-256 file, install that bundle. Release-bundle publication is planned from 0.34.0; 0.33.0 has no published bundle asset.');
replace('packages/mcp/README.md','const server = createOpfServer({ version: "0.27.0" });','const server = createOpfServer({ version: "1.0.0" }); // your hosted server’s version');
replace('docs/diagrams.md','OPF draws diagrams with [pele](https://pele.run), which parses Mermaid 12.1 syntax.','OPF draws diagrams with [pele](https://pele.run), the shared layout/drawing library pinned as `pele@1.13.0` in this source. It parses Mermaid 12.1 syntax. OPF reads the supported DOT and PlantUML subsets itself and adapts them to the same engine; these are not separate Graphviz or PlantUML renderer installations.');
replace('docs/chart-options.md','## ', '## '); // no-op records this guide before appending the exact report boundary below
fs.appendFileSync('docs/chart-options.md',`\n## Multi-series Pareto adaptation\n\nA Pareto chart sorts one numeric series and draws its cumulative share. When the source has two or more numeric series, OPF preserves every series and category in data order as clustered columns in both the preview and PPTX. Validation reports \`opf/chart-mapping-adapted\` at the chart's \`type\`. It does not claim that these clustered columns are a Pareto chart, and does not discard a baseline series to produce a cumulative curve. Use one numeric series for the Pareto representation.\n`);
fs.writeFileSync('docs/handoff/2026-11-08/f1-f3-currency/edited-files.json',JSON.stringify([...new Set(changes)],null,2)+'\n');
