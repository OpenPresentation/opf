import assert from'node:assert/strict';
// Qualification input only: derive the mark family from the actual saved native
// chart group, never from an authored overlay or a guessed generic marker.
export function nativeChartMarkKind(xml){
 const plot=/<c:plotArea\b[^>]*>([\s\S]*?)<\/c:plotArea>/.exec(xml)?.[1];assert.ok(plot,'One actual native plotArea is required');
 const groups=[...plot.matchAll(/<c:([A-Za-z0-9]+Chart)\b/g)].map(m=>m[1]);assert.equal(groups.length,1,'One homogeneous native chart group is required');const type=groups[0];
 if(type==='barChart'){const body=/<c:barChart\b[^>]*>([\s\S]*?)<\/c:barChart>/.exec(plot)?.[1],direction=/<c:barDir\b[^>]*\bval=["']([^"']+)["']/.exec(body??'')?.[1];assert.ok(direction==='col'||direction==='bar','Actual native bar direction must be col or bar');return direction==='col'?'vertical-bar':'horizontal-bar';}
 assert.ok(['lineChart','areaChart','scatterChart','pieChart','doughnutChart'].includes(type),'Unsupported native chart group: '+type);return type==='pieChart'||type==='doughnutChart'?'slice':'marker';
}
export function nativeNameWitnessPlan(actions,chartXml){
 const kind=nativeChartMarkKind(chartXml);assert.ok(Array.isArray(actions)&&actions.length===3,'Name witness needs one rename and two point observations');assert.equal(actions[0].op,'set-chart-series-name');assert.ok(actions.slice(1).every(a=>a.op==='measure-chart-point'&&a.chartName===actions[0].chartName),'Name witness observations must address its exact native chart');return actions.map(action=>action.op==='measure-chart-point'?{...action,chartKind:kind}:{...action});
}
