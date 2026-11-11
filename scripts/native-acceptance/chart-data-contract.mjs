// Office-free checks of the precise plotted cache/workbook and authored import.
import assert from 'node:assert/strict';
import path from 'node:path';
const list=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const text=value=>typeof value==='object'?value?.['#text']:value;
const range=(letter,rows)=>'Sheet1!$'+letter+'$2:$'+letter+'$'+(rows+1);
const cache=(value,kind,count,id)=>{
  const ref=value?.[kind==='number'?'c:numRef':'c:strRef'],data=ref?.[kind==='number'?'c:numCache':'c:strCache'];
  assert.equal(data?.['c:ptCount']?.val,String(count),id+': declared classic cache count');
  return list(data['c:pt']).map((point,index)=>{assert.equal(String(point.idx),String(index),id+': cache point order');return String(point['c:v']);});
};
function workbookPath(parts,file,external,{parser,fflate},id){
  const relFile=path.posix.join(path.posix.dirname(file),'_rels',path.posix.basename(file)+'.rels');
  assert.ok(parts[relFile],id+': workbook relationships');
  const rels=list(parser.parse(fflate.strFromU8(parts[relFile])).Relationships.Relationship);
  assert.equal(new Set(rels.map(rel=>rel.Id)).size,rels.length,id+': unique relationship identities');
  const matches=rels.filter(rel=>rel.Id===external?.['r:id']);
  assert.equal(matches.length,1,id+': unique embedded workbook relationship');
  assert.ok(matches[0].Type.endsWith('/package'),id+': workbook package relationship');
  assert.equal(matches[0].TargetMode,undefined,id+': internal workbook relationship');
  const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),matches[0].Target));
  assert.ok(parts[target],id+': embedded workbook exists');
  return target;
}

