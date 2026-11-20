import {parseFontFamilies,parseFontWeight} from './pdf-style.js';
import {parseXml,textContent} from './pdf-xml.js';
// resvg does not follow the explicit RTL anchor/bidi of generated numeric list
// markers. Only the temporary raster SVG outlines those markers with the SAME
// layout/bidi/outline engine as vector PDF; returned logical SVG stays text.
const SELECTOR = /\bdata-opf-number-marker\s*=\s*["']rtl["']/;
const isMarker=node=>node.name==='text'&&node.attrs?.['data-opf-number-marker']==='rtl'&&node.attrs.direction==='rtl'&&node.attrs['unicode-bidi']==='isolate'&&node.attrs['aria-hidden']==='true'&&textContent(node).length>0;
const hasMarker=node=>isMarker(node)||(node.children??[]).some(child=>child.name&&hasMarker(child));

export async function outlineRasterMarkers(svg,{font,shape,report=()=>{},fail,strict=false}={}) {
  if(!SELECTOR.test(svg))return svg;
  // The substring is only a cheap prefilter. Prove an ACTUAL selected text node
  // before constructing a library or reading any caller font file.
  let tree;try{tree=parseXml(svg);}catch{return svg;}
  if(!tree||!hasMarker(tree))return svg;
  const refuse=({reason,fontFamily})=>{
    const diagnostic={code:'raster-marker-unavailable',reason,...(fontFamily?{fontFamily}:{}),message:'An RTL numbered marker stays text because its exact raster face cannot safely be outlined; marker direction/placement parity is not established.'};
    report(diagnostic);
    if(strict)throw fail('raster-marker-unavailable',diagnostic.message);
  };
  if(font.loadSystemFonts){refuse({reason:'system-fonts'});return svg;}
  const [{FontLibrary},{loadFontFiles},{outlineSlideText,prepareOutlineFace}]=await Promise.all([import('./pdf-fonts.js'),import('./font-files.js'),import('./text-paths.js')]);
  const generics={serif:'Times New Roman','sans-serif':font.sansSerifFamily,monospace:font.monospaceFamily,cursive:'Comic Sans MS',fantasy:'Impact','system-ui':font.sansSerifFamily,'ui-sans-serif':font.sansSerifFamily,'ui-serif':'Times New Roman','ui-monospace':font.monospaceFamily};
  const library=new FontLibrary({genericFamilies:generic=>[generics[generic]??font.defaultFontFamily]});
  library.restricted=new Set();
  // Exact raster inputs only: no replacement handle, SVG font URLs or system
  // lookup. File bytes/name-table style match what fontdb receives. Ambiguous
  // duplicate family/style faces refuse below, so directory-vs-file precedence
  // cannot silently choose a different face than the rasterizer.
  await loadFontFiles(library,font.fontFiles??[],font.fontDirs??[],()=>{},face=>prepareOutlineFace(library,face));
  const validateFace=(face,style)=>{
    const families=parseFontFamilies(style['font-family']),weight=parseFontWeight(style['font-weight'],400),italic=/italic|oblique/i.test(style['font-style']??'');
    if(library.match(families,weight,italic)?.face!==face)return 'unresolved';
    // Resolve generic names through the SAME mapping as matching. An earlier
    // restricted actual family cannot be skipped merely because usable() hid
    // it. Stop at the first actual match; later unused restrictions do not win.
    for(const family of families){
      const lower=family.toLowerCase(),actual=Object.hasOwn(generics,lower)?generics[lower]??font.defaultFontFamily:family;
      if(library.restricted.has(actual.toLowerCase()))return 'restricted';
      if(library.match([family],weight,italic))break;
    }
    return library.faces.some(other=>other!==face&&other.hash!==face.hash&&other.weight===face.weight&&other.italic===face.italic&&[...other.names].some(name=>face.names.has(name)))?'unresolved':undefined;
  };
  const result=outlineSlideText([svg],{library,shape,selectText:isMarker,onRefusal:refuse,fail,validateFace});
  return result.defs?result.content[0].replace(/<svg\b(?:[^>"']|"[^"]*"|'[^']*')*>/,root=>root+result.defs):result.content[0];
}
