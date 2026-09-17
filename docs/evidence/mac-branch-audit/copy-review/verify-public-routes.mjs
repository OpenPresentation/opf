import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve(process.cwd(),'package.json'));
const {chromium,expect}=require('@playwright/test');
const base=process.argv[2]??'http://127.0.0.1:4325',out=process.argv[3]??'/private/tmp/opf-copy-browser';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();
const context=await browser.newContext();
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const local=new URL(base).hostname==='127.0.0.1';
const report={base,node:process.version,viewports:[],links:[],routes:[],deferredUntilConfiguredPreview:[]};
try {
 if(process.env.OPF_PREVIEW_ACCESS_FILE){await page.goto((await fs.readFile(process.env.OPF_PREVIEW_ACCESS_FILE,'utf8')).trim());await page.goto(base);}
 for(const width of [1440,1024,768,390]){
  await page.setViewportSize({width,height:1000});
  const response=await page.goto(base);assert(response.ok());
  await page.locator('h1').waitFor();await page.evaluate(()=>document.fonts.ready);
  if(width<1024)await page.getByRole('button',{name:'Open menu',exact:true}).click();
  const links=await page.locator('header a:visible').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent.trim(),href:n.getAttribute('href'),box:n.getBoundingClientRect().toJSON()})));
  for(const label of ['Author','Inspector','Decoder'])assert(links.some(x=>x.text===label),`${width}: ${label}`);
  assert.deepEqual(links.filter(x=>['Author','Inspector','Decoder'].includes(x.text)).map(x=>x.text),['Author','Inspector','Decoder']);
  for(const link of links) assert(link.box.x>=0&&link.box.right<=width+1,JSON.stringify({width,link}));
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),{timeout:2000}).toBeLessThanOrEqual(1);

  if(width<1024){await page.screenshot({path:`${out}/menu-${width}.png`});await page.getByRole('button',{name:'Close menu',exact:true}).click();}
  await page.locator('section[aria-labelledby="surfaces-heading"]').screenshot({path:`${out}/surfaces-${width}.png`});
  report.viewports.push({width,links:links.map(({text,href})=>({text,href})),overflow:false});
 }
 await page.goto(base);
 const hrefs=await page.locator('header a, footer a, section[aria-labelledby="surfaces-heading"] a').evaluateAll(nodes=>[...new Set(nodes.map(n=>n.getAttribute('href')).filter(h=>h?.startsWith('/')&&!h.startsWith('/sign-')))]);
 for(const href of hrefs){if(local&&!['/','/author','/inspector','/docs/opf-toolkit'].includes(href)){report.deferredUntilConfiguredPreview.push(href);continue;}const response=await context.request.get(base+href);assert(response.ok(),`${href}: ${response.status()}`);report.links.push({href,status:response.status()});}
 for(const route of (local?['/author','/inspector']:['/author','/inspector','/decoder'])){
  await page.goto(base+route);await page.locator('link[rel="canonical"]').waitFor({state:'attached'});
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),'https://www.pptx.dev'+route);
  assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'),'https://www.pptx.dev'+route);
  report.routes.push({route,canonical:'https://www.pptx.dev'+route});
 }
 for(const [from,to]of [['/playground','/inspector'],['/studio','/author']]){
  const response=await context.request.get(base+from,{maxRedirects:0});assert.equal(response.status(),308);assert.equal(new URL(response.headers().location,base).pathname,to);
  await page.goto(base+from);assert.equal(new URL(page.url()).pathname,to);report.routes.push({from,to,status:308});
 }
 if(!local){const sitemap=await(await context.request.get(base+'/sitemap.xml')).text();for(const route of ['author','inspector','decoder'])assert(sitemap.includes('https://www.pptx.dev/'+route));
 const llms=await(await context.request.get(base+'/llms.txt')).text();assert(llms.includes('without sign-in'));assert(llms.includes('signed-in hosted PPTX'));assert(llms.includes('docs/opf-toolkit'));}
 assert.deepEqual(errors,[]);report.errors=errors;report.passed=true;
}finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report));
