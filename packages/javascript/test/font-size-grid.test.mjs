import assert from 'node:assert/strict';
import test from 'node:test';
import {composeSlide,fitText,fitRichText,fitList,layoutTable,layoutQuote,layoutCode,layoutMetric,layoutTimeline,wrapText,snapFontSizeDown,snapFontSizeUp,FONT_SIZE_GRID_PER_PX} from '../dist/composition.js';
import {examples} from '../dist/examples.js';

// RR-16 (opf#213): PowerPoint stores a run size in hundredths of a point, so every composed font size is a whole
// multiple of 0.01 pt (1/75 px). The preview then draws exactly the size the export writes.
const PT_PER_PX=.75;
/** Hundredths of a point, which must be a whole number. */
const hundredths=px=>px*PT_PER_PX*100;
const onGrid=px=>Math.abs(hundredths(px)-Math.round(hundredths(px)))<1e-6;
const style={fontFamily:'Test',fontWeight:400};
const measurement={measure:(text,size)=>[...text].length*size*.5};
const measure=measurement.measure;
/** A small deterministic generator (mulberry32): the property cases are identical on every run. */
function random(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5>>>0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const words=['alpha','beta','gamma','delta','epsilon','zeta','eta','theta','iota','kappa','lambda','mu','extraordinarily','interdisciplinary'];
const sentence=(next,count)=>Array.from({length:count},()=>words[Math.floor(next()*words.length)]).join(' ');
/** Every numeric painted `fontSize` in a composed or fitted result (authored run sizes are in points and are skipped). */
const authored=new Set(['run','value','input','descriptionValue','payload','requestedStyle']);
function fontSizes(value,found=[],seen=new Set()){
  if(!value||typeof value!=='object'||seen.has(value))return found;
  seen.add(value);
  for(const [key,item] of Object.entries(value)){
    if(authored.has(key))continue;
    if(key==='fontSize'&&typeof item==='number')found.push(item);
    else if(item&&typeof item==='object')fontSizes(item,found,seen);
  }
  return found;
}

test('the grid is 0.01 pt: snapping is exact, idempotent and monotone',()=>{
  assert.equal(FONT_SIZE_GRID_PER_PX,75);
  const next=random(1);
  let previous=0;
  for(let i=0;i<5000;i++){
    const px=next()*200+.01;
    const down=snapFontSizeDown(px),up=snapFontSizeUp(px);
    assert.ok(onGrid(down)&&onGrid(up),`${px} snaps off the grid`);
    assert.ok(down<=px+1e-9&&px<=up+1e-9,`${px} is not between ${down} and ${up}`);
    assert.ok(px-down<1/75+1e-9&&up-px<1/75+1e-9,'snapping moves less than one grid step');
    assert.equal(snapFontSizeDown(down),down,'rounding down is idempotent');
    assert.equal(snapFontSizeUp(up),up,'rounding up is idempotent');
    assert.equal(snapFontSizeDown(up),up,'a grid size never drops a step to binary noise');
  }
  for(let hundredthsOfPoint=1;hundredthsOfPoint<20000;hundredthsOfPoint++){
    const px=hundredthsOfPoint/100/PT_PER_PX;
    assert.ok(Math.abs(snapFontSizeDown(px)-px)<1e-9,`${hundredthsOfPoint} hundredths of a point is on the grid`);
    assert.equal(Math.round(snapFontSizeDown(px)*PT_PER_PX*100),hundredthsOfPoint,'the export writes this exact sz');
  }
  for(let px=0.5;px<80;px+=.37){const a=snapFontSizeDown(px),b=snapFontSizeDown(px+.37);assert.ok(b>=a,'rounding down is monotone');previous=a;}
  assert.ok(previous>0);
  assert.ok(Math.abs(snapFontSizeDown(14.145/PT_PER_PX)-14.14/PT_PER_PX)<1e-9,'opf#213: 14.145 pt rounds down to 14.14 pt');
  assert.equal(Math.round(snapFontSizeDown(14.145/PT_PER_PX)*PT_PER_PX*100),1414);
  assert.ok(snapFontSizeDown(1e-300)>0&&snapFontSizeUp(1e-300)>0,'a positive size stays positive');
});

test('plain text: sizes are on the grid, deterministic, readable and genuinely fitting',()=>{
  const next=random(7);
  let shrunk=0;
  for(let i=0;i<400;i++){
    const text=sentence(next,1+Math.floor(next()*40)),scale=[1,1.5,.9722,1.1333,.3][i%5];
    const box={x:0,y:0,width:80+next()*900,height:30+next()*600},requested=(10+next()*60)*scale,floor=(8+next()*14)*scale;
    const first=fitText(text,box,requested,floor,measure),second=fitText(text,box,requested,floor,measure);
    assert.deepEqual(first,second,'deterministic');
    assert.ok(onGrid(first.fontSize),`${first.fontSize}px is off the 0.01 pt grid`);
    assert.ok(first.fontSize+1e-9>=snapFontSizeUp(floor)&&first.fontSize+1e-9>=floor,'the readability floor holds');
    assert.ok(first.fontSize<=Math.max(snapFontSizeDown(requested),snapFontSizeUp(floor))+1e-9,'never larger than the request (or the grid-rounded floor)');
    if(first.fontSize<snapFontSizeDown(Math.max(requested,floor))-1e-9)shrunk++;
    if(!first.overflow){
      assert.ok(first.lines.length*first.lineHeight<=box.height+.01,'a result that reports no overflow fits the height');
      for(const line of first.sourceLines)assert.ok(line.width<=box.width+.01,'and the width');
    }else assert.equal(first.fontSize,snapFontSizeUp(floor),'an overflowing result is the irreducible floor');
    // The accepted size measures and breaks exactly as the export will write it.
    const again=fitText(text,box,first.fontSize,first.fontSize,measure);
    assert.deepEqual(again.lines,first.lines);assert.equal(again.fontSize,first.fontSize);
  }
  assert.ok(shrunk>50,`the cases must exercise shrinking (${shrunk})`);
});

test('fitting is monotone in the available space',()=>{
  const next=random(11);
  for(let i=0;i<150;i++){
    const text=sentence(next,5+Math.floor(next()*40)),width=100+next()*600;
    let previous=0;
    for(const height of [40,80,120,200,320,500,900]){
      const fit=fitText(text,{x:0,y:0,width,height},40,12,measure);
      assert.ok(fit.fontSize+1e-9>=previous,`${fit.fontSize} shrank when the box grew`);
      previous=fit.fontSize;
    }
  }
});

test('requested sizes on the grid are honored and one grid step does not change the fit',()=>{
  const box={x:0,y:0,width:2000,height:2000};
  for(const pt of [8,9.75,11.25,14.14,14.15,18.75,21.01,47.08,54]){
    const px=pt/PT_PER_PX;
    const size=fitText('Short',box,px,6,measure).fontSize;
    assert.ok(Math.abs(size-px)<1e-9,`${pt} pt stays ${pt} pt (${size*PT_PER_PX})`);
    assert.equal(Math.round(size*PT_PER_PX*100),Math.round(pt*100));
  }
  // wrapText measures at exactly the size it is given; only fits compose on the grid.
  assert.deepEqual(wrapText('aa bb',46.255,18.5,measure),['aa bb'],'wrapText measures at the size it is given (18.5 px is off the grid; 18.5067 px would wrap)');
});

test('rich text and lists: every painted run, marker and picture bullet is on the grid and at or above the floor',()=>{
  const next=random(23);
  const bulletImage={source:'asset:dot',path:'design.listBullet'};
  for(let i=0;i<150;i++){
    const rich=[sentence(next,6),{text:sentence(next,3),bold:true},{text:'small',fontSize:7+next()*8},{text:'2',superscript:true},{text:'i',subscript:true},` ${sentence(next,5)}`];
    const scale=[1,1.5,.9722,1.1333][i%4],floor=(10+next()*10)*scale,requested=(18+next()*20)*scale;
    const box={x:0,y:0,width:150+next()*700,height:60+next()*500};
    const fit=fitRichText(rich,box,requested,floor,{style,textMeasurement:measurement});
    assert.deepEqual(fit,fitRichText(rich,box,requested,floor,{style,textMeasurement:measurement}),'deterministic');
    for(const size of fontSizes(fit))assert.ok(onGrid(size),`rich ${size}px is off the grid`);
    for(const fragment of fit.richLines.flatMap(line=>line.fragments))assert.ok(fragment.fontSize+1e-9>=floor,`${fragment.fontSize}px is below the floor ${floor}`);
    const items=[{text:rich,description:[sentence(next,4),{text:'detail',italic:true}],level:i%3},sentence(next,8),{text:sentence(next,5),description:sentence(next,6)}];
    const list=fitList(items,box,requested,floor,{style,textMeasurement:measurement,bulletImage});
    for(const size of fontSizes(list))assert.ok(onGrid(size),`list ${size}px is off the grid`);
    for(const entry of list.listEntries){
      assert.equal(entry.marker.fontSize,list.fontSize,'the marker uses the snapped list size');
      assert.ok(entry.bulletBox.width===entry.marker.fontSize*.65&&entry.bulletBox.height===entry.bulletBox.width,'the picture bullet derives from the snapped size');
      for(const fit of [entry.text,entry.description])if(fit)for(const fragment of fit.richLines.flatMap(line=>line.fragments))assert.ok(fragment.fontSize+1e-9>=floor,'list glyphs honor the floor');
    }
  }
});

test('tables: cell sizes are on the grid and fit their rows',()=>{
  const next=random(31);
  for(let i=0;i<60;i++){
    const rows=Array.from({length:2+Math.floor(next()*5)},()=>Array.from({length:2+Math.floor(next()*3)},()=>next()<.3?[sentence(next,2),{text:'x',bold:true,fontSize:9+next()*10}]:sentence(next,1+Math.floor(next()*6))));
    const scale=[1,.9722,1.1333][i%3],box={x:0,y:0,width:400+next()*700,height:120+next()*500},options={scale,minFontSize:12+next()*6,textMeasurement:measurement},table=layoutTable({rows},box,options);
    assert.deepEqual(table,layoutTable({rows},box,options),'deterministic');
    for(const size of fontSizes(table))assert.ok(onGrid(size),`table ${size}px is off the grid`);
  }
});

test('quote, code, metric and timeline layouts compose on the grid at awkward scales',()=>{
  const next=random(41);
  for(const scale of [1,.9722,1.1333,2.2222,.37]){
    const cell={x:0,y:0,width:640*scale,height:300*scale};
    const results=[
      layoutQuote({text:sentence(next,30),attribution:sentence(next,3),source:sentence(next,3)},cell,{scale,textMeasurement:measurement,minFontSize:14}),
      layoutCode({source:Array.from({length:12},()=>sentence(next,6)).join('\n'),language:'ts',filename:'a.ts'},cell,{scale,textMeasurement:measurement,minFontSize:14}),
      layoutMetric({value:'1,234.5',unit:'ms',label:sentence(next,3),description:sentence(next,10),delta:3,trend:'up'},cell,{scale,textMeasurement:measurement,minFontSize:14}),
      layoutTimeline({name:'Plan',description:sentence(next,6),events:Array.from({length:4},()=>({when:'Q1',what:sentence(next,3),description:sentence(next,6)}))},{x:0,y:0,width:1100*scale,height:420*scale},{scale,textMeasurement:measurement,minFontSize:14}),
    ];
    for(const result of results){
      const parts=result.parts??[];
      for(const part of parts){
        assert.ok(onGrid(part.requestedFontSize),`requested ${part.requestedFontSize}px is off the grid at scale ${scale}`);
        assert.ok(onGrid(part.minFontSize),'the floor is on the grid');
        if(part.fit)for(const size of fontSizes(part.fit))assert.ok(onGrid(size),`${part.path} draws ${size}px at scale ${scale}`);
        if(part.fit)assert.ok(part.fit.fontSize+1e-9>=14*scale,'minFontSize holds');
      }
    }
  }
});

test('composed slides: every font size in the example corpus is on the grid, at several canvases',()=>{
  const sizes=[{width:1280,height:720},{width:960,height:720},{width:1056,height:816},{width:1280,height:700}];
  let slides=0,checked=0;
  for(const {file,deck} of examples){
    for(const [slideIndex,slide] of deck.slides.entries()){
      const canvas=sizes[(slideIndex+file.length)%sizes.length];
      let composed;
      try{composed=composeSlide(slide,{...canvas,presentation:deck,slideIndex});}catch{continue;}
      slides++;
      for(const size of fontSizes(composed)){checked++;assert.ok(onGrid(size),`${file}#${slideIndex}: ${size}px is off the grid (${canvas.width}x${canvas.height})`);}
    }
  }
  assert.ok(slides>600&&checked>3000,`the corpus must be exercised (${slides} slides, ${checked} sizes)`);
});

test('composed slides: the floor survives snapping at an odd scale',()=>{
  const slide={title:'A title '.repeat(9),subtitle:'Subtitle '.repeat(12),blocks:[{text:sentence(random(5),80)},{items:[sentence(random(6),9),sentence(random(7),9)]}]};
  const canvas={width:1280,height:700},scale=700/720,floor=18*scale;
  const composed=composeSlide({...slide,composition:{minFontSize:18}},canvas);
  const sizes=composed.items.flatMap(item=>item.text?fontSizes(item.text):[]);
  assert.ok(sizes.length>3);
  for(const size of sizes){assert.ok(onGrid(size));assert.ok(size+1e-9>=floor,`${size} is below ${floor}`);}
});
