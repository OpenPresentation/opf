// The exact source decks in fixtures/chartex-fallback-main.mjs.txt, promoted to a maintained module.
const region = {columns:['Region','Value'],rows:[['North',42],['South',31],['East',-8],['West',19]]};
const multi = {columns:['Quarter','North','South','West'],rows:[['Q1',4,3,2],['Q2',5,2,3],['Q3',6,4,1]]};
const single = {columns:['Sample'],rows:[[3],[5],[8],[13],[5.5],[9]]};
export const chartexFallbackDecks = {
  'treemap-category':{slides:[{title:'treemap',chart:{type:'treemap',data:region}}]},
  'histogram-single':{slides:[{title:'histogram',chart:{type:'histogram',data:single}}]},
  'histogram-category':{slides:[{title:'histogram',chart:{type:'histogram',data:region}}]},
  'pareto-multi':{slides:[{title:'pareto',chart:{type:'pareto',data:multi}}]},
  'box-multi':{slides:[{title:'box',chart:{type:'box-and-whisker',data:multi}}]},
  'waterfall-single':{slides:[{title:'waterfall',chart:{type:'waterfall',data:single}}]},
  'funnel-category':{slides:[{title:'funnel',chart:{type:'funnel',data:region}}]},
  'world-category':{name:'Map deck',language:'ja-JP',design:{fontScheme:'calibri',contentAlignment:'center'},slides:[{id:'a',layout:'chart',title:'地図',chart:{type:'world',data:{columns:['国','値'],rows:[['日本',4],['ドイツ',3]]}},text:'Body'}]},
  'all-seven':{slides:['treemap','histogram','pareto','box-and-whisker','waterfall','funnel','world'].map(type=>({title:type,chart:{type,data:region}}))},
};
