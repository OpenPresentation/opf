// Reconstruct only review metadata from the sealed inputs. Never imports an exporter.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {makeRr54ArchiveCandidate} from '../../../packages/pptx/scripts/rr54-archive-candidate.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=readFileSync(new URL('./original-fixture.json',import.meta.url));
const evidence=JSON.parse(readFileSync(new URL('./construction-evidence.json',import.meta.url)));
assert.equal(sha(bytes),evidence.fixtureSha256);
assert.equal(sha(readFileSync(new URL('../../../packages/pptx/scripts/rr54-archive-candidate.mjs',import.meta.url))),evidence.candidateHelperSha256);
const report=JSON.parse(readFileSync(new URL('./construction-input-report.json',import.meta.url)));
const candidate=makeRr54ArchiveCandidate(JSON.parse(bytes),report,evidence);
const generated=JSON.stringify(candidate,null,2)+'\n';
assert.equal(sha(generated),JSON.parse(readFileSync(new URL('./construction-proof.json',import.meta.url))).correctedCandidateSha256);
assert.ok(process.argv[2],'Choose a fresh output JSON path');
writeFileSync(process.argv[2],generated,{flag:'wx'});
console.log('PASS: exact corrected candidate reconstructed with no archive exporter or serialization');
