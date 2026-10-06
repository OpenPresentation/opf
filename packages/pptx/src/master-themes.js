const decoder = new TextDecoder(), encoder = new TextEncoder();
const text = bytes => decoder.decode(bytes);

const THEME_TYPE = 'application/vnd.openxmlformats-officedocument.theme+xml';
const THEME_TARGET = /Target="\.\.\/theme\/(theme\d+\.xml)"/;
const NOTES_MASTER = /^ppt\/notesMasters\/notesMaster\d+\.xml$/;
const SLIDE_MASTER = /^ppt\/slideMasters\/slideMaster\d+\.xml$/;

const relsOf = path => path.replace(/([^/]+)$/, '_rels/$1.rels');

/**
 * FF-05 (font-fidelity-everywhere). PptxGenJS 4.0.1 points the notes master at the slide master's theme part (and
 * vendor-compat.js points pptxgenjs-plus's notes master back there, replacing its default Office notes theme)
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

const MASTER_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml';
const LAYOUT_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml';
const REL_MASTER = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster';
const RELATIONSHIP = /<Relationship\b[^>]*\/>/g;
const attribute = (xml, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(xml)?.[1];
const partNumber = (output, pattern) => Math.max(0, ...Object.keys(output).map(path => Number(pattern.exec(path)?.[1] ?? 0)));
const read = (output, path) => text(output[path][0]);
const write = (output, path, xml, options) => { output[path] = [encoder.encode(xml), options]; };

/**
 * opf-pptx#168 (FF-05). Slide runs name no East Asian / complex-script font (stripRunScriptFonts: PowerPoint lists an
 * explicit run `ea`/`cs` as an empty-name font), so a slide's script fonts reach PowerPoint only through the theme of
 * its slide master. `themes` and `assignment` come from planSlideThemes (script-fonts.js): theme 0 is the presentation
 * theme of slide master 1, and each further theme gets its own slide master, a copy of master 1 with a copy of its
 * layout, so the slides that select those script fonts are drawn with them while every other part stays as it was.
 *
 * Runs after giveNotesMastersOwnThemes (the notes master keeps its copy of the presentation theme) and before the
 * fonts-used list and the document provenance, which read the finished parts. With one theme nothing changes, so a
 * deck with a single script profile is byte-identical. New parts are numbered after the existing ones: slide masters
 * and layouts, themes (`1_<name>`, `2_<name>`, ... as PowerPoint names a second master's theme), master and layout ids
 * after the largest id in use, presentation relationship ids after the largest `rIdN`.
 */
