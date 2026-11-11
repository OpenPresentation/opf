// Native-generated archive readbacks, never fabricated Series.Values observations.
import assert from 'node:assert/strict';
import {digest} from './identity.mjs';
import {inspectSevenArchive,archiveDependencies} from './seven-chart-archive.mjs';
import {bindCurrentTreemap} from './seven-value-current.mjs';
import {comparePersistedSevenValueEdit} from './seven-value-archive.mjs';
import {assertSnapshotRawPreservation} from './seven-value-snapshot-namespace.mjs';

export function snapshotNumericReadback(archive,action){
 const matches=archive.slides[action.slideIndex-1].shapes.filter(shape=>shape.kind==='chart'&&shape.branch===action.branch&&shape.id===action.shapeId&&shape.name===action.shapeName);assert.equal(matches.length,1);const chart=matches[0].chart;assert.equal(chart.family,'chartEx');
 const data=chart.caches.filter(cache=>cache.id===action.dataId);assert.equal(data.length,1);const dimension=data[0].dimensions[action.dimensionIndex];assert.equal(dimension.kind,'cx:numDim');assert.equal(dimension.formula,action.dataFormula);
 assert.equal(chart.workbook.part,action.workbookPart);assert.equal(chart.workbook.sheet,action.worksheet);
 const workbookValues=action.workbookCells.map(cell=>{const found=chart.workbook.cells.filter(row=>row.cell===cell);assert.equal(found.length,1);return found[0].value;});assert.deepEqual(dimension.values,workbookValues,'Actual native cache/workbook readbacks disagree');
 return{values:[...dimension.values],workbookValues};
}
function unchangedRaw(input,saved,action,values,deps,archiveContext){
 // This internal zero-delta comparison action is not a setter request/receipt.
 // The guard checks each selected leaf equals values before masking it.
 return assertSnapshotRawPreservation({input,saved,action:{...action,expectedValues:[...values],newValues:[...values]},deps,archiveContext});
}
export function compareSevenNativeBefore({input,before,source,selection,action,imports,root,deps=archiveDependencies()}){
 const original=bindCurrentTreemap(input,source,selection,{root,deps});assert.deepEqual(original.action,action);
 const actual=bindCurrentTreemap(before,source,selection,{root,deps});
 assert.deepEqual({...actual.action,inputSha256:action.inputSha256},action,'Native-before changed target/cache/workbook ownership');
 assert.deepEqual(actual.archive.slides,original.archive.slides,'Native-before changed parsed seven-chart source model');
 const raw=unchangedRaw(input,before,action,action.expectedValues,deps,original.archiveContext);
 assert.deepEqual(imports.before.document,imports.source.document,'Native-before public import changed');assert.deepEqual(imports.before.diagnostics,imports.source.diagnostics,'Native-before diagnostics changed');
 return {sourceSha256:digest(input),beforeSha256:digest(before),actualNumericValues:snapshotNumericReadback(actual.archive,actual.action).values,baselineAction:actual.action,raw,observation:'actual-native-before-archive; not COM getter',nativeAcceptance:false};
}
export function compareSevenNativeSnapshots({input,before,edited,reopened,source,selection,action,phases,imports,root,deps=archiveDependencies()}){
 const baseline=compareSevenNativeBefore({input,before,source,selection,action,imports,root,deps});
 const context=bindCurrentTreemap(before,source,selection,{root,deps}).archiveContext;
 const editOptions={input:before,saved:edited,source,action:baseline.baselineAction,phases,imports:{original:imports.before,'saved-reopened':imports.edited},deps,archiveContext:context};
 const strictEdit={parsed:comparePersistedSevenValueEdit(editOptions),raw:assertSnapshotRawPreservation(editOptions)};
 const editedArchive=inspectSevenArchive(edited,deps,context),reopenedArchive=inspectSevenArchive(reopened,deps,context);
 assert.deepEqual(reopenedArchive.slides,editedArchive.slides,'Reopened native archive changed parsed current data/style');
 const rawReopened=unchangedRaw(edited,reopened,action,action.newValues,deps,context);
 assert.deepEqual(imports.reopened.document,imports.edited.document,'Reopened full public import changed');assert.deepEqual(imports.reopened.diagnostics,imports.edited.diagnostics,'Reopened diagnostics changed');
 return {baseline,editContract:strictEdit,rawReopened,archiveReadbacks:{before:{sha256:digest(before),values:baseline.actualNumericValues},edited:{sha256:digest(edited),...snapshotNumericReadback(editedArchive,action)},reopened:{sha256:digest(reopened),...snapshotNumericReadback(reopenedArchive,action)}},allFullImportsRetained:true,nativeAcceptance:false,registryAcceptance:false,scope:'One documented native setter with three native-generated archive numeric readbacks; strict source-before, isolated edit and reopen preservation. No getter-array, all-chart-type, pixel or release claim.'};
}
