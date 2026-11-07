#!/bin/sh
# conv.sh in out [flags]: run the worktree CLI and print ok and findings
node /c/opf-work/sh-17-linear-smartart/packages/cli/dist/index.js convert "$@" --force 2>&1 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const r=JSON.parse(s);console.log(r.ok,r.error??'',JSON.stringify((r.findings??[]).map(f=>f.ruleId+' '+f.path+' '+f.message)).slice(0,3000))}catch{console.log(s.slice(0,2000))}})"
