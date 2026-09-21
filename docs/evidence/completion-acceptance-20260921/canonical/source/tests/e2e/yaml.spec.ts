import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('YAML and Markdown editing preserve OPF values and recover from malformed YAML offline',async({page})=>{
 const errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/inspector');
 const input=page.getByRole('textbox',{name:'Editor content'});
 await expect(input).toBeVisible();
 const doc={name:'2026-09-09',slides:[{title:'yes',text:'  \nPreserve café العربية 日本語\n\n'}]};
 const replace=async(text:string)=>{await input.focus();await page.keyboard.press('ControlOrMeta+a');await page.evaluate(value=>navigator.clipboard.writeText(value),text);await page.keyboard.press('ControlOrMeta+v');};
 // The renderer's font alert does not prove Monaco's lazy JSON worker is ready.
 // Require an actual schema diagnostic before disconnecting, then restore the
 // source fixture and wait for that diagnostic to clear.
 const diagnostics=page.locator('.monaco-editor').first().locator('.squiggly-error, .squiggly-warning');
 await replace('{"name":42,"slides":[]}');
 await expect(diagnostics).not.toHaveCount(0);
 await replace(JSON.stringify(doc));
 await expect(diagnostics).toHaveCount(0);
 // Serialization must preserve scripts that the selected default font cannot
 // render. Keep that rendering limit visible rather than replacing the content.
 await expect(page.getByRole('alert').filter({hasText:"Font 'Carlito' cannot display U+627."})).toBeVisible({timeout:20000});
 await page.context().setOffline(true);
 for(const format of ['YAML','MD','JSON']){
  await page.getByRole('tab',{name:format,exact:true}).click();
  await expect(page.getByRole('tab',{name:format,exact:true})).toHaveAttribute('aria-selected','true');
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'json',exact:true}).click();
  const download=await pending;
  expect(download.suggestedFilename()).toMatch(/\.opf\.json$/);
  expect(await download.failure()).toBeNull();
  expect(JSON.parse(await readFile((await download.path())!,'utf8'))).toEqual(doc);
 }
 await page.getByRole('tab',{name:'YAML',exact:true}).click();
 await replace('name: [');
 await page.getByRole('tab',{name:'JSON',exact:true}).click();
 await expect(page.getByText('Format error',{exact:true})).toBeVisible();
 await expect(page.getByRole('tab',{name:'YAML',exact:true})).toHaveAttribute('aria-selected','true');
 await replace('name: Recovered\nslides:\n  - title: Recovery');
 await page.getByRole('tab',{name:'JSON',exact:true}).click();
 await expect(page.getByText('Schema clean',{exact:true})).toBeVisible();
 await expect(page.getByRole('group',{name:'Slide 1: Recovery',exact:true}).locator('svg')).toBeVisible({timeout:20000});
 await page.getByRole('tab',{name:'MD',exact:true}).click();
 await replace('---\n# Comment-only frontmatter\n\n  # Keep the slide below\n---\n## {title="Retained body" text="Some content."}\n');
 await page.getByRole('tab',{name:'JSON',exact:true}).click();
 await expect(page.getByRole('tab',{name:'JSON',exact:true})).toHaveAttribute('aria-selected','true');
 await expect(page.getByText('Schema clean',{exact:true})).toBeVisible();
 await expect(page.getByRole('group',{name:'Slide 1: Retained body',exact:true}).locator('svg')).toBeVisible({timeout:20000});
 const pending=page.waitForEvent('download');
 await page.getByRole('button',{name:'json',exact:true}).click();
 const download=await pending;
 expect(await download.failure()).toBeNull();
 expect(JSON.parse(await readFile((await download.path())!,'utf8'))).toEqual({slides:[{title:'Retained body',text:'Some content.'}]});
 expect(errors).toEqual([]);
});
