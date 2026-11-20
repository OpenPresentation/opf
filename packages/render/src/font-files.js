// Same deterministic file/directory loading for PDF and raster outline compatibility.
// No static Node dependency: SVG/edge/browser module graphs remain safe.
export async function loadFontFiles(library,files,directories,diagnostic=()=>{},onFace) {
    // Font files are Node-only. A browser host passes no paths: its faces come from the SVG's @font-face data or `fontData`.
    if (!files.length && !directories.length) return;
    const { readdir, readFile, stat: fsStat, path } = await nodeFileSystem();
    const seen = new Set();
    const read = async (file) => {
      const resolved = path.resolve(file);
      if (seen.has(resolved)) return;
      seen.add(resolved);
      try {
        const stat = await fsStat(resolved);
        const face=await library.addFile(resolved, stat, () => readFile(resolved));
        if(face)onFace?.(face);
      } catch (error) {
        diagnostic({ code: "pdf-font-unreadable", message: `Font file ${resolved} could not be read: ${error.code ?? error.message}.`, origin: resolved });
      }
    };
    for (const directory of directories) {
      for (const file of await listFonts(directory, { readdir, path })) await read(file);
    }
    for (const file of files) await read(file);
}

async function listFonts(directory, { readdir, path }) {
  const found = [];
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch { return found; }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await listFonts(full, { readdir, path }));
    else if (/\.(ttf|otf)$/i.test(entry.name)) found.push(full);
  }
  return found;
}

async function nodeFileSystem() {
  const fsName="node:fs/promises",pathName="node:path";
  const [fs,path]=await Promise.all([import(/* webpackIgnore: true */ /* @vite-ignore */ fsName),import(/* webpackIgnore: true */ /* @vite-ignore */ pathName)]);
  return {readdir:fs.readdir,readFile:fs.readFile,stat:fs.stat,path:path.default??path};
}
