/** Map textarea LF offsets to the original UTF-16 source, including CRLF pairs. */
export function textInputMap(source) {
  const offsets=[0];
  for(let i=0;i<source.length;i++) {
    if(source[i]==='\r'&&source[i+1]==='\n')i++;
    offsets.push(i+1);
  }
  return {
    text:source.replace(/\r\n|\r/g,'\n'),
    toSource(offset) {
      if(!Number.isInteger(offset)||offset<0||offset>=offsets.length)throw new RangeError('Input offset is outside the text.');
      return offsets[offset];
    },
    toInput(offset) {
      if(!Number.isInteger(offset)||offset<0||offset>source.length)throw new RangeError('Source offset is outside the text.');
      let lo=0,hi=offsets.length-1;
      while(lo<hi){const mid=Math.floor((lo+hi)/2);if(offsets[mid]<offset)lo=mid+1;else hi=mid;}
      return lo;
    },
  };
}

export const preferredLineEnding=source=>/\r\n|\r|\n/.exec(source)?.[0]??'\n';

/** Textareas normalize line endings; retain unchanged source bytes around an edit. */
export function preserveTextLineEndings(original, input) {
  const mapping=textInputMap(original),normalized=mapping.text,next=input.replace(/\r\n|\r/g,'\n');
  if(normalized===next)return original;
  let prefix=0,suffix=0;
  while(prefix<normalized.length&&prefix<next.length&&normalized[prefix]===next[prefix])prefix++;
  while(suffix<normalized.length-prefix&&suffix<next.length-prefix&&normalized[normalized.length-1-suffix]===next[next.length-1-suffix])suffix++;
  return original.slice(0,mapping.toSource(prefix))+next.slice(prefix,next.length-suffix).replaceAll('\n',preferredLineEnding(original))+original.slice(mapping.toSource(normalized.length-suffix));
}
