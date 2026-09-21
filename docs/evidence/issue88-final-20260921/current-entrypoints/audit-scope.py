#!/usr/bin/env python3
"""Read-only receipt for the bounded current-entrypoint docs audit."""
from pathlib import Path
import hashlib,json,re,subprocess,sys
root=Path(sys.argv[1]).resolve()
sha=lambda b:hashlib.sha256(b).hexdigest()
exclude=re.compile(r'\d{4}-\d{2}-\d{2}|handoff|release-plan')
docs=sorted((root/'docs').glob('*.md'))
files=sorted([Path('README.md'),*[p.relative_to(root) for p in docs if not exclude.search(p.name)],*[p.relative_to(root) for p in (root/'packages').glob('*/README.md')],*[p.relative_to(root) for p in (root/'skills').rglob('*.md')]])
patterns={
 'obsolete-version-candidates':r'0\.(10\.1|8\.1|7\.1|7\.0|5\.0|4\.0|5\.1)',
 'availability-candidates':r'unreleased|local preview|release target|pre-release|future (render|edit)|not yet|Still needed',
 'published-context':r'published|public set|Use core|CLI preview|preview packages|candidate packages|pending release|release will|not published',
 'all-version-context':r'0\.[0-9]+\.[0-9]+',
}
records=[]
for p in files:
 data=(root/p).read_bytes()
 hits=[]
 for number,line in enumerate(data.decode().splitlines(),1):
  matched=[name for name,pattern in patterns.items() if re.search(pattern,line)]
  if matched:hits.append({'line':number,'patterns':matched})
 records.append({'path':p.as_posix(),'sha256':sha(data),'hits':hits})
print(json.dumps({
 'scope':'Current README, non-dated root docs, package READMEs, six skill entrypoints and their Markdown references; lexical audit plus contextual human review, not whole-repository certification.',
 'repository':str(root),
 'commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),
 'tree':subprocess.check_output(['git','rev-parse','HEAD^{tree}'],cwd=root,text=True).strip(),
 'workingTreeClean':not subprocess.check_output(['git','status','--porcelain'],cwd=root,text=True),
 'scriptSha256':sha(Path(__file__).read_bytes()),
 'matching':'Python re.search, case-sensitive; all-version-context is the final broad version cross-check.',
 'patterns':patterns,
 'excludedRootDocs':[p.relative_to(root).as_posix() for p in docs if exclude.search(p.name)],
 'excludedTrees':['docs/evidence/**','docs/plans/**','docs/releases/**','docs/migrations/**','docs/continuation/**'],
 'filesSearched':len(records),'matchedLines':sum(len(r['hits']) for r in records),'files':records,
 'humanDisposition':'See audit-scope.md for historical-introduction/checkpoint, present-day boundary, and actual-limitation decisions. Search matches are candidates, not automatic stale-copy findings.',
},indent=2))
