import {readFileSync, writeFileSync} from 'node:fs';
const p = process.argv[2];
let s = readFileSync(p, 'utf8');
const swap = (a, b) => { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 80)); s = s.replace(a, b); };
swap(`import {addArrangements,attachArrangementTags,attachSmartArt,exportPaint,importArrangementShapes,importSmartArt,writeArrangementAdjustments} from './smart-art.js';`,
`import {addArrangements,attachArrangementTags,attachSmartArt,attachSmartArtFallbacks,exportPaint,importArrangementShapes,importSmartArt,importSmartArtFallbacks,smartArtRegionSvg,smartArtSlideSvg,writeArrangementAdjustments} from './smart-art.js';`);
swap(`  const liveArrangements = addArrangements(slide, geometry.arrangements, {context: {...slideContext, direction: geometry.direction, deckLang: context.deckLang}, mode: context.smartArtMode, items: geometry.items, slideIndex,
    records: context.smartArt, tags: context.arrangementTags, smartArtTags: context.smartArtTags, provenance: context.provenanceMode, report: options.onDiagnostic, fontOf: nativeFontOptions});`,
`  // SH-16: each live frame's fallback picture is cut from this slide's preview, drawn once.
  let preview;
  const liveArrangements = await addArrangements(slide, geometry.arrangements, {context: {...slideContext, direction: geometry.direction, deckLang: context.deckLang}, mode: context.smartArtMode, items: geometry.items, slideIndex,
    records: context.smartArt, tags: context.arrangementTags, smartArtTags: context.smartArtTags, provenance: context.provenanceMode, report: options.onDiagnostic, fontOf: nativeFontOptions,
    fallback: (arrangement, picture) => smartArtFallback(slide, arrangement, picture, () => (preview ??= smartArtSlideSvg(presentation, slideIndex + 1, options)), context, options)});`);
swap(`// SH-07: a diagram as one group of native shapes (src/diagram-shapes.js)`,
`// SH-16: the fallback picture of a live SmartArt frame, for every app that does not lay SmartArt out: OPF's preview of the frame
// (smartArtRegionSvg of the slide's preview) as an SVG picture over its PNG raster, the diagram picture's path (resolveSvgImage, 192 dpi
// of the frame). Returns the function that places it after the frame's placeholder, or why it cannot be drawn (the arrangement is then
// native shapes, smartart-unavailable).
async function smartArtFallback(slide, arrangement, {name, alt}, preview, context, options) {
  const {frame} = arrangement, box = {x: frame.x / 96, y: frame.y / 96, w: frame.width / 96, h: frame.height / 96};
  const unavailable = reason => \`no fallback picture can be drawn for apps without SmartArt (\${reason})\`;
  let svg;
  try {
    svg = smartArtRegionSvg(await preview(), arrangement);
  } catch (error) {
    return unavailable(error?.code === 'ERR_MODULE_NOT_FOUND' ? 'it needs the optional peer @openpresentation/opf-render' : errorMessage(error));
  }
  const outcome = {box}, problems = [];
  const resolved = await resolveSvgImage(encodeText(svg), {...options, strictAssets: false, onDiagnostic: entry => problems.push(entry)}, arrangement.path, outcome);
  if (!resolved) return unavailable(problems.find(entry => entry.code === 'unresolved-asset')?.message.replace(/ The image exports as the unavailable-image placeholder\.$/, '') ?? 'its SVG could not be drawn');
  return () => {
    context.svgPictures.set(name, outcome.svg);
    slide.addImage({...resolved, objectName: name, ...box, altText: alt});
  };
}

// SH-07: a diagram as one group of native shapes (src/diagram-shapes.js)`);
swap(`  const svgSizes = attachSvgPictures(entries, context.svgPictures);
`, `  const svgSizes = attachSvgPictures(entries, context.svgPictures);
  // SH-16: each SmartArt fallback picture takes its frame's name, id and outline, and its OPF_SMARTART_V1 record in full provenance.
  try {
    attachSmartArtFallbacks(entries, context.smartArt, parseRelationships);
  } catch (error) {
    throw new OPFPptxError("packaging-failed", \`SmartArt fallback pictures could not be attached: \${errorMessage(error)}\`);
  }
`);
// Import: the wrapped frame (mc:Choice) and a surviving fallback picture.
swap(`  for (const [alternateIndex, alternate] of asArray(tree?.["mc:AlternateContent"]).entries()) {
    const choice = asArray(alternate?.["mc:Choice"]).map((node) => node?.["p:graphicFrame"]).find(Boolean);
    const fallback = asArray(alternate?.["mc:Fallback"]).map((node) => node?.["p:graphicFrame"]).find(Boolean);`,
`  for (const [alternateIndex, alternate] of asArray(tree?.["mc:AlternateContent"]).entries()) {
    const choice = asArray(alternate?.["mc:Choice"]).map((node) => node?.["p:graphicFrame"]).find(Boolean);
    // SH-16: a SmartArt frame wrapped with its fallback picture is read from the mc:Choice, as an unwrapped frame (SH-09).
    const wrapped = choice ? importSmartArt({frames: [choice], relationships, entries, slideIndex, report: diagnostic => options.onDiagnostic?.(diagnostic)}).get(0) : undefined;
    if (wrapped) {
      roles.set(\`alt:\${alternateIndex}\`, 'smartart');
      if (!nativeContext.layoutTag && nativeContext.smartArtLayout === undefined) nativeContext.smartArtLayout = wrapped.layout;
      items.push({kind: 'list', bounds: shapeBounds(choice['p:xfrm']), payload: wrapped.payload, sources: [\`alt:\${alternateIndex}\`]});
      continue;
    }
    const fallback = asArray(alternate?.["mc:Fallback"]).map((node) => node?.["p:graphicFrame"]).find(Boolean);`);
swap(`  for (const [index, picture] of nativeContext.pictures.entries()) {
    const pictureRole = furniture.pictures.has(index)`,
`  // SH-16: a SmartArt's fallback picture without its frame (a file another app saved) is its list again, through its OPF_SMARTART_V1 record.
  const smartArtPictures = importSmartArtFallbacks({pictures: nativeContext.pictures, relationships, entries, slideIndex, report: diagnostic => options.onDiagnostic?.(diagnostic)});
  for (const [index, picture] of nativeContext.pictures.entries()) {
    if (smartArtPictures.has(index)) {
      const found = smartArtPictures.get(index);
      roles.set(\`pic:\${index}\`, 'smartart');
      if (!nativeContext.layoutTag && nativeContext.smartArtLayout === undefined) nativeContext.smartArtLayout = found.layout;
      items.push({kind: 'list', bounds: shapeBounds(picture['p:spPr']?.['a:xfrm']), payload: found.payload, sources: [\`pic:\${index}\`]});
      continue;
    }
    const pictureRole = furniture.pictures.has(index)`);
writeFileSync(p, s);
