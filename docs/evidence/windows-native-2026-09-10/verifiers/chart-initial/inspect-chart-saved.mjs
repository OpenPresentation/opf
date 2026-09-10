import {readFile, writeFile} from 'node:fs/promises';
import {unzipSync,strFromU8} from 'fflate';
const root=new URL('./chart-node24-slide1/',import.meta.url);
const results={};
for(const phase of ['charts','charts-saved','charts-edited']) {
  const archive=unzipSync(await readFile(new URL(`${phase}.pptx`,root)));
  const chart=strFromU8(archive['ppt/charts/chart1.xml']);
  const rels=strFromU8(archive['ppt/charts/_rels/chart1.xml.rels']);
  const target=rels.match(/Target="([^"]+\.xlsx)"/)[1];
  const bookPart=new URL(target,'https://fixture.invalid/ppt/charts/chart1.xml').pathname.slice(1);
  const workbook=unzipSync(archive[bookPart]);
  results[phase]={chart,rels,bookPart,worksheets:Object.fromEntries(Object.entries(workbook).filter(([key])=>/^xl\/(worksheets\/sheet\d+\.xml|sharedStrings\.xml)$/.test(key)).map(([key,value])=>[key,strFromU8(value)]))};
}
await writeFile(new URL('saved-workbook-inspection.json',root),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
