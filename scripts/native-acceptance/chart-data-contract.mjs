// Office-free checks of the precise plotted cache/workbook and authored import.
import assert from 'node:assert/strict';
import path from 'node:path';
const list=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const text=value=>typeof value==='object'?value?.['#text']:value;
const points=cache=>list(cache?.['c:pt']).map((point,index)=>{assert.equal(String(point.idx),String(index),'cache point order');return String(point['c:v']);});
const cache=(value,kind)=>points(value?.[kind==='number'?'c:numRef':'c:strRef']?.[kind==='number'?'c:numCache':'c:strCache']);

export function assertClassicChartData(parts,number,data,{parser,fflate},id){
  const file='ppt/charts/chart'+number+'.xml';
  const parse=name=>{assert.ok(parts[name],id+': missing '+name);return parser.parse(fflate.strFromU8(parts[name]));};
  const chart=parse(file)['c:chartSpace']['c:chart'],plot=chart['c:plotArea'];
  assert.deepEqual(Object.keys(plot).filter(key=>key.endsWith('Chart')),['c:barChart'],id+': clustered-column construct');
  const bar=plot['c:barChart'];assert.equal(bar['c:barDir'].val,'col',id+': vertical columns');
  assert.equal(bar['c:grouping'].val,'clustered',id+': clustered grouping');
  const series=list(bar['c:ser']);assert.equal(series.length,data.columns.length-1,id+': every numeric series');
  for(const [index,entry] of series.entries()){
    assert.deepEqual(cache(entry['c:tx'],'string'),[data.columns[index+1]],id+': series name');
    assert.deepEqual(cache(entry['c:cat'],'string'),data.rows.map(row=>String(row[0])),id+': categories');
    assert.deepEqual(cache(entry['c:val'],'number'),data.rows.map(row=>String(row[index+1])),id+': values');
  }
  const external=parse(file)['c:chartSpace']['c:externalData'];
  const rels=list(parse('ppt/charts/_rels/chart'+number+'.xml.rels').Relationships.Relationship);
  const workbook=rels.filter(rel=>rel.Id===external['r:id']&&rel.Type.endsWith('/package'));
  assert.equal(workbook.length,1,id+': unique embedded workbook');
  const nested=fflate.unzipSync(parts[path.posix.normalize('ppt/charts/'+workbook[0].Target)]);
  const strings=list(parser.parse(fflate.strFromU8(nested['xl/sharedStrings.xml'])).sst.si).map(si=>String(text(si.t)??''));
  const sheet=parser.parse(fflate.strFromU8(nested['xl/worksheets/sheet1.xml'])).worksheet;
  const rows=list(sheet.sheetData.row).map((row,rowIndex)=>{
    assert.equal(String(row.r),String(rowIndex+1),id+': workbook row order');
    return list(row.c).map((cell,columnIndex)=>{
      assert.equal(cell.r,String.fromCharCode(65+columnIndex)+(rowIndex+1),id+': workbook cell mapping');
      return cell.t==='s'?strings[Number(cell.v)]:cell.t==='inlineStr'?String(text(cell.is?.t)??''):Number(cell.v);
    });
  });
  assert.deepEqual(rows,[data.columns,...data.rows],id+': complete embedded workbook values');
}

export function assertNativeBoxData(parts,data,{parser,fflate},id){
  const files=Object.keys(parts).filter(file=>/^ppt\/charts\/chartEx\d+\.xml$/.test(file));
  assert.equal(files.length,1,id+': one native box chart');
  const space=parser.parse(fflate.strFromU8(parts[files[0]]))['cx:chartSpace'];
  const series=list(space['cx:chart']['cx:plotArea']['cx:plotAreaRegion']['cx:series']);
  const values=list(space['cx:chartData']['cx:data']);
  assert.equal(series.length,data.columns.length-1,id+': every native box series');
  assert.equal(values.length,series.length,id+': every native box data cache');
  for(const [index,entry] of series.entries()){
    assert.equal(entry.layoutId,'boxWhisker',id+': native box construct');
    assert.equal(entry['cx:tx']['cx:txData']['cx:v'],data.columns[index+1],id+': native box name');
    assert.equal(entry['cx:dataId'].val,String(index),id+': native box data association');
    assert.equal(values[index].id,String(index),id+': native box cache association');
    const points=dimension=>list(dimension['cx:lvl']['cx:pt']).map((point,row)=>{assert.equal(point.idx,String(row),id+': native cache order');return String(text(point));});
    assert.deepEqual(points(values[index]['cx:strDim']),data.rows.map(row=>String(row[0])),id+': native box categories');
    assert.deepEqual(points(values[index]['cx:numDim']),data.rows.map(row=>String(row[index+1])),id+': native box values');
  }
}