export function giveSlidesScriptMasters(output, {themes, assignment}) {
  if (themes.length < 2) return;
  const presentation = 'ppt/presentation.xml', presentationRels = relsOf(presentation);
  const master = 'ppt/slideMasters/slideMaster1.xml', masterRels = relsOf(master);
  const masterRelsXml = read(output, masterRels);
  const layoutTarget = [...masterRelsXml.matchAll(RELATIONSHIP)].map(([node]) => node).filter(node => attribute(node, 'Type')?.endsWith('/slideLayout'));
  if (layoutTarget.length !== 1) throw new Error('Slide master 1 must have exactly one layout to copy for a script profile.');
  const layout = `ppt/slideLayouts/${attribute(layoutTarget[0], 'Target').replace(/^\.\.\/slideLayouts\//, '')}`, layoutRels = relsOf(layout);
  const theme = `ppt/theme/${THEME_TARGET.exec(masterRelsXml)?.[1]}`;
  if (!output[layout] || !output[layoutRels] || !output[theme]) throw new Error('Slide master 1, its layout and its theme must exist.');
  const options = output[master][1];
  let presentationXml = read(output, presentation), presentationRelsXml = read(output, presentationRels), types = read(output, '[Content_Types].xml');
  const ids = [...presentationXml.matchAll(/<p:sldMasterId\b[^>]*\bid="(\d+)"/g), ...Object.keys(output).filter(path => SLIDE_MASTER.test(path))
    .flatMap(path => [...read(output, path).matchAll(/<p:sldLayoutId\b[^>]*\bid="(\d+)"/g)])].map(match => Number(match[1]));
  let nextId = Math.max(2147483647, ...ids) + 1;
  let nextRel = Math.max(0, ...[...presentationRelsXml.matchAll(/\bId="rId(\d+)"/g)].map(match => Number(match[1]))) + 1;
  let nextMaster = partNumber(output, /^ppt\/slideMasters\/slideMaster(\d+)\.xml$/) + 1;
  let nextLayout = partNumber(output, /^ppt\/slideLayouts\/slideLayout(\d+)\.xml$/) + 1;
  let nextTheme = partNumber(output, /^ppt\/theme\/theme(\d+)\.xml$/) + 1;
  const layoutFor = [layout];
  let masterIds = '', overrides = '';
  themes.forEach((themeXml, index) => {
    if (index === 0) return;
    const masterName = `slideMaster${nextMaster++}.xml`, layoutName = `slideLayout${nextLayout++}.xml`, themeName = `theme${nextTheme++}.xml`;
    const masterId = nextId++, layoutId = nextId++, relId = `rId${nextRel++}`;
    write(output, `ppt/theme/${themeName}`, themeXml.replace(/(<a:theme\b[^>]*\bname=")([^"]*)"/, (match, open, name) => `${open}${index}_${name}"`), output[theme][1]);
    write(output, `ppt/slideMasters/${masterName}`, read(output, master).replace(/<p:sldLayoutIdLst>[\s\S]*?<\/p:sldLayoutIdLst>/,
      list => list.replace(/(<p:sldLayoutId\b[^>]*\bid=")\d+"/, (match, open) => `${open}${layoutId}"`)), options);
    write(output, `ppt/slideMasters/_rels/${masterName}.rels`, masterRelsXml.replace(RELATIONSHIP, node => {
      const type = attribute(node, 'Type') ?? '';
      if (type.endsWith('/slideLayout')) return node.replace(/\sTarget="[^"]*"/, ` Target="../slideLayouts/${layoutName}"`);
      if (type.endsWith('/theme')) return node.replace(/\sTarget="[^"]*"/, ` Target="../theme/${themeName}"`);
      return node;
    }), output[masterRels][1]);
    write(output, `ppt/slideLayouts/${layoutName}`, read(output, layout), output[layout][1]);
    write(output, `ppt/slideLayouts/_rels/${layoutName}.rels`, read(output, layoutRels).replace(RELATIONSHIP, node =>
      attribute(node, 'Type') === REL_MASTER ? node.replace(/\sTarget="[^"]*"/, ` Target="../slideMasters/${masterName}"`) : node), output[layoutRels][1]);
    masterIds += `<p:sldMasterId id="${masterId}" r:id="${relId}"/>`;
    presentationRelsXml = presentationRelsXml.replace('</Relationships>', `<Relationship Id="${relId}" Type="${REL_MASTER}" Target="slideMasters/${masterName}"/></Relationships>`);
    overrides += `<Override PartName="/ppt/slideMasters/${masterName}" ContentType="${MASTER_TYPE}"/><Override PartName="/ppt/slideLayouts/${layoutName}" ContentType="${LAYOUT_TYPE}"/><Override PartName="/ppt/theme/${themeName}" ContentType="${THEME_TYPE}"/>`;
    layoutFor.push(`ppt/slideLayouts/${layoutName}`);
  });
  if (!presentationXml.includes('</p:sldMasterIdLst>')) throw new Error('The presentation has no slide master list.');
  presentationXml = presentationXml.replace('</p:sldMasterIdLst>', `${masterIds}</p:sldMasterIdLst>`);
  write(output, presentation, presentationXml, output[presentation][1]);
  write(output, presentationRels, presentationRelsXml, output[presentationRels][1]);
  write(output, '[Content_Types].xml', types.replace('</Types>', `${overrides}</Types>`), output['[Content_Types].xml'][1]);
  // Each slide's layout relationship points at the layout of its theme's master.
  const slides = [...presentationXml.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)].map(match => {
    const node = [...presentationRelsXml.matchAll(RELATIONSHIP)].map(([rel]) => rel).find(rel => attribute(rel, 'Id') === match[1]);
    return `ppt/${attribute(node ?? '', 'Target')}`;
  });
  assignment.forEach((index, slideIndex) => {
    if (!index) return;
    const slide = slides[slideIndex], rels = slide && relsOf(slide);
    if (!rels || !output[rels]) throw new Error(`Slide ${slideIndex + 1} has no relationships to point at its slide layout.`);
    const target = layoutFor[index].replace(/^ppt\/slideLayouts\//, '../slideLayouts/');
    write(output, rels, read(output, rels).replace(RELATIONSHIP, node => attribute(node, 'Type')?.endsWith('/slideLayout') ? node.replace(/\sTarget="[^"]*"/, ` Target="${target}"`) : node), output[rels][1]);
  });
}
