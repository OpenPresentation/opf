import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createFontRegistry } from "./fonts.js";
const require = createRequire(import.meta.url);
/** Bundled, openly licensed faces. No system font discovery or network requests. */
export async function loadBundledFontRegistry(options = {}) {
  const definitions = [
    ["roboto","400Regular","Roboto_400Regular",400,false],
    ["roboto","500Medium","Roboto_500Medium",500,false],
    ["roboto","600SemiBold","Roboto_600SemiBold",600,false],
    ["roboto","700Bold","Roboto_700Bold",700,false],
    ["roboto","800ExtraBold","Roboto_800ExtraBold",800,false],
    ["roboto","400Regular_Italic","Roboto_400Regular_Italic",400,true],
    ["roboto","700Bold_Italic","Roboto_700Bold_Italic",700,true],
    ["roboto-mono","400Regular","RobotoMono_400Regular",400,false],
    ["roboto-mono","700Bold","RobotoMono_700Bold",700,false],
  ];
  const licenses = Object.fromEntries(await Promise.all(["roboto","roboto-mono"].map(async pkg=>[pkg,await readFile(require.resolve(`@expo-google-fonts/${pkg}/LICENSE_FONT`),"utf8")])));
  const fontFiles = definitions.map(([pkg,directory,name])=>require.resolve(`@expo-google-fonts/${pkg}/${directory}/${name}.ttf`));
  const entries = await Promise.all(definitions.map(async ([pkg,,,weight,italic],index)=>({license:licenses[pkg],data:new Uint8Array(await readFile(fontFiles[index])),weight,italic})));
  return Object.assign(createFontRegistry(entries,options),{fontFiles});
}

/** Six pinned open-source Office substitutes, optionally alongside the base Roboto pack. */
export async function loadOfficeFontRegistry(options = {}) {
  const packages = ["carlito","caladea","arimo","tinos","cousine","gelasio"];
  const styles = [["400Regular",400,false],["400Regular_Italic",400,true],["700Bold",700,false],["700Bold_Italic",700,true]];
  const entries = [], fontFiles = [];
  for (const pkg of packages) {
    const name = pkg[0].toUpperCase()+pkg.slice(1);
    const license = await readFile(require.resolve(`@expo-google-fonts/${pkg}/LICENSE_FONT`),"utf8");
    for (const [directory,weight,italic] of styles) {
      const path = require.resolve(`@expo-google-fonts/${pkg}/${directory}/${name}_${directory}.ttf`);
      fontFiles.push(path);
      entries.push({data:new Uint8Array(await readFile(path)),weight,italic,license});
    }
  }
  if (options.includeBaseFonts !== false) {
    const base = await loadBundledFontRegistry();
    fontFiles.push(...base.fontFiles);
    for (const face of base.embeddedFonts) entries.push({...face,data:Uint8Array.from(Buffer.from(face.dataUrl.split(",")[1],"base64"))});
  }
  return Object.assign(createFontRegistry(entries,{substitutionPolicy:"metric",...options}),{fontFiles});
}
