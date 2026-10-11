import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
export async function inputs(){
 const [consumerArg,outputArg,coreArg,pptxArg,expectedArg]=process.argv.slice(2);
 assert.ok(consumerArg&&outputArg&&coreArg&&pptxArg&&expectedArg,'Usage: SCRIPT STAGED_CONSUMER PACKET CORE_GRAPH PPTX_SOURCE EXPECTED_GRAPH_JSON');
 const consumer=path.resolve(consumerArg),output=path.resolve(outputArg),coreRoot=path.resolve(coreArg),pptxRoot=path.resolve(pptxArg),expectedPath=path.resolve(expectedArg);
 const expected=JSON.parse(await readFile(expectedPath));
 assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:coreRoot,encoding:'utf8'}).trim(),expected.replay,'unexpected tooling/source checkout');
 const {candidateArtifacts,assertInstalledCandidateGraph}=await import(pathToFileURL(path.join(coreRoot,'scripts/candidate-gallery-pack.mjs')));
 const graph=candidateArtifacts(coreRoot);assert.ok(graph,'explicit staged graph required');assertInstalledCandidateGraph(coreRoot,consumer);
 assert.equal(graph.artifacts.length,6);
 for(const actual of graph.artifacts){const bound=expected.artifacts.find(a=>a.name===actual.name);assert.ok(bound,actual.name);for(const key of ['sourceSha','sha256','bytes','version'])assert.equal(actual[key],bound[key],`${actual.name}: ${key}`);}
 assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:pptxRoot,encoding:'utf8'}).trim(),expected.source.source.pptx,'unexpected fixture/harness source');
 return {consumer,output,coreRoot,pptxRoot,expectedPath,expected,graph};
}
