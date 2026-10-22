import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {tar} from './archive-tar.mjs';

// Test support comes from the same immutable source as its tests. Runtime dist
// remains the separately verified registry installation linked by the caller.
// `prefix` is the package's directory inside the checkout (MR-34: `packages/render` in this repository, where the old
// repositories' commits are imported under packages/<directory>/); without it the package is the checkout's root.
export function archiveRegistryFidelity({checkout, ref, repo, directory, prefix = ''}) {
 const archive=path.join(directory,'tests.tar');
 const base=prefix?prefix.replace(/\/+$/,'')+'/':'';
 execFileSync('git',['archive',ref,base+'test',...(repo==='opf-render'?[base+'scripts']:[]),'--output',archive],{cwd:checkout});
 tar(archive,'-xf',['-C',directory,...(prefix?['--strip-components',String(base.split('/').length-1)]:[])]);
 return archive;
}
