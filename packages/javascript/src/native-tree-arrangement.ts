import {arrangementTree} from './tree-arrangement.js';

interface Box {x:number;y:number;width:number;height:number}
export type NativeTreeKind='org-chart'|'hierarchy';
export interface NativeTreeNode {index:number;level:number;parent?:number;box:Box;background?:Box}
export interface NativeTreeConnector {parent:number;child:number;box:Box;points:readonly [number,number][]}
export interface NativeTreeGeometry {ok:true;nodes:NativeTreeNode[];connectors:NativeTreeConnector[]}
export type NativeTreeGeometryResult=NativeTreeGeometry|{ok:false;reason:string;index?:number};
interface Position {index:number;x:number;row:number}
interface Model {root:number;nodes:Position[]}

type TreeModel={ok:true;tree:Extract<ReturnType<typeof arrangementTree>,{ok:true}>;root:Model;org:boolean;span:number;gap:number;stride:number;height:number;frontX:number;frontY:number};

/** SH21 geometry measured in PowerPoint, including paired Hierarchy cards and semantic connector paths; eligibility is separate. */
export function nativeTreeGeometry(kind:NativeTreeKind,frame:Box,entries:readonly unknown[]):NativeTreeGeometryResult{
 const model=treeModel(kind,frame,entries);if(!model.ok)return model;
 const {root,org,span,stride,height,frontY}=model;
 const width=Math.max(...root.nodes.map(node=>node.x+span)),tall=Math.max(...root.nodes.map(node=>node.row*stride+height+frontY));
 // Native fit quantization: keep the lower fitting bound when the interval is <=0.002 of its midpoint. At most40 steps.
 let low=0,high=(org?1.25:.9)*frame.width;
 for(let step=0;step<40&&high-low>.002*(low+high)/2;step++){
  const mid=(low+high)/2;
  // Numerical exact-boundary epsilon only; native qualification retains its independent0.1pt acceptance bound.
  if(width*mid<=frame.width+1e-8&&tall*mid<=frame.height+1e-8)low=mid;else high=mid;
 }
 return placeTree(model,frame.x+(frame.width-width*low)/2,frame.y+(frame.height-tall*low)/2,low,low,row=>row*stride*low,height*low);
}

/**
 * HI1, H2: OPF's own tree, drawn where PowerPoint's (scaled as a whole to its frame) leaves most of the region empty or does not hold
 * the labels: the same tidy positions, rows and connectors, but scaled across and down on their own. A node is as wide as the region's
 * width allows (`span` of a unit); its height is `share` of a row's step, at most `aspect` times its width and at least PowerPoint's
 * proportion of it, and the tree is centered in the region. A hierarchy keeps its rear and front cards in PowerPoint's proportions.
 */
export function opfTreeGeometry(kind:NativeTreeKind,frame:Box,entries:readonly unknown[],share=OPF_TREE_SHARE,aspect=OPF_TREE_ASPECT):NativeTreeGeometryResult{
 const model=treeModel(kind,frame,entries);if(!model.ok)return model;
 const {root,org,span,height,frontY}=model;
 const units=Math.max(...root.nodes.map(node=>node.x+span)),rows=Math.max(...root.nodes.map(node=>node.row))+1;
 const sx=frame.width/units,boxWidth=(org?2:1)*sx;
 // Rows a step apart, a node `share` of a step tall (a hierarchy's front card offset below it), the last row's node at the foot.
 const least=height*sx,most=aspect*boxWidth,fit=frame.height/((rows-1)/share+1+frontY/height);
 const h=Math.min(fit,Math.max(least,most)),step=h/share,sy=h/height,tall=(rows-1)*step+h+frontY*sy;
 if(!(sx>0)||!(h>0))return{ok:false,reason:'The region is too small for the tree.'};
 return placeTree(model,frame.x,frame.y+(frame.height-tall)/2,sx,sy,row=>row*step,h);
}
/** HI1: a node of OPF's tree is this share of its row's step tall, and at most this many times as tall as it is wide. */
export const OPF_TREE_SHARE=.6,OPF_TREE_ASPECT=.75;

