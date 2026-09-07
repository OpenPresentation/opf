import type { EditorSession } from './index.js';
export interface SchemaInspector { navigate(path:string|string[]):void; commit():boolean; reset():void; readonly document:any; readonly dirty:boolean; destroy():void; }
export declare function createSchemaInspector(container:HTMLElement, options:{editor:EditorSession;path?:string;onDraft?:(event:{document:any;path:string;dirty:boolean})=>void;onCommit?:(event:{editor:EditorSession;path:string})=>void;onCancel?:()=>void;onError?:(error:Error)=>void}):SchemaInspector;
