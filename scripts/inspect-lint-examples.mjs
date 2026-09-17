import {readFile, readdir, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {lintSource} from '../packages/javascript/dist/lint.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const files=(await readdir(path.join(root,'examples'),{recursive:true}))
  .filter(file=>file.endsWith('.opf.json')).sort();
const reports=[];
for(const file of files){
  const source=await readFile(path.join(root,'examples',file),'utf8');
  const result=lintSource(source);
  reports.push({file:`examples/${file.split(path.sep).join('/')}`,
    sha256:createHash('sha256').update(source).digest('hex'),
    valid:result.valid,schemaValid:result.schemaValid,counts:result.counts,
    diagnostics:result.diagnostics.filter(issue=>issue.severity!=='info')});
}
const counts={error:0,warning:0,info:0};
for(const report of reports)for(const severity of Object.keys(counts))counts[severity]+=report.counts[severity];
const summary={files:files.length,valid:reports.filter(report=>report.valid).length,counts};
if(process.argv[2]){
  const output=path.resolve(process.argv[2]);
  await mkdir(path.dirname(output),{recursive:true});
  await writeFile(output,`${JSON.stringify({summary,reports},null,2)}\n`);
}
console.log(JSON.stringify(summary,null,2));
// This is a document-diagnostics command, not a passing-code-test claim.
// Existing schema-valid examples can fail their companion catalog schemas.
if(counts.error)process.exitCode=1;
