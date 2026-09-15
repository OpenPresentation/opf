import {MapMode,StateEffect,StateField} from '@codemirror/state';
import {invertedEffects} from '@codemirror/commands';
import {textInputMap,preferredLineEnding} from './text-input.js';

// CodeMirror uses LF positions internally. Keep authored source as a separate
// field, and store only removed newline spellings in its existing undo history.
export const setJsonSource=StateEffect.define();
const restoreEndings=StateEffect.define({map:(endings,changes)=>{
  const mapped=endings.map(({position,ending})=>({position:changes.mapPos(position,1,MapMode.TrackDel),ending})).filter(item=>item.position!==null);
  return mapped.length?mapped:undefined;
}});
export const jsonSource=StateField.define({
  create:state=>state.doc.toString(),
  update(source,tr){
    const explicit=tr.effects.findLast(effect=>effect.is(setJsonSource));
    if(explicit){
      if(textInputMap(explicit.value).text!==tr.newDoc.toString())throw new Error('JSON source and code-editor document must agree.');
      return explicit.value;
    }
    if(tr.docChanged){
      const map=textInputMap(source),ending=preferredLineEnding(source),changes=[];
      tr.changes.iterChanges((from,to,_fromB,_toB,insert)=>changes.push({from:map.toSource(from),to:map.toSource(to),insert:insert.toString().replaceAll('\n',ending)}));
      for(const change of changes.reverse())source=source.slice(0,change.from)+change.insert+source.slice(change.to);
    }
    const endings=[...new Map(tr.effects.filter(effect=>effect.is(restoreEndings)).flatMap(effect=>effect.value).map(item=>[item.position,item])).values()];
    if(endings.length){
      const map=textInputMap(source);
      for(const {position,ending} of endings.sort((a,b)=>b.position-a.position)){
        if(tr.newDoc.sliceString(position,position+1)!=='\n')continue;
        source=source.slice(0,map.toSource(position))+ending+source.slice(map.toSource(position+1));
      }
    }
    return source;
  },
});
export const jsonSourceHistory=invertedEffects.of(tr=>{
  if(!tr.docChanged)return [];
  const source=tr.startState.field(jsonSource),map=textInputMap(source),endings=[];
  tr.changes.iterChanges((from,to)=>{
    const removed=tr.startState.doc.sliceString(from,to);
    for(let index=removed.indexOf('\n');index!==-1;index=removed.indexOf('\n',index+1)){
      const position=from+index;
      endings.push({position,ending:source.slice(map.toSource(position),map.toSource(position+1))});
    }
  });
  return endings.length?[restoreEndings.of(endings)]:[];
});
