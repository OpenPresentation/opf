import {itemizeScripts} from '@openpresentation/opf/composition';
import {isSymbolEncodedFamily} from '@openpresentation/opf/symbol-font-encodings';
import {nativeLatinParagraphFingerprint,nativeLatinMemberProperties} from './native-language-provenance.js';

// Export-local source selections, captured before native language/run adapters.
// No source words are stored in the structural split-span receipt.
const emojiFamily = /^(?:Segoe UI Emoji|Noto (?:Color |)Emoji)$/i;
const escapeXml = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const decodeXml = text => text.replace(/&(?:amp|lt|gt|quot|apos|#x[\da-f]+|#\d+);/gi, entity => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[entity] ?? String.fromCodePoint(parseInt(entity.slice(entity[2]?.toLowerCase() === 'x' ? 3 : 2, -1), entity[2]?.toLowerCase() === 'x' ? 16 : 10))));
const ascii = /^[\x20-\x7e]*$/;
const runPattern = /<a:r>([\s\S]*?)<a:t>([\s\S]*?)<\/a:t><\/a:r>/g;
const withoutCs = nativeLatinMemberProperties;

export function createNativeLatinSlots(plan, resolveProfile, report) {
  const records = new Map(), profiles = new Map(), warned = new Set(), groups = new Map();
  const unavailable = (path, reason) => {
    if (warned.has(path)) return;
    warned.add(path);
    report?.({code:'native-latin-slot-unavailable',path,reason,message:'The source-selected Latin font or its original run boundary could not be bound to this native text shape; uncertain native properties are retained.'});
  };
  function selection(source, style, slideIndex) {
    const profileKey = JSON.stringify([slideIndex,style.lang]);
    if (!profiles.has(profileKey)) profiles.set(profileKey,resolveProfile(style.lang,slideIndex));
    const profile = profiles.get(profileKey);
    // Repair Arabic proofing only. Other scripts, non-ASCII characters, symbol
    // encodings and emoji faces keep their existing script slots.
    if (profile?.script !== 'Arab' || style.symbolEncoding != null || isSymbolEncodedFamily(style.fontFamily) || emojiFamily.test(style.fontFamily ?? '')) return [];
    // Preserve the renderer's whole-run ASCII fast path. Otherwise itemize the
    // ORIGINAL source, so digits following Arabic do not become Latin after wrapping.
    const runs = ascii.test(source) ? [{text:source,role:'latin'}] : itemizeScripts(source,profile);
    const ranges = []; let offset = 0;
    for (const run of runs) {
      if (run.role === 'latin') for (const match of run.text.matchAll(/[\x20-\x7e]+/g)) ranges.push([offset + match.index, offset + match.index + match[0].length]);
      offset += run.text.length;
    }
    return ranges;
  }
  const api = {
    groups,
    rememberLines(slideIndex,name,lines,source,style,path) {
      const fragments = []; let offset = 0;
      for (const text of lines) {
        const start = source.indexOf(text,offset);
        if (start < 0) { unavailable(path,'source-line'); return; }
        fragments.push({text,source,start,end:start+text.length,style,sourceRun:0}); offset=start+text.length;
      }
      api.remember(slideIndex,name,fragments,path);
    },
    remember(slideIndex, name, fragments, path = name) {
      if (!plan || !name) return;
      const parts = [];
      for (const [index,fragment] of fragments.entries()) {
        const {text,source,style = {}} = fragment, start = fragment.start ?? 0, end = fragment.end ?? start + text.length;
        // Native no-break binding only substitutes U+0020 with U+00A0, retaining UTF-16 offsets.
        const mapped = typeof source==='string'&&typeof text==='string'&&Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&end>=start&&end<=source.length
          &&(fragment.marker?start===source.length&&end===start:source.slice(start,end).replace(/ /g,'\u00a0')===text.replace(/ /g,'\u00a0'));
        if (!mapped) { unavailable(path,'source-range'); return; }
        const ranges = fragment.marker ? [] : selection(source,style,slideIndex);
        parts.push({text,sourceRun:fragment.marker?`marker:${index}`:fragment.sourceRun??index,selected:Array.from({length:text.length},(_,i)=>text.charCodeAt(i)>=32&&text.charCodeAt(i)<=126&&ranges.some(([from,to])=>start+i>=from&&start+i<to))});
      }
      if (!parts.some(part=>part.selected.some(Boolean))) return;
      const key = `${slideIndex}|${name}`;
      if (records.has(key)) { records.set(key,null); unavailable(path,'duplicate-shape'); return; }
      records.set(key,{text:parts.map(part=>part.text).join(''),selected:parts.flatMap(part=>part.selected),sources:parts.flatMap(part=>Array(part.text.length).fill(part.sourceRun)),path});
    },
    write(xml, slideIndex) {
      return xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => {
        const encodedName = /<p:cNvPr\b[^>]*\bname="([^"]*)"/.exec(shape)?.[1], name=decodeXml(encodedName ?? '');
        const record = records.get(`${slideIndex}|${name}`);
        if (!record) return shape;
        const runs = [...shape.matchAll(runPattern)], text = runs.map(run=>decodeXml(run[2])).join('');
        if (text !== record.text) { unavailable(record.path,'native-text'); return shape; }
        let offset = 0, paragraphIndex = 0, generatedSpans = 0, metadataAvailable = true;
        const paragraphs = [];
        const result = shape.replace(/<a:p>[\s\S]*?<\/a:p>/g, paragraph => {
          const native = [];
          const next = paragraph.replace(runPattern,(whole,properties,rawText) => {
            const text = decodeXml(rawText), selected = record.selected.slice(offset,offset+text.length), sources=record.sources.slice(offset,offset+text.length); offset += text.length;
            const latin = /<a:latin\b[^>]*\btypeface="([^"]*)"[^>]*\/>/.exec(properties)?.[0];
            let chosen=properties;
            if (selected.some(Boolean)) {
              if (!latin || !/<a:rPr\b[^>]*>[\s\S]*<\/a:rPr>/.test(properties)) { unavailable(record.path,'native-font'); native.push({xml:whole,properties,source:undefined,changed:false}); return whole; }
              else {
                // Copy only the FINAL post-safe Latin typeface. Existing CS metadata and every other property stay exact.
                const face=/\btypeface="([^"]*)"/.exec(latin)[1],currentCs=/<a:cs\b[^>]*\/>/.exec(properties)?.[0];
                const cs=currentCs?currentCs.replace(/\btypeface="[^"]*"/,()=>`typeface="${face}"`):`<a:cs typeface="${face}"/>`;
                chosen=/<a:cs\b[^>]*\/>/.test(properties)?properties.replace(/<a:cs\b[^>]*\/>/,()=>cs):properties.replace(/(<a:(?:ea|latin)\b[^>]*\/>)(?![\s\S]*<a:(?:ea|latin)\b)/,value=>value+cs);
              }
            }
            if (!text.length) { native.push({xml:whole,properties,source:undefined,changed:false}); return whole; }
            const pieces = []; let start = 0;
            while (start < text.length) {
              let end=start+1; while(end<text.length&&selected[end]===selected[start]&&sources[end]===sources[start])end++;
              const style=selected[start]?chosen:properties;
              const piece=start===0&&end===text.length&&style===properties?whole:`<a:r>${style}<a:t>${escapeXml(text.slice(start,end))}</a:t></a:r>`;
              native.push({xml:piece,properties:style,source:sources[start],changed:selected[start]&&chosen!==properties});pieces.push(piece);start=end;
            }
            return pieces.length===1&&pieces[0]===whole?whole:pieces.join('');
          });
          const spans=[];
          // Restore CS-generated boundaries only. Existing adapters' distinct proofing/styles remain distinct.
          for(let start=0;start<native.length;){const style=withoutCs(native[start].properties);let end=start+1;while(end<native.length&&native[end].source===native[start].source&&withoutCs(native[end].properties)===style)end++;
            const members=native.slice(start,end);
            if(end-start>1&&members.some(run=>run.changed)){
              generatedSpans++;
              if(generatedSpans>1000||native.length>10000){metadataAvailable=false;paragraphs.length=0;}
              else if(metadataAvailable)spans.push({start,count:end-start});
            }
            start=end;
          }
          if(metadataAvailable&&spans.length)paragraphs.push({index:paragraphIndex,count:native.length,hash:nativeLatinParagraphFingerprint(next,{name,index:paragraphIndex,count:native.length,spans}),spans});
          paragraphIndex++;return next;
        });
        if(!metadataAvailable)unavailable(record.path,'source-boundary-budget');else if(paragraphs.length)groups.set(name,{slideIndex,paragraphs});
        return result;
      });
    }
  };
  return api;
}