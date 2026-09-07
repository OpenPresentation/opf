export type TextRun = string | {text:string; bold?:boolean; italic?:boolean; underline?:boolean; strikethrough?:boolean; color?:string; fontFamily?:string; fontSize?:number; link?:string; superscript?:boolean; subscript?:boolean; [key:string]:unknown};
export interface TextRunFormat {
  bold?:boolean|null; italic?:boolean|null; underline?:boolean|null; strikethrough?:boolean|null;
  superscript?:boolean|null; subscript?:boolean|null; color?:string|null; fontFamily?:string|null;
  fontSize?:number|null; link?:string|null;
}
export declare function richTextContent(value:string|TextRun[]):string;
/** Nonempty UTF-16 range on grapheme boundaries; null removes an override. */
export declare function formatRichTextRange(value:string|TextRun[],start:number,end:number,format:TextRunFormat):TextRun[];
export declare function replaceRichTextRange(value:string|TextRun[],start:number,end:number,replacement:string):TextRun[];
