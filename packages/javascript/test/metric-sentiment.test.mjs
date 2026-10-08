import assert from 'node:assert/strict';
import {test} from 'node:test';
import { composeSlide, METRIC_TREND_MIN_CONTRAST, METRIC_TREND_SHAPES, colorContrast, layoutMetric, metricTrendColor, metricTrendMark } from '../dist/composition.js';
import {convertContent as convert} from '../dist/convert.js';
import { colorSchemes } from './support/catalog.mjs';
import {fromMarkdown,toMarkdown} from '../dist/markdown.js';
import { check, errorsOf, warningsOf } from './support/validation.mjs';

// FA-06: metric.sentiment says whether a change is good news. The arrow follows the trend; the colour follows the sentiment.
const box={x:40,y:60,width:600,height:400};
const TRENDS=['up','down','flat'],SENTIMENTS=['positive','negative','neutral'];
const LIGHT='#FFFFFF',DARK='#0F172A';
// The colours the preview and export drew before sentiment existed: up green, down red, flat neutral.
const TODAY={up:{[LIGHT]:'#15803D',[DARK]:'#4ADE80'},down:{[LIGHT]:'#B91C1C',[DARK]:'#F87171'},flat:{[LIGHT]:'#475569',[DARK]:'#CBD5E1'}};
const DEFAULT_SENTIMENT={up:'positive',down:'negative',flat:'neutral'};
const COLORS={positive:TODAY.up,negative:TODAY.down,neutral:TODAY.flat};

test('absent sentiment is the conventional reading: up positive, down negative, flat neutral, with exactly the colours drawn before',()=>{
  for(const trend of TRENDS) for(const background of [LIGHT,DARK]) {
    assert.equal(metricTrendColor(trend,{background}),TODAY[trend][background],`${trend} on ${background}`);
    assert.equal(metricTrendColor(trend,{background,sentiment:DEFAULT_SENTIMENT[trend]}),TODAY[trend][background]);
  }
});

test('every trend and sentiment: the arrow keeps the trend, the colour follows the sentiment, at 4.5:1 or more',()=>{
  const backgrounds=[LIGHT,DARK,'#000000','#808080','#7F7F7F','#2563EB','#F59E0B'];
  for(const scheme of colorSchemes) backgrounds.push(scheme.light1,scheme.dark1,scheme.light2,scheme.dark2);
  for(const trend of TRENDS) for(const sentiment of [undefined,...SENTIMENTS]) {
    const content={value:42,label:'Churn',delta:'-3%',trend,...(sentiment?{sentiment}:{})};
    const layout=layoutMetric(content,box,{path:'m'});
    assert.equal(layout.sentiment,sentiment,'the layout passes the sentiment through');
    const expected=sentiment??DEFAULT_SENTIMENT[trend];
    for(const background of backgrounds) {
      const mark=metricTrendMark(layout,{background});
      assert.equal(mark.trend,trend);assert.equal(mark.shape,METRIC_TREND_SHAPES[trend],'the arrow follows the trend, never the sentiment');
      assert.equal(mark.ariaLabel,`Trend: ${trend}`);
      assert.equal(mark.sentiment,expected);
      assert.equal(mark.color,metricTrendColor(trend,{background,sentiment:expected}));
      assert.ok(colorContrast(mark.color,background)>=METRIC_TREND_MIN_CONTRAST,`${trend}/${sentiment} ${mark.color} on ${background}`);
    }
    for(const background of [LIGHT,DARK]) assert.equal(metricTrendMark(layout,{background}).color,COLORS[expected][background],`${trend}/${sentiment} on ${background}`);
  }
});

test('good news in a falling trend is the green of a rising one; the arrow still points down',()=>{
  const churn=metricTrendMark(layoutMetric({value:3.1,unit:'%',label:'Churn',delta:'-0.6 pts',trend:'down',sentiment:'positive'},box),{background:LIGHT});
  assert.equal(churn.shape,'downArrow');assert.equal(churn.color,TODAY.up[LIGHT]);
  const revenue=metricTrendMark(layoutMetric({value:3.1,label:'Churn',trend:'up',sentiment:'negative'},box),{background:DARK});
  assert.equal(revenue.shape,'upArrow');assert.equal(revenue.color,TODAY.down[DARK]);
  // The colour options override the layout's sentiment.
  const layout=layoutMetric({value:1,trend:'up',sentiment:'negative'},box);
  assert.equal(metricTrendMark(layout,{background:LIGHT,sentiment:'positive'}).color,TODAY.up[LIGHT]);
});

