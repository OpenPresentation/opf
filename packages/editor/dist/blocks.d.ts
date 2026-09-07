import type {JsonPatchOperation} from './index.js';
/** Move a complete block; toIndex is the insertion position before removal. */
export declare function prepareBlockMove(document:unknown,fromPath:string,toContainerPath:string,toIndex:number):{
 document:unknown;patches:JsonPatchOperation[];path:string;changed:boolean;
};
export declare function listBlockContainers(document:unknown,options?:{slideIndex?:number;includeImplicit?:boolean}):{path:string;label:string;count:number;implicit?:boolean}[];

export interface PreparedBlockChange { document:unknown;patches:JsonPatchOperation[];path:string;changed:boolean }
export declare function prepareBlockInsert(document:unknown,containerPath:string,block:unknown,index?:number):PreparedBlockChange;
export declare function prepareBlockDuplicate(document:unknown,path:string):PreparedBlockChange;
export declare function prepareBlockRemove(document:unknown,path:string):PreparedBlockChange;
export type ContentBlockKind='text'|'list'|'chart'|'table'|'metric'|'quote'|'code'|'timeline'|'group'|'image'|'video';
export declare function createContentBlock(kind:ContentBlockKind,options?:{source?:string}):Record<string,unknown>;
