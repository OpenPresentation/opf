import {arrangementTree} from './tree-arrangement.js';

interface Box {x:number;y:number;width:number;height:number}
export type NativeTreeKind='org-chart'|'hierarchy';
export interface NativeTreeNode {index:number;level:number;parent?:number;box:Box;background?:Box}
export interface NativeTreeGeometry {ok:true;nodes:NativeTreeNode[]}
export type NativeTreeGeometryResult=NativeTreeGeometry|{ok:false;reason:string;index?:number};
interface Position {index:number;x:number;row:number}
interface Model {root:number;nodes:Position[]}

/** SH21 rectangle model measured in PowerPoint. This helper does not enable native export or define Hierarchy's freeform paint. */
export function nativeTreeGeometry(kind:NativeTreeKind,frame:Box,entries:readonly unknown[]):NativeTreeGeometryResult{
 if(kind!=='org-chart'&&kind!=='hierarchy')return{ok:false,reason:'Unsupported native tree kind.'};
 if(![frame.x,frame.y,frame.width,frame.height].every(Number.isFinite)||frame.width<=0||frame.height<=0)return{ok:false,reason:'A native tree frame needs finite coordinates and positive dimensions.'};
 const tree=arrangementTree(entries);if(!tree.ok)return tree;
 const org=kind==='org-chart',span=org?2:10/9,gap=org?.42:1/9,stride=org?1.42:1111/1200,height=org?1:127/200,frontX=org?0:1/9,frontY=org?0:19/180;
 const models:Model[]=[];
 // Source order is preorder, so every child's model exists in this bounded reverse walk. No recursive JS stack or source edits.
 for(let index=tree.nodes.length-1;index>=0;index--){
  const semantic=tree.nodes[index];if(!semantic)return{ok:false,index,reason:'A native tree node is missing.'};
  if(!semantic.children.length){models[index]={root:0,nodes:[{index,x:0,row:0}]};continue;}
  if(org&&index!==0&&semantic.children.every(child=>tree.nodes[child]?.children.length===0)){
   models[index]={root:0,nodes:[{index,x:0,row:0},...semantic.children.map((child,row)=>({index:child,x:.5,row:row+1}))]};continue;
  }
  const positions:Position[]=[],contour=new Map<number,number>(),roots:number[]=[];
  for(const child of semantic.children){
   const own=models[child];if(!own)return{ok:false,index:child,reason:'A child has no native tree geometry.'};
   let shift=0;for(const node of own.nodes){const right=contour.get(node.row);if(right!==undefined)shift=Math.max(shift,right+gap-node.x);}
   roots.push(own.root+shift);
   for(const node of own.nodes){const x=node.x+shift;positions.push({...node,x,row:node.row+1});contour.set(node.row,Math.max(contour.get(node.row)??-Infinity,x+span));}
  }
  const first=roots[0],last=roots.at(-1);if(first===undefined||last===undefined)return{ok:false,index,reason:'A parent has no placed child.'};
  const x=(first+last)/2;positions.unshift({index,x,row:0});const min=Math.min(...positions.map(node=>node.x));models[index]={root:x-min,nodes:positions.map(node=>({...node,x:node.x-min}))};
 }
 const root=models[0];if(!root)return{ok:false,reason:'A native tree needs its root geometry.'};
 const width=Math.max(...root.nodes.map(node=>node.x+span)),tall=Math.max(...root.nodes.map(node=>node.row*stride+height+frontY));
 // Native fit quantization: keep the lower fitting bound when the interval is <=0.002 of its midpoint. At most40 steps.
 let low=0,high=(org?1.25:.9)*frame.width;
 for(let step=0;step<40&&high-low>.002*(low+high)/2;step++){
  const mid=(low+high)/2;
  // Numerical exact-boundary epsilon only; native qualification retains its independent0.1pt acceptance bound.
  if(width*mid<=frame.width+1e-8&&tall*mid<=frame.height+1e-8)low=mid;else high=mid;
 }
 const x0=frame.x+(frame.width-width*low)/2,y0=frame.y+(frame.height-tall*low)/2;
 const nodes=root.nodes.map(node=>{
  const semantic=tree.nodes[node.index];if(!semantic)throw new Error('Native tree model lost its semantic node.');
  const back={x:x0+node.x*low,y:y0+node.row*stride*low,width:(org?2:1)*low,height:height*low};
  return{index:node.index,level:semantic.level,...(semantic.parent===undefined?{}:{parent:semantic.parent}),box:org?back:{...back,x:back.x+frontX*low,y:back.y+frontY*low},...(org?{}:{background:back})};
 }).sort((a,b)=>a.index-b.index);
 return{ok:true,nodes};
}