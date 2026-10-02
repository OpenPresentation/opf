const decoder = new TextDecoder(), encoder = new TextEncoder();
const text = bytes => decoder.decode(bytes);

const THEME_TYPE = 'application/vnd.openxmlformats-officedocument.theme+xml';
const THEME_TARGET = /Target="\.\.\/theme\/(theme\d+\.xml)"/;
const NOTES_MASTER = /^ppt\/notesMasters\/notesMaster\d+\.xml$/;
const SLIDE_MASTER = /^ppt\/slideMasters\/slideMaster\d+\.xml$/;

const relsOf = path => path.replace(/([^/]+)$/, '_rels/$1.rels');

/**
 * FF-05 (font-fidelity-everywhere). PptxGenJS 4.0.1 points the notes master at the slide master's theme part
 * (`ppt/theme/theme1.xml`). Every master owns its theme part in a PowerPoint package (theme1 for the slide master,
 * theme2 for the notes master, theme3 for a handout master), and PowerPoint refuses to read a package whose notes
 * master it recognises when that master shares the slide theme ("The file or directory is corrupted and unreadable",
 * 0x80070570). The vendored `p:notesMasterIdLst` sits after `p:sldIdLst` (see presentationInSchemaOrder in index.js),
 * which PowerPoint ignored; it then synthesised a default notes master with the default Office theme, and that
 * made the default font (Aptos) appear in Presentation.Fonts although no part names it.
 *
 * Each notes master that shares a theme part with another master gets its own copy of that theme, with the same
 * fonts, colours and format scheme, a relationship to it and a content-type override. The copy is taken after
 * every theme rewrite, so it carries the deck's final fonts. Copies are numbered after the existing themes.
 */
export function giveNotesMastersOwnThemes(output) {
  const types = output['[Content_Types].xml'];
  if (!types) return;
  const used = new Set();
  const themeOf = master => THEME_TARGET.exec(text(output[relsOf(master)]?.[0] ?? new Uint8Array()))?.[1];
  for (const master of Object.keys(output).filter(path => SLIDE_MASTER.test(path))) {
    const theme = themeOf(master);
    if (theme) used.add(theme);
  }
  let next = Math.max(0, ...Object.keys(output).map(path => Number(/^ppt\/theme\/theme(\d+)\.xml$/.exec(path)?.[1] ?? 0))) + 1;
  let overrides = '';
  for (const master of Object.keys(output).filter(path => NOTES_MASTER.test(path)).sort()) {
    const theme = themeOf(master);
    if (!theme) continue;
    if (!used.has(theme)) { used.add(theme); continue; }
    const source = output[`ppt/theme/${theme}`];
    if (!source) continue;
    const name = `theme${next++}.xml`;
    output[`ppt/theme/${name}`] = [source[0], source[1]];
    const rels = relsOf(master);
    output[rels] = [encoder.encode(text(output[rels][0]).replace(THEME_TARGET, `Target="../theme/${name}"`)), output[rels][1]];
    overrides += `<Override PartName="/ppt/theme/${name}" ContentType="${THEME_TYPE}"/>`;
    used.add(name);
  }
  if (overrides) output['[Content_Types].xml'] = [encoder.encode(text(types[0]).replace('</Types>', `${overrides}</Types>`)), types[1]];
}
