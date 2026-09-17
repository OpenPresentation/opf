import {getValueAtPath, createValuePatch, applyJsonPatch, validateOpfDocument, opfPathToJsonPointer} from './index.js';

/** Prepare a validated track resize; the test operation guards its container revision. */
export function prepareTrackResize(document, flow, boundary, fraction) {
  const vertical = flow?.composition?.mode === 'column';
  const tracks = vertical ? flow?.rows : flow?.columns;
  if (!Array.isArray(tracks) || tracks.length < 2 || tracks.length > 12)
    throw new RangeError('Resize a flow with 2–12 tracks; group larger arrangements first.');
  if (flow.itemCount !== flow.slotCount)
    throw new RangeError('Choose an explicit arrangement before resizing reserved layout slots.');
  if (!Number.isInteger(boundary) || boundary < 0 || boundary >= tracks.length - 1)
    throw new RangeError('Track boundary is out of range.');
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1)
    throw new RangeError('Track fraction must be between zero and one.');
  const container = getValueAtPath(document,flow.path);
  if (!container || typeof container !== 'object') throw new Error('The layout container no longer exists.');
  const effective = flow.composition.weights ?? [];
  const weights = Array.from({length:Math.max(tracks.length,effective.length)},(_,index)=>effective[index]??1);
  if (weights.some(weight=>!Number.isFinite(weight)||weight<=0||weight>100)) throw new RangeError('Invalid track weights.');
  const share = Math.min(.95,Math.max(.05,fraction));
  const pair = weights[boundary]+weights[boundary+1];
  weights[boundary]=pair*share;weights[boundary+1]=pair*(1-share);
  const scale = Math.max(1,...weights.slice(0,tracks.length).map(weight=>weight/100));
  for(let i=0;i<tracks.length;i++)weights[i]=Number((weights[i]/scale).toPrecision(12));
  const composition={...container.composition,mode:flow.composition.mode??'auto',weights};
  // A drag expresses an explicit arrangement. Preserve the automatic engine's chosen columns.
  if(composition.mode==='auto'){composition.mode='grid';composition.columns=flow.columns.length;}
  const patches=[{op:'test',path:opfPathToJsonPointer(flow.path),value:structuredClone(container)},...createValuePatch(document,[...flow.path.split('.'),'composition'],composition)];
  const next=applyJsonPatch(document,patches),validation=validateOpfDocument(next);
  if(!validation.valid)throw new Error(validation.errors[0]?.message??'Track resize is not valid OPF.');
  return {document:next,patches,composition,fraction:share};
}

export {prepareBlockMove,listBlockContainers,prepareBlockInsert,prepareBlockDuplicate,prepareBlockRemove,createContentBlock} from './blocks.js';
