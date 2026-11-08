import type {VennBox,VennNode} from './venn-arrangement.js';

interface LabelSize {width:number; height:number}
interface Fit {nodes:VennNode[]; scale:number; circleHeight:number}
const extent=(boxes:readonly VennBox[]):VennBox=>{
  const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
  return{x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y};
};
const overlap=(a:VennBox,b:VennBox,gap=0)=>a.x<b.x+b.width+gap&&b.x<a.x+a.width+gap&&a.y<b.y+b.height+gap&&b.y<a.y+a.height+gap;

/** Editable-shape fit only. Native Basic Venn measurements and live eligibility remain separate and unchanged.
 * One positive uniform transform preserves every circle intersection and source index; labels are measured outside the union.
 */
export function fitVennShapes(frame:VennBox,native:readonly VennNode[],labels:readonly LabelSize[],gap:number):Fit|undefined{
  if(native.length<5||native.length>7||labels.length!==native.length||!Number.isFinite(gap)||gap<0)return undefined;
  if(![frame.x,frame.y,frame.width,frame.height,...native.flatMap(n=>Object.values(n.box)),...labels.flatMap(n=>[n.width,n.height])].every(Number.isFinite))return undefined;
  if(frame.width<=2*gap||frame.height<=2*gap||native.some(n=>n.box.width<=0||n.box.height<=0)||labels.some(n=>n.width<=0||n.height<=0))return undefined;
  const cx=frame.x+frame.width/2,cy=frame.y+frame.height/2;
  const ox=native.reduce((sum,n)=>sum+n.box.x+n.box.width/2,0)/native.length;
  const oy=native.reduce((sum,n)=>sum+n.box.y+n.box.height/2,0)/native.length;
  const measured=extent(native.map(n=>n.box));
  if(measured.width<=0||measured.height<=0)return undefined;
  const inner={x:frame.x+gap,y:frame.y+gap,width:frame.width-2*gap,height:frame.height-2*gap};
  const make=(scale:number)=>{
    const circles=native.map(n=>({...n,box:{x:cx+(n.box.x-ox)*scale,y:cy+(n.box.y-oy)*scale,width:n.box.width*scale,height:n.box.height*scale}}));
    const slots=circles.map((n,index)=>{
      const original=native[index]!,label=labels[index]!,vx=original.box.x+original.box.width/2-ox,vy=original.box.y+original.box.height/2-oy,length=Math.hypot(vx,vy);
      const dx=length?vx/length:Math.sin(2*Math.PI*index/native.length),dy=length?vy/length:-Math.cos(2*Math.PI*index/native.length);
      const box=(distance:number):VennBox=>({x:cx+dx*distance-label.width/2,y:cy+dy*distance-label.height/2,width:label.width,height:label.height});
      const collides=(distance:number)=>{const candidate=box(distance);return circles.some(circle=>{
        const x=circle.box.x+circle.box.width/2,y=circle.box.y+circle.box.height/2;
        const px=Math.max(candidate.x,Math.min(x,candidate.x+candidate.width)),py=Math.max(candidate.y,Math.min(y,candidate.y+candidate.height));
        // The enclosing radius conservatively covers the tiny measured width/height quantization of the native ellipses.
        const radius=Math.max(circle.box.width,circle.box.height)/2+gap;
        return (x-px)**2+(y-py)**2<radius**2;
      });};
      let lo=0,hi=Math.max(...circles.map(c=>Math.hypot(c.box.x+c.box.width/2-cx,c.box.y+c.box.height/2-cy)+Math.max(c.box.width,c.box.height)/2))+gap+Math.hypot(label.width,label.height);
      for(let step=0;step<40;step++){const mid=(lo+hi)/2;if(collides(mid))lo=mid;else hi=mid;}
      return box(hi+1e-6);
    });
    const bounds=extent([...circles.map(n=>n.box),...slots]);
    return{circles,slots,bounds};
  };
  const fits=(result:ReturnType<typeof make>)=>result.bounds.width<=inner.width+1e-7&&result.bounds.height<=inner.height+1e-7;
  if(!fits(make(0)))return undefined;
  let low=0,high=Math.min(inner.width/measured.width,inner.height/measured.height);
  if(fits(make(high)))low=high;
  else for(let step=0;step<40;step++){const mid=(low+high)/2;if(fits(make(mid)))low=mid;else high=mid;}
  if(low<=1+1e-6)return undefined;
  const result=make(low);
  for(let i=0;i<result.slots.length;i++)for(let j=i+1;j<result.slots.length;j++)if(overlap(result.slots[i]!,result.slots[j]!,gap/2))return undefined;
  const tx=cx-result.bounds.x-result.bounds.width/2,ty=cy-result.bounds.y-result.bounds.height/2;
  const move=(box:VennBox):VennBox=>({...box,x:box.x+tx,y:box.y+ty});
  return{nodes:result.circles.map((node,index)=>({...node,box:move(node.box),textBox:move(result.slots[index]!)})),scale:low,circleHeight:measured.height*low};
}
