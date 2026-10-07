// Shared inputs for the standalone metric geometry and controlled browser probes.
// `coreVersion` is the core the documents are validated and rendered with: FontScheme roles are family strings from
// core 0.14 (FA-07) and { family } objects before, so a registry run against an older published core keeps its shape.
export function metricLayoutFixtures({coreVersion}={}) {
  const [major,minor]=String(coreVersion??'0.14.0').split('.').map(Number);
  const font=family=>major===0&&minor<14?{family}:family;
  const scenarios=[
    {id:'scalar-zero',metric:0},
    {id:'all-metadata',metric:{value:-12.5,unit:'ms',label:'Latency',description:'Median across completed requests',delta:0,trend:'flat'}},
    {id:'raised-floor',minFontSize:32,metric:{value:42,unit:'%',label:'Completion',description:'All source fields remain readable',delta:'+3.2',trend:'up'}},
    {id:'long-label',metric:{value:42,label:'The complete supporting label stays readable. '.repeat(18)}},
    {id:'long-unit',metric:{value:42,unit:'milliseconds across all completed production requests',label:'Latency'}},
    {id:'literal-whitespace',metric:{value:' 42\r\n-0.5 ',unit:'ms',label:'Left\tRight  ',description:'Café  stays literal.\n\nNo spaces removed. ',delta:0}},
    {id:'combining-mark',metric:{value:42,label:'e\u0301 remains decomposed'}},
    {id:'greek-symbol',metric:{value:42,label:'Ω remains literal'}},
    {id:'empty-fields',metric:{value:'',unit:'',label:'',description:'',delta:'',trend:'flat'}},
    {id:'irreducible',minFontSize:32,overflow:true,metric:{value:42,unit:'ms',label:'The complete supporting label stays readable. '.repeat(100),delta:0,trend:'flat'}},
  ];
  return ['Carlito','Caladea','Roboto'].flatMap(family=>[{width:1280,height:720},{width:540,height:960}].flatMap(dimensions=>scenarios.map(scenario=>({
    ...scenario,family,dimensions,minFontSize:scenario.minFontSize??24,overflow:scenario.overflow??false,
    ...(family==='Carlito'&&scenario.id==='combining-mark'?{missingGlyph:'\u0301'}:family==='Caladea'&&scenario.id==='greek-symbol'?{missingGlyph:'Ω'}:{}),
    document:{design:{fontScheme:{heading:font(family),body:font(family),code:font('Cousine')},
      dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96}},slides:[{metric:scenario.metric}]},
  }))));
}
