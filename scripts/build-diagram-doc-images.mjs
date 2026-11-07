// Draws the slides the diagram guide (docs/diagrams.md) shows as output, into docs/images/diagrams/<name>.svg.
//
//   node scripts/build-diagram-doc-images.mjs          write the SVGs
//   node scripts/build-diagram-doc-images.mjs --check  fail when an image is missing, stale or not used by the guide (pnpm check:diagram-doc-images)
//
// Each image is the whole slide as the renderer draws it from the checkout (packages/render/dist), with the bundled office fonts embedded,
// so the guide shows the real output of the source printed above it. A renderer diagnostic fails the build: the guide never shows a fallback.
import {mkdir,readdir,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'docs/images/diagrams');
const guide=path.join(root,'docs/diagrams.md');
const check=process.argv.includes('--check');
const {toSvg}=await import('../packages/render/dist/svg.js');
const {loadFonts}=await import('../packages/render/dist/fonts-node.js');
const {gallery}=await import('../packages/gallery/dist/index.js');

const REVIEW='flowchart LR\n  A[Request] --> B{Approved?}\n  B -->|yes| C[Build]\n  B -->|no| D[Revise]\n  D --> A';
const PIPELINE='flowchart LR\n  A[Request] --> B{Approved?}\n  B -->|yes| C[Build]\n  B -->|no| D[Revise]\n  D --> A\n  C --> E[Test]\n  E --> F{Passes?}\n  F -->|yes| G[Release]\n  F -->|no| C';
const PIPELINE_TITLE='Every request is reviewed before it ships';

// Name, then the deck design (undefined: the engine default) and the one slide. The sources match the guide's examples.
const IMAGES={
 'review-loop':[undefined,{title:'Every request is reviewed before it ships',diagram:REVIEW}],
 'review-loop-caption':[undefined,{title:'A rejected brief returns to its author',diagram:{source:'flowchart LR\n  A[Brief] --> B{Approved?}\n  B -->|yes| C[Build]\n  B -->|no| A',alt:'A brief goes to review. Approved work is built; rejected work returns to the brief.'},caption:'Figure 1. The review loop'}],
 'beside-text':[undefined,{title:'The client talks to one API',blocks:[{bullets:['The client creates a deck with one call','The API validates it before it answers']},{diagram:'sequenceDiagram\n  Client->>API: POST /decks\n  API-->>Client: 201 Created'}]}],
 'family-flowchart':[undefined,{diagram:'flowchart LR\n  A[Idea] --> B{Worth testing?}\n  B -->|yes| C[Prototype]\n  B -->|no| D[Park it]'}],
 'family-sequence':[undefined,{diagram:'sequenceDiagram\n  Client->>API: POST /decks\n  API-->>Client: 201 Created'}],
 'family-mindmap':[undefined,{diagram:'mindmap\n  root((Strategy))\n    Growth\n    Efficiency\n    People'}],
 'family-timeline':[undefined,{diagram:'timeline\n  title Regional rollout\n  section Pilot\n    2026 Q1 : One operations team\n  section Rollout\n    2026 Q3 : All regions'}],
 'family-state':[undefined,{diagram:'stateDiagram-v2\n  [*] --> Queued\n  Queued --> Building\n  Building --> Live: success\n  Building --> Failed: error\n  Failed --> Queued: retry'}],
 'family-journey':[undefined,{diagram:'journey\n  title Onboarding\n  section Sign up\n    Create an account: 5: New user\n    Verify the email: 3: New user\n  section First week\n    Build a first deck: 4: New user'}],
 'dot-pipeline':[undefined,{title:'Every change passes the same pipeline',diagram:{syntax:'dot',source:'digraph release {\n  rankdir=LR\n  node [shape=box, style=rounded]\n  subgraph cluster_ci {\n    label="Continuous integration"\n    Commit -> Build -> Test\n  }\n  Review [shape=diamond, label="Approved?"]\n  Test -> Review [label="passes"]\n  Test -> Build [label="fails", style=dashed]\n  Review -> Release [label="yes"]\n  Release [shape=ellipse]\n}'}}],
 'dot-states':[undefined,{title:'A deck moves from draft to published',design:{variant:'dark1'},diagram:{syntax:'dot',alt:'A draft is submitted for review; review approves it or sends it back.',source:'digraph states {\n  rankdir=LR\n  node [shape=circle]\n  Draft -> Review [label="submit"]\n  Review -> Draft [label="changes"]\n  Review -> Published [label="approve"]\n  Published [shape=doublecircle]\n}'}}],
 'style-classic':[{theme:'classic',colorScheme:'forest-green',fontScheme:'aptos'},{title:PIPELINE_TITLE,diagram:PIPELINE}],
 'style-bold':[{theme:'bold',colorScheme:'deep-purple',fontScheme:'montserrat'},{title:PIPELINE_TITLE,diagram:PIPELINE}],
 'style-minimal':[{theme:'minimal',colorScheme:'burnt-orange',fontScheme:'georgia'},{title:PIPELINE_TITLE,diagram:PIPELINE}],
 'style-dark':[{theme:'classic',colorScheme:'steel-blue',fontScheme:'open-sans'},{title:PIPELINE_TITLE,diagram:PIPELINE,design:{variant:'dark1'}}],
};

const fonts=await loadFonts({pack:'office'});
const problems=[];
const files={};
for(const [name,[design,slide]] of Object.entries(IMAGES)){
 const deck={$schema:'https://openpresentation.org/schema/opf/v1',name,language:'en-US',...(design?{design}:{}),slides:[slide]};
 const diagnostics=[];
 const svg=toSvg(deck,1,{fonts,catalogs:[gallery],onDiagnostic:diagnostic=>diagnostics.push(diagnostic)});
 if(diagnostics.length)problems.push(`${name}: ${diagnostics.map(diagnostic=>`${diagnostic.code} ${diagnostic.message??''}`.trim()).join('; ')}`);
 if(!svg.includes('data-opf-diagram='))problems.push(`${name}: the slide draws no diagram`);
 files[`${name}.svg`]=svg.endsWith('\n')?svg:svg+'\n';
}
const text=await readFile(guide,'utf8');
for(const file of Object.keys(files))if(!text.includes(`](images/diagrams/${file})`))problems.push(`docs/diagrams.md does not show images/diagrams/${file}`);

if(check){
 for(const [file,svg] of Object.entries(files)){
  const current=await readFile(path.join(output,file),'utf8').catch(()=>null);
  if(current===null)problems.push(`docs/images/diagrams/${file} is missing`);
  else if(current!==svg)problems.push(`docs/images/diagrams/${file} is stale`);
 }
 for(const file of await readdir(output).catch(()=>[]))if(!files[file])problems.push(`docs/images/diagrams/${file} belongs to no image in the script`);
 if(problems.length){
  console.error(`Diagram guide images are not up to date (run node scripts/build-diagram-doc-images.mjs):\n${problems.map(problem=>`  ${problem}`).join('\n')}`);
  process.exit(1);
 }
 console.log(`Diagram guide images: ${Object.keys(files).length} current.`);
}else{
 await rm(output,{recursive:true,force:true});
 await mkdir(output,{recursive:true});
 for(const [file,svg] of Object.entries(files))await writeFile(path.join(output,file),svg);
 const sizes=Object.entries(files).map(([file,svg])=>`${file} ${Math.round(Buffer.byteLength(svg)/1024)} KB`);
 console.log(`Wrote ${sizes.length} diagram guide images:\n  ${sizes.join('\n  ')}`);
 if(problems.length){console.error(problems.join('\n'));process.exit(1);}
}
