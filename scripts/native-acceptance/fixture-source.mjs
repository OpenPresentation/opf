import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {primaryDecks} from './fixtures.mjs';

const fixture = name => new URL(`./fixtures/${name}`, import.meta.url);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const PRIMARY_CASE_NAMES = Object.freeze([
  'layout-title-auto','layout-media-regions','layout-empty-custom','table-save',
  'furniture-inherited','furniture-flags','list-description-native-edit','layout-bleed-card','picture-control',
  'chart-treemap-category','chart-histogram-single','chart-histogram-category',
  'chart-pareto-multi','chart-box-multi','chart-waterfall-single',
  'chart-funnel-category','chart-world-category','chart-all-seven',
  'feature-catalog-timeline','feature-dense-events','feature-custom-roadmap',
  'feature-long-labels','feature-metrics','feature-quote','feature-list','feature-table',
]);

export async function loadFixtureSource() {
  const imageBytes=await readFile(fixture('wide.png'));
  const chartBytes=await readFile(fixture('chartex-fallback-main.json'));
  const featureManifestBytes=await readFile(fixture('feature-inputs.json'));
  const chartFixture=JSON.parse(chartBytes), featureManifest=JSON.parse(featureManifestBytes);
  assert.deepEqual(Object.keys(chartFixture.decks),Object.keys(chartFixture.entries),'every chart has a reviewed archive entry');
  assert.equal(Object.keys(chartFixture.decks).length,9,'retain all nine chart fixtures');
  assert.equal(Object.keys(featureManifest).length,8,'retain all eight measured feature inputs');
  const image={src:`data:image/png;base64,${imageBytes.toString('base64')}`,alt:'Packet local picture'};
  const base={design:{fontScheme:'roboto',dimensions:{widthInches:13.333333,heightInches:7.5}}};
  const decks=primaryDecks(image,chartFixture,base);
  for(const [name,record] of Object.entries(featureManifest)) {
    assert.match(name,/^feature-[a-z0-9-]+$/);
    const bytes=await readFile(fixture(`features/${name}.opf.json`));
    assert.equal(sha256(bytes),record.candidateSHA256,`feature source changed: ${name}`);
    assert.ok(!Object.hasOwn(decks,name),`duplicate source case: ${name}`);
    decks[name]=JSON.parse(bytes);
  }
  assert.deepEqual(Object.keys(decks),PRIMARY_CASE_NAMES,'primary case set or order changed');
  return {decks,base,chartFixture,featureManifest,sourceFiles:[
    {path:'fixtures/wide.png',sha256:sha256(imageBytes)},
    {path:'fixtures/chartex-fallback-main.json',sha256:sha256(chartBytes)},
    {path:'fixtures/feature-inputs.json',sha256:sha256(featureManifestBytes)},
  ]};
}

export async function actionPlanFor(name) {
  assert.ok(PRIMARY_CASE_NAMES.includes(name),`unknown case: ${name}`);
  if(!['layout-title-auto','furniture-inherited','list-description-native-edit'].includes(name))return [];
  const actions=JSON.parse(await readFile(fixture(`actions/${name}.json`)));
  assert.ok(Array.isArray(actions)&&actions.length>0&&actions.length<=20,`invalid action count: ${name}`);
  return actions;
}