export function assertClassicChartData(parts,number,data,{parser,fflate},id){
  const file='ppt/charts/chart'+number+'.xml';
  const parse=name=>{assert.ok(parts[name],id+': missing '+name);return parser.parse(fflate.strFromU8(parts[name]));};
  const chart=parse(file)['c:chartSpace']['c:chart'],plot=chart['c:plotArea'];
  assert.deepEqual(Object.keys(plot).filter(key=>key.endsWith('Chart')),['c:barChart'],id+': clustered-column construct');
  const bar=plot['c:barChart'];assert.equal(bar['c:barDir'].val,'col',id+': vertical columns');
  assert.equal(bar['c:grouping'].val,'clustered',id+': clustered grouping');
  const series=list(bar['c:ser']);assert.equal(series.length,data.columns.length-1,id+': every numeric series');
  for(const [index,entry] of series.entries()){
    const letter=String.fromCharCode(66+index);
    assert.equal(entry['c:tx']['c:strRef']['c:f'],'Sheet1!$'+letter+'$1',id+': classic name formula');
    assert.equal(entry['c:cat']['c:strRef']['c:f'],range('A',data.rows.length),id+': classic category formula');
    assert.equal(entry['c:val']['c:numRef']['c:f'],range(letter,data.rows.length),id+': classic value formula');
    assert.deepEqual(cache(entry['c:tx'],'string',1,id),[data.columns[index+1]],id+': series name');
    assert.deepEqual(cache(entry['c:cat'],'string',data.rows.length,id),data.rows.map(row=>String(row[0])),id+': categories');
    assert.deepEqual(cache(entry['c:val'],'number',data.rows.length,id),data.rows.map(row=>String(row[index+1])),id+': values');
  }
  const external=parse(file)['c:chartSpace']['c:externalData'];
  const nested=fflate.unzipSync(parts[workbookPath(parts,file,external,{parser,fflate},id)]);
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

/** Dedicated current signed-Pareto combo contract. The ordinary classic-only checker above remains strict. */
export function assertSignedParetoComboData(parts,number,data,{parser,fflate},id){
  assert.equal(data.columns.length,3,id+': category, signed value and cumulative share');
  const file='ppt/charts/chart'+number+'.xml';
  assert.ok(parts[file],id+': signed combo part');
  const space=parser.parse(fflate.strFromU8(parts[file]))['c:chartSpace'],plot=space['c:chart']['c:plotArea'];
  assert.deepEqual(Object.keys(plot).filter(key=>key.endsWith('Chart')),['c:barChart','c:lineChart'],id+': exactly signed columns and cumulative line');
  const bar=plot['c:barChart'],line=plot['c:lineChart'];
  assert.equal(bar['c:barDir'].val,'col',id+': vertical signed columns');
  assert.equal(bar['c:grouping'].val,'clustered',id+': clustered signed columns');
  assert.equal(bar['c:gapWidth'].val,'6',id+': broad histogram-style columns');
  const bars=list(bar['c:ser']),lines=list(line['c:ser']);
  assert.equal(bars.length,1,id+': one signed series');assert.equal(lines.length,1,id+': one cumulative series');
  const series=[bars[0],lines[0]];
  assert.equal(lines[0]['c:marker']['c:symbol'].val,'none',id+': cumulative line has no added point markers');
  for(const[index,entry]of series.entries()){
    const letter=String.fromCharCode(66+index);
    assert.equal(entry['c:idx'].val,String(index),id+': globally distinct series index');
    assert.equal(entry['c:order'].val,String(index),id+': explicit series order');
    assert.equal(entry['c:tx']['c:strRef']['c:f'],'Sheet1!$'+letter+'$1',id+': combo name formula');
    assert.equal(entry['c:cat']['c:strRef']['c:f'],range('A',data.rows.length),id+': combo category formula');
    assert.equal(entry['c:val']['c:numRef']['c:f'],range(letter,data.rows.length),id+': combo value formula');
    assert.deepEqual(cache(entry['c:tx'],'string',1,id),[data.columns[index+1]],id+': combo series name');
    assert.deepEqual(cache(entry['c:cat'],'string',data.rows.length,id),data.rows.map(row=>String(row[0])),id+': sorted categories');
    assert.deepEqual(cache(entry['c:val'],'number',data.rows.length,id),data.rows.map(row=>String(row[index+1])),id+': complete signed/cumulative cache');
  }
  const axes=[...list(plot['c:catAx']).map(node=>({kind:'category',node})),...list(plot['c:valAx']).map(node=>({kind:'value',node}))];
  assert.equal(axes.length,4,id+': two category and two value axes');
  const byId=new Map(axes.map(axis=>[axis.node['c:axId'].val,axis]));
  assert.equal(byId.size,4,id+': distinct axis identities');
  const groupAxes=[bar,line].map(group=>list(group['c:axId']).map(axis=>axis.val));
  assert.equal(new Set(groupAxes.flat()).size,4,id+': disjoint primary/secondary associations');
  for(const ids of groupAxes){
    assert.equal(ids.length,2,id+': exact group axis pair');
    const category=byId.get(ids[0]),value=byId.get(ids[1]);
    assert.equal(category?.kind,'category',id+': category association');assert.equal(value?.kind,'value',id+': value association');
    assert.equal(category.node['c:crossAx'].val,ids[1],id+': category crosses its value axis');
    assert.equal(value.node['c:crossAx'].val,ids[0],id+': value crosses its category axis');
  }
  const secondary=byId.get(groupAxes[1][1]).node;
  assert.equal(secondary['c:scaling']['c:min'].val,'0',id+': percentage minimum');
  assert.equal(secondary['c:scaling']['c:max'].val,'1',id+': percentage maximum');
  assert.equal(secondary['c:numFmt'].formatCode,'0%',id+': percentage format');
  assert.equal(byId.get(groupAxes[1][0]).node['c:delete'].val,'1',id+': secondary category axis hidden');
  const nested=fflate.unzipSync(parts[workbookPath(parts,file,space['c:externalData'],{parser,fflate},id)]);
  const strings=list(parser.parse(fflate.strFromU8(nested['xl/sharedStrings.xml'])).sst.si).map(si=>String(text(si.t)??''));
  const sheetXml=fflate.strFromU8(nested['xl/worksheets/sheet1.xml']);
  assert.doesNotMatch(sheetXml,/<f(?:\s|>)/,id+': cumulative values are static, not formulas');
  const rows=list(parser.parse(sheetXml).worksheet.sheetData.row).map((row,rowIndex)=>{
    assert.equal(row.r,String(rowIndex+1),id+': workbook row order');
    return list(row.c).map((cell,columnIndex)=>{
      assert.equal(cell.r,String.fromCharCode(65+columnIndex)+(rowIndex+1),id+': combo workbook cell mapping');
      return cell.t==='s'?strings[Number(cell.v)]:cell.t==='inlineStr'?String(text(cell.is?.t)??''):Number(cell.v);
    });
  });
  assert.deepEqual(rows,[data.columns,...data.rows],id+': complete sorted/derived workbook');
}

export function assertNativeBoxData(parts,data,{parser,fflate},id){
  const files=Object.keys(parts).filter(file=>/^ppt\/charts\/chartEx\d+\.xml$/.test(file));
  assert.equal(files.length,1,id+': one native box chart');
  const space=parser.parse(fflate.strFromU8(parts[files[0]]))['cx:chartSpace'];
  const external=space['cx:chartData']['cx:externalData'];
  assert.equal(external['cx:autoUpdate'],'0',id+': explicit native workbook update policy');
  const nativeWorkbook=workbookPath(parts,files[0],external,{parser,fflate},id);
  const classicFile='ppt/charts/chart1.xml',classic=parser.parse(fflate.strFromU8(parts[classicFile]))['c:chartSpace'];
  assert.equal(nativeWorkbook,workbookPath(parts,classicFile,classic['c:externalData'],{parser,fflate},id),id+': native/classic same workbook');
  const series=list(space['cx:chart']['cx:plotArea']['cx:plotAreaRegion']['cx:series']);
  const values=list(space['cx:chartData']['cx:data']);
  assert.equal(series.length,data.columns.length-1,id+': every native box series');
  assert.equal(values.length,series.length,id+': every native box data cache');
  for(const [index,entry] of series.entries()){
    const letter=String.fromCharCode(66+index);
    assert.equal(entry['cx:tx']['cx:txData']['cx:f'],'Sheet1!$'+letter+'$1',id+': native name formula');
    assert.equal(values[index]['cx:strDim']['cx:f'],range('A',data.rows.length),id+': native category formula');
    assert.equal(values[index]['cx:numDim']['cx:f'],range(letter,data.rows.length),id+': native value formula');
    assert.equal(entry.layoutId,'boxWhisker',id+': native box construct');
    assert.equal(entry['cx:tx']['cx:txData']['cx:v'],data.columns[index+1],id+': native box name');
    assert.equal(entry['cx:dataId'].val,String(index),id+': native box data association');
    assert.equal(values[index].id,String(index),id+': native box cache association');
    const points=dimension=>{
      assert.equal(dimension['cx:lvl'].ptCount,String(data.rows.length),id+': declared native cache count');
      return list(dimension['cx:lvl']['cx:pt']).map((point,row)=>{assert.equal(point.idx,String(row),id+': native cache order');return String(text(point));});
    };
    assert.deepEqual(points(values[index]['cx:strDim']),data.rows.map(row=>String(row[0])),id+': native box categories');
    assert.deepEqual(points(values[index]['cx:numDim']),data.rows.map(row=>String(row[index+1])),id+': native box values');
  }
}
