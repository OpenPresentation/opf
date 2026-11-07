import fs from 'fs';
import {pathToFileURL} from 'node:url';
const {toPng}=await import(pathToFileURL('C:/opf-work/lh-184-columns/packages/render/dist/index.js').href);
const mainKeys=JSON.parse(fs.readFileSync('C:/opf-work/lh-184-review/keys.json','utf8')),keys=JSON.parse(fs.readFileSync('C:/opf-work/lh-184-sheets/v2/keys.json','utf8'));
const pad=n=>String(n).padStart(2,'0'),img=f=>`data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
for(let off=0,sheetNo=0;off<keys.length;off+=6,sheetNo++){const part=keys.slice(off,off+6);
 const cells=part.map((k,i)=>{const y=i*300;const b=`C:/opf-work/lh-184-review/before/${pad(mainKeys.indexOf(k))}.png`,a=`C:/opf-work/lh-184-sheets/v2/after/${pad(keys.indexOf(k))}.png`;
  return `<image x="0" y="${y}" width="480" height="270" href="${img(b)}"/><image x="490" y="${y}" width="480" height="270" href="${img(a)}"/><text x="4" y="${y+288}" font-size="14" font-family="Roboto">${k} (before | after)</text>`}).join('');
 fs.writeFileSync(`C:/opf-work/lh-184-sheets/v2/sheet-${sheetNo}.png`,await toPng(`<svg xmlns="http://www.w3.org/2000/svg" width="970" height="${part.length*300}"><rect width="100%" height="100%" fill="#e5e5e5"/>${cells}</svg>`));}