test('sentiment without a trend has no mark and so no colour: only the trend arrow and the trend and delta text are coloured',()=>{
  assert.equal(metricTrendMark(layoutMetric({value:42,delta:'+3',sentiment:'positive'},box),{background:LIGHT}),undefined);
});

test('absent sentiment leaves the layout byte-identical; a present one only adds its own key',()=>{
  for(const trend of [undefined,...TRENDS]) {
    const content={value:42,unit:'ms',label:'Latency',description:'Median',delta:-4.2,...(trend?{trend}:{})};
    const plain=layoutMetric(content,box,{path:'m'});
    assert.ok(!('sentiment' in plain));
    const stated=layoutMetric({...content,sentiment:'neutral'},box,{path:'m'});
    const {sentiment,...rest}=stated;
    assert.equal(sentiment,'neutral');
    assert.equal(JSON.stringify(rest),JSON.stringify(plain),'sentiment moves no geometry and no text');
  }
});

test('composition passes the sentiment through to the metric layout',()=>{
  const slide={blocks:[{metric:{value:3.1,unit:'%',label:'Churn',delta:'-0.6 pts',trend:'down',sentiment:'positive'}}]};
  const item=composeSlide(slide,{width:1280,height:720}).items.find(candidate=>candidate.metricLayout);
  assert.equal(item.metricLayout.sentiment,'positive');
  assert.equal(composeSlide({blocks:[{metric:{value:1,trend:'down'}}]},{width:1280,height:720}).items.find(candidate=>candidate.metricLayout).metricLayout.sentiment,undefined);
});

test('sentiment is validated: only positive, negative and neutral',()=>{
  for(const sentiment of SENTIMENTS) assert.equal(check({slides:[{metric:{value:1,trend:'down',sentiment}}]}).valid,true,sentiment);
  for(const sentiment of ['good','Positive','',1,null,['positive']]) {
    assert.equal(check({slides:[{metric:{value:1,sentiment}}]}).valid,false,JSON.stringify(sentiment));
    assert.throws(()=>layoutMetric({value:1,sentiment},box),TypeError);
  }
});

test('markdown reads and writes the sentiment key of a metric fence',()=>{
  const result=fromMarkdown('```metric\nvalue: 3.1\nunit: %\nlabel: Churn\ndelta: -0.6 pts\ntrend: down\nsentiment: positive\n```\n');
  assert.deepEqual(result.findings.filter(item=>item.severity==='error'),[]);
  const metric={value:3.1,label:'Churn',unit:'%',delta:'-0.6 pts',trend:'down',sentiment:'positive'};
  assert.deepEqual(result.presentation.slides[0].metric,{value:3.1,label:'Churn',unit:'%',delta:'-0.6 pts',trend:'down',sentiment:'positive'});
  const {markdown}=toMarkdown({slides:[{metric}]});
  assert.match(markdown,/trend: down\nsentiment: positive\n/);
  assert.deepEqual(fromMarkdown(markdown).presentation.slides[0].metric,metric);
});

test('metric tables carry a Sentiment column and read it back; metric to text reports the loss',()=>{
  const metrics={blocks:[
    {metric:{value:3.1,label:'Churn',trend:'down',sentiment:'positive'}},
    {metric:{value:9,label:'Costs',trend:'up',sentiment:'negative'}},
    {metric:{value:1,label:'Flat',trend:'flat'}},
  ]};
  const table=convert(metrics,'table');
  assert.deepEqual(table.payload.table.columns,['Label','Value','Trend','Sentiment']);
  assert.deepEqual(table.payload.table.rows,[['Churn',3.1,'down','positive'],['Costs',9,'up','negative'],['Flat',1,'flat',null]]);
  assert.equal(table.lossless,true);
  const back=convert(table.payload,'metrics');
  assert.deepEqual(back.payload,metrics);assert.equal(back.lossless,true);
  const odd=convert({table:{columns:['Metric','Value','Mood'],rows:[['A',1,'good']]}},'metrics');
  assert.deepEqual(odd.loss,['column "Mood"']);
  const bad=convert({table:{columns:['Metric','Value','Sentiment'],rows:[['A',1,'good']]}},'metrics');
  assert.deepEqual(bad.payload.blocks,[{metric:{value:1,label:'A'}}]);
  assert.deepEqual(bad.loss,['sentiment values other than positive, negative or neutral']);
  assert.deepEqual(convert({metric:{value:3,trend:'down',sentiment:'positive'}},'text').loss,['metric trend','metric sentiment']);
  assert.deepEqual(convert({metric:{value:3,trend:'down'}},'text').loss,['metric trend']);
});