function treeModel(kind:NativeTreeKind,frame:Box,entries:readonly unknown[]):TreeModel|{ok:false;reason:string;index?:number}{
 if(kind!=='org-chart'&&kind!=='hierarchy')return{ok:false,reason:'Unsupported native tree kind.'};
 if(![frame.x,frame.y,frame.width,frame.height].every(Number.isFinite)||frame.width<=0||frame.height<=0)return{ok:false,reason:'A native tree frame needs finite coordinates and positive dimensions.'};
 const tree=arrangementTree(entries);if(!tree.ok)return tree;
 const assistant=(index:number)=>tree.nodes[index]?.assistant===true;
 if(kind==='hierarchy'){const at=tree.nodes.findIndex(node=>node.assistant);if(at>=0)return{ok:false,index:at,reason:'A hierarchy has no assistants.'};}
 const org=kind==='org-chart',span=org?2:10/9,gap=org?.42:1/9,stride=org?1.42:1111/1200,height=org?1:127/200,frontX=org?0:1/9,frontY=org?0:19/180;
 const models:Model[]=[];
 // Source order is preorder, so every child's model exists in this bounded reverse walk. No recursive JS stack or source edits.
 for(let index=tree.nodes.length-1;index>=0;index--){
  const semantic=tree.nodes[index];if(!semantic)return{ok:false,index,reason:'A native tree node is missing.'};
  if(!semantic.children.length){models[index]={root:0,nodes:[{index,x:0,row:0}]};continue;}
  // An org chart's assistants hang off the line below their manager, one a row, to its right, above the reports, which start a row lower each.
  const assistants=semantic.children.filter(assistant),reports=semantic.children.filter(child=>!assistant(child)),below=assistants.length;
  const aside=(x:number):Position[]=>assistants.map((child,row)=>({index:child,x:x+span/2+gap,row:row+1}));
  if(org&&index!==0&&reports.length&&reports.every(child=>tree.nodes[child]?.children.length===0)){
   models[index]={root:0,nodes:[{index,x:0,row:0},...aside(0),...reports.map((child,row)=>({index:child,x:.5,row:row+1+below}))]};continue;
  }
  if(!reports.length){models[index]={root:0,nodes:[{index,x:0,row:0},...aside(0)]};continue;}
  const positions:Position[]=[],contour=new Map<number,number>(),roots:number[]=[];
  for(const child of reports){
   const own=models[child];if(!own)return{ok:false,index:child,reason:'A child has no native tree geometry.'};
   let shift=0;for(const node of own.nodes){const right=contour.get(node.row);if(right!==undefined)shift=Math.max(shift,right+gap-node.x);}
   roots.push(own.root+shift);
   for(const node of own.nodes){const x=node.x+shift;positions.push({...node,x,row:node.row+1+below});contour.set(node.row,Math.max(contour.get(node.row)??-Infinity,x+span));}
  }
  const first=roots[0],last=roots.at(-1);if(first===undefined||last===undefined)return{ok:false,index,reason:'A parent has no placed child.'};
  const x=(first+last)/2;positions.unshift({index,x,row:0},...aside(x));const min=Math.min(...positions.map(node=>node.x));models[index]={root:x-min,nodes:positions.map(node=>({...node,x:node.x-min}))};
 }
 const root=models[0];if(!root)return{ok:false,reason:'A native tree needs its root geometry.'};
 return{ok:true,tree,root,org,span,gap,stride,height,frontX,frontY};
}

/** The tree's nodes and connectors from its model: x units of `low`, each row at `rowY` below y0, nodes `h` tall, y units of `sy`. */
function placeTree(model:TreeModel,x0:number,y0:number,low:number,sy:number,rowY:(row:number)=>number,h:number):NativeTreeGeometryResult{
 const {tree,root,org,frontX,frontY}=model,assistant=(index:number)=>tree.nodes[index]?.assistant===true;
 const nodes=root.nodes.map(node=>{
  const semantic=tree.nodes[node.index];if(!semantic)throw new Error('Native tree model lost its semantic node.');
  const back={x:x0+node.x*low,y:y0+rowY(node.row),width:(org?2:1)*low,height:h};
  return{index:node.index,level:semantic.level,...(semantic.parent===undefined?{}:{parent:semantic.parent}),box:org?back:{...back,x:back.x+frontX*low,y:back.y+frontY*sy},...(org?{}:{background:back})};
 }).sort((a,b)=>a.index-b.index);
 const connectors:NativeTreeConnector[]=[];
 for(const child of nodes){
  if(child.parent===undefined)continue;
  const parent=nodes[child.parent],semantic=tree.nodes[child.parent];if(!parent||!semantic)return{ok:false,index:child.index,reason:'A connector lost its semantic parent.'};
  const p=parent.background??parent.box,c=child.background??child.box;
  const reports=semantic.children.filter(index=>!assistant(index));
  if(assistant(child.index)){
   // The assistant's elbow: down the manager's center line to the assistant's middle, then across to its near side.
   const from:[number,number]=[p.x+p.width/2,p.y+p.height],to:[number,number]=[c.x,c.y+c.height/2],points:readonly [number,number][]=[from,[from[0],to[1]],to];
   connectors.push({parent:parent.index,child:child.index,box:{x:from[0],y:from[1],width:to[0]-from[0],height:to[1]-from[1]},points});continue;
  }
  const hanging=org&&parent.index!==0&&reports.length>0&&reports.every(index=>tree.nodes[index]?.children.length===0);
  const from:[number,number]=hanging?[p.x+.2*low,p.y+p.height]:[p.x+p.width/2,p.y+p.height];
  const to:[number,number]=hanging?[c.x,c.y+c.height/2]:[c.x+c.width/2,c.y];
  const width=Math.abs(to[0]-from[0]),straight=width<1e-6;
  // PowerPoint gives a vertical zero-width connector a fixed0.1in bounding box (7.2pt), independent of frame scale.
  const box={x:straight?from[0]-4.8:Math.min(from[0],to[0]),y:from[1],width:straight?9.6:width,height:to[1]-from[1]};
  // The reports' bar sits halfway between the lowest assistant (or the manager) and the reports.
  const above=Math.max(parent.box.y+parent.box.height,...semantic.children.filter(assistant).map(index=>{const node=nodes[index]!;return node.box.y+node.box.height;}));
  const middle=(above+to[1])/2;
  const points:readonly [number,number][]=hanging?[from,[from[0],to[1]],to]:[from,[from[0],middle],[to[0],middle],to];
  connectors.push({parent:parent.index,child:child.index,box,points});
 }
 // Native groups stack parent connectors in reverse source-child order; all420 measured sequences agree.
 return{ok:true,nodes,connectors:connectors.reverse()};
}