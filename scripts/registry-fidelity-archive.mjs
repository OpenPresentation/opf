import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {tar} from './archive-tar.mjs';

// Test support comes from the same immutable source as its tests. Runtime dist
// remains the separately verified registry installation linked by the caller.
export function archiveRegistryFidelity({checkout, ref, repo, directory}) {
 const archive=path.join(directory,'tests.tar');
 execFileSync('git',['archive',ref,'test',...(repo==='opf-render'?['scripts']:[]),'--output',archive],{cwd:checkout});
 tar(archive,'-xf',['-C',directory]);
 return archive;
}
