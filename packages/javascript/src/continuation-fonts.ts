import {layoutTable, type ComposeSlideOptions, type SlideComposition} from './composition.js';

/** Text actually painted by a continued body, in reference pixels. Explicit sizes and
 * secondary roles keep their own source identity; only comparable automatic roles pool. */
export interface ContinuationFont {
  path: string; part: string; kind: string; role: string; style: string; size: number; automatic: boolean; constraints: string;
}
const record = (value: any): Record<string, any> => value && typeof value === 'object' ? value : {};
export const continuationFontKey = (font: ContinuationFont): string => JSON.stringify([font.path,font.part,font.style]);
export const continuationFontCohort = (font: ContinuationFont): string => JSON.stringify([font.kind,font.role,font.style,font.constraints]);
export function continuationFonts(composed: SlideComposition, options: ComposeSlideOptions = {}, sourcePath = (path: string) => path): ContinuationFont[] {
  const scale = Math.min(composed.width,composed.height)/720, samples = new Map<string,ContinuationFont>();
  for (const item of composed.items) {
    if (['title','subtitle','tag'].includes(item.field) || item.eyebrow) continue;
    const kind = item.field === 'items' || item.field === 'bullets' ? 'list' : item.field;
    const constraints = JSON.stringify([item.composition.minFontSize??16,item.composition.maxFontSize??null]);
    const add = (size: number, part: string, role: string, style: any, run: any = {}, automatic = true) => {
      if (!Number.isFinite(size) || size <= 0) return;
      const family = record(style).sourceFontFamily??record(style).fontFamily;
      const font: ContinuationFont = {path:sourcePath(item.path),part,kind,role,size:size/scale,automatic,constraints,
        style:JSON.stringify([family,record(style).fontWeight??400,!!record(style).italic,record(style).lang??null,run.fontFamily??null,run.fontSize??null,run.bold??null,run.italic??null,!!run.superscript,!!run.subscript])};
      const key=continuationFontKey(font),previous=samples.get(key);
      if (!previous || previous.size>font.size) samples.set(key,font);
    };
    const fit = (value: any, part: string, role: string, style: any, automatic = true): void => {
      if (!value) return;
      if (Array.isArray(value.listEntries)) {
        for (const entry of value.listEntries) {
          fit(entry.text,`${part}.entry.${entry.index}`,role,style,automatic);
          fit(entry.description,`${part}.description.${entry.index}`,'description',style,automatic);
        }
      } else if (Array.isArray(value.richLines)) {
        for (const line of value.richLines) for (const fragment of line.fragments) {
          if (fragment.kind !== undefined || !fragment.text.trim()) continue;
          const run=record(fragment.run);
          add(fragment.fontSize,`${part}.run.${fragment.runIndex}`,role,fragment.style??style,run,automatic&&run.fontSize===undefined&&!run.superscript&&!run.subscript);
        }
      } else if (Number.isFinite(value.fontSize)) add(value.fontSize,part,role,style,{},automatic);
    };
    const internal=item.quoteLayout??item.codeLayout??item.metricLayout??item.timelineLayout;
    if (internal) for (const part of internal.parts) {
      if ('visible' in part && part.visible===false) continue;
      fit(part.fit,String(part.path).slice(item.path.length),part.role,part.style);
    }
    else if (item.field==='table') {
      const table=layoutTable(item.value as any,item.box,{scale,minFontSize:item.composition.minFontSize,fontFamily:options.fontFamilies?.body,textMeasurement:options.textMeasurement,presentation:options.presentation,...(item.tableGrowth?{growth:item.tableGrowth}:{})});
      for (const [rowIndex,row] of table.rows.entries()) for (const [columnIndex,cell] of row.cells.entries()) fit(cell.fit,`cell.${rowIndex}.${columnIndex}`,'cell',item.textStyle);
    } else if (item.listColumns?.length) {
      // Column boundaries may change; the source entry indexes remain stable.
      for (const column of item.listColumns) fit(column.text,'body','body',item.textStyle);
    } else fit(item.text,'body','body',item.textStyle);
    if (item.caption) fit((item.caption as any).fit,'caption','caption',(item.caption as any).style,false);
  }
  return [...samples.values()];
}
