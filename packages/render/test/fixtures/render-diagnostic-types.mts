import {toSvg, type RenderDiagnostic} from '@openpresentation/opf-render';
import {toSvg as svg, type RenderDiagnostic as SvgDiagnostic} from '@openpresentation/opf-render/svg';

const outline: RenderDiagnostic = {code:'text-as-paths-fallback',reason:'restricted',fontFamily:'Host',message:'Kept text'};
const restricted: SvgDiagnostic = {code:'font-embedding-restricted',faces:[{fontFamily:'Host',weight:400,italic:false,fsType:2}],message:'Not embedded'};
function consume(d: RenderDiagnostic) {
  if (d.code === 'text-as-paths-fallback') {
    const reason: 'colour-font'|'restricted'|'shaping' = d.reason;
    const family: string = d.fontFamily;
    return reason + family;
  }
  if (d.code === 'font-embedding-restricted') return d.faces.map(f => `${f.fontFamily}/${f.weight}/${f.italic}/${f.fsType}`).join();
}
const deck={slides:[{title:'Control'}]};
toSvg(deck,{onDiagnostic:consume});
svg(deck,{onDiagnostic:consume});
consume(outline); consume(restricted);
// @ts-expect-error unsupported fallback reasons are not accepted
const wrongReason: RenderDiagnostic = {code:'text-as-paths-fallback',reason:'ignored',fontFamily:'Host',message:'No'};
// @ts-expect-error a restricted face retains its integer fsType value, not a string
const wrongFace: SvgDiagnostic = {code:'font-embedding-restricted',faces:[{fontFamily:'Host',weight:400,italic:false,fsType:'2'}],message:'No'};
void wrongReason; void wrongFace;
