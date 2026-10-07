import {nativeBodyReader, joinNativeParagraphs} from './body-text-import.js';
import {autoNumScheme, deriveListNumbering, withDisplayedNumbers} from './numbered-list.js';
import {isFaceStyleSuffix} from './font-weights.js';
import {importTableFrames} from './table-import.js';
import {applyChartFonts, applyPitchFamilies, finalizeFontsUsed, fontPitchFamilies} from './package-fonts.js';
import {giveNotesMastersOwnThemes, giveSlidesScriptMasters} from './master-themes.js';
import {legacyVendorOutput} from './vendor-compat.js';
import {readChartCategoryHeading,writeChartCategoryHeading,writeChartWorkbookFormats,repairChartWorkbookRanges} from './chart-workbook.js';
import {applyChartNumberFormats,chartNumber,excelCode,formattedColumns,inlineChartData,inlineTableData,isDatasetRef,numericRanges,resolveChartData} from './chart-data.js';
import {attachDataProvenance,chartDataRecord,chartEvidence,readDataTag,readDatasetsTag,restoreChartData,restoreTableData,tableDataRecord} from './data-provenance.js';
import {CHARTEX_FALLBACK,resolveChartType,chartTypeFromNative,applyChartConstruct,comboFromNative,NATIVE_CHART_ELEMENTS} from './chart-types.js';
import {attachChartexParts,chartFromChartex,CHARTEX_GRAPHIC_DATA_URI} from './chartex.js';
import {applyChartAlt,readFrameAlt} from './chart-alt.js';
import {applyDataLabels,chartOptionsFromClassic,chartTargetFor,classicChartOptions,reportChartOptionDiagnostics,resolveChartOptionsFor} from './chart-options.js';
import {attachCodeTags, attachTextTags, codeManifest, importCodeGroups, nativeShapeParagraphs, nativeTextShapes} from './code-provenance.js';
import {attachMetricTags,metricManifest,importMetricGroups} from './metric-provenance.js';
import {attachCardTags,importCardFrames} from './card-provenance.js';
import {attachMediaTags,importMediaGroups,mediaCaption,mediaFrameRecord,mediaTextFingerprint} from './media-provenance.js';
// RR-34: captions and footnote areas as tagged text boxes; citation markers round-trip through the tags and the marker runs.
import {addCaption, addFootnotes} from './annotation-export.js';
import {attachAnnotationTags, captionValue, importAnnotations, restoreCitations} from './annotation-provenance.js';
import {attachHeadingTags,importHeadingGroups} from './heading-provenance.js';
import {headingValue,joinRichLines} from './rich-heading.js';
import {attachPlainTextTags,importPlainTextGroups} from './text-provenance.js';
import {attachTimelineTags,timelineManifest,importTimelineGroups} from './timeline-provenance.js';
import {attachQuoteTags,quoteManifest,importQuoteGroups,quotePhotoName} from './quote-provenance.js';
import {attachFurnitureTags, furnitureManifest, importFurniture, manifestPartIndex, staticDateFallback} from './furniture-provenance.js';
import {restoreRunColors} from './run-colors.js';
import {joinWrappedText} from './content-topology.js';
import {applyDocumentProvenance, attachDocumentProvenance, documentProvenance, recordContentTopology, restoreDocumentProvenance, joinAuthors, splitAuthors, slideListBreaks, DEFAULT_AUTHOR} from './document-provenance.js';
import {INVALID_XML_CHARACTER, nativeSections, writeSectionList} from './sections.js';
import {attachFurnitureFields, furniturePartFields, lineFields, nativeFieldType} from './furniture-fields.js';
import {attachNativePlaceholders, defaultPlaceholderGeometry, nativeDateText, nativeFurnitureParts, writeNativeMasters} from './native-furniture.js';
import {importImageOrientation} from './image-import.js';
import {extractSignals, normalizeSignalOptions, themeFactsFor} from './import-signals.js';
import {placeSlideImages, importSlideImage, slideImageName, slideImageOverlayName} from './slide-image-provenance.js';
import {dedupeMedia} from './media-dedupe.js';
import {placeWatermarks, importWatermark, importTextWatermark, tagTextWatermarks, watermarkName, watermarkTextName, watermarkBox, watermarkOpacity} from './watermark-provenance.js';
import {placeLogos, importLogo, importLogoPlaceholders, logoName, LOGO_TAG} from './logo-provenance.js';
import {nativeBackgroundFill, nativeImageBackgroundFill, nativePatternPreset} from './background.js';
import {importBackground} from './background-import.js';
import {chartHighlightPlan, applyChartHighlight} from './chart-highlight.js';
import {themeSlotColors, writeThemeColors, schemeColorValue, schemeBackgroundFill, schemeBackgroundValue, defaultTextSchemeValues, tableTextSchemeValue, solidColorXml, writeMasterBackground, inheritLayoutBackground, readThemeSlotColors, recoverColorScheme, recoverTheme, presentationThemePath} from './theme-colors.js';
import {languageDiagnostics, observeLanguage, observedRtl, partScriptFonts, physicalAlignment, planScriptFonts, planSlideThemes, reconcileLanguage, reportPerSlideNotesScriptFonts, runLanguageFonts, runLanguageTag, stripRunScriptFonts, themeEastAsianFromLatin} from './script-fonts.js';
import { webpToPng, svgToPng, readLocalFile } from '#image-fallback';
import { prepareSvg, svgDataUriBytes, svgRasterScale, svgBlipRelationship, attachSvgPictures } from './svg-image.js';
import { rasterMetadata, pictureTransform, normalizeImageOrientation } from './image-geometry.js';
import { layoutTable, composeSlide, fitText, fitRichText, textWidthMeasurer, resolveCanvasDimensions, resolveFontFamilies, resolveTextStyle, textColorForFill, chartColorForFill } from "@openpresentation/opf/composition";
// chartPaletteForFill ships with core RR-29 (opf#270); an older published core still loads and clamps each colour on its own.
import * as opfComposition from "@openpresentation/opf/composition";
import { colorContext, resolveColorRefValue, resolveExportColor, resolveVariableColors } from "./color-ref.js";
import PptxGenJS from "../vendor/pptxgenjs/pptxgen.es.js";
import { unzipSync, zipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";
import {
  catalogs as bundledCatalogs,
  validatePresentation
} from "@openpresentation/opf";
// Optional core exports (RR-07 syntax colours, trend marks) are read from the namespace so an older published core still loads.

// Optional core exports are read from the namespace so an older published core still loads;
// resolveVariables ships with core RR-32.
import * as opfCore from "@openpresentation/opf";

export {checkPptxTypefaces, inventoryPptxTypefaces, packageFontsUsed, THEME_SCRIPT_SUPPLEMENTS} from './typeface-inventory.js';
export {DEFAULT_SIGNAL_LIMITS, SIGNALS_VERSION, isMonospaceFamily} from './import-signals.js';

export const packageName = "@openpresentation/opf-pptx";

export const releaseLane = Object.freeze({
  githubRepository: "OpenPresentation/opf-pptx",
  npmPackage: "@openpresentation/opf-pptx",
  compatibilityPackage: "@openpresentation/opf",
  rendererPackage: "@openpresentation/opf-render"
});

export const runtimePolicy = Object.freeze({
  hostedServiceInCriticalPath: false,
  telemetry: false,
  commercialSdkInCriticalPath: false,
  requiredAiDependency: false,
  requiredLibreOfficeDependency: false,
  requiredNetworkCalls: false,
  deterministicLocalExecution: true
});

export class OPFPptxError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "OPFPptxError";
    this.code = code;
    this.details = details;
    if (details.issues) this.issues = details.issues;
    if (details.path) this.path = details.path;
  }
}

const FIXED_TIMESTAMP = "1980-01-01T00:00:00Z";
// fflate derives the DOS zip date from local-time fields, so build this from
// local components: a UTC instant rolls back to 1979 west of UTC (below
// fflate's 1980 floor) and would otherwise yield timezone-dependent bytes.
const FIXED_ZIP_DATE = new Date(1980, 0, 1, 0, 0, 0);
// Explicit stamps overwrite these fields after ZIP generation. Keep the
// temporary instant well inside fflate's range even if the host changes TZ.
const EXPLICIT_ZIP_SENTINEL = new Date('2000-01-01T12:00:00Z');
const DEFAULT_SEED = 0x4f504658;
const CANONICAL_SCHEMA = "https://openpresentation.org/schema/opf/v1";
const EMUS_PER_INCH = 914400;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "#text",
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: false
});
// Keep numeric character references (notably CR) in native core text. This is
// scoped to properties; the ordinary slide/relationship parser is unchanged.
const coreTextParser = new XMLParser({
  ignoreAttributes: false, attributeNamePrefix: "", textNodeName: "#text",
  parseAttributeValue: false, parseTagValue: false, trimValues: false, htmlEntities: true
});

const ROOT_PAYLOAD_FIELDS = [
  "text",
  "items",
  "bullets",
  "image",
  "video",
  "chart",
  "table",
  "code",
  "metric",
  "quote",
  "timeline"
];

const PROMOTED_REGION_KEYS = [
  "left",
  "center",
  "right",
  "left+center",
  "center+right",
  "left+center+right",
  "top",
  "middle",
  "bottom",
  "top+middle",
  "middle+bottom",
  "top+middle+bottom",
  "top:left",
  "top:center",
  "top:right",
  "top:left+center",
  "top:center+right",
  "top:left+center+right",
  "middle:left",
  "middle:center",
  "middle:right",
  "middle:left+center",
  "middle:center+right",
  "middle:left+center+right",
  "bottom:left",
  "bottom:center",
  "bottom:right",
  "bottom:left+center",
  "bottom:center+right",
  "bottom:left+center+right",
  "top+middle:left",
  "top+middle:center",
  "top+middle:right",
  "top+middle:left+center",
  "top+middle:center+right",
  "top+middle:left+center+right",
  "middle+bottom:left",
  "middle+bottom:center",
  "middle+bottom:right",
  "middle+bottom:left+center",
  "middle+bottom:center+right",
  "middle+bottom:left+center+right",
  "top+middle+bottom:left",
  "top+middle+bottom:center",
  "top+middle+bottom:right",
  "top+middle+bottom:left+center",
  "top+middle+bottom:center+right",
  "top+middle+bottom:left+center+right"
];

const DIMENSION_PRESETS = Object.freeze({
  widescreen: Object.freeze({ widthInches: 13.333333, heightInches: 7.5 }),
  "16:9": Object.freeze({ widthInches: 13.333333, heightInches: 7.5 }),
  standard: Object.freeze({ widthInches: 10, heightInches: 7.5 }),
  "4:3": Object.freeze({ widthInches: 10, heightInches: 7.5 }),
  "16:10": Object.freeze({ widthInches: 10, heightInches: 6.25 }),
  letter: Object.freeze({ widthInches: 11, heightInches: 8.5 }),
  "1:1": Object.freeze({ widthInches: 7.5, heightInches: 7.5 }),
  "4:5": Object.freeze({ widthInches: 7.5, heightInches: 9.375 }),
  "9:16": Object.freeze({ widthInches: 7.5, heightInches: 40 / 3 }),
  a4: Object.freeze({ widthInches: 11.69, heightInches: 8.27 })
});

const DEFAULTS = Object.freeze({
  theme: "minimal",
  colorScheme: "cool-horizon",
  // Shared last-resort font scheme (core DEFAULT_FONT_SCHEME): every engine uses aptos.
  fontScheme: "aptos"
});

const CHART_COLORS = [
  "2874A6",
  "1B4F72",
  "5499C7",
  "7BDBB2",
  "3AC67A",
  "24A89E",
  "F59E0B",
  "EF4444",
  "8B5CF6",
  "14B8A6",
  "0F172A",
  "64748B"
];

export async function toPptx(input, options = {}) {
  if (options.imageFormat !== undefined && !['compatible', 'preserve'].includes(options.imageFormat)) {
    throw new OPFPptxError('invalid-image-format', 'imageFormat must be compatible or preserve.', {path: 'options.imageFormat'});
  }
  if (options.provenance !== undefined && !['full', 'references-only', false].includes(options.provenance)) {
    throw new OPFPptxError('invalid-provenance-option', "provenance must be 'full', 'references-only' or false.", {path: 'options.provenance'});
  }
  const presentation = resolveTemplateInput(parseInput(input), options);
  assertValidBoundary(presentation);
  options = {...options, textMeasurement: chosenFamilyMeasurement(options.textMeasurement), svgRasters: new Map()};

  const context = resolvePresentationContext(presentation, {...options,textMeasurement:undefined});
  context.listMarkers = new Map();
  context.imagePlaceholders = new Map();
  context.tableHeaders = new Map();
  context.tableCells = new Map();
  context.imagePlacements = new Map();
  context.svgPictures = new Map();
  context.pictureText = new Map();
  context.slideImages = new Map();
  context.watermarks = new Map();
  context.textWatermarks = new Map();
  context.logos = new Map();
  context.logoPlaceholderTags = new Map();
  context.bulletImages = new Map();
  context.backgroundFills = new Map();
  context.notesWithCarriageReturns = new Map();
  context.cardTags = new Map();
  context.mediaTags = new Map();
  context.provenanceMode = options.provenance ?? "full";
  context.headingTags = new Map();
  context.plainTextTags = new Map();
  context.timelineTags = new Map();
  context.quoteTags = new Map();
  context.quotePhotos = new Map();
  context.furnitureTags = new Map();
  context.furnitureLogoTags = new Map();
  context.furnitureFields = new Map();
  context.furnitureManifests = new Map();
  context.nativeFurniture = new Map();
  context.hostDate = options.date;
  context.codeTags = new Map();
  context.captionTags = new Map();
  context.footnoteTags = new Map();
  context.metricTags = new Map();
  context.metricDescriptions = new Map();
  context.chartHeadings = new Map();
  context.chartAlts = new Map();
  context.chartFonts = new Map();
  context.chartPalettes = new Map();
  context.chartex = new Map();
  // RR-54: the authored data form of charts and tables (OPF_DATA_V1) and the datasets map (OPF_DATASETS_V1), `full` mode only.
  context.dataRecords = new Map();
  context.dataRecordPaths = new Map();
  context.datasets = presentation.datasets;
  context.reportDiagnostic = options.onDiagnostic;
  context.imageFormat = options.imageFormat ?? "compatible";
  // Chartex export mode (FF-22b): 'auto' (default) writes native chartex parts for the constructs the native PowerPoint
  // check confirmed (treemap, histogram, pareto, box-and-whisker, waterfall, funnel) and the clustered column fallback
  // for the unconfirmed map; 'native' writes every chartex part; 'fallback' writes clustered columns only.
  if (options.chartex !== undefined && !['auto', 'native', 'fallback'].includes(options.chartex)) {
    throw new OPFPptxError('invalid-chartex-mode', 'chartex must be auto, native or fallback.', {path: 'options.chartex'});
  }
  context.chartexMode = options.chartex ?? 'auto';
  Object.assign(context, exportTheme(presentation, context));
  context.reportedFontSchemes = new Set();
  // Document references and metadata tags (FF-32, docs/document-roundtrip.md).
  context.documentProvenance = options.provenance === false ? null : documentProvenance(presentation, {
    mode: options.provenance ?? "full",
    isCatalogId: (kind, id) => !!(findById(normalizeRecords(presentation.catalogs?.[kind]), id) ?? findById(defaultCatalog(kind), id)),
    report: diagnostic => options.onDiagnostic?.(diagnostic)
  });
  context.scriptFonts = planScriptFonts(presentation, options.onDiagnostic);
  // Slide section labels become PowerPoint's native section list (src/sections.js).
  // A label is an XML attribute: the characters text runs reject are rejected here too.
  context.sections = presentation.slides.map((slide, index) => {
    if (typeof slide.section !== 'string') return undefined;
    const invalid = INVALID_XML_CHARACTER.exec(slide.section);
    if (invalid) throw new OPFPptxError('invalid-text', `Text contains U+${invalid[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0')} at UTF-16 offset ${invalid.index}, which DrawingML XML cannot represent.`, {path: `slides.${index}.section`});
    return slide.section;
  });
  context.masterBackground = masterBackground(context);
  context.linkSentinels = linkSentinels(presentation);
  const pptx = new PptxGenJS();
  configurePresentation(pptx, presentation, {...context,fonts:resolveSlideContext(presentation,presentation.slides[0],context,options).fonts});

  for (let index = 0; index < presentation.slides.length; index += 1) {
    await addSlide(pptx, presentation, presentation.slides[index], index, context, options);
  }

  // FF-08: pitchFamily per exported family, from each slide's resolved scheme.
  context.fontPitch = fontPitchFamilies(presentation.slides.map((slide, index) => resolveSlideContext(presentation, slide, context, options, index).fonts),
    [...normalizeRecords(presentation.catalogs?.fontSchemes), ...defaultCatalog("fontSchemes")]);

  let raw;
  try {
    // The package is unzipped and re-zipped by normalizePptxZip, so the intermediate ZIP is stored uncompressed.
    raw = await withDeterministicRandom(context.seed, () => pptx.write({
      outputType: "uint8array"
    }));
  } catch (error) {
    throw new OPFPptxError("pptxgen-failed", "PPTX generation failed.", {
      cause: errorMessage(error)
    });
  }

  return normalizePptxZip(asUint8Array(raw), context);
}

export async function fromPptx(input, options = {}) {
  // Opt-in raw shape signals (import-signals.js). Validated first so a bad option fails before any work.
  const signalLimits = normalizeSignalOptions(options.signals, (code, message, details) => new OPFPptxError(code, message, details));
  const entries = readPptxZip(input);
  const presentationDoc = parseRequiredXml(entries, "ppt/presentation.xml");
  const presentationRoot = presentationDoc["p:presentation"];
  if (!presentationRoot) {
    throw new OPFPptxError("invalid-pptx", "PPTX is missing ppt/presentation.xml.");
  }

  const presentationRels = parseRelationships(entries, "ppt/presentation.xml");
  const slidePaths = resolveSlidePaths(entries, presentationRoot, presentationRels);
  if (slidePaths.length === 0) {
    throw new OPFPptxError("invalid-pptx", "PPTX does not contain any slides.");
  }

  const core = readCoreProperties(entries);
  const dimensions = dimensionsFromPresentation(presentationRoot);
  let imported = {
    $schema: options.schema ?? CANONICAL_SCHEMA,
    name: core.title || options.fallbackName || "Imported PPTX",
    slides: []
  };

  // FF-07: the language the runs carry. A stored FF-32 reference can still win below.
  const languageThemePath = presentationThemePath(presentationRoot, presentationRels, path => parseRelationships(entries, path), entries);
  // opf-pptx#168: each slide's theme, through its layout and master (several masters carry per-slide script fonts).
  const relatedPart = (path, type) => path ? [...parseRelationships(entries, path).values()].find(rel => rel.type?.endsWith(`/${type}`) && rel.path && entries[rel.path])?.path : undefined;
  const observedLanguage = observeLanguage({
    slides: slidePaths.map(path => decodeText(entries[path])),
    theme: languageThemePath && entries[languageThemePath] ? decodeText(entries[languageThemePath]) : null,
    themePath: languageThemePath,
    slideThemes: slidePaths.map(path => {
      const theme = relatedPart(relatedPart(relatedPart(path, 'slideLayout'), 'slideMaster'), 'theme');
      return theme ? {path: theme, xml: decodeText(entries[theme])} : null;
    }),
    catalogs: bundledCatalogs
  });
  if (observedLanguage.language !== undefined) imported.language = observedLanguage.language;
  if (core.description) imported.description = core.description;
  if (core.author) imported.author = splitAuthors(core.author);
  const themeDesign = importThemeDesign(entries, presentationRoot, presentationRels);
  const design = {...themeDesign.design, ...(dimensions ? {dimensions} : {})};
  if (Object.keys(design).length) imported.design = design;

  // Layouts and the master are read once however many slides inherit a placeholder from them (RR-11).
  const cached = read => { const memo = new Map(); return path => { if (!memo.has(path)) memo.set(path, read(path)); return memo.get(path); }; };
  const cachedRelationships = cached(path => parseRelationships(entries, path)), cachedPart = cached(path => parseOptionalXml(entries, path));
  const furnitureContexts = slidePaths.map((slidePath, index) => {
    const root = parseRequiredXml(entries, slidePath)['p:sld'];
    if (!root) throw new OPFPptxError('invalid-pptx', `PPTX slide is not a PresentationML slide: ${slidePath}.`, {path: slidePath});
    const tree = root['p:cSld']?.['p:spTree'], relationships = parseRelationships(entries, slidePath);
    return {root, relationships, shapes: nativeTextShapes(tree), pictures: nativePictures(tree),
      // RR-11: native footer placeholders resolve their position through the layout and master.
      path: slidePath, slideWidth: Number(presentationRoot['p:sldSz']?.cx), relationshipsOf: cachedRelationships, readPart: cachedPart,
      paragraphs: nativeShapeParagraphs(decodeText(entries[slidePath])),
      readPicture: picture => importPicture(entries, picture, slidePath, relationships,
        diagnostic => options.onDiagnostic?.({...diagnostic, path: `slides.${index}.design`}))};
  });
  const furniture = importFurniture(furnitureContexts, entries, options.onDiagnostic);
  if (Object.keys(furniture.design).length) imported.design = {...imported.design, ...furniture.design};
  if (furniture.organization) imported.organization = furniture.organization;
  if (furniture.speaker) imported.speaker = furniture.speaker;

  // RR-54: the datasets recorded at export (OPF_DATASETS_V1). Chart and table frames restore their dataset references against
  // them, so the document carries them before document provenance validates the restored document.
  const datasets = readDatasetsTag(entries, presentationRoot, presentationRels, options.onDiagnostic);
  const mediaRegistry = Object.create(null);
  for (let index = 0; index < slidePaths.length; index += 1) {
    furnitureContexts[index].mediaRegistry = mediaRegistry;
    imported.slides.push(importSlide(entries, slidePaths[index], index, dimensions, {...options, rtlDeck: observedRtl(observedLanguage), deckLang: observedLanguage.lang, codeFamily: Object.keys(entries).some(path => /^ppt\/tags\/opf/i.test(path)) ? importedCodeFamily(imported.design) : undefined, dataProvenance: {datasets}}, furniture.slides[index], furnitureContexts[index]));
  }
  if (datasets) imported.datasets = datasets;
  // Native sections (PowerPoint's own section list, `Default Section` = none)
  // are reconciled with the footer text and the stored value in restoreDocumentProvenance.
  const slideSections = nativeSections(presentationRoot, slideIdsInOrder(presentationRoot, presentationRels, entries, slidePaths));
  // A watermark carried identically by every slide is the deck's design.watermark.
  const carried = imported.slides.map(slide => slide.design?.watermark);
  if (carried.length && carried[0] && carried.every(value => JSON.stringify(value) === JSON.stringify(carried[0]))) {
    imported.design = {...imported.design, watermark: carried[0]};
    for (const slide of imported.slides) { delete slide.design.watermark; if (!Object.keys(slide.design).length) delete slide.design; }
  }
  // Conflicting media asset IDs fall back to their current native URLs during import.
  for (const context of furnitureContexts) for (const [id, asset] of Object.entries(context.mediaAssets ?? {})) if (!Object.hasOwn(imported.assets ?? {}, id)) imported.assets = {...imported.assets, [id]: asset};
  // Report after the slides so slide diagnostics keep their established order.
  // A theme name FF-24 could not verify is not reported when the stored reference restores the theme.
  for (const diagnostic of themeDesign.diagnostics) if (diagnostic.code !== "theme-unverified") options.onDiagnostic?.(diagnostic);

  // Catalog references, layout ids and authoring metadata recorded at export
  // (FF-32). Stored references win while the package still matches them;
  // otherwise the observed values (including FF-24's theme recovery) stay and
  // a diagnostic names the reference. A restored field that does not validate
  // is dropped on its own.
  const report = diagnostic => options.onDiagnostic?.(diagnostic);
  // Per slide: {layout, structure: 'match' | 'changed' | 'untagged', record, catalogRecord}.
  // Layout-structure recovery (FF-29) reads the stored OPF_SLIDE_V1 record from
  // here instead of writing a second slide tag.
  let slideProvenance = slidePaths.map(() => ({structure: "untagged"}));
  let restoredGroups = [];
  try {
    const restored = restoreDocumentProvenance(imported, {entries, presentationRoot, presentationRels, organizationConflict: furniture.organizationConflict === true, speakerConflict: furniture.speakerConflict === true,
      // Host catalogs format stored socials exactly as export did (FF-34).
      socialPlatformRecords: catalogs => socialPlatformRecords({catalogs}, options),
      nativeSections: slideSections,
      slides: slidePaths.map((path, index) => ({path, root: furnitureContexts[index].root, relationships: furnitureContexts[index].relationships, contentBounds: furnitureContexts[index].contentBounds}))}, report);
    // The stored language wins while the runs still carry its tag (FF-07).
    restored.groups = reconcileLanguage(restored.groups, observedLanguage, report);
    imported = applyDocumentProvenance(imported, restored, validatePresentation, report);
    slideProvenance = restored.slides;
    restoredGroups = restored.groups;
  } catch (error) {
    report({code: "invalid-document-provenance", path: "", message: `${errorMessage(error)} Ordinary import keeps the values observed in the PPTX.`});
  }
  if (slideProvenance.length !== imported.slides.length) throw new OPFPptxError("invalid-import-opf", "Slide provenance does not match the imported slides.");
  // RR-34: marker runs become cite/footnote on the runs before them, and the references list is rebuilt
  // from the stored record and the footnote boxes (an edited note keeps its edited text).
  restoreCitations(imported, furnitureContexts.map(context => context.annotations?.notes ?? []), report);
  restoreLogoFallback(imported, furnitureContexts);
  applyRunColors(imported, slideProvenance, restoredGroups, report, options);
  if (imported.design?.theme === undefined) for (const diagnostic of themeDesign.diagnostics) if (diagnostic.code === "theme-unverified") report(diagnostic);
  languageDiagnostics(imported, observedLanguage, options.onDiagnostic && report);

  const result = validatePresentation(imported);
  if (!result.valid) {
    throw new OPFPptxError("invalid-import-opf", "Imported PPTX did not produce valid OPF.", {
      issues: result.errors,
      result
    });
  }

  if (!signalLimits) return imported;
  // Where document provenance rebuilt the authored structure, flat block indexes map to their rebuilt paths.
  const contentPaths = slidePaths.map(() => null);
  for (const group of restoredGroups) if (group.applied && group.contentPaths?.paths) contentPaths[group.contentPaths.slide] = group.contentPaths.paths;
  const archive = {part: (path, parser) => parseRequiredXml(entries, path, parser), relationships: path => parseRelationships(entries, path), bytes: path => entries[path]};
  const signals = extractSignals({archive, presentationRoot, slidePaths, themeFacts: themeFactsFor(slidePaths[0], archive), limits: signalLimits,
    recorded: furnitureContexts.map(context => context.signalSources), slideProvenance, contentPaths});
  return {document: imported, signals};
}

// RR-08: run colours named by a ColorRef (variable, scheme slot, role) come back as that name where the document's own
// colour resolution still gives the run's colour; see run-colors.js.
function applyRunColors(imported, slideProvenance, restoredGroups, report, options) {
  const restoredContent = new Set(restoredGroups.filter(group => group.applied && group.contentPaths).map(group => group.contentPaths.slide));
  const info = slideProvenance.map((entry, index) => entry.structure === "untagged" ? undefined : {record: entry.record, structure: entry.structure === "match", content: restoredContent.has(index)});
  const contexts = new Map();
  const resolve = (slide, name) => {
    try {
      const key = slide.design ?? imported.design ?? null;
      if (!contexts.has(key)) contexts.set(key, resolvePresentationContext(slide.design ? {...imported, design: {...imported.design, ...slide.design}} : imported, options));
      return resolveColorRefValue(name, colorContext(contexts.get(key)));
    } catch {
      return undefined;
    }
  };
  restoreRunColors(imported.slides, info, resolve, report);
}

// A consumed logo picture (OPF_LOGO_V1) never becomes content. Its own image restores the logo only when nothing else
// did: the stored document and slide design (or the organization) win and carry LogoSet variants, so a package exported
// without provenance still keeps its logo. A slide-level logo path restores slide design; every other path the deck's.
function restoreLogoFallback(imported, contexts) {
  const organizations = asArray(imported.organization);
  contexts.forEach((context, index) => {
    const fallback = context.logoFallback;
    if (!fallback) return;
    const slide = imported.slides[index];
    const image = fallback.image;
    // A slide's own logo restores whenever the slide states none, whatever the deck logo is; the deck logo only
    // when neither it nor the organization has one.
    if (fallback.path.startsWith('slides.')) { if (slide.design?.logo === undefined) slide.design = {...slide.design, logo: image}; }
    else if (imported.design?.logo === undefined && !organizations.some(item => item?.logo !== undefined)) imported.design = {...imported.design, logo: image};
  });
}

function readPptxZip(input) {
  let bytes;
  if (input instanceof Uint8Array) {
    bytes = input;
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else {
    throw new OPFPptxError("invalid-input", "PPTX input must be a Uint8Array or ArrayBuffer.");
  }

  try {
    return unzipSync(bytes);
  } catch (error) {
    throw new OPFPptxError("invalid-pptx", "PPTX input is not a readable ZIP archive.", {
      cause: errorMessage(error)
    });
  }
}

function parseRequiredXml(entries, path, parser = xmlParser) {
  const bytes = entries[path];
  if (!bytes) {
    throw new OPFPptxError("invalid-pptx", `PPTX is missing ${path}.`, { path });
  }
  try {
    return parser.parse(decodeText(bytes));
  } catch (error) {
    throw new OPFPptxError("invalid-pptx", `PPTX XML part could not be parsed: ${path}.`, {
      path,
      cause: errorMessage(error)
    });
  }
}

function parseOptionalXml(entries, path) {
  if (!entries[path]) return null;
  return parseRequiredXml(entries, path);
}

function parseRelationships(entries, sourcePartPath) {
  const relsPath = relationshipsPathForPart(sourcePartPath);
  const doc = parseOptionalXml(entries, relsPath);
  const relationships = asArray(doc?.Relationships?.Relationship);
  const map = new Map();
  for (const relationship of relationships) {
    if (!relationship?.Id) continue;
    map.set(relationship.Id, {
      id: relationship.Id,
      type: relationship.Type ?? "",
      target: relationship.Target ?? "",
      targetMode: relationship.TargetMode ?? "Internal",
      path: resolveRelationshipTarget(sourcePartPath, relationship.Target ?? "")
    });
  }
  return map;
}

function relationshipsPathForPart(partPath) {
  const slash = partPath.lastIndexOf("/");
  const dir = slash >= 0 ? partPath.slice(0, slash + 1) : "";
  const file = slash >= 0 ? partPath.slice(slash + 1) : partPath;
  return `${dir}_rels/${file}.rels`;
}

function resolveRelationshipTarget(sourcePartPath, target) {
  if (!target || /^https?:\/\//i.test(target)) return target;
  const raw = target.startsWith("/")
    ? target.slice(1)
    : `${sourcePartPath.slice(0, sourcePartPath.lastIndexOf("/") + 1)}${target}`;
  const parts = [];
  for (const part of raw.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return parts.join("/");
}

function resolveSlidePaths(entries, presentationRoot, relationships) {
  const slideIds = asArray(presentationRoot["p:sldIdLst"]?.["p:sldId"]);
  const paths = [];
  for (const slideId of slideIds) {
    const relId = slideId?.["r:id"];
    const relationship = relationships.get(relId);
    if (relationship?.type.endsWith("/slide") && entries[relationship.path]) {
      paths.push(relationship.path);
    }
  }

  if (paths.length > 0) return paths;
  return Object.keys(entries)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort(compareSlidePaths);
}

// The `p:sldId` ids of the imported slides, aligned with `slidePaths`; empty
// when the slides were listed from the package rather than `p:sldIdLst`.
function slideIdsInOrder(presentationRoot, relationships, entries, slidePaths) {
  const ids = [];
  for (const slideId of asArray(presentationRoot["p:sldIdLst"]?.["p:sldId"])) {
    const relationship = relationships.get(slideId?.["r:id"]);
    if (relationship?.type.endsWith("/slide") && entries[relationship.path]) ids.push(String(slideId?.id ?? ""));
  }
  return ids.length === slidePaths.length ? ids : slidePaths.map(() => "");
}

function compareSlidePaths(left, right) {
  return slideNumber(left) - slideNumber(right) || (left < right ? -1 : left > right ? 1 : 0);
}

function slideNumber(path) {
  return Number(path.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
}

function readCoreProperties(entries) {
  const doc = entries["docProps/core.xml"] ? parseRequiredXml(entries, "docProps/core.xml", coreTextParser) : null;
  const core = doc?.["cp:coreProperties"] ?? {};
  return {
    title: scalarText(core["dc:title"]),
    description: scalarText(core["dc:description"] ?? core["dc:subject"]),
    author: scalarText(core["dc:creator"])
  };
}

// FA-13: the code family of the imported design's font scheme (a run in it is an inline code run). The scheme's own `code` role,
// else the bundled record's, else the shared fallback; heading and body families are never code. Only a package the exporter
// wrote (it carries OPF tag parts) is read this way; a deck from another tool keeps its runs' font families as they are.
function importedCodeFamily(design) {
  const reference = design?.fontScheme;
  const id = referenceId(reference);
  const base = (id && findById(defaultCatalog("fontSchemes"), id)) || findById(defaultCatalog("fontSchemes"), DEFAULTS.fontScheme);
  return resolveFontFamilies({...base, ...(isPlainObject(reference) ? reference : {})}).code;
}

function dimensionsFromPresentation(presentationRoot) {
  const size = presentationRoot["p:sldSz"];
  const width = emuToInches(size?.cx);
  const height = emuToInches(size?.cy);
  if (!width || !height) return null;
  return {
    widthInches: width,
    heightInches: height
  };
}

function importSlide(entries, slidePath, slideIndex, presentationDimensions, options, furniture, nativeContext) {
  const slideRoot = nativeContext.root;
  const relationships = nativeContext.relationships;
  const dimensions = presentationDimensions ?? DIMENSION_PRESETS.widescreen;
  const slide = {};
  if (slideRoot.show === "0") slide.hidden = true;

  const background = importBackground(slidePath, resolveCanvasDimensions(dimensions), {
    part: (path, parser) => parseRequiredXml(entries, path, parser), relationships: path => parseRelationships(entries, path), bytes: path => entries[path]
  }, diagnostic => options.onDiagnostic?.({...diagnostic, path: `slides.${slideIndex}.design.background`}));
  if (background) slide.design = {background};
  if (Object.keys(furniture.design).length) slide.design = {...slide.design, ...furniture.design};
  if (furniture.section !== undefined) slide.section = furniture.section;
  const slideImagePath = `slides.${slideIndex}.design.slideImage`;
  const slideImage = importSlideImage(nativeContext.pictures, nativeContext.shapes, relationships, entries, slideIndex,
    picture => importPicture(entries, picture, slidePath, relationships, diagnostic => {
      // The recorded crop/fit is re-derived from design.slideImage.
      if (diagnostic.code !== 'unsupported-image-crop') options.onDiagnostic?.({...diagnostic, path: slideImagePath});
    }),
    diagnostic => options.onDiagnostic?.({...diagnostic, path: slideImagePath}));
  if (slideImage.design) slide.design = {...slide.design, ...slideImage.design};
  if (slideImage.image) slide.image = slideImage.image;
  nativeContext.slideImagePictures = slideImage.consumed;
  nativeContext.slideImageShapes = slideImage.consumedShapes;
  const watermarkPath = `slides.${slideIndex}.design.watermark`;
  // FA-13: a text watermark is a tagged native text box; it is not content and never imports as a text block.
  const textWatermark = importTextWatermark(nativeContext.shapes, nativeContext.paragraphs.map(shapeParagraphs => shapeParagraphs.map(paragraph => ({text: paragraph.text}))), relationships, entries, slideIndex,
    diagnostic => options.onDiagnostic?.({...diagnostic, path: watermarkPath}));
  if (textWatermark.design) slide.design = {...slide.design, ...textWatermark.design};
  nativeContext.watermarkShapes = textWatermark.consumed;
  const watermark = importWatermark(nativeContext.pictures, relationships, entries, slideIndex,
    picture => importPicture(entries, picture, slidePath, relationships, diagnostic => {
      // The recorded fit is re-derived from design.watermark.
      if (diagnostic.code !== 'unsupported-image-crop') options.onDiagnostic?.({...diagnostic, path: watermarkPath});
    }),
    diagnostic => options.onDiagnostic?.({...diagnostic, path: watermarkPath}));
  if (watermark.design) slide.design = {...slide.design, ...watermark.design};
  nativeContext.watermarkPictures = watermark.consumed;
  // The generated deck logo picture is not content; its value returns from the stored design (or, without one, from the picture).
  const logoPath = `slides.${slideIndex}.design.logo`;
  const logo = importLogo(nativeContext.pictures, relationships, entries, slideIndex,
    picture => importPicture(entries, picture, slidePath, relationships, diagnostic => {
      if (diagnostic.code !== 'unsupported-image-crop') options.onDiagnostic?.({...diagnostic, path: logoPath});
    }),
    diagnostic => options.onDiagnostic?.({...diagnostic, path: logoPath}));
  nativeContext.logoPictures = logo.consumed;
  nativeContext.logoPlaceholderShapes = importLogoPlaceholders(nativeContext.shapes, relationships, entries, slideIndex);
  nativeContext.logoFallback = logo.fallback;

  const items = collectSlideItems(entries, slideRoot, slidePath, relationships, dimensions, options, slideIndex, furniture, nativeContext)
    .sort(comparePositionedItems);
  // Complete OPF heading roles are authoritative. Nearby body lines must not
  // fill an absent role by geometry; explicit native placeholders still apply.
  const inferHeadings = !items.some(item => item.heading||item.sourceText);
  const heading = field => {const index=items.findIndex(item=>item.heading===field);return index<0?null:items.splice(index,1)[0];};
  // FA-10: a heading is its plain text, or TextRun[] when its native runs are formatted differently from one another (the way
  // body text reads current native runs). A tagged line group brings its own value; one native shape (a title placeholder, or the
  // shape the importer took for the title) is read through the native body reader.
  const headingText = item => {
    const key = item.sources?.length === 1 ? /^sp:(\d+)$/.exec(item.sources[0]) : null;
    const parts = item.richText === undefined && key ? joinRichLines([{index: Number(key[1])}], nativeContext.readBody, () => '') : undefined;
    const value = item.richText ?? (parts ? headingValue(parts) : undefined);
    // Only when it reads as the same words as the plain path: the native text is authoritative.
    return Array.isArray(value) && value.map(run => typeof run === 'string' ? run : run.text).join('') === item.text ? value : item.text;
  };
  const tagItem=heading('tag');
  if(tagItem)slide.tag=headingText(tagItem);
  const titleItem = heading('title')??takeTitleItem(items, dimensions, inferHeadings);
  if (titleItem) slide.title = headingText(titleItem);
  const subtitleItem = heading('subtitle')??takeSubtitleItem(items, titleItem, dimensions, inferHeadings);
  if (subtitleItem) slide.subtitle = headingText(subtitleItem);

  // Heading inference keeps its existing scalar/native metrics. Only remaining
  // ordinary body shapes gain current rich values; tagged recovery is separate.
  for (const item of items) if (item.readNativeBody) {
    const current = item.readNativeBody();
    if (current) {
      item.paragraphs = current.map((paragraph, index) => ({...item.paragraphs[index], ...paragraph}));
      item.text = current.map(paragraph => paragraph.text).join('\n');
    }
  }
  const listBreaks = slideListBreaks(entries, slidePath, slideRoot, relationships);
  const content = mergeAdjacentBulletShapes(mergeOpfListShapes(items, listBreaks, diagnostic => options.onDiagnostic?.({...diagnostic, path: `slides.${slideIndex}`})))
    .map((item) => ({payload: payloadFromSlideItem(item, diagnostic => options.onDiagnostic?.({...diagnostic, path: `slides.${slideIndex}`})), bounds: item.visualBounds ?? item.bounds, sources: item.sources ?? []}))
    .filter((entry) => entry.payload);
  const blocks = content.map((entry) => entry.payload);
  // RR-34: a tagged caption re-attaches to the block whose native media shape it names (never by position).
  const annotations = nativeContext.annotations;
  if (annotations?.captions.size) {
    const tree = slideRoot['p:cSld']?.['p:spTree'];
    const shapeName = node => scalarText(node?.['p:nvSpPr']?.['p:cNvPr']?.name ?? node?.['p:nvPicPr']?.['p:cNvPr']?.name ?? node?.['p:nvGraphicFramePr']?.['p:cNvPr']?.name).trim();
    const keyByName = new Map();
    nativeContext.shapes.forEach((shape, index) => keyByName.set(shapeName(shape), `sp:${index}`));
    nativeContext.pictures.forEach((picture, index) => keyByName.set(shapeName(picture), `pic:${index}`));
    asArray(tree?.['p:graphicFrame']).forEach((frame, index) => keyByName.set(shapeName(frame), `frame:${index}`));
    asArray(tree?.['mc:AlternateContent']).forEach((alternate, index) => { for (const node of [...asArray(alternate?.['mc:Choice']), ...asArray(alternate?.['mc:Fallback'])]) if (node?.['p:graphicFrame']) keyByName.set(shapeName(node['p:graphicFrame']), `alt:${index}`); });
    for (const [mediaName, caption] of annotations.captions) {
      const key = keyByName.get(mediaName);
      const entry = key === undefined ? undefined : content.find(item => item.sources.includes(key));
      if (!entry || !['image', 'chart', 'table', 'video'].includes(inferPayloadKind(entry.payload))) {
        options.onDiagnostic?.({code: 'caption-detached', path: `slides.${slideIndex}`, message: `The caption of ${caption.path} no longer has its media shape (${mediaName}); its text is imported as an ordinary text block.`});
        blocks.push({type: 'text', text: caption.value});
        continue;
      }
      entry.payload.caption = captionValue(caption);
    }
  }
  if (blocks.length > 0) slide.blocks = blocks;
  // Native bounds of each block in reference px, for content topology matching (document provenance).
  // Which native shapes fed each field and block (import signals); never part of the document.
  nativeContext.signalSources = {tag: tagItem?.sources ?? [], title: titleItem?.sources ?? [], subtitle: subtitleItem?.sources ?? [],
    blocks: content.map(entry => ({sources: entry.sources, type: entry.payload.type})), roles: nativeContext.signalRoles ?? new Map()};
  nativeContext.contentBounds = content.map((entry) => entry.bounds ? {x: entry.bounds.x * 96, y: entry.bounds.y * 96, width: entry.bounds.w * 96, height: entry.bounds.h * 96} : null);

  const notes = readSlideNotes(entries, relationships);
  if (notes) slide.notes = notes;

  return slide;
}

const nativePictures = tree => [...asArray(tree?.['p:pic']), ...asArray(tree?.['p:grpSp']).flatMap(nativePictures)];

function collectSlideItems(entries, slideRoot, slidePath, relationships, dimensions, options, slideIndex, furniture, nativeContext) {
  const tree = slideRoot["p:cSld"]?.["p:spTree"];
  const items = [];
  const shapes = nativeContext.shapes;
  if (tree?.['p:grpSp']) options.onDiagnostic?.({code:'grouped-text-reflow',path:`slides.${slideIndex}`,message:'Grouped native text and pictures are retained, but group transforms and unsupported group members are not reconstructed; review the reflowed OPF.'});
  const paragraphs = nativeContext.paragraphs;
  // FF-45: OMML equations (a14:m math zones) have no OPF model. Their fallback text is imported as plain text; the equation
  // layout (fractions, radicals, limits, matrices) is lost, and that loss is diagnosed per shape instead of passing silently.
  paragraphs.forEach((list, index) => {
    const zones = list.reduce((count, paragraph) => count + (paragraph.math?.zones ?? 0), 0);
    if (zones) options.onDiagnostic?.({code: 'math-equation-flattened', path: `slides.${slideIndex}`, message: `Native shape ${index} holds ${zones} OMML equation${zones === 1 ? '' : 's'} (a14:m); OPF has no equation model, so its fallback text is imported as plain text and the equation layout is not represented.`});
  });
  // Native shape keys (indexes in nativeTextShapes / nativePictures / frame order) for import signals.
  const shapeKeys = new Map(shapes.map((shape, index) => [shape, `sp:${index}`]));
  const sourcesOf = group => group.flatMap(shape => shapeKeys.has(shape) ? [shapeKeys.get(shape)] : []);
  const roles = new Map();
  nativeContext.signalRoles = roles;
  const readBody = nativeBodyReader(slidePath, {
    part: (path, parser) => parseRequiredXml(entries, path, parser), relationships: path => parseRelationships(entries, path), bytes: path => entries[path]
  }, relationships, diagnostic => options.onDiagnostic?.({...diagnostic,path:`slides.${slideIndex}.${diagnostic.path}`}), {deckLang: options.deckLang, codeFamily: options.codeFamily});
  const code = importCodeGroups(shapes, paragraphs, relationships, entries, diagnostic => options.onDiagnostic?.({...diagnostic,path:`slides.${slideIndex}.code`}));
  const metric = importMetricGroups(shapes, paragraphs, relationships, entries, diagnostic => options.onDiagnostic?.({...diagnostic,path:`slides.${slideIndex}.metric`}));
  const cards = importCardFrames(shapes, paragraphs, relationships, entries, diagnostic => options.onDiagnostic?.({...diagnostic,path:`slides.${slideIndex}`}));
  const media = importMediaGroups(shapes, paragraphs, relationships, entries, slideIndex, diagnostic => options.onDiagnostic?.(diagnostic), nativeContext.mediaRegistry);
  nativeContext.mediaAssets = media.assets;
  nativeContext.readBody=readBody;
  const headings=importHeadingGroups(shapes,paragraphs,relationships,entries,diagnostic=>options.onDiagnostic?.({...diagnostic,path:`slides.${slideIndex}`}),readBody);
  const plainText=importPlainTextGroups(shapes,paragraphs,relationships,entries,diagnostic=>options.onDiagnostic?.({...diagnostic,path:`slides.${slideIndex}`}));
  const timelines=importTimelineGroups(shapes,paragraphs,relationships,entries,diagnostic=>options.onDiagnostic?.({...diagnostic,path:`slides.${slideIndex}`}));
  const quotes=importQuoteGroups(shapes,paragraphs,relationships,entries,diagnostic=>options.onDiagnostic?.({...diagnostic,path:`slides.${slideIndex}.quote`}),nativeContext.pictures,
    picture=>importPicture(entries,picture,slidePath,relationships,diagnostic=>{
      // The recorded crop is re-derived from the circular frame of the quote photo.
      if(diagnostic.code!=='unsupported-image-crop')options.onDiagnostic?.({...diagnostic,path:`slides.${slideIndex}.quote.photo`});
    }),readBody);
  // RR-34: tagged caption and footnote lines are not content; captions re-attach to their media block and notes rebuild cite/footnote.
  const annotations=importAnnotations({shapes,paragraphs,relationships,entries,slideIndex,readBody,report:diagnostic=>options.onDiagnostic?.(diagnostic)});
  nativeContext.annotations=annotations;
  for(const group of [...headings.items,...plainText.items]) {
    const item=importShape(group.shapes[0],dimensions,group.paragraphs,true);
    if(item){
      const bounds=group.shapes.map(shape=>shapeBounds(shape['p:spPr']?.['a:xfrm'])).filter(Boolean);
      if(bounds.length){const x=Math.min(...bounds.map(b=>b.x)),y=Math.min(...bounds.map(b=>b.y));item.bounds={x,y,w:Math.max(...bounds.map(b=>b.x+b.w))-x,h:Math.max(...bounds.map(b=>b.y+b.h))-y};}
      items.push({...item,heading:group.field,sourceText:!group.field,sources:sourcesOf(group.shapes),...(group.richText!==undefined?{richText:group.richText}:{})});
    }
  }
  for(const group of timelines.items){
    const bounds=group.shapes.map(shape=>shapeBounds(shape['p:spPr']?.['a:xfrm'])).filter(Boolean);
    let union;for(const bound of bounds){if(!union)union={...bound};else{const x=Math.min(union.x,bound.x),y=Math.min(union.y,bound.y);union={x,y,w:Math.max(union.x+union.w,bound.x+bound.w)-x,h:Math.max(union.y+union.h,bound.y+bound.h)-y};}}
    items.push({kind:'timeline',sourceText:true,bounds:union,payload:group.payload,sources:sourcesOf(group.shapes)});
  }
  for(const group of quotes.items){
    const bounds=[...group.shapes.map(shape=>shapeBounds(shape['p:spPr']?.['a:xfrm'])),...group.pictures.map(picture=>shapeBounds(picture['p:spPr']?.['a:xfrm']))].filter(Boolean);
    let union;for(const bound of bounds){if(!union)union={...bound};else{const x=Math.min(union.x,bound.x),y=Math.min(union.y,bound.y);union={x,y,w:Math.max(union.x+union.w,bound.x+bound.w)-x,h:Math.max(union.y+union.h,bound.y+bound.h)-y};}}
    items.push({kind:'quote',bounds:union,payload:group.payload,sources:[...sourcesOf(group.shapes),...group.pictures.map(picture=>`pic:${nativeContext.pictures.indexOf(picture)}`)]});
  }
  for (const item of code.items) items.push({kind:'code',bounds:shapeBounds(item.shape['p:spPr']?.['a:xfrm']),payload:item.payload,sources:sourcesOf([item.shape])});
  for (const item of metric.items) items.push({kind:'metric',bounds:shapeBounds(item.shape['p:spPr']?.['a:xfrm']),payload:item.payload,sources:sourcesOf([item.shape])});
  for (const item of media.items) items.push({kind:'media',sourceText:item.payload.type==='text',bounds:shapeBounds(item.shape['p:spPr']?.['a:xfrm']),payload:item.payload,sources:sourcesOf([item.shape])});
  for (const [index,shape] of shapes.entries()) {
    const role = furniture.text.has(index) ? 'furniture' : nativeContext.slideImageShapes?.has(index) ? 'slide-image' : nativeContext.watermarkShapes?.has(index) ? 'watermark' : nativeContext.logoPlaceholderShapes?.has(index) ? 'logo' : cards.has(shape) ? 'card-frame'
      : code.consumed.has(shape) ? 'code' : metric.consumed.has(shape) ? 'metric' : media.consumed.has(shape) ? 'media' : timelines.consumed.has(shape) ? 'timeline' : quotes.consumed.has(shape) ? 'quote' : undefined;
    if (role) roles.set(shapeKeys.get(shape), role);
    if (furniture.text.has(index) || nativeContext.slideImageShapes?.has(index) || nativeContext.watermarkShapes?.has(index) || nativeContext.logoPlaceholderShapes?.has(index)) continue;
    if (annotations.consumed.has(shape)) { roles.set(shapeKeys.get(shape), 'annotation'); continue; }
    if (code.consumed.has(shape)||metric.consumed.has(shape)||cards.has(shape)||media.consumed.has(shape)||headings.consumed.has(shape)||plainText.consumed.has(shape)||timelines.consumed.has(shape)||quotes.consumed.has(shape)) continue;
    const ordinaryBody = Object.hasOwn(shape, 'p:txBody') && !shape['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst']?.['p:tags'];
    const item = importShape(shape, dimensions, paragraphs[index], ordinaryBody || furniture.taggedText.has(index) || media.captionShapes.has(shape));
    if (item && ordinaryBody) item.readNativeBody = () => readBody(index);
    // A damaged/edited furniture group falls back to current native text,
    // including cleared text boxes, without inventing a title or shape label.
    if (item && (furniture.taggedText.has(index) || media.captionShapes.has(shape))) item.sourceText = true;
    if (item) items.push({...item, sources: [`sp:${index}`]});
  }

  const frames = asArray(tree?.["p:graphicFrame"]);
  // RR-35: what a chart's axis titles, legend and data labels cannot express in OPF is reported on the chart's path.
  const chartReport = label => diagnostic => options.onDiagnostic?.({code: 'chart-option-adapted', ...diagnostic, path: `slides.${slideIndex}.${label}.${diagnostic.option}`});
  const tables = frames.some(frame => frame['a:graphic']?.['a:graphicData']?.['a:tbl'])
    ? importTableFrames(slidePath, {
      part: (path, parser) => parseRequiredXml(entries, path, parser), relationships: path => parseRelationships(entries, path), bytes: path => entries[path]
    }, relationships, (frame, cell, code, message) => options.onDiagnostic?.({code, message, path: `slides.${slideIndex}.tables.${frame}${cell ? '.' + cell : ''}`}), dimensions, {rtlDeck: options.rtlDeck === true}) : [];
  // RR-54: chart and table data records (OPF_DATA_V1) restore against the stored datasets; their diagnostics name the frame.
  const dataContext = label => ({datasets: options.dataProvenance?.datasets, report: (kind, diagnostic) => options.onDiagnostic?.({...diagnostic, path: `slides.${slideIndex}.${kind === 'table' ? 'tables' : 'charts'}.${label}`})});
  for (const [index, frame] of frames.entries()) {
    const item = importGraphicFrame(entries, frame, slidePath, relationships, tables[index], chartReport(`charts.${index}`), dataContext(index));
    if (item) items.push({...item, sources: [`frame:${index}`]});
  }
  // A chartex chart is an mc:AlternateContent: the choice frame references the cx:chartSpace part; the fallback is a classic chart frame
  // (this exporter) or a text shape (PowerPoint). The choice is read first and the fallback only when it names no OPF chart type.
  for (const [alternateIndex, alternate] of asArray(tree?.["mc:AlternateContent"]).entries()) {
    const choice = asArray(alternate?.["mc:Choice"]).map((node) => node?.["p:graphicFrame"]).find(Boolean);
    const fallback = asArray(alternate?.["mc:Fallback"]).map((node) => node?.["p:graphicFrame"]).find(Boolean);
    const chosen = choice ? importGraphicFrame(entries, choice, slidePath, relationships, undefined, chartReport(`charts.alt${alternateIndex}`), dataContext(`alt${alternateIndex}`)) : null;
    const item = chosen?.payload?.type === "chart" ? chosen : fallback ? importGraphicFrame(entries, fallback, slidePath, relationships, undefined, chartReport(`charts.alt${alternateIndex}`), dataContext(`alt${alternateIndex}`)) : chosen;
    if (item && item.kind !== "unknown") items.push({...item, sources: [`alt:${alternateIndex}`]});
  }

  for (const [index, picture] of nativeContext.pictures.entries()) {
    const pictureRole = furniture.pictures.has(index) ? 'furniture' : nativeContext.slideImagePictures?.has(index) ? 'slide-image' : nativeContext.watermarkPictures?.has(index) ? 'watermark' : nativeContext.logoPictures?.has(index) ? 'logo' : quotes.consumedPictures.has(picture) ? 'quote' : undefined;
    if (pictureRole) { roles.set(`pic:${index}`, pictureRole); continue; }
    const report = diagnostic => options.onDiagnostic?.({...diagnostic, path: `slides.${slideIndex}.pictures.${index}`});
    const item = importPicture(entries, picture, slidePath, relationships, report);
    if (item) items.push({...item, sources: [`pic:${index}`]});
  }

  return items;
}

function importShape(shape, dimensions, paragraphs = readParagraphs(shape["p:txBody"]), allowEmptyText = false) {
  const text = paragraphs.map((paragraph) => paragraph.text).join("\n");
  const placeholder = shapePlaceholderType(shape);
  const bounds = shapeBounds(shape["p:spPr"]?.["a:xfrm"]);
  const name = scalarText(shape["p:nvSpPr"]?.["p:cNvPr"]?.name).trim();

  if (text || allowEmptyText) {
    return {
      kind: "text",
      text,
      paragraphs,
      bounds,
      placeholder,
      name,
      maxFontSize: Math.max(0, ...paragraphs.map((paragraph) => paragraph.maxFontSize))
    };
  }

  if (placeholder || !bounds || isFullSlide(bounds, dimensions)) return null;
  return {
    kind: "unknown",
    bounds,
    name,
    text: `PowerPoint shape: ${name || "unsupported shape"}`
  };
}

function importGraphicFrame(entries, frame, slidePath, relationships, importedTable, report, data = {}) {
  const bounds = shapeBounds(frame["p:xfrm"]);
  const name = scalarText(frame["p:nvGraphicFramePr"]?.["p:cNvPr"]?.name).trim();
  const graphicData = frame["a:graphic"]?.["a:graphicData"];
  const table = graphicData?.["a:tbl"];
  // RR-54: the frame's chart or table data record (src/data-provenance.js); an unreadable record is reported and ignored.
  const record = kind => {
    try {
      const value = readDataTag(entries, frame, relationships);
      return value?.kind === kind ? value : undefined;
    } catch (error) {
      data.report?.(kind, {code: 'invalid-data-provenance', message: `${errorMessage(error)} The ${kind} imports the values it shows.`});
      return undefined;
    }
  };
  // A record that passed its checks but cannot be restored (it fails validation in a way that throws) is reported too.
  const restore = (kind, imported, apply) => {
    try {
      return apply();
    } catch (error) {
      data.report?.(kind, {code: 'invalid-data-provenance', message: `${errorMessage(error)} The ${kind} imports the values it shows.`});
      return imported;
    }
  };
  if (table) {
    const stored = importedTable && record('table');
    return {
      kind: "table",
      bounds,
      name,
      payload: {
        type: "table",
        table: stored ? restore('table', importedTable, () => restoreTableData(importedTable, stored, {datasets: data.datasets, report: diagnostic => data.report?.('table', diagnostic)})) : importedTable
      }
    };
  }

  const chartExRelId = graphicData?.uri === CHARTEX_GRAPHIC_DATA_URI ? graphicData?.["cx:chart"]?.["r:id"] : undefined;
  const chartRelId = graphicData?.["c:chart"]?.["r:id"] ?? chartExRelId;
  if (chartRelId) {
    const imported = chartExRelId
      ? chartexFromRelationship(entries, relationships, chartExRelId, report)
      : chartFromRelationship(entries, slidePath, relationships, chartRelId, report);
    const stored = imported && record('chart');
    const part = relationships.get(chartRelId)?.path;
    const restored = stored && part && entries[part]
      ? restore('chart', imported, () => restoreChartData(imported, stored, chartEvidence(decodeText(entries[part])), {datasets: data.datasets, report: diagnostic => data.report?.('chart', diagnostic)}))
      : imported;
    const chart = restored?.type === 'combo' ? elideComboDefault(restored, data.datasets) : restored;
    // FA-09: the frame's descr (or PowerPoint's decorative marker) is the chart's text alternative.
    const alt = chart ? readFrameAlt(frame["p:nvGraphicFramePr"]?.["p:cNvPr"]) : undefined;
    return {
      kind: "chart",
      bounds,
      name,
      payload: chart
        ? { type: "chart", chart: alt === undefined ? chart : { ...chart, alt } }
        : { type: "text", text: `PowerPoint chart: ${name || chartRelId}` }
    };
  }

  return {
    kind: "unknown",
    bounds,
    name,
    text: `PowerPoint object: ${name || "unsupported object"}`
  };
}

// The box a quarter-turned picture occupies on the slide: `a:xfrm` describes the
// frame before rotation, so a 90 or 270 degree turn swaps its width and height
// around the same centre. Content topology matching compares this visual box.
function visualBounds(xfrm) {
  const bounds = shapeBounds(xfrm);
  const rotation = Number(xfrm?.rot ?? 0);
  if (!bounds || !Number.isFinite(rotation) || ((rotation % 10800000) + 10800000) % 10800000 !== 5400000) return bounds;
  return { x: bounds.x + bounds.w / 2 - bounds.h / 2, y: bounds.y + bounds.h / 2 - bounds.w / 2, w: bounds.h, h: bounds.w };
}

function importPicture(entries, picture, slidePath, relationships, report) {
  const bounds = shapeBounds(picture["p:spPr"]?.["a:xfrm"]);
  const name = scalarText(picture["p:nvPicPr"]?.["p:cNvPr"]?.name).trim();
  // PptxGenJS (and so exports before this fix) wrote `preencoded.<ext>` for a picture with no alt text; that is no authored description.
  const authoredAlt = scalarText(picture["p:nvPicPr"]?.["p:cNvPr"]?.descr);
  const alt = /^preencoded\.[a-z0-9]+$/i.test(authoredAlt.trim()) ? "" : authoredAlt;
  const title = scalarText(picture["p:nvPicPr"]?.["p:cNvPr"]?.title);
  const relId = picture["p:blipFill"]?.["a:blip"]?.["r:embed"];
  const relationship = relationships.get(relId);
  let bytes = relationship?.path ? entries[relationship.path] : null;
  // A picture PowerPoint stores as SVG carries the SVG beside its PNG fallback: the SVG is the image.
  let svg = null;
  const svgRelationship = relationships.get(svgBlipRelationship(picture["p:blipFill"]?.["a:blip"]));
  if (svgRelationship && svgRelationship.targetMode !== "External" && entries[svgRelationship.path]) {
    const prepared = prepareSvg(entries[svgRelationship.path]);
    if (prepared.error) report({code: "invalid-svg-image", message: `A picture's SVG was not imported (${prepared.error.message}); its PNG fallback was imported instead (none: the picture has no image).`});
    else {
      svg = prepared.bytes;
      if (prepared.removed.length) report({code: "svg-sanitized", message: `The SVG had ${prepared.removed.join(", ")} removed on import.`});
    }
  }
  // PowerPoint can save an SVG picture with no PNG fallback at all (an a:blip with no r:embed): the SVG alone is the image.
  if (!bytes && !svg) {
    return {
      kind: "unknown",
      bounds,
      name,
      text: `PowerPoint image: ${alt || name || "unresolved image"}`
    };
  }

  const crop = picture["p:blipFill"]?.["a:srcRect"];
  if (crop && ['l','r','t','b'].some(key => Number(crop[key] ?? 0) !== 0)) {
    report({code: 'unsupported-image-crop', message: 'Native picture crop is not represented by the imported OPF asset; the full image was retained.'});
  }
  bytes = importImageOrientation(svg ?? bytes, picture["p:spPr"]?.["a:xfrm"], report);

  return {
    kind: "image",
    bounds,
    visualBounds: visualBounds(picture["p:spPr"]?.["a:xfrm"]),
    name,
    payload: {
      type: "image",
      image: {
        src: `data:${svg ? "image/svg+xml" : rasterMetadata(bytes)?.mediaType ?? mediaTypeForPath(relationship?.path)};base64,${bytesToBase64(bytes)}`,
        ...(alt ? { alt } : {}),
        ...(title && alt ? { title } : {})
      }
    }
  };
}

function readParagraphs(txBody) {
  return withDisplayedNumbers(asArray(txBody?.["a:p"])
    .map((paragraph) => {
      // FF-45: an a14:m math zone (OMML equation) inside mc:AlternateContent has no OPF model; its mc:Fallback runs are read as
      // text (or, without them, the equation's m:t text), and `math` records the zones so the importer can diagnose the loss.
      const alternates = asArray(paragraph?.["mc:AlternateContent"]);
      const zones = alternates.flatMap(alternate => asArray(alternate?.["mc:Choice"])).filter(choice => choice?.["a14:m"] !== undefined);
      const fallbackRuns = alternates.flatMap(alternate => asArray(alternate?.["mc:Fallback"])).flatMap(fallback => [...asArray(fallback?.["a:r"]), ...asArray(fallback?.["a:fld"])]);
      const runs = [
        ...asArray(paragraph?.["a:r"]),
        ...asArray(paragraph?.["a:fld"]),
        ...fallbackRuns
      ];
      const texts = [];
      const sizes = [];
      for (const run of runs) {
        const text = scalarText(run?.["a:t"]);
        if (text) texts.push(text);
        const size = Number(run?.["a:rPr"]?.sz);
        if (Number.isFinite(size)) sizes.push(size / 100);
      }
      const linear = zones.map(choice => keyedMathText(choice["a14:m"])).join("");
      if (zones.length && !fallbackRuns.some(run => scalarText(run?.["a:t"]))) texts.push(linear);
      return {
        text: texts.join(""),
        bullet: asArray(paragraph?.["a:pPr"]).some(props => props?.["a:buChar"] !== undefined || props?.["a:buBlip"] !== undefined || props?.["a:buAutoNum"] !== undefined),
        level: Number(asArray(paragraph?.["a:pPr"])[0]?.lvl ?? 0),
        maxFontSize: sizes.length > 0 ? Math.max(...sizes) : 0,
        ...(zones.length ? {math: {zones: zones.length, text: linear}} : {}),
        ...autoNumberOf(asArray(paragraph?.["a:pPr"])[0])
      };
    }));
}
// RR-33: the native auto-number of a paragraph's properties, when its last bullet element is one.
function autoNumberOf(properties) {
  if (properties?.["a:buAutoNum"] === undefined) return {};
  const attributes = asArray(properties["a:buAutoNum"])[0] ?? {};
  return {autoNum: {type: attributes.type, startAt: attributes.startAt}};
}
/** The m:t text of a keyed OMML tree (an a14:m zone) in document order: the equation's linear reading without its layout. */
function keyedMathText(node) {
  if (Array.isArray(node)) return node.map(keyedMathText).join("");
  if (!node || typeof node !== "object") return "";
  return Object.entries(node).map(([key, value]) => key === "m:t" ? asArray(value).map(scalarText).join("") : keyedMathText(value)).join("");
}

function shapePlaceholderType(shape) {
  return shape["p:nvSpPr"]?.["p:nvPr"]?.["p:ph"]?.type ?? null;
}

function shapeBounds(xfrm) {
  if (!xfrm) return null;
  const x = emuToInches(xfrm["a:off"]?.x);
  const y = emuToInches(xfrm["a:off"]?.y);
  const w = emuToInches(xfrm["a:ext"]?.cx);
  const h = emuToInches(xfrm["a:ext"]?.cy);
  if ([x, y, w, h].some((value) => value === null)) return null;
  return { x, y, w, h };
}

function takeTitleItem(items, dimensions, inferHeadings) {
  const explicitIndex = items.findIndex((item) => ["title", "ctrTitle"].includes(item.placeholder));
  if (explicitIndex >= 0) return items.splice(explicitIndex, 1)[0];
  if (!inferHeadings) return null;

  const titleLimit = dimensions.heightInches * 0.28;
  const candidateIndex = items.findIndex((item) => {
    if (item.heading || item.kind !== "text" || !item.text || item.paragraphs.some(p=>p.bullet)) return false;
    const y = item.bounds?.y ?? 0;
    return y <= titleLimit && (item.maxFontSize >= 20 || /^title\b/i.test(item.name ?? ""));
  });
  if (candidateIndex >= 0) return items.splice(candidateIndex, 1)[0];
  return null;
}

function takeSubtitleItem(items, titleItem, dimensions, inferHeadings) {
  const explicitIndex = items.findIndex((item) => item.placeholder === "subTitle");
  if (explicitIndex >= 0) return items.splice(explicitIndex, 1)[0];
  if (!inferHeadings || !titleItem) return null;

  const titleBottom = (titleItem.bounds?.y ?? 0) + (titleItem.bounds?.h ?? 0);
  const subtitleLimit = Math.min(dimensions.heightInches * 0.34, 1.45);
  const candidateIndex = items.findIndex((item) => {
    if (item.heading || item.kind !== "text" || !item.text || item.paragraphs.some(p=>p.bullet)) return false;
    const y = item.bounds?.y ?? 0;
    const h = item.bounds?.h ?? 0;
    return y >= titleBottom - 0.05
      && y <= subtitleLimit
      && h <= 0.75
      && item.paragraphs.length === 1
      && item.maxFontSize <= Math.max(22, titleItem.maxFontSize);
  });
  if (candidateIndex >= 0) return items.splice(candidateIndex, 1)[0];
  return null;
}

// The export writes every native line of a list as its own shape named "OPF list <path> line N". The lines of one list
// import as one list: a bulleted line starts an entry, an unbulleted line of the entry's own size continues it (a wrapped
// entry) and a smaller one is its description. Without a bulleted first line the shapes stay as they are.
const richRuns = value => typeof value === 'string' ? [{text: value}] : value;
function joinRich(a, b) {
  if (typeof a === 'string' && typeof b === 'string') return a + b;
  const runs = [...richRuns(a), ...richRuns(b)], joined = [];
  for (const run of runs) {
    const last = joined.at(-1);
    if (last && JSON.stringify({...last, text: ''}) === JSON.stringify({...run, text: ''})) last.text += run.text;
    else joined.push({...run});
  }
  return joined;
}
// `breaks` (slideListBreaks) holds the whitespace of the hard breaks the export recorded, by list path and line number: the
// continuation line after a break joins with it, so a newline inside an item (or a description) returns. A blank line is a
// native shape with no text: it is never a description. Without a record the lines join without a separator, as before.
function mergeOpfListShapes(items, breaks = null, report = () => {}) {
  const lists = new Map();
  for (const item of items) {
    const match = /^OPF list (.+) line (\d+)$/.exec(item.name ?? '');
    if (match && item.kind === 'text' && item.paragraphs?.length === 1) {
      if (!lists.has(match[1])) lists.set(match[1], []);
      lists.get(match[1]).push({item, line: Number(match[2])});
    }
  }
  const merged = new Map(), consumed = new Set();
  for (const [path, entries] of lists) {
    entries.sort((a, b) => a.line - b.line);
    if (!entries[0].item.paragraphs[0].bullet) continue;
    const paragraphs = [];
    const recorded = breaks?.get(path), applied = new Set();
    let bounds, size = 0;
    for (const {item, line} of entries) {
      const [paragraph] = item.paragraphs, current = paragraphs.at(-1);
      const gap = recorded?.get(line);
      const join = (a, b) => gap === undefined ? joinRich(a, b) : joinWrappedText([a, b], [gap]);
      if (paragraph.bullet) { paragraphs.push({...paragraph}); size = paragraph.maxFontSize; }
      else if (paragraph.text === '') { /* a blank line of the entry: no text, no description */ }
      else if (paragraph.maxFontSize < size - 0.01) {
        const text = paragraph.richText ?? paragraph.text;
        if (current.description === undefined) current.description = text;
        else { current.description = join(current.description, text); applied.add(line); }
      } else {
        const before = current.text;
        current.text += (gap === undefined ? '' : Array.isArray(gap) ? gap[0] : gap) + paragraph.text;
        if (current.richText !== undefined || paragraph.richText !== undefined) current.richText = join(current.richText ?? before, paragraph.richText ?? paragraph.text);
        applied.add(line);
      }
      const b = item.visualBounds ?? item.bounds;
      if (b) {
        const x = Math.min(bounds?.x ?? b.x, b.x), y = Math.min(bounds?.y ?? b.y, b.y);
        bounds = {x, y, w: Math.max((bounds ? bounds.x + bounds.w : -Infinity), b.x + b.w) - x, h: Math.max((bounds ? bounds.y + bounds.h : -Infinity), b.y + b.h) - y};
      }
      consumed.add(item);
    }
    if (recorded && [...recorded.keys()].some(line => !applied.has(line))) report({code: 'list-line-break-changed', message: `A hard line break recorded at export inside the list ${path} no longer has the continuation line it belonged to (a line was edited away, or became an entry), so that break was not restored; the list keeps the lines it has.`});
    const first = entries[0].item;
    merged.set(first, {...first, paragraphs, text: paragraphs.map(paragraph => paragraph.text).join('\n'), bounds, visualBounds: undefined, sources: entries.flatMap(({item}) => item.sources ?? [])});
  }
  return items.flatMap(item => merged.has(item) ? [merged.get(item)] : consumed.has(item) ? [] : [item]);
}

// Adjacent native bullet boxes on the same text column form one imported list.
// This is a geometry heuristic, not a lossless reconstruction of arbitrary PPTX.
function mergeAdjacentBulletShapes(items) {
  const result=[];
  for(const item of items){
    const previous=result.at(-1);
    const bullets=value=>value?.kind==='text'&&value.paragraphs.length&&value.paragraphs.every(p=>p.bullet);
    if(bullets(previous)&&bullets(item)&&previous.bounds&&item.bounds
      &&Math.abs(previous.bounds.x-item.bounds.x)<.05
      &&item.bounds.y>=previous.bounds.y+previous.bounds.h-.02
      &&item.bounds.y-(previous.bounds.y+previous.bounds.h)<.3){
      previous.paragraphs.push(...item.paragraphs);
      previous.text+='\n'+item.text;
      previous.sources=[...(previous.sources??[]),...(item.sources??[])];
      previous.bounds.h=item.bounds.y+item.bounds.h-previous.bounds.y;
    }else result.push({...item,paragraphs:item.paragraphs?[...item.paragraphs]:undefined,bounds:item.bounds?{...item.bounds}:undefined});
  }
  return result;
}

function payloadFromSlideItem(item, report) {
  if (item.payload) return item.payload;
  if (item.kind === "text") {
    if (item.paragraphs.some(p=>p.bullet)) {
      // RR-33: native auto-numbers come back as `numbering` and the entry `start` values that restore their numbers.
      const {numbering, starts, diagnostics} = deriveListNumbering(item.paragraphs);
      for (const diagnostic of diagnostics) report?.(diagnostic);
      return {
        type: "list",
        items: item.paragraphs.map((paragraph, index) => {
          const start = starts.get(index) === undefined ? {} : {start: starts.get(index)};
          return paragraph.level > 0
            ? { text: paragraph.richText ?? paragraph.text, level: paragraph.level, ...(paragraph.description !== undefined ? {description: paragraph.description} : {}), ...start }
            : paragraph.description !== undefined ? { text: paragraph.richText ?? paragraph.text, description: paragraph.description, ...start }
            : start.start !== undefined ? { text: paragraph.richText ?? paragraph.text, ...start } : (paragraph.richText ?? paragraph.text);
        }),
        ...(numbering !== undefined ? {numbering} : {})
      };
    }
    return { type: "text", text: joinNativeParagraphs(item.paragraphs) };
  }
  if (item.kind === "unknown" && item.text) return { type: "text", text: item.text };
  return null;
}

function chartFromRelationship(entries, slidePath, relationships, relId, report) {
  const relationship = relationships.get(relId);
  if (!relationship?.path || !entries[relationship.path]) return null;
  const doc = parseRequiredXml(entries, relationship.path);
  const plotArea = doc["c:chartSpace"]?.["c:chart"]?.["c:plotArea"];
  if (!plotArea) return null;

  // FA-15: a clustered column group with one or two line groups is a combo chart; its series are read in c:order.
  const combo = comboFromNative(plotArea);
  const comboSeries = combo ? comboSeriesOf(combo) : undefined;
  const chartNode = combo ? {node: combo.bar, type: 'combo'} : firstChartNode(plotArea);
  if (!chartNode) return null;
  const series = comboSeries ? comboSeries.map(entry => entry.ser) : asArray(chartNode.node["c:ser"]);
  if (series.length === 0) return null;
  if (series.length > MAX_CHART_CACHE_POINTS) {
    throw new OPFPptxError('invalid-chart-cache', 'Chart cache exceeds the 100,000-series import limit; reduce its series before importing.', {path: relationship.path});
  }

  const budget = { cells: 0 };
  const cachePath = (index, role) => `${relationship.path}#c:ser[${index}]/${role}`;
  // RR-54: each series' number format code (c:numCache or c:numLit formatCode); core maps the codes it can back to column formats.
  const valueCodes = series.map(entry => cacheFormatCode(entry?.["c:val"] ?? entry?.["c:yVal"]));
  const xCode = chartNode.type === 'scatter' ? cacheFormatCode(series[0]?.["c:xVal"]) : undefined;
  // RR-35: axis titles, legend position and data labels read back into the chart's option fields.
  const withOptions = chart => {
    const {options, notes} = chartOptionsFromClassic(doc["c:chartSpace"], {chartNode: chartNode.node, target: chartTargetFor(chartNode.type), seriesCount: series.length, circular: chartNode.type === 'pie' || chartNode.type === 'doughnut', scatter: chartNode.type === 'scatter', seriesFormats: valueCodes,
      ...(combo ? {combo: {lineNode: combo.lines[0]?.node, secondaryValueAxis: secondaryValueAxisOf(plotArea, combo)}} : {})});
    for (const note of notes) report?.(note);
    if (budget.rejected?.length) report?.({code: 'chart-value-not-numeric', option: 'data', message: `${budget.rejected.length} cached chart ${budget.rejected.length === 1 ? 'value is' : 'values are'} not a number (first at ${budget.rejected[0]}) and ${budget.rejected.length === 1 ? 'imports as a gap' : 'import as gaps'}, never as a guessed value.`});
    return chart && Object.keys(options).length ? {...chart, ...options} : chart;
  };
  if (chartNode.type === 'scatter') return withOptions(scatterFromSeries(entries, relationship.path, series, budget, cachePath, {codes: valueCodes, xCode, report}));
  const labels = cachedValues(series[0]?.["c:cat"], cachePath(0, 'c:cat'), budget);
  const names = series.map((entry, index) => firstCachedValue(entry?.["c:tx"], cachePath(index, 'c:tx'), budget) ?? `Series ${index + 1}`);
  const values = series.map((entry, index) => {
    const role = entry?.["c:val"] !== undefined ? 'c:val' : 'c:yVal';
    return cachedValues(entry?.[role], cachePath(index, role), budget, strictCacheValue(budget));
  });
  const rowCount = values.reduce((count, row) => Math.max(count, row.length), labels.length);
  if (rowCount === 0) return null;
  if (rowCount * (series.length + 1) > MAX_CHART_CACHE_CELLS) {
    throw new OPFPptxError('invalid-chart-cache', 'Chart cache exceeds the 1,000,000-cell import limit; reduce its rows or series before importing.', {path: relationship.path});
  }

  const rows = [];
  for (let index = 0; index < rowCount; index += 1) {
    rows.push([
      labels[index] ?? null,
      ...values.map((row) => row[index] ?? null)
    ]);
  }

  return withOptions({
    type: chartNode.type,
    data: {
      columns: formattedColumns([readChartCategoryHeading(entries,relationship.path) ?? "Category", ...names], [undefined, ...valueCodes], report),
      rows
    },
    ...(comboSeries ? comboFields(comboSeries, names, report) : {})
  });
}

// FA-15: the series of a combo plot area with their role and axis, in c:order (document order breaks ties).
function comboSeriesOf(combo) {
  const entries = [
    ...asArray(combo.bar["c:ser"]).map(ser => ({ser, role: 'bar', secondary: false})),
    ...combo.lines.flatMap(group => asArray(group.node["c:ser"]).map(ser => ({ser, role: 'line', secondary: group.secondary}))),
  ];
  const order = (entry, index) => {
    const value = Number(entry.ser?.["c:order"]?.val);
    return Number.isFinite(value) ? value : index;
  };
  return entries.map((entry, index) => ({...entry, key: order(entry, index), index})).sort((a, b) => a.key - b.key || a.index - b.index);
}

// The c:valAx a secondary line group plots against (its axis that the column group does not use), or undefined.
function secondaryValueAxisOf(plotArea, combo) {
  const group = combo.lines.find(entry => entry.secondary);
  if (!group) return undefined;
  const ids = new Set(asArray(group.node["c:axId"]).map(axis => String(axis?.val)));
  return asArray(plotArea["c:valAx"]).find(axis => ids.has(String(axis?.["c:axId"]?.val)));
}

// `line` and `secondaryAxis` of an imported combo chart by series name (elideComboDefault drops a `line` that is the default).
// Combo lines always draw markers in OPF; a native line without markers is reported, never silently changed.
function comboFields(comboSeries, names, report) {
  const line = names.filter((_, index) => comboSeries[index].role === 'line');
  const secondaryAxis = names.filter((_, index) => comboSeries[index].secondary);
  const unmarked = names.filter((_, index) => comboSeries[index].role === 'line' && comboSeries[index].ser?.["c:marker"]?.["c:symbol"]?.val === 'none');
  if (unmarked.length) report?.({option: 'line', message: `The combo chart's line ${unmarked.length === 1 ? 'series' : 'series'} ${unmarked.map(name => `'${name}'`).join(', ')} ${unmarked.length === 1 ? 'has' : 'have'} no markers; OPF combo lines always draw markers, so ${unmarked.length === 1 ? 'it imports' : 'they import'} with markers.`});
  if (new Set(line).size !== line.length || new Set(names).size !== names.length) {
    report?.({option: 'line', message: 'Two series of the combo chart share a name, so which of them is a line cannot be said by name; the chart imports with its default line (the last series).'});
    return {};
  }
  return {...(line.length ? {line} : {}), ...(secondaryAxis.length ? {secondaryAxis} : {})};
}

// An imported combo chart writes `line` only when it differs from the default (the last plotted series), judged on the final
// data (a restored data record can order the columns differently from the native series).
function elideComboDefault(chart, datasets) {
  if (!Array.isArray(chart.line)) return chart;
  const {line, ...rest} = chart;
  const resolved = resolveChartData(rest, {datasets: datasets ?? {}});
  if (!resolved.ok || !Array.isArray(resolved.combo)) return chart;
  const defaults = resolved.columns.slice(1).filter((_, index) => resolved.combo[index]?.role === 'line');
  return defaults.length === line.length && defaults.every(name => line.includes(name)) ? rest : chart;
}

// The format code of a numeric cache (c:numRef/c:numCache or c:numLit), or undefined.
function cacheFormatCode(node) {
  const cache = node?.["c:numRef"]?.["c:numCache"] ?? node?.["c:numLit"];
  const code = cache?.["c:formatCode"];
  return code === undefined ? undefined : scalarText(code);
}

// RR-54: a cached value is a number in strict decimal syntax (core chartNumber) or another XML number form (a leading '+',
// leading zeros, '.5'); anything else is a gap, counted for one chart-value-not-numeric diagnostic. Exponent tokens keep their
// own range checks (numericCacheValue).
function strictCacheValue(budget) {
  return (value, path) => {
    const number = numericCacheValue(value, path);
    if (number === null && value !== null && value.trim() !== '') (budget.rejected ??= []).push(path);
    return number;
  };
}

// Scatter charts share X values (c:xVal) across Y series (c:yVal). OPF keeps
// them category-major: [point label, X, Y1, Y2, ...]; native charts carry no
// point labels, so points are numbered.
function scatterFromSeries(entries, chartPart, series, budget, cachePath, {codes = [], xCode, report} = {}) {
  // The same cache helpers as every other chart: bounded, indexed by c:pt@idx, with gaps kept as null (never plotted as 0).
  const xRole = series[0]?.["c:xVal"];
  const xs = cachedValues(xRole, cachePath(0, "c:xVal"), budget, strictCacheValue(budget));
  const names = series.map((entry, index) => firstCachedValue(entry?.["c:tx"], cachePath(index, "c:tx"), budget) ?? `Series ${index + 1}`);
  const values = series.map((entry, index) => cachedValues(entry?.["c:yVal"], cachePath(index, "c:yVal"), budget, strictCacheValue(budget)));
  const rowCount = values.reduce((count, row) => Math.max(count, row.length), xs.length);
  if (rowCount === 0) return null;
  if (rowCount * (series.length + 2) > MAX_CHART_CACHE_CELLS) {
    throw new OPFPptxError('invalid-chart-cache', 'Chart cache exceeds the 1,000,000-cell import limit; reduce its rows or series before importing.', {path: chartPart});
  }
  const rows = [];
  // A chart without c:xVal plots against 1..n natively; a c:xVal gap stays a gap.
  for (let index = 0; index < rowCount; index += 1) rows.push([String(index + 1), xRole === undefined ? index + 1 : xs[index] ?? null, ...values.map((row) => row[index] ?? null)]);
  return { type: "scatter", data: { columns: formattedColumns(["Point", readChartCategoryHeading(entries, chartPart) ?? "X", ...names], [undefined, xCode, ...codes], report), rows } };
}

// A chartex part (cx:chartSpace): the series layoutIds name the kept OPF chart
// type and the cached dimensions restore the category-major data, under the
// same bounds as the classic chart cache.
function chartexFromRelationship(entries, relationships, relId, report) {
  const relationship = relationships.get(relId);
  if (!relationship?.path || !entries[relationship.path]) return null;
  const doc = parseRequiredXml(entries, relationship.path);
  return chartFromChartex(doc, {
    heading: readChartCategoryHeading(entries, relationship.path),
    limits: {points: MAX_CHART_CACHE_POINTS, cells: MAX_CHART_CACHE_CELLS},
    path: relationship.path,
    report,
    invalid: (message, location) => {
      throw new OPFPptxError('invalid-chart-cache', `Invalid chart cache: ${message}. Repair the chart data before importing.`, {path: location ?? relationship.path});
    }
  });
}

function firstChartNode(plotArea) {
  // Map the native construct back to the kept OPF chart type id (FF-22).
  for (const element of NATIVE_CHART_ELEMENTS) {
    const node = asArray(plotArea[`c:${element}`])[0];
    if (node) return { node, type: chartTypeFromNative(element, node) };
  }
  return null;
}

const MAX_CHART_CACHE_POINTS = 100_000;
const MAX_CHART_CACHE_CELLS = 1_000_000;

// Import complete decimal exponent tokens with their range checks. RR-54: every other token is an XML decimal (xsd:double
// without an exponent: a leading '+', leading zeros, '.5', '5.', and any number of digits, so 1e20, which the exporter
// writes as "100000000000000000000", reads back); anything else is a gap, never a stripped or guessed value.
function numericCacheValue(value, path) {
  if (value === null || value.trim() === '') return null;
  const token = value.trim();
  const exponent = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))[eE][+-]?\d+$/.exec(token);
  if (!exponent) {
    const number = /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(token) ? Number(token) : NaN;
    return Number.isFinite(number) ? number : null;
  }
  const parsed = Number(token);
  if (!Number.isFinite(parsed) || (parsed === 0 && /[1-9]/.test(exponent[1]))) {
    const reason = Number.isFinite(parsed) ? 'underflows to zero' : 'overflows';
    throw new OPFPptxError('unsupported-chart-cache', `Scientific-notation chart value is outside the supported finite numeric range (${reason}); use a representable value before importing.`, {path});
  }
  return parsed;
}

// c:pt is sparse and its XML order does not determine the data row. Keep
// explicit empty strings distinct from missing points, and bound native
// metadata before allocating a dense OPF table. Only numeric roles convert values.
function cachedValues(node, path, budget, readValue) {
  const invalid = (message, suffix = '') => {
    throw new OPFPptxError('invalid-chart-cache', `Invalid chart cache: ${message}. Repair the chart data before importing.`, {path: path + suffix});
  };
  const single = (value, location) => {
    if (value !== undefined && value !== '' && (!value || typeof value !== 'object' || Array.isArray(value))) {
      invalid('cache container must be a single element', location);
    }
  };
  single(node, '');
  for (const reference of ['c:strRef', 'c:numRef', 'c:multiLvlStrRef']) single(node?.[reference], `/${reference}`);
  const candidates = [
    ['c:strRef/c:strCache', node?.['c:strRef']?.['c:strCache']],
    ['c:numRef/c:numCache', node?.['c:numRef']?.['c:numCache']],
    ['c:multiLvlStrRef/c:multiLvlStrCache', node?.['c:multiLvlStrRef']?.['c:multiLvlStrCache']],
    ['c:numLit', node?.['c:numLit']],
    ['c:strLit', node?.['c:strLit']],
  ].filter(([, cache]) => cache !== undefined);
  if (candidates.length === 0) return [];
  if (candidates.length > 1) invalid('multiple competing cache sources');
  const [kind, cache] = candidates[0];
  path += `/${kind}`;
  if (cache !== '' && (!cache || typeof cache !== 'object' || Array.isArray(cache))) invalid('cache must be a single element');
  const integer = (raw, limit, location) => {
    // XML Schema unsigned integers allow an optional sign and whitespace;
    // their value must still be nonnegative, integral and bounded.
    if (typeof raw !== 'string' || !/^[+-]?\d+$/.test(raw.trim())) invalid('expected an unsigned integer', location);
    const value = Number(raw.trim());
    if (!Number.isSafeInteger(value) || value < 0 || value > limit) invalid(`integer exceeds the supported range 0–${limit}`, location);
    return value;
  };
  const count = cache?.['c:ptCount'] === undefined ? undefined
    : integer(cache['c:ptCount']?.val, MAX_CHART_CACHE_POINTS, '/c:ptCount@val');
  let data = cache;
  if (kind.startsWith('c:multiLvlStrRef')) {
    const levels = asArray(cache?.['c:lvl']);
    if (levels.length > 1) {
      throw new OPFPptxError('unsupported-chart-cache', 'Hierarchical chart category caches cannot be flattened without losing labels; use a single category level before importing.', {path});
    }
    data = levels[0];
  }
  const points = asArray(data?.['c:pt']);
  if (points.length > MAX_CHART_CACHE_POINTS) invalid('too many points');
  const indexed = new Map();
  let extent = count ?? 0;
  for (const [position, point] of points.entries()) {
    const location = `/c:pt[${position}]@idx`;
    const index = integer(point?.idx, MAX_CHART_CACHE_POINTS - 1, location);
    if (count !== undefined && index >= count) invalid('point index is outside its declared count', location);
    if (indexed.has(index)) invalid('duplicate point index', location);
    if (Array.isArray(point?.['c:v'])) invalid('point has multiple values', `/c:pt[${position}]/c:v`);
    indexed.set(index, point?.['c:v'] === undefined ? null : scalarText(point['c:v']));
    extent = Math.max(extent, index + 1);
  }
  if (budget.cells + extent > MAX_CHART_CACHE_CELLS) invalid('combined caches exceed the 1,000,000-cell import limit');
  budget.cells += extent;
  const result = new Array(extent).fill(null);
  for (const [index, value] of indexed) {
    result[index] = readValue ? readValue(value, `${path}/c:pt[@idx="${index}"]/c:v`) : value;
  }
  return result;
}

function firstCachedValue(node, path, budget) {
  return cachedValues(node, path, budget).find(value => value !== null);
}

function readSlideNotes(entries, relationships) {
  const notesRel = [...relationships.values()].find((relationship) => relationship.type.endsWith("/notesSlide"));
  if (!notesRel?.path || !entries[notesRel.path]) return "";
  const doc = parseRequiredXml(entries, notesRel.path);
  const shapes = nativeTextShapes(doc["p:notes"]?.["p:cSld"]?.["p:spTree"]);
  const paragraphs = nativeShapeParagraphs(decodeText(entries[notesRel.path]), 'p:notes');
  return shapes.flatMap((shape, index) => shapePlaceholderType(shape) === "body"
    ? paragraphs[index].map(paragraph => paragraph.text) : []).join("\n");
}

function comparePositionedItems(left, right) {
  const leftY = left.bounds?.y ?? Number.MAX_SAFE_INTEGER;
  const rightY = right.bounds?.y ?? Number.MAX_SAFE_INTEGER;
  const leftX = left.bounds?.x ?? Number.MAX_SAFE_INTEGER;
  const rightX = right.bounds?.x ?? Number.MAX_SAFE_INTEGER;
  return leftY - rightY || leftX - rightX;
}

function firstLine(value) {
  return String(value ?? "").split(/\r?\n/).find((line) => line.trim())?.trim() ?? "";
}

function mediaTypeForPath(path) {
  const ext = path.toLowerCase().split(".").pop();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "svg") return "image/svg+xml";
  return "image/png";
}

function isFullSlide(bounds, dimensions) {
  return bounds.x <= 0.02
    && bounds.y <= 0.02
    && bounds.w >= dimensions.widthInches - 0.04
    && bounds.h >= dimensions.heightInches - 0.04;
}

function emuToInches(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  // Keep native precision through layout/rendering. Rounding inches to six
  // decimals turns a 1280-pixel canvas into 1279.999968 and changes raster edges.
  return number / EMUS_PER_INCH;
}

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function scalarText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(scalarText).join("");
  if (typeof value === "object" && value["#text"] !== undefined) return scalarText(value["#text"]);
  return "";
}

function parseInput(input) {
  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch (error) {
      throw new OPFPptxError("invalid-json", "OPF input is not valid JSON.", {
        cause: errorMessage(error)
      });
    }
  }

  if (input instanceof Uint8Array) {
    return parseInput(new TextDecoder().decode(input));
  }

  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input;
  }

  throw new OPFPptxError("invalid-input", "OPF input must be a parsed object, JSON string, or Uint8Array.");
}

// Template variables (core resolveVariables, RR-32): a deck that uses content variables, or a template, is resolved to a
// concrete deck before export, so the PPTX holds exactly the text, numbers, dates and images the preview shows. A template
// exports with each unfilled variable's example (reported as variable-example-used); a normal deck with an unfilled
// required variable is refused. Decks without content variables are returned untouched. The package stores the resolved
// deck, not the template form, so fromPptx returns the filled deck.
function resolveTemplateInput(presentation, options) {
  if (typeof opfCore.resolveVariables !== "function" || !isPlainObject(presentation)) return presentation;
  const values = options.variables;
  if (values !== undefined && !isPlainObject(values)) {
    throw new OPFPptxError("invalid-variables", "The variables option must be an object keyed by variable id.", {path: "options.variables"});
  }
  const template = opfCore.isTemplate(presentation);
  if (!template && !opfCore.hasContentVariables(presentation) && !(values && Object.keys(values).length)) return presentation;
  const result = opfCore.resolveVariables(presentation, values ?? {}, {examples: template});
  const errors = result.diagnostics.filter(entry => entry.severity === "error");
  if (errors.length) {
    throw new OPFPptxError(errors.some(entry => entry.code === "variable-unfilled") ? "unfilled-variables" : "invalid-variables", errors[0].message, {issues: errors, path: errors[0].path});
  }
  for (const entry of result.diagnostics) {
    if (entry.code === "variable-example-used" || entry.code === "variable-builtin-missing") options.onDiagnostic?.({code: entry.code, path: entry.path, message: entry.message, id: entry.id});
  }
  return result.presentation;
}

function assertValidBoundary(presentation) {
  const result = validatePresentation(presentation);
  if (!result.valid) {
    throw new OPFPptxError("invalid-opf", "OPF validation failed.", {
      issues: result.errors,
      result
    });
  }
}

function resolvePresentationContext(presentation, options) {
  const design = presentation.design ?? {};
  const theme = resolveDesignRecord(presentation, "themes", design.theme, DEFAULTS.theme);
  const colorScheme = resolveDesignRecord(
    presentation,
    "colorSchemes",
    design.colorScheme ?? theme?.colorScheme,
    DEFAULTS.colorScheme
  );
  const fontScheme = resolveDesignRecord(
    presentation,
    "fontSchemes",
    design.fontScheme ?? theme?.fontScheme,
    DEFAULTS.fontScheme
  );
  // Shared rule (core resolveFontSchemeReference): an unresolved id falls back to the
  // DEFAULTS.fontScheme record as the base; resolveSlideContext reports it once per path.
  const fontSchemeId = referenceId(design.fontScheme ?? theme?.fontScheme);
  const unresolvedFontScheme = fontSchemeId && !findById(normalizeRecords(presentation.catalogs?.fontSchemes), fontSchemeId) && !findById(defaultCatalog("fontSchemes"), fontSchemeId) ? fontSchemeId : null;
  const dimensions = resolveDimensions(design.dimensions ?? theme?.dimensions);
  const variables = resolveVariableColors(presentation.variables);
  const background = resolveBackground(design.background ?? theme?.background, colorScheme, variables);
  // One resolution for every color role (core resolveColorRoles), shared with the SVG preview and the audit.
  const roles = opfCore.resolveColorRoles(colorScheme, {background: `#${background}`});
  const fonts = resolveFonts(fontScheme);
  for (const role of ["heading","body","code"]) fonts[role] = resolveTextStyle({fontFamily:fonts[role],fontWeight:role === "heading" ? 700 : 400},options.textMeasurement).fontFamily;
  const textColor = normalizeHex(roles.text);

  return {
    seed: Number.isInteger(options.seed) ? options.seed : DEFAULT_SEED,
    timestamp: options.timestamp ?? FIXED_TIMESTAMP,
    zipDate: options.zipDate === undefined ? FIXED_ZIP_DATE : EXPLICIT_ZIP_SENTINEL,
    zipDateStamp: resolveZipDateStamp(options.zipDate),
    compressionLevel: Number.isInteger(options.compressionLevel) ? options.compressionLevel : 6,
    layoutName: "OPF_CANVAS",
    dimensions,
    colorScheme,
    backgroundDefinition: design.background ?? theme?.background,
    fonts,
    unresolvedFontScheme,
    // The color roles a ColorRef names (primary, secondary, accent, background, surface, text, textSecondary, hyperlink).
    roles,
    colors: {
      background,
      text: textColor,
      mutedText: normalizeHex(roles.textSecondary),
      // The primary color, which the exporter draws accent fills (table headers, tag, media badge) in. The `accent` ColorRef role is roles.accent.
      accent: normalizeHex(roles.primary),
      surface: normalizeHex(roles.surface),
      border: normalizeHex(colorScheme.accent5 ?? "#CBD5E1")
    },
    variables
  };
}

function exportColor(entry, context, fallback) {
  return resolveExportColor(entry, colorContext(context, fallback));
}

// PptxGenJS color for a document color reference: a theme scheme value when the
// reference names a scheme slot or role that the deck theme holds exactly,
// otherwise the resolved literal RRGGBB. Alpha stays in the caller's transparency.
function nativeColor(reference, hex, context, fallback) {
  if (fallback !== undefined && (reference === undefined || reference === null || reference === '')) return pptxColor(fallback);
  const value = schemeColorValue(reference, hex, context, {vendor: true});
  if (value) return value;
  // PptxGenJS cannot write hlink or folHlink: a reserved literal stands in and
  // is rewritten to the scheme color in the finished slide part.
  const link = schemeColorValue(reference, hex, context);
  return (link && context.linkSentinels?.[link]) ?? normalizeHex(hex);
}

// FF-59: the slide tag is the eyebrow label. It is written in the deck primary color, the scheme accent1 slot the
// preview draws it from: a:schemeClr accent1 where the deck theme holds that exact color, the literal otherwise.
// FF-61: unless that primary is under 4.5:1 (WCAG 2.x) against the slide background, in which case the tag takes the
// slide text color, the value the title and body text get (the scheme text slot where the theme holds it). opf-render
// applies the same rule with the same arithmetic (test/tag-colour.mjs in both repositories pins the same color pairs).
const TAG_MIN_CONTRAST = 4.5;
function relativeLuminance(hex) {
  const [red, green, blue] = [0, 2, 4].map(offset => {
    const value = Number.parseInt(normalizeHex(hex).slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}
function contrastRatio(first, second) {
  const a = relativeLuminance(first), b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
// The tag's color as a literal (the one tagColor writes, resolved).
function tagHex(context) {
  return contrastRatio(context.colors.accent, context.colors.background) < TAG_MIN_CONTRAST ? context.colors.text : context.colors.accent;
}

// The defaults a rich heading or quote body is exported with on every run (weight, color, size, family). The tag records them so that
// import can tell the heading's own look from run formatting the author chose.
function richBase(fit, style, color) {
  const font = nativeFontOptions(style);
  return {bold: font.bold === true, color: `#${normalizeHex(color)}`, fontSize: Math.round(fit.fontSize * .75 * 100) / 100, fontFamily: font.fontFace};
}

function tagColor(context) {
  if (contrastRatio(context.colors.accent, context.colors.background) < TAG_MIN_CONTRAST) return context.textColor;
  return nativeColor('primary', context.colors.accent, context);
}

// A link run with no color of its own is written in the theme hyperlink color (a:schemeClr hlink where the deck theme
// holds that exact color, else the literal), underlined by PowerPoint, as the preview draws it. A run color is kept.
function linkColor(run, color, context) {
  const link = typeof run?.link === 'string' && /^(https?:|mailto:|tel:)/i.test(run.link);
  if (!link || !(run.color === undefined || run.color === null || run.color === '')) return color;
  return nativeColor('hyperlink', normalizeHex(context.roles.hyperlink), context);
}

// FF-24c: two literals no document color uses stand in for hlink and folHlink
// (see nativeColor). When the document uses every candidate, those colors stay literal.
const LINK_SENTINELS = [['FE01A0', 'FE01A1'], ['FE02B0', 'FE02B1'], ['FE03C0', 'FE03C1']];
function linkSentinels(presentation) {
  const text = JSON.stringify(presentation).toUpperCase();
  const pair = LINK_SENTINELS.find(hexes => hexes.every(hex => !text.includes(hex)));
  return pair ? {hlink: pair[0], folHlink: pair[1]} : {};
}

function writeLinkSentinels(xml, sentinels) {
  const values = Object.entries(sentinels ?? {});
  if (!values.length) return xml;
  return xml.replace(/<a:srgbClr val="([0-9A-F]{6})"(\/>|>[\s\S]*?<\/a:srgbClr>)/g, (node, hex, rest) => {
    const link = values.find(([, value]) => value === hex)?.[0];
    return link ? `<a:schemeClr val="${link}"${rest.replace(/<\/a:srgbClr>$/, '</a:schemeClr>')}` : node;
  });
}

// PptxGenJS color option: a scheme value it can emit (tx1, bg2, ...) or RRGGBB.
function pptxColor(value) {
  return /^(?:tx[12]|bg[12]|accent[1-6])$/.test(value) ? value : normalizeHex(value);
}

// Deck-level theme background for the slide master, so slides added in
// PowerPoint match. The vendored layout already uses bg1, so only a theme
// background on another slot (dark themes, light2, accents) changes the master.
function masterBackground(context) {
  const deck = {...context, schemeOverride: false};
  const value = schemeBackgroundValue(deck.backgroundDefinition, deck);
  const fill = schemeBackgroundFill(deck.backgroundDefinition, deck);
  if (!value || value === 'bg1' || !fill || fill.includes('<a:alpha')) return null;
  return {fill, text: defaultTextSchemeValues(deck).text ?? normalizeHex(context.colors.text)};
}

// The theme part carries the deck-level scheme (slide overrides stay literal)
// and, for an explicit catalog theme, that theme's name.
function exportTheme(presentation, context) {
  const reference = presentation.design?.theme;
  const id = referenceId(reference);
  const theme = id ? resolveDesignRecord(presentation, "themes", reference, DEFAULTS.theme) : null;
  const scheme = context.colorScheme;
  return {
    themeColors: themeSlotColors(scheme),
    schemeName: scheme.name ?? scheme.id ?? "OpenPresentation",
    themeName: theme?.id === id ? theme.name ?? theme.id : undefined
  };
}

function importThemeDesign(entries, presentationRoot, presentationRels) {
  const diagnostics = [], design = {};
  const report = (code, path, message) => diagnostics.push({code, path, message});
  const themePath = presentationThemePath(presentationRoot, presentationRels, path => parseRelationships(entries, path), entries);
  const theme = themePath ? parseOptionalXml(entries, themePath)?.["a:theme"] : undefined;
  const elements = theme?.["a:themeElements"];
  const clrScheme = elements?.["a:clrScheme"];
  if (!clrScheme || Array.isArray(clrScheme)) {
    report("unsupported-theme-colors", "design.colorScheme", "The PPTX has no readable theme color scheme, so design.colorScheme was not imported.");
    return {design, diagnostics};
  }
  const {colors, unreadable} = readThemeSlotColors(clrScheme);
  const records = defaultCatalog("colorSchemes");
  if (Object.keys(colors).length) design.colorScheme = recoverColorScheme({colors, unreadable, name: scalarText(clrScheme.name)}, records).value;
  if (unreadable.length) report("unsupported-theme-colors", "design.colorScheme", `Theme color slot(s) ${unreadable.join(", ")} do not resolve to an opaque sRGB color and were not imported.`);
  const latin = font => scalarText(elements?.["a:fontScheme"]?.[font]?.["a:latin"]?.typeface);
  const recoveredTheme = recoverTheme({themeName: scalarText(theme?.name), colors, majorFont: latin("a:majorFont"), minorFont: latin("a:minorFont")}, {
    themes: defaultCatalog("themes"),
    colorSchemes: records,
    fontFamilies: id => {
      const record = findById(defaultCatalog("fontSchemes"), id);
      return record ? resolveFontFamilies(record) : null;
    }
  });
  if (recoveredTheme.unverified) report("theme-unverified", "design.theme", `The native theme has the name of OPF catalog theme '${recoveredTheme.unverified}', but neither its color scheme nor its heading/body fonts match that theme, so design.theme was not set.`);
  return {design: recoveredTheme.id ? {theme: recoveredTheme.id, ...design} : design, diagnostics};
}

function configurePresentation(pptx, presentation, context) {
  pptx.defineLayout({
    name: context.layoutName,
    width: context.dimensions.widthInches,
    height: context.dimensions.heightInches
  });
  pptx.layout = context.layoutName;
  pptx.author = normalizeAuthor(presentation.author) ?? DEFAULT_AUTHOR;
  pptx.company = "OpenPresentation";
  pptx.subject = presentation.description ?? "";
  pptx.title = presentation.name ?? presentation.filename ?? "OPF Presentation";
  pptx.revision = "1";
  pptx.theme = {
    headFontFace: context.fonts.heading,
    bodyFontFace: context.fonts.body
  };
}

async function addSlide(pptx, presentation, opfSlide, slideIndex, context, options) {
  const slide = pptx.addSlide();
  const slideContext = resolveSlideContext(presentation, opfSlide, context, options, slideIndex);
  const { widthInches, heightInches } = slideContext.dimensions;
  const layout = resolveCatalogRecord(presentation, "layouts", opfSlide.layout, "blank") ?? {};
  if (opfSlide.layout && layout.id !== opfSlide.layout) throw new OPFPptxError("catalog-resolution-failed", `Layout '${opfSlide.layout}' needs an inline or bundled catalog record.`, { path: `slides.${slideIndex}.layout` });
  const composeOptions = { width: widthInches * 96, height: heightInches * 96, layout, presentation, slideIndex, fonts: slideContext.fonts, textRasterPadding:options.textRasterPadding, darkBackground: slideContext.roles.dark, textMeasurement: options.textMeasurement, date: options.date, socialPlatforms: socialPlatformRecords(presentation, options) };
  // Core resolves every shared design key once (slide design, deck design, then the layout record's design): the text alignment of
  // each item (item.alignment), and the imageFill that backgrounds and picture placements use (SlideComposition.design).
  const geometry = composeSlide(opfSlide, composeOptions);
  slideContext.imageFill = geometry.design.imageFill ?? "fit";
  // The default footer band (date left, text center, number right): where a footer added natively lands (RR-11).
  if (slideIndex === 0) context.defaultFooterOptions = composeOptions;
  slide.background = { color: slideContext.colors.background };
  const backgroundDefinition = slideContext.backgroundDefinition;
  const backgroundPath = `${opfSlide.design?.background !== undefined ? `slides.${slideIndex}.` : ''}design.background`;
  const backgroundFill = schemeBackgroundFill(backgroundDefinition, slideContext) ?? nativeBackgroundFill(backgroundDefinition, {
    width: slideContext.dimensions.widthInches, height: slideContext.dimensions.heightInches
  }, slideContext.colors.background, slideContext.colors.text, (reference, hex) => schemeColorValue(reference, hex, slideContext), reference => resolveBackgroundColorRef(reference, slideContext.colorScheme, slideContext.variables));
  if (backgroundFill) context.backgroundFills.set(`ppt/slides/slide${slideIndex + 1}.xml`, backgroundFill);
  if (backgroundDefinition?.type === 'pattern' && !nativePatternPreset(backgroundDefinition.pattern?.preset)) {
    options.onDiagnostic?.({code: 'unsupported-pattern', path: `${backgroundPath}.pattern.preset`, message: `Pattern ${backgroundDefinition.pattern?.preset} has no DrawingML preset; only its background color was exported.`});
  }
  if (backgroundDefinition?.type === 'image') {
    const imagePath = `${backgroundPath}.image`;
    // An SVG background is its PNG raster at the slide's size: a slide background picture fill carries no SVG.
    const outcome = { box: { w: slideContext.dimensions.widthInches, h: slideContext.dimensions.heightInches }, cover: (backgroundDefinition.image?.fit ?? 'cover') !== 'contain' };
    const resolved = await resolveImage(backgroundDefinition.image, presentation, options, imagePath, outcome);
    if (resolved) {
      // PptxGenJS embeds the raster and its relationship; packaging replaces
      // its stretched fill with the fitted native picture fill.
      slide.background = { ...resolved };
      context.backgroundFills.set(`ppt/slides/slide${slideIndex + 1}.xml`, { image: {
        fit: backgroundDefinition.image?.fit ?? 'cover', opacity: backgroundDefinition.opacity ?? 1, imageFill: slideContext.imageFill, path: imagePath,
        width: slideContext.dimensions.widthInches * 96, height: slideContext.dimensions.heightInches * 96, report: options.onDiagnostic
      } });
    } else if (!outcome.reported) {
      options.onDiagnostic?.({code: 'unresolved-asset', path: imagePath, message: 'The background image needs an embedded raster, a declared asset or a host imageResolver; the slide background color was exported instead.'});
    }
  }
  slide.color = slideContext.textColor;
  if (opfSlide.hidden === true) slide.hidden = true;

  for (const diagnostic of geometry.diagnostics) options.onDiagnostic?.(diagnostic);
  // The content topology (groups, regions, root form, block ids) with the leaf boxes this geometry draws.
  recordContentTopology(context.documentProvenance, opfSlide, slideIndex, geometry.items);
  // The preview paints background, slide image (and its overlay), then design.watermark, then content.
  if (geometry.slideImage) await addSlideImage(slide, presentation, geometry.slideImage, slideIndex, slideContext, options);
  await addWatermark(slide, presentation, opfSlide, slideIndex, slideContext, context, options);
  // Cover and section slides: the deck logo core composed at the top-left of the free area, after the watermark and before content.
  if (geometry.logo) await addLogo(slide, presentation, geometry.logo, slideIndex, slideContext, context, options);
  for (const item of geometry.items) {
    // Card text sits on a literal card fill, not the slide background: keep it literal.
    const itemContext = item.frameBox ? {...slideContext, textColor: slideContext.colors.text, mutedColor: slideContext.colors.mutedText} : slideContext;
    const region = { x: item.box.x / 96, y: item.box.y / 96, w: item.box.width / 96, h: item.box.height / 96 };
    if (item.frameBox) {
      const frame=item.frameBox;
      context.cardTags.set(`OPF card ${item.path}`,item.path);
      const paint=value=>({color:normalizeHex(value),transparency:/^#[0-9a-f]{8}$/i.test(value)?(1-parseInt(value.slice(7),16)/255)*100:0});
      const surface=itemContext.colorScheme.surface??itemContext.colorScheme[itemContext.roles.dark?'dark2':'light2']??`#${itemContext.colors.surface}`;
      slide.addShape('roundRect',{x:frame.x/96,y:frame.y/96,w:frame.width/96,h:frame.height/96,
        rectRadius:8*Math.min(widthInches,heightInches)/720,
        fill:paint(surface),line:{...paint(itemContext.colorScheme.accent5??`#${itemContext.colors.border}`),width:.75},objectName:`OPF card ${item.path}`});
    }
    if(['text','title','subtitle','tag'].includes(item.field)&&(item.text?.placement||item.text?.sourceLines)&&!item.text.richLines) {
      addMeasuredPayloadText(slide,item.value,item.box,itemContext,options,{path:item.path,fit:item.text,textStyle:item.textStyle,sourceText:item.field==='text'&&!!item.text.sourceLines,align:item.alignment,diagnosticsHandled:true,heading:['title','subtitle','tag'].includes(item.field)?item.field:undefined,color:item.field==='tag'?tagColor(itemContext):itemContext.textColor});
    } else if (["title", "subtitle", "tag"].includes(item.field) && !item.text?.richLines) {
      // Estimated-font headings use one native text box, which still needs a
      // role tag. Role recovery must not depend on outline measurement support.
      const objectName = `OPF heading ${item.path} line 0`;
      context.headingTags.set(objectName,{v:1,group:item.path,field:item.field,line:0,count:1});
      slide.addText(item.text.lines.join("\n"), {
        ...textBoxOptions(region, itemContext, item.text.fontSize * 0.75),
        ...nativeFontOptions(item.textStyle),
        color: item.field === "tag" ? tagColor(itemContext) : itemContext.textColor,
        align: physicalAlignment(item.alignment, item.text.directions?.[0]),
        ...(item.text.directions?.[0] === 'rtl' ? {rtlMode: true} : {}),
        objectName,
        breakLine: false
      });
    } else if ((item.field === "items" || item.field === "bullets") && item.text?.listEntries) {
      await addMeasuredList(slide,item.text,itemContext,item.path,item.bulletImage,presentation,slideIndex,options,item.payload?.numbering!==undefined);
    } else if (["text", "title", "subtitle", "tag"].includes(item.field) && item.text?.richLines) {
      // FA-10: a TextRun[] heading draws and exports like rich body text; its lines are named and tagged as a heading (the body's are not).
      const heading = item.field !== 'text';
      addRichFitLines(slide, item.text, item.box, itemContext, {
        value: item.value, alignment: item.text.placement?.alignment ?? item.alignment ?? 'left',
        fallback: item.field === 'tag' ? tagColor(itemContext) : itemContext.textColor,
        ...(heading ? {
          objectName: index => `OPF heading ${item.path} line ${index}`,
          tag: (name, index, count, boundary) => context.headingTags.set(name, {v: 1, group: item.path, field: item.field, line: index, count, ...boundary, base: richBase(item.text, item.textStyle, item.field === 'tag' ? tagHex(itemContext) : itemContext.colors.text)})
        } : {})
      });
    } else if (item.field === "text" && typeof item.value === "string") {
      slide.addText(item.text.lines.join("\n"), {...textBoxOptions(region, itemContext, item.text.fontSize * 0.75),...nativeFontOptions(item.textStyle),align:physicalAlignment(item.alignment, item.text.directions?.[0])});
    } else {
      // RR-34: a captioned item draws its media in item.box; the caption band follows as tagged text boxes linked to the media shape by name.
      const mediaNames = item.caption ? new Set([...context.imagePlacements.keys(), ...context.imagePlaceholders.keys(), ...context.chartHeadings.keys(), ...context.tableHeaders.keys()]) : undefined;
      await addPayload(slide, presentation, item.payload, region, item.path, { ...itemContext, composition: item.composition, contentAlignment: item.alignment ?? "left", direction: geometry.direction }, options, item.quoteLayout, item.codeLayout,item.metricLayout,item.timelineLayout);
      if (item.caption) {
        const mediaName = item.field === 'video' ? `OPF media ${item.path} frame` : [...context.imagePlacements.keys(), ...context.imagePlaceholders.keys(), ...context.chartHeadings.keys(), ...context.tableHeaders.keys()].find(name => !mediaNames.has(name));
        addCaption(slide, item, mediaName, itemContext, exportHelpers, (code, message) => new OPFPptxError(code, message, {path: item.caption.path}));
      }
    }
  }
  // RR-34: the footnote area core reserved above the footer band (rule plus one tagged text box per listed line).
  addFootnotes(slide, geometry.footnotes, slideIndex, slideContext, exportHelpers, (code, message) => new OPFPptxError(code, message, {path: `slides.${slideIndex}`}));
  // Core composes furniture above all content and opf-render paints it last, so
  // spTree order (PowerPoint's z-order) matches: header/footer parts come after
  // every content item, and an overlapping footer stays visible over content.
  await addFurniture(slide,presentation,opfSlide,geometry.furniture,slideContext,options,slideIndex);

  if (opfSlide.notes) {
    const notes = String(opfSlide.notes);
    slide.addNotes(notes);
    if (notes.includes('\r')) context.notesWithCarriageReturns.set(`ppt/notesSlides/notesSlide${slideIndex + 1}.xml`, notes);
  }
}

function resolveSlideContext(presentation, slide, baseContext, options, slideIndex = 0) {
  const effective = { ...presentation, design: { ...presentation.design, ...slide.design } };
  const resolved = resolvePresentationContext(effective, options);
  if (resolved.unresolvedFontScheme) {
    const path = slide.design?.fontScheme !== undefined ? `slides.${slideIndex}.design.fontScheme`
      : presentation.design?.fontScheme !== undefined ? "design.fontScheme"
      : slide.design?.theme !== undefined ? `slides.${slideIndex}.design.theme` : "design.theme";
    if (!baseContext.reportedFontSchemes?.has(path)) {
      baseContext.reportedFontSchemes?.add(path);
      const id = resolved.unresolvedFontScheme;
      options.onDiagnostic?.({ code: "unresolved-font-scheme", path, id, fallback: DEFAULTS.fontScheme, message: `Font scheme '${id}' is not in the inline or bundled catalogs; using the default font scheme '${DEFAULTS.fontScheme}'.` });
    }
  }
  if (Math.abs(resolved.dimensions.widthInches - baseContext.dimensions.widthInches) > 1e-6
    || Math.abs(resolved.dimensions.heightInches - baseContext.dimensions.heightInches) > 1e-6) {
    throw new OPFPptxError("mixed-slide-dimensions", "PowerPoint requires one canvas size per presentation. Set dimensions on the deck or export this slide separately.");
  }
  const slideContext = { ...baseContext, backgroundDefinition: resolved.backgroundDefinition, colorScheme: resolved.colorScheme, fonts: resolved.fonts, colors: resolved.colors, roles: resolved.roles, variables: resolved.variables };
  // A slide-level color scheme (directly or through a slide theme) pins every
  // named color on that slide to literal sRGB; see schemeColorValue().
  const slideScheme = themeSlotColors(resolved.colorScheme), deckScheme = baseContext.themeColors ?? {};
  slideContext.schemeOverride = slide.design?.colorScheme !== undefined
    || Object.keys({...slideScheme, ...deckScheme}).some(slot => slideScheme[slot] !== deckScheme[slot]);
  // Default and muted text follow the theme only where the background does.
  const text = defaultTextSchemeValues(slideContext);
  slideContext.textColor = text.text ?? resolved.colors.text;
  slideContext.mutedColor = text.muted ?? resolved.colors.mutedText;
  return slideContext;
}

function fieldToType(field) {
  return field === "items" || field === "bullets" ? "list" : field;
}

async function addPayload(slide, presentation, payload, region, path, context, options, quoteLayout, codeLayout,metricLayout,timelineLayout) {
  const kind = inferPayloadKind(payload);
  switch (kind) {
    case "text":
      addTextPayload(slide, payload.text ?? payload.bullets, region, context);
      break;
    case "list":
      addListPayload(slide, payload.items ?? payload.bullets, region, context);
      break;
    case "image":
      await addImagePayload(slide, presentation, payload.image, region, path, context, options);
      break;
    case "video":
      addMediaPayload(slide, presentation, payload.video, region, path, context, options);
      break;
    case "chart":
      addChartPayload(slide, payload.chart, region, context, options, path, presentation);
      break;
    case "table":
      addTablePayload(slide, payload.table, region, context, options, path, presentation);
      break;
    case "code":
      addCodePayload(slide, payload.code, codeLayout, region, context, path, options);
      break;
    case "metric":
      addMetricPayload(slide, payload.metric,metricLayout,context,path,options);
      break;
    case "quote":
      await addQuotePayload(slide, presentation, payload.quote, quoteLayout, context, options, path);
      break;
    case "timeline":
      addTimelinePayload(slide, payload.timeline, timelineLayout, context, options, path);
      break;
    default:
      options.onDiagnostic?.({code: "content-placeholder", path, reason: "unsupported-payload", message: "This content has no PowerPoint export; a placeholder frame stands in for it."});
      addPlaceholderPayload(slide, "Unsupported content", "This content has no PowerPoint export.", region, context);
  }
}

function inferPayloadKind(payload) {
  if (payload?.type === "list") return "list";
  if (payload?.type && ROOT_PAYLOAD_FIELDS.includes(payload.type)) return fieldToType(payload.type);
  if (payload?.items !== undefined) return "list";
  for (const field of ROOT_PAYLOAD_FIELDS) {
    if (payload?.[field] !== undefined) return fieldToType(field);
  }
  return "unknown";
}

function addTextPayload(slide, value, region, context) {
  if (Array.isArray(value)) {
    slide.addText(textRuns(value, context, 18), textBoxOptions(region, context, 18));
    return;
  }
  if (Array.isArray(value?.bullets)) {
    addListPayload(slide, value.bullets, region, context);
    return;
  }
  slide.addText(stringifyText(value), textBoxOptions(region, context, 18));
}

function richLineRuns(line,color,native,context) {
  const fallback=color.replace(/^#/,'');
  return line.fragments.map(fragment=>{
    const runColor=exportColor(fragment.run.color,context,fallback),color=nativeColor(fragment.run.color,runColor,context,native);
    return {text:fragment.text,options:{...nativeFontOptions(fragment.style),fontSize:(fragment.nominalSize??fragment.fontSize)*.75,color:linkColor(fragment.run,color,context),underline:fragment.run.underline?{style:'sng',color:linkColor(fragment.run,color,context)}:undefined,strike:fragment.run.strikethrough?'sngStrike':undefined,baseline:fragment.baselineShift?-fragment.baselineShift/(fragment.nominalSize??fragment.fontSize)*2000:undefined,hyperlink:fragment.run.link&&/^(https?:|mailto:|tel:)/i.test(fragment.run.link)?{url:fragment.run.link}:undefined,...langOptions(context,fragment.style.lang)}};
  });
}
// Every native line of a list, marker paragraph or not, is named for the list's
// composed path (`OPF list <path> line N`, N counting across the whole list) like
// the other measured text shapes. A reader maps lines to their list by name, not
// by geometry, so lines of an overflowing list that fall below its box still
// belong to it.
// design.listBullet: image (core's item.bulletImage, the deck's icon logo) makes every entry marker a native picture bullet.
// PptxGenJS embeds the media and its relationship through one picture per slide (OPF bullet image); packaging removes
// that picture and points each marker paragraph at the relationship with a:buBlip. An icon that cannot be embedded
// keeps the character bullets, as the preview does.
async function addMeasuredList(slide,fit,context,path,bulletImage,presentation,slideIndex,options,numbered=false) {
  // RR-33: a numbered list writes native auto-numbers (a:buAutoNum) at core's marker geometry. Core older than the numbering
  // release composes bullet markers, so nothing numbered can be written; say so instead of exporting bullets silently.
  if(numbered&&!fit.listEntries.some(entry=>entry.marker.number))options.onDiagnostic?.({code:'numbering-unsupported-core',path,message:'The installed @openpresentation/opf does not compose numbered lists (numbering), so the list is exported with bullets. Use a core release that supports numbering.'});
  let picture=false;
  if(bulletImage){
    const part=`ppt/slides/slide${slideIndex+1}.xml`;
    if(context.bulletImages.has(part))picture=context.bulletImages.get(part);
    else{
      // A picture bullet (a:buBlip) can only reference a raster: an SVG icon is its PNG fallback.
      const outcome={box:{w:.5,h:.5}};
      const resolved=await resolveImage(bulletImage.source,presentation,options,bulletImage.path,outcome);
      if(resolved){
        slide.addImage({...resolved,objectName:bulletImageName(),x:0,y:0,w:.1,h:.1,altText:''});
        picture=true;
      }else if(!outcome.reported)options.onDiagnostic?.({code:'unresolved-asset',path:bulletImage.path,message:'A picture bullet needs an embedded raster, a declared asset or a host imageResolver; the character bullets were exported instead.'});
      context.bulletImages.set(part,picture);
    }
  }
  let lineNumber=0;
  for(const entry of fit.listEntries){
    const addLines=(text,box,color,native,withBullet)=>{
      text.richLines.forEach((line,index)=>{
        const first=withBullet&&index===0,level=Math.min(8,entry.level),inset=first?entry.marker.indent*(level+1):0;
        // Right to left (RR-05): the bullet column is at the right, so the first line's box extends right to hold it and the paragraph
        // is rtl with its text aligned to the right; marL/indent are the start-side margin and hanging indent in PowerPoint.
        const entryRtl=entry.direction==='rtl';
        const region={x:(entryRtl?box.x:box.x-inset)/96,y:(box.y+line.y)/96,w:(box.width+inset)/96,h:line.height/96};
        const lineDirection=(text.directions?.[index])??entry.direction;
        const lineAlign=physicalAlignment('left',lineDirection);
        const objectName=`OPF list ${path} line ${lineNumber++}`;
        const number=first?entry.marker.number:undefined;
        if(first)context.listMarkers.set(objectName,{fontFamily:entry.marker.style.fontFamily,fontSize:entry.marker.fontSize*.75,color:pptxColor(context.textColor),picture:number?false:picture});
        const paragraph=first?{bullet:number?{type:'number',style:autoNumScheme(number.style,number.suffix),startAt:number.value,indent:entry.marker.indent*.75}:{characterCode:entry.marker.text.codePointAt(0).toString(16).padStart(4,'0'),indent:entry.marker.indent*.75},indentLevel:level}:{bullet:false};
        const runs=richLineRuns(line,color,native,context);
        if(!runs.length)runs.push({text:'',options:{}});
        // Keep paragraph intent identical across runs. ZIP normalization below
        // removes the duplicate paragraph-property nodes emitted by PptxGenJS.
        for(const run of runs)Object.assign(run.options,paragraph,lineDirection==='rtl'?{rtlMode:true}:{});
        slide.addText(runs,{...textBoxOptions(region,context,text.fontSize*.75),fontFace:nativeFontOptions(entry.marker.style).fontFace,objectName,align:lineAlign,fit:'none',wrap:false,lineSpacingMultiple:1,...paragraph});
      });
    };
    addLines(entry.text,entry.textBox,context.colors.text,context.textColor,true);
    if(entry.description)addLines(entry.description,entry.descriptionBox,context.colors.mutedText,context.mutedColor,false);
  }
}

function addListPayload(slide, items, region, context) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) {
    slide.addText("", textBoxOptions(region, context, 16));
    return;
  }

  const runs = [];
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    const level = isPlainObject(item) && Number.isInteger(item.level) ? item.level : 0;
    runs.push({
      text: stringifyText(isPlainObject(item) ? item.text : item),
      options: {
        bullet: { type: "bullet", indent: 14 + level * 14 },
        breakLine: index < list.length - 1 || Boolean(isPlainObject(item) && item.description),
        color: context.textColor,
        fontFace: context.fonts.body,
        fontSize: 15,
        hanging: 4 + level * 10
      }
    });
    if (isPlainObject(item) && item.description) {
      runs.push({
        text: stringifyText(item.description),
        options: {
          breakLine: index < list.length - 1,
          color: context.mutedColor,
          fontFace: context.fonts.body,
          fontSize: 11,
          margin: [0, 0, 0, 18 + level * 14]
        }
      });
    }
  }

  slide.addText(runs, textBoxOptions(region, context, 15));
}

async function addImagePayload(slide, presentation, asset, region, path, context, options) {
  const outcome = { box: region, cover: context.imageFill === 'crop' };
  const resolved = await resolveImage(asset, presentation, options, path, outcome);
  if (!resolved) {
    addImagePlaceholder(slide, presentation, asset, region, path, context, options);
    return;
  }
  const objectName = `OPF image ${context.imagePlacements.size + 1}`;
  context.imagePlacements.set(objectName, { region, mode: context.imageFill, path });
  if (outcome.svg) context.svgPictures.set(objectName, outcome.svg);
  context.pictureText.set(objectName, pictureText(assetAlt(asset, presentation), asset, presentation));
  slide.addImage({
    ...resolved,
    objectName,
    x: region.x,
    y: region.y,
    w: region.w,
    h: region.h,
    altText: assetAlt(asset, presentation)
  });
  return objectName;
}

// design.watermark: one native picture per slide, added after the slide image
// (and its overlay) and before all content, the preview's paint order. The
// slide's own design.watermark replaces the deck's, and false suppresses it.
// Frame, fit and opacity are written after PptxGenJS embeds the bytes.
async function addWatermark(slide, presentation, opfSlide, slideIndex, slideContext, context, options) {
  const local = opfSlide.design?.watermark !== undefined;
  const watermark = local ? opfSlide.design.watermark : presentation.design?.watermark;
  if (watermark === undefined || watermark === null || watermark === false) return;
  const path = local ? `slides.${slideIndex}.design.watermark` : 'design.watermark';
  // The schema requires exactly one of src and text, so there is no source-less watermark to report.
  const asset = watermark;
  const {widthInches, heightInches} = slideContext.dimensions;
  // FA-13: a text watermark is one native text box with the opacity as text alpha, centered and rotated as core's layoutWatermark says.
  if (isPlainObject(asset) && typeof asset.text === 'string') {
    addTextWatermark(slide, asset, slideIndex, {width: widthInches * 96, height: heightInches * 96}, slideContext, context, options, path);
    return;
  }
  const box = watermarkBox(widthInches, heightInches);
  const outcome = {box};
  const resolved = await resolveImage(asset, presentation, options, path, outcome);
  if (!resolved) {
    if (!outcome.reported) options.onDiagnostic?.({code: 'unresolved-asset', path, message: 'The watermark image needs an embedded raster, a declared asset or a host imageResolver; no watermark was exported for this slide.'});
    return;
  }
  const opacity = watermarkOpacity(watermark);
  context.watermarks.set(`ppt/slides/slide${slideIndex + 1}.xml`, {slide: `slides.${slideIndex}`, box, opacity, path});
  // Opacity is an a:alphaModFix on the blip, which PowerPoint applies to an SVG picture (native check 2026-10-01).
  if (outcome.svg) context.svgPictures.set(`ppt/slides/slide${slideIndex + 1}.xml|${watermarkName()}`, outcome.svg);
  slide.addImage({...resolved, objectName: watermarkName(), ...box, altText: assetAlt(asset, presentation) ?? 'Watermark'});
}

// The stamp takes the slide's own resolved fonts and default text color (readable on that slide's background), as the preview does.
function addTextWatermark(slide, watermark, slideIndex, size, slideContext, context, options, path) {
  if (typeof opfCore.layoutWatermark !== 'function') {
    options.onDiagnostic?.({code: 'watermark-not-exported', path, message: 'The installed @openpresentation/opf has no layoutWatermark, so the text watermark was not exported. Use a core release that exports it.'});
    return;
  }
  const layout = opfCore.layoutWatermark(watermark.text, size, {fontFamily: slideContext.fonts.heading, fontWeight: 700, textMeasurement: options.textMeasurement});
  if (!layout) {
    options.onDiagnostic?.({code: 'watermark-not-exported', path, message: 'The text watermark has no text; no watermark was exported for this slide.'});
    return;
  }
  const opacity = watermarkOpacity(watermark);
  const {box} = layout;
  slide.addText(layout.text, {
    ...textBoxOptions({x: box.x / 96, y: box.y / 96, w: box.width / 96, h: box.height / 96}, slideContext, layout.fontSize * .75),
    ...nativeFontOptions(layout.style), bold: true,
    color: slideContext.textColor, transparency: Math.round((1 - opacity) * 100000) / 1000,
    align: 'center', valign: 'middle', fit: 'none', wrap: false, lineSpacingMultiple: 1,
    rotate: (layout.rotation + 360) % 360, objectName: watermarkTextName()
  });
  context.textWatermarks.set(`ppt/slides/slide${slideIndex + 1}.xml`, {slide: `slides.${slideIndex}`, text: layout.text, opacity});
}

// The deck logo (design.logo, a slide's own logo or the primary organization's) on a cover or section slide: one native
// picture per slide at core's geometry.logo box, fitted without cropping, anchored left and vertically centered, after
// the watermark and before content (the preview's paint order). The frame and the provenance tag are written after
// PptxGenJS embeds the bytes. An unresolved source draws the preview's "Image unavailable" panel in the logo box.
async function addLogo(slide, presentation, logo, slideIndex, slideContext, context, options) {
  const region = {x: logo.box.x / 96, y: logo.box.y / 96, w: logo.box.width / 96, h: logo.box.height / 96};
  const outcome = {box: region};
  const resolved = await resolveImage(logo.source, presentation, options, logo.path, outcome);
  if (!resolved) {
    if (!outcome.reported) options.onDiagnostic?.({code: 'unresolved-asset', path: logo.path, message: 'The logo needs an embedded raster, a declared asset or a host imageResolver; the logo panel shows "Image unavailable" instead.'});
    const prefix = addImagePlaceholder(slide, presentation, logo.source, region, logo.path, slideContext, options, {logo: true});
    if (prefix) context.logoPlaceholderTags.set(prefix, {v: 1, role: 'placeholder', slide: `slides.${slideIndex}`, path: logo.path});
    return;
  }
  context.logos.set(`ppt/slides/slide${slideIndex + 1}.xml`, {slide: `slides.${slideIndex}`, box: region, path: logo.path, variant: logo.variant, anchor: logo.anchor ?? 'left'});
  if (outcome.svg) context.svgPictures.set(`ppt/slides/slide${slideIndex + 1}.xml|${logoName()}`, outcome.svg);
  slide.addImage({...resolved, objectName: logoName(), ...region, altText: assetAlt(logo.source, presentation) ?? 'Logo'});
}

// design.slideImage: one native picture at the shared frame, beneath content.
// Crop/fit and treatments are written after PptxGenJS embeds the bytes.
async function addSlideImage(slide, presentation, image, slideIndex, context, options) {
  const box = { x: image.box.x / 96, y: image.box.y / 96, w: image.box.width / 96, h: image.box.height / 96 };
  const outcome = { box, cover: image.fill === 'crop' };
  const resolved = await resolveImage(image.value, presentation, options, image.sourcePath, outcome);
  if (!resolved) {
    addImagePlaceholder(slide, presentation, image.value, box, image.sourcePath, context, options);
    return;
  }
  const objectName = slideImageName(`slides.${slideIndex}`);
  const configured = image.path === 'design.slideImage' ? presentation.design?.slideImage : presentation.slides[slideIndex].design?.slideImage;
  const { src: _source, ...treatment } = isPlainObject(configured) && 'position' in configured ? configured : {};
  const paint = (entry, fallback) => {
    const hex = normalizeHex(exportColor(entry, context, fallback), fallback);
    const raw = exportColor(entry, context, fallback).replace(/^#/, '');
    return { hex, alpha: /^[0-9a-f]{8}$/i.test(raw) ? parseInt(raw.slice(6), 16) / 255 : 1 };
  };
  // Native effects are resolved here, in the slide's color context.
  const effects = {
    shape: image.shape ?? null,
    border: image.border ? { ...paint(image.border.color, context.colors.border), width: image.border.width } : null,
    opacity: image.opacity ?? null,
    recolor: image.recolor?.type === 'grayscale' ? { type: 'grayscale' }
      : image.recolor?.type === 'duotone' ? { type: 'duotone', dark: paint(image.recolor.dark, '000000'), light: paint(image.recolor.light, 'FFFFFF') } : null,
    overlay: image.overlay ? { ...paint(image.overlay.color, context.colors.text), opacity: image.overlay.opacity, box: image.overlay.box, shape: image.overlay.shape } : null,
  };
  // FF-53: a root `image` with the slide image's source is the slide image (core `replacesContent`); the
  // manifest records that so an unchanged picture imports back as both design.slideImage and slide.image.
  context.slideImages.set(objectName, { slide: `slides.${slideIndex}`, box, fill: image.fill, path: image.sourcePath, treatment: { ...treatment, position: image.position }, effects, content: image.replacesContent === true });
  // PowerPoint applies opacity (a:alphaModFix), grayscale (a:grayscl) and the border (a:ln) to an SVG picture (native check
  // 2026-10-01). A duotone recolor and a non-rectangular mask are not confirmed on an SVG picture: with either the SVG stays its
  // PNG raster, so the effect applies as in the preview.
  if (outcome.svg) {
    const treated = [effects.recolor?.type === 'duotone' && 'duotone recolor', effects.shape && effects.shape.preset !== 'rect' && 'shape'].filter(Boolean);
    if (treated.length) options.onDiagnostic?.({ code: 'svg-image-rasterized', path: image.sourcePath, message: `An SVG slide image with ${treated.join(', ')} exports as its PNG raster, so the effect applies as in the preview; PowerPoint has not been confirmed to apply it to an SVG picture.` });
    else context.svgPictures.set(objectName, outcome.svg);
  }
  const slideImageAlt = image.alt ?? assetAlt(image.value, presentation);
  context.pictureText.set(objectName, pictureText(slideImageAlt, image.value, presentation));
  slide.addImage({ ...resolved, objectName, ...box, altText: slideImageAlt });
  // The overlay scrim is a separate native shape directly above the picture.
  if (effects.overlay) {
    const overlay = effects.overlay.box;
    slide.addShape('rect', { x: overlay.x / 96, y: overlay.y / 96, w: overlay.width / 96, h: overlay.height / 96, objectName: slideImageOverlayName(`slides.${slideIndex}`), fill: { color: effects.overlay.hex } });
  }
}

// FF-62: chart text is one size. The preview draws every chart label (axis, legend, data label) at
// max(14, composition.minFontSize ?? 16) px scaled by the slide's shorter side over 720 px (renderer charts.js, `fontPx`),
// the readability floor: 12 pt on a 13.33 x 7.5 in slide. The export writes that size, in hundredths of a point (DrawingML `sz`).
// RR-16: core composes every font size on PowerPoint's 0.01 pt grid (1/75 px), so the preview draws the grid size, not the raw
// product: the floor rounds up (core `snapFontSizeUp`) and an unfloored request of 14 px rounds down (`snapFontSizeDown`).
// Math.round differed from the preview by 0.01 pt on slide sizes whose scale is not a whole number (A4, Letter, 16:10).
function chartTextSize(context) {
  const scale = Math.min(context.dimensions.widthInches, context.dimensions.heightInches) * 96 / 720;
  const floor = context.composition?.minFontSize ?? 16;
  const hundredths = Math.max(14, floor) * scale * 75;
  return floor >= 14 ? Math.ceil(hundredths - 1e-6) : Math.floor(hundredths + 1e-6);
}

// Every c:txPr of a generated classic chart carries the chart text size: PptxGenJS writes no size on the legend (PowerPoint's
// 18 pt default) and hardcodes 18 pt on pie and doughnut data labels. Only the size changes; faces and colours stay as written.
function applyChartTextSize(xml, size) {
  return xml.replace(/<c:txPr>[\s\S]*?<\/c:txPr>/g, properties => properties.replace(/<a:defRPr\b([^>]*?)(\/?)>/g, (match, attributes, close) =>
    `<a:defRPr${/\bsz="[^"]*"/.test(attributes) ? attributes.replace(/\bsz="[^"]*"/, `sz="${size}"`) : `${attributes} sz="${size}"`}${close}>`));
}

function addChartPayload(slide, chart, region, context, options = {}, path = "chart", presentation) {
  const chartData = toPptxChartData(chart, context.chartexMode, presentation);
  if (!chartData.series) {
    // Never lose a chart silently: the placeholder frame stands in for it, and a diagnostic names the reason.
    options.onDiagnostic?.({code: "chart-data-unplottable", path, message: chartData.message, reason: chartData.reason});
    addPlaceholderPayload(slide, "Chart", chartData.summary, region, context);
    return;
  }
  // RR-54: one strict-number diagnostic per chart, and core's mapping warnings (chart-mapping-adapted) on the chart's path.
  if (chartData.notNumeric) options.onDiagnostic?.({code: "chart-value-not-numeric", path, message: chartData.notNumeric.message, count: chartData.notNumeric.count});
  for (const entry of chartData.diagnostics ?? []) options.onDiagnostic?.({code: entry.code, path, message: entry.message, pointer: entry.path});
  for (const {adaptation, message} of chartData.adaptations ?? []) options.onDiagnostic?.({code: "chart-data-adapted", path, message, adaptation});
  // RR-35: axis titles, legend position and data labels (core resolves them against what the chart type can show).
  const chartOptions = resolveChartOptionsFor(chart);
  reportChartOptionDiagnostics(chartOptions, path, options.onDiagnostic);

  // Keep the resolved palette surface (including alpha) explicit in native
  // chart/plot areas, so inherited labels are assessed against their own panel.
  const panelFill = context.colorScheme.surface ?? context.colorScheme[context.roles.dark ? 'dark2' : 'light2'] ?? `#${context.colors.surface}`;
  const labelColor = normalizeHex(textColorForFill(panelFill, `#${context.colors.text}`));
  const transparency = /^#[0-9a-f]{8}$/i.test(panelFill) ? (1 - parseInt(panelFill.slice(7), 16) / 255) * 100 : 0;
  const fill = {color:normalizeHex(panelFill),transparency};
  const objectName = `OPF chart ${context.chartHeadings.size + 1}`;
  const circular = chartData.type === 'pie' || chartData.type === 'doughnut';
  const textSize = chartTextSize(context);
  // RR-54: the columns' number formats (Excel codes per exported series) for the caches, labels, value axis and workbook.
  // The value axis shows the first plotted series' format (General when it has none), as the preview does.
  // A combo chart's secondary value axis shows its first series' format (FA-15).
  const secondaryIndex = chartData.combo?.findIndex((entry) => entry.axis === 'secondary') ?? -1;
  const numberFormats = chartData.formats && {...chartData.formats, axis: chartData.spec.grouping === 'percentStacked' ? undefined : chartData.formats.series[0],
    ...(secondaryIndex >= 0 ? {secondaryAxis: chartData.formats.series[secondaryIndex]} : {}),
    labels: !chartOptions?.dataLabels?.content?.includes('percent'), scatter: chartData.type === 'scatter'};
  context.chartHeadings.set(objectName,{heading:chartData.type === 'scatter' ? undefined : chartData.heading,labelColor,spec:chartData.spec,textSize,
    options:chartOptions,kind:chartTargetFor(chart.type)?.kind,pointCount:chartData.pointCount,numberFormats});
  recordPayloadData(context, objectName, 'chart', presentation, path);
  context.chartFonts.set(objectName,{heading:context.fonts.heading,body:context.fonts.body});
  // FA-09: the chart's text alternative (the frame's descr; the empty string is PowerPoint's decorative marker), applied before the chartex frame copies the head.
  if (typeof chart.alt === 'string') context.chartAlts.set(objectName, chart.alt);
  const preferredPalette = CHART_COLORS.map(color=>`#${color}`);
  const palette = (typeof opfComposition.chartPaletteForFill === "function" ? opfComposition.chartPaletteForFill(panelFill, preferredPalette) : preferredPalette.map(color=>chartColorForFill(panelFill,color))).map(color=>normalizeHex(color));
  // FA-14: chart.highlight. A highlighted chart writes accent and muted colours over the series palette, and its data labels
  // contrast with those colours (src/chart-highlight.js).
  const highlight = chartData.chartex ? undefined : chartHighlightPlan({options: chartOptions, data: chartData.resolved, kind: chartTargetFor(chart.type)?.kind, panelFill, labelColor, primary: `#${context.colors.accent}`,
    schemeFor: hex => schemeColorValue('primary', hex, context)});
  context.chartPalettes.set(objectName,highlight ? highlight.seriesFills : palette);
  if (highlight) context.chartHeadings.get(objectName).highlight = highlight;
  if (chartData.chartex) {
    // The native chartex part is added when the package is normalized (attachChartexParts); the classic chart below becomes its fallback.
    // PptxGenJS rewrites the series it is given (labels become nested levels), so the chartex part keeps its own copy.
    const series = chartData.series.map((entry) => ({name: entry.name, labels: [...entry.labels], values: [...entry.values]}));
    context.chartex.set(objectName, {spec: chartData.chartex, series, hasCategories: chartData.hasCategories, fill, labelColor, gridColor: context.colors.border, font: context.fonts.body, palette, textSize, options: chartOptions, ...(numberFormats ? {formats: numberFormats.series} : {})});
    if (chartData.chartex.layoutId === 'regionMap') {
      options.onDiagnostic?.({code: "chart-map-geodata", path, message: `The '${stringifyText(chart.type)}' chart is exported as a native PowerPoint map (chartex regionMap) without cached geography (no cx:geoCache; provider data is never fabricated): PowerPoint must fetch the region shapes from its online map service when the deck is opened, and until it does it shows "There was a problem getting the information for your map chart" and draws nothing. The clustered column fallback shows the same values in readers without chartex support.`});
    }
  }
  const percent = chartData.spec.grouping === 'percentStacked';
  // RR-36: a series has one colour, as the preview draws it (opf-render paints series j with palette colour j; only pie,
  // doughnut and treemap slices take a colour per category). PptxGenJS writes a c:dPt per point, cycling the palette, for a
  // bar chart with one series whenever chartColors is a custom array of more than one colour, so PowerPoint drew each
  // column of a single-series column or bar chart in a different colour. One colour for that series writes no c:dPt.
  const chartColors = chartData.type === 'bar' && chartData.series.length === 1 ? palette.slice(0, 1) : palette;
  const chartOptionsXml = {
    objectName,
    x: region.x,
    y: region.y,
    w: region.w,
    h: region.h,
    showLegend: circular || chartData.series.length > (chartData.type === 'scatter' ? 2 : 1),
    ...classicChartOptions(chartOptions, {labelColor, font: context.fonts.body, textSize}),
    showTitle: false,
    chartColors,
    chartArea: {fill:{...fill},roundedCorners:false},
    // Paint alpha once in the chart area, rather than stacking two alpha fills.
    plotArea: {fill:{color:null}},
    catAxisLabelFontFace: context.fonts.body,
    catAxisLabelFontSize: textSize / 100,
    catAxisLabelColor: labelColor,
    valAxisLabelFontFace: context.fonts.body,
    valAxisLabelFontSize: textSize / 100,
    valAxisLabelColor: labelColor,
    legendColor: labelColor,
    legendFontFace: context.fonts.body,
    legendFontSize: textSize / 100,
    dataLabelColor: labelColor,
    dataLabelFontSize: textSize / 100,
    showValue: false,
    valGridLine: { color: context.colors.border, transparency: 30, size: 1 },
    barDir: chartData.barDir,
    barGrouping: chartData.barGrouping,
    // Right to left (RR-05): column, line and area charts reverse their categories (c:catAx orientation maxMin), which also moves the
    // value axis to the right, as the preview draws them. Bar charts keep their vertical category axis.
    ...(context.direction === 'rtl' && ((chartData.type === 'bar' && chartData.barDir === 'col') || chartData.type === 'line' || chartData.type === 'area') ? { catAxisOrientation: 'maxMin' } : {}),
    ...(percent ? { valAxisLabelFormatCode: '0%' } : {}),
    ...(chartData.spec.markers === undefined ? {} : { lineDataSymbol: chartData.spec.markers ? 'circle' : 'none' }),
    ...(chartData.spec.radarStyle ? { radarStyle: chartData.spec.radarStyle } : {}),
    // ScatterWithMarkers: markers only, no connecting line.
    ...(chartData.type === 'scatter' ? { lineSize: 0, lineDataSymbol: 'circle' } : {})
  };
  if (chartData.combo?.length && chartData.combo.length === chartData.series.length) {
    slide.addChart(...comboChart(chartData, chartOptionsXml, {palette, chartOptions, labelColor, font: context.fonts.body, textSize}));
    return;
  }
  slide.addChart(chartData.type, chartData.series, chartOptionsXml);
}

// FA-15: a combo chart is one PptxGenJS multi-type chart: a clustered column c:barChart on the primary axes, a c:lineChart with
// markers for the primary-axis lines, and one for the secondary-axis lines on a second c:valAx (at the right, crossing at the
// maximum of a deleted second c:catAx). Each series keeps its palette colour by its index in the whole chart (PptxGenJS restarts
// the colour cycle per chart type), and the embedded workbook holds every series. The secondary axis has no gridlines and only
// its own title; applyComboConstruct puts the line groups into schema order afterwards.
function comboChart(chartData, options, {palette, chartOptions, labelColor, font, textSize}) {
  const series = chartData.series.map((entry, index) => ({...entry, color: palette[index % palette.length]}));
  const part = (role, axis) => series.filter((_, index) => chartData.combo[index].role === role && (role === 'bar' || chartData.combo[index].axis === axis));
  const bars = part('bar'), primaryLines = part('line', 'primary'), secondaryLines = part('line', 'secondary');
  const lineOptions = {lineDataSymbol: 'circle'};
  const types = [
    // The column group's own colour list: with one column series, a longer list would make PptxGenJS colour each column (c:dPt, RR-36).
    ...(bars.length ? [{type: 'bar', data: bars, options: {barDir: 'col', barGrouping: 'clustered', chartColors: bars.map((entry) => entry.color)}}] : []),
    ...(primaryLines.length ? [{type: 'line', data: primaryLines, options: lineOptions}] : []),
    ...(secondaryLines.length ? [{type: 'line', data: secondaryLines, options: {...lineOptions, secondaryValAxis: true, secondaryCatAxis: true}}] : []),
  ];
  // A gap in a line series breaks the line, as the preview draws it (PptxGenJS defaults to span).
  const {barGrouping: _grouping, ...rest} = options;
  const shared = {...rest, displayBlanksAs: 'gap'};
  if (!secondaryLines.length) return [types, {...shared, barDir: 'col'}];
  const title = chartOptions?.axisTitles?.secondary;
  const secondaryValue = {valGridLine: {style: 'none'}, showValAxisTitle: Boolean(title), ...(title ? {valAxisTitle: title, valAxisTitleColor: labelColor, valAxisTitleFontFace: font, valAxisTitleFontSize: textSize / 100} : {})};
  return [types, {...shared, barDir: 'col', valAxes: [{}, secondaryValue], catAxes: [{}, {catAxisHidden: true, showCatAxisTitle: false}]}];
}

// RR-54: a chart or table that uses a dataset, DataColumn objects, a mapping, a data source or number formats records its
// authored data form on its native frame (src/data-provenance.js), in `full` provenance mode only. `path` is the composed
// item's path ("slides.0.blocks.1.chart"), which names the authored value (composition hands over the inline copy).
function recordPayloadData(context, objectName, kind, presentation, path, layout) {
  if (context.provenanceMode !== 'full' || !context.dataRecords || !presentation) return;
  let authored = presentation;
  for (const key of String(path).split('.')) authored = authored !== null && typeof authored === 'object' ? authored[Array.isArray(authored) ? Number(key) : key] : undefined;
  const record = kind === 'chart' ? chartDataRecord(authored, presentation.datasets) : tableDataRecord(authored, layout);
  if (record) {
    context.dataRecords.set(objectName, record);
    context.dataRecordPaths.set(objectName, String(path));
  }
}

function addTablePayload(slide, authoredTable, region, context, options, path, presentation) {
  // RR-54: a dataset-backed table is laid out as its inline copy (composition normally hands that over already); core's
  // layout gives each body cell its display text (a number with a format becomes its formatted text) and each DataColumn
  // header its name.
  const table = inlineTableData(authoredTable, presentation);
  const scale = Math.min(context.dimensions.widthInches * 96, context.dimensions.heightInches * 96) / 720;
  const hasHeaders = Array.isArray(table?.columns) && table.columns.length > 0;
  const sourceRows = [...(hasHeaders ? [table.columns] : []), ...(table?.rows ?? [])];
  if (sourceRows.length === 0) {
    options?.onDiagnostic?.({code: "content-placeholder", path, reason: "table-has-no-rows", message: "The table has no rows and no header; a placeholder frame stands in for it."});
    addPlaceholderPayload(slide, "Table", "The table has no rows.", region, context);
    return;
  }

  const layout = layoutTable(table, {x:region.x*96,y:region.y*96,width:region.w*96,height:region.h*96}, {
    scale, minFontSize:context.composition?.minFontSize, fontFamily:context.fonts.body, textMeasurement:options.textMeasurement, path,
    ...(context.direction === 'rtl' ? {direction: 'rtl'} : {}), ...(presentation ? {presentation} : {})
  });
  const columnCount = layout.columnCount;
  const rows = layout.rows.map(row => row.cells.map(cell => {
    const {header,rich,fit} = cell;
    const cellStyle = cell.style ?? {};
    const defaultFillHex = header ? context.colors.accent : context.colors.surface;
    const baseFill = exportColor(cellStyle.fill ?? defaultFillHex, context, defaultFillHex);
    // FF-24c: engine chrome resolves from scheme roles (header accent1, body surface), so it follows the deck theme like a named fill.
    const fillReference = cellStyle.fill ?? (header ? 'accent1' : 'surface');
    const fillValue = schemeColorValue(fillReference, baseFill, context);
    const inheritedText = textColorForFill(`#${baseFill}`, header ? "#FFFFFF" : `#${context.colors.text}`);
    const baseColor = exportColor(cellStyle.color ?? inheritedText.replace(/^#/, ""), context, inheritedText.replace(/^#/, ""));
    // Default cell text follows the theme only with a theme-referenced fill: paired slot on a light or dark fill, light1/dark1 on an accent fill.
    const defaultText = cellStyle.color === undefined ? tableTextSchemeValue(fillValue, baseColor, context) : undefined;
    const alpha = value => value.length === 8 ? (1 - parseInt(value.slice(6), 16) / 255) * 100 : 0;
    const text = stringifyText(cell.value), style = cell.textStyle;
    const fragments = rich ? fit.richLines.flatMap(line => line.fragments) : [];
    const runs = rich ? cell.value.flatMap((value, index) => {
      const run = typeof value === 'string' ? {text:value} : value;
      const fragment = fragments.find(item => item.runIndex === index);
      const runStyle = fragment?.style ?? resolveTextStyle({...style,fontFamily:run.fontFamily ?? style.fontFamily,fontWeight:run.bold === undefined ? style.fontWeight : run.bold ? 700 : 400,italic:run.italic ?? style.italic}, options.textMeasurement);
      const rawColor = run.color !== undefined && run.color !== '' ? exportColor(run.color, context, baseColor) : baseColor;
      const color = nativeColor(run.color !== undefined && run.color !== '' ? run.color : cellStyle.color, rawColor, context, defaultText), transparency = rawColor.length === 8 ? (1 - parseInt(rawColor.slice(6), 16) / 255) * 100 : 0;
      const runOptions = {
        ...nativeFontOptions(runStyle),fontSize:fragment ? fragment.fontSize * .75 : fit.fontSize * .75,
        underline:run.underline ? {style:'sng',color:linkColor(run,color,context)} : undefined,strike:run.strikethrough ? 'sngStrike' : undefined,
        color:linkColor(run,color,context),transparency,baseline:fragment?.baselineShift ? -fragment.baselineShift / fragment.fontSize * 2000 : undefined,
        hyperlink:run.link && /^(https?:|mailto:|tel:)/i.test(run.link) ? {url:run.link} : undefined,
      };
      // PptxGenJS marks every part of a newline-containing run as a paragraph
      // break, including its final part. Split explicitly so the next styled
      // run stays on that final line, and preserve empty/trailing lines.
      const parts = run.text.split(/\r*\n/);
      return parts.map((text, part) => ({text,options:{...runOptions,breakLine:part < parts.length - 1}}));
    }) : null;
    return {
      // Keep native wrapping and the original cell value: inserting measured
      // soft wraps into the text would change a later import or copy operation.
      text: rich ? runs : text,
      options: {
        ...nativeFontOptions(style),
        fontSize: fit.fontSize * 0.75,
        // PptxGenJS fills falsy run options from cell defaults. Rich runs
        // carry their resolved weight, so a bold header default must not turn
        // an explicit bold:false run back on.
        ...(rich ? {bold:false,italic:false} : {}),
        lineSpacing: fit.lineHeight * 0.75,
        paraSpaceAfter: 0,
        align: physicalAlignment(cellStyle.align ?? context.contentAlignment, cell.direction),
        valign: cellStyle.verticalAlign ?? 'top',
        ...(cell.colSpan > 1 ? {colspan:cell.colSpan} : {}),
        ...(cell.rowSpan > 1 ? {rowspan:cell.rowSpan} : {}),
        color: nativeColor(cellStyle.color, baseColor, context, defaultText),
        // Rich runs carry resolved alpha. A translucent cell default would
        // overwrite an explicit opaque run because PptxGenJS inherits falsy 0.
        ...(cellStyle.color && !rich ? {transparency:alpha(baseColor)} : {}),
        fill: { color: nativeColor(fillReference, baseFill, context), ...(cellStyle.fill ? {transparency:alpha(baseFill)} : {}) },
      },
    };
  }));
  const objectName = `OPF table ${context.tableHeaders.size + 1}`;
  context.tableHeaders.set(objectName, hasHeaders);
  recordPayloadData(context, objectName, 'table', presentation, path, layout);
  if (layout.rows.some(row => row.cells.some(cell => Object.keys(cell.style ?? {}).length))) context.tableCells.set(objectName, {layout, scale, context, defaultBorder:{color:"accent5",width:1/scale}});
  slide.addTable(rows, {
    objectName,
    x: region.x,
    y: region.y,
    w: region.w,
    // PowerPoint derives a table's height from its rows, and the preview draws
    // the rows (layout.height, never more than the composed box). The declared
    // frame height is the row total so the XML matches what both engines draw.
    h: layout.height / 96,
    rowH: layout.rows.map(row => row.box.height / 96),
    colW: Array(columnCount).fill(region.w / columnCount),
    autoPage: false,
    fontFace: context.fonts.body,
    fontSize: 15 * scale * 0.75,
    color: context.colors.text,
    border: { type: "solid", color: nativeColor("accent5", context.colors.border, context), pt: 0.75 },
    margin: [6 * scale, 7.5 * scale, 3 * scale, 7.5 * scale],
    valign: "top"
  });
}

function pixelBox(region) {
  return {x: region.x * 96, y: region.y * 96, width: region.w * 96, height: region.h * 96};
}

// One native text box per laid-out rich line (core's richLines), each carrying its runs: run color, size, weight, underline, strike,
// super/subscript (a citation marker is a baseline run) and http(s)/mailto links. The body's lines stay untagged; a heading or quote
// body passes `objectName` and `tag`, which name and tag every line with the boundary between wrapped lines (a soft wrap inserts
// nothing, a hard line break keeps its separator), recovered from the flattened text. `fallback` is the color of runs without one.
function addRichFitLines(slide, fit, box, context, {value, alignment: logicalAlignment, fallback, objectName, tag}) {
  const region = {x: box.x / 96, y: box.y / 96, w: box.width / 96, h: box.height / 96};
  const runText = run => typeof run === 'string' ? run : run.text;
  const whole = typeof value === 'string' ? value : value.map(runText).join('');
  const count = fit.richLines.length;
  let cursor = 0;
  for (const [index, line] of fit.richLines.entries()) {
    const runs = line.fragments.map(fragment => {
      const runColor = exportColor(fragment.run.color, context, context.colors.text);
      const color = nativeColor(fragment.run.color, runColor, context, fallback);
      return {text: fragment.text, options: {...nativeFontOptions(fragment.style), fontSize: (fragment.nominalSize ?? fragment.fontSize) * .75, color: linkColor(fragment.run, color, context), underline: fragment.run.underline ? {style: 'sng', color: linkColor(fragment.run, color, context)} : undefined, strike: fragment.run.strikethrough ? 'sngStrike' : undefined, baseline: fragment.baselineShift ? -fragment.baselineShift / (fragment.nominalSize ?? fragment.fontSize) * 2000 : undefined, hyperlink: fragment.kind !== 'marker' && fragment.run.link && /^(https?:|mailto:|tel:)/i.test(fragment.run.link) ? {url: fragment.run.link} : undefined, ...langOptions(context, fragment.style.lang)}};
    });
    // Logical alignment (RR-05): a right-to-left paragraph starts at the right edge; every wrapped line shares its paragraph's direction.
    const placed = fit.placement?.lines[index], alignment = placed?.alignment ?? physicalAlignment(logicalAlignment, fit.directions?.[index]), factor = alignment === 'right' ? 1 : alignment === 'center' ? .5 : 0;
    const area = placed ? {...region, x: (placed.x + line.width * factor - box.width * factor) / 96, y: placed.y / 96, h: placed.height / 96} : {...region, y: region.y + line.y / 96, h: line.height / 96};
    // PptxGenJS reads the paragraph direction from the first run's options, not from the shape options.
    if (fit.directions?.[index] === 'rtl') for (const run of runs) run.options.rtlMode = true;
    let name;
    if (tag) {
      const text = fit.lines[index] ?? '', end = cursor + text.length;
      const newline = index < count - 1 && whole.startsWith(text, cursor) ? /^(\r\n|\r|\n)/.exec(whole.slice(end)) : null;
      name = objectName(index);
      tag(name, index, count, {boundary: index === count - 1 ? 'end' : newline ? 'hard' : 'soft', separator: newline ? newline[0] : ''});
      cursor = end + (newline ? newline[0].length : 0);
    }
    if (runs.length) slide.addText(runs, {...textBoxOptions(area, context, fit.fontSize * .75), align: alignment, fit: 'none', wrap: false, lineSpacingMultiple: 1, ...(name ? {objectName: name} : {})});
  }
}

// Match the published renderer's payload geometry and shared core text fitting.
// Each fitted line remains native editable text, without PowerPoint rewrapping it.
function addMeasuredPayloadText(slide, text, box, context, options, config) {
  const invalid=/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/u.exec(String(text??''));
  if(invalid)throw new OPFPptxError('invalid-text',`Text contains U+${invalid[0].codePointAt(0).toString(16).toUpperCase().padStart(4,'0')} at UTF-16 offset ${invalid.index}, which DrawingML XML cannot represent.`,{path:config.path});
  const scale = Math.min(context.dimensions.widthInches, context.dimensions.heightInches) * 96 / 720;
  const style = config.textStyle ?? resolveTextStyle({fontFamily: config.fontFamily ?? context.fonts.body, fontWeight: config.fontWeight ?? 400, path: config.path}, options.textMeasurement);
  const fit = config.fit ?? fitText(String(text ?? ''), box, config.fontSize * scale, (context.composition?.minFontSize ?? 16) * scale, textWidthMeasurer(style, options.textMeasurement));
  if (fit.overflow && !config.diagnosticsHandled) {
    const diagnostic = {code: 'text-overflow', path: config.path, message: 'Text exceeds its cell at the minimum font size; shorten it, increase its space, or split the slide.'};
    options.onDiagnostic?.(diagnostic);
    if (context.composition?.overflow === 'error') throw new OPFPptxError('layout-overflow', diagnostic.message, {path: config.path, issues: [diagnostic]});
  }
  // Generated socials carry one link per explicit source line; wrapped lines share it.
  let sourceLineIndex = 0;
  for (const [index, line] of fit.lines.entries()) {
    const link = config.links?.[sourceLineIndex];
    if (fit.sourceLines?.[index]?.boundary === 'hard') sourceLineIndex += 1;
    if (!line&&!config.heading&&!config.sourceText&&!config.timeline&&!config.quote&&!config.keepEmpty) continue;
    // Logical alignment (RR-05): a right-to-left line starts at the right edge; furniture and metrics pass physical alignments and report no line directions.
    const placed=fit.placement?.lines[index],alignment=placed?.alignment??physicalAlignment(fit.placement?.alignment??config.align??context.contentAlignment??'left',fit.directions?.[index]),factor=alignment==='right'?1:alignment==='center'?.5:0;
    const sourceLine=fit.sourceLines?.[index],boundary=sourceLine?{boundary:sourceLine.boundary,separator:String(text).slice(sourceLine.end,sourceLine.nextStart)}:{};
    const objectName=config.heading?`OPF heading ${config.path} line ${index}`:config.timeline?`OPF timeline ${config.timeline.group} part ${config.timeline.part} line ${index}`:config.quote?`OPF quote ${config.quote.group} part ${config.quote.part} line ${index}`:config.sourceText?`OPF text ${config.path} line ${index}`:config.objectName?`${config.objectName} line ${index}`:undefined;
    if(config.heading)context.headingTags.set(objectName,{v:1,group:config.path,field:config.heading,line:index,count:fit.lines.length,...boundary});
    else if(config.timeline)context.timelineTags.set(objectName,{v:1,role:'text',group:config.timeline.group,part:config.timeline.part,line:index,count:fit.lines.length,...boundary,...(config.timeline.part===0&&index===0?{anchor:config.timeline.anchor}:{})});
    else if(config.quote)context.quoteTags.set(objectName,{v:1,role:'text',group:config.quote.group,part:config.quote.part,line:index,count:fit.lines.length,...boundary,...(config.quote.part===0&&index===0?{anchor:config.quote.anchor}:{})});
    else if(config.furniture){
      context.furnitureTags.set(objectName,{v:1,role:'text',...config.furniture,line:index,count:fit.lines.length,...boundary});
      if(config.liveFields?.[index]?.length)context.furnitureFields.set(objectName,{text:line,fields:config.liveFields[index]});
    }
    else if(config.media&&context.provenanceMode!==false)context.mediaTags.set(objectName,{v:1,role:'caption',path:config.path,line:index,count:fit.lines.length,boundary:sourceLine?.boundary??'end',...(context.provenanceMode==='full'?{fingerprint:mediaTextFingerprint(line),...boundary}:{})});
    else if(config.sourceText)context.plainTextTags.set(objectName,{v:1,group:config.path,line:index,count:fit.lines.length,...boundary});
    const area=placed?{x:(placed.x+placed.width*factor-box.width*factor)/96,y:(placed.baseline-fit.fontSize)/96,w:box.width/96,h:placed.height/96}:{x:box.x/96,y:(box.y+index*fit.lineHeight)/96,w:box.width/96,h:fit.lineHeight/96};
    // A run-level link keeps the muted, non-underlined furniture look of the preview (hlinkClr=tx, u=none).
    const lineColor = pptxColor(config.color ?? context.textColor);
    slide.addText(link?.href && line ? [{text: line, options: {hyperlink: {url: link.href}, color: lineColor, underline: {style: 'none'}}}] : line, {
      ...textBoxOptions(area, context, fit.fontSize * .75),
      ...nativeFontOptions(style),
      color: lineColor, align: alignment,
      ...(fit.directions?.[index]==='rtl'?{rtlMode:true}:{}),
      // Reuse the frame's existing relationship to cover blank caption boxes.
      // PptxGenJS also inherits it into runs; keep their native text styling.
      hyperlink: config.hyperlink,
      underline: config.hyperlink ? {style: 'none'} : undefined,
      tabStops:sourceLine?.segments.filter(segment=>segment.kind==='tab').map(segment=>({position:(segment.x+segment.width)/96,alignment:'l'})),
      objectName,
      fit: 'none', wrap: false, lineSpacingMultiple: 1,
    });
  }
}

// The default footer band core composes for a deck with no footer of its own: where a footer added natively lands.
function defaultFooterParts(composeOptions) {
  try {
    const slide = {design: {footer: {left: {date: '2026-01-01'}, center: {text: 'Footer'}, right: {slideNumber: true}}}};
    // Only the zone boxes and line height are used, and they do not depend on text widths: estimated measurement keeps the host's measurer (and its call count) out of this.
    return (composeSlide(slide, {...composeOptions, textMeasurement: undefined}).furniture?.parts ?? []).filter(part => part.kind === 'footer' && part.type === 'text');
  } catch {
    return undefined;
  }
}

async function addFurniture(slide,presentation,source,layout,context,options,slideIndex) {
  if(!layout){
    if(['header','footer'].some(kind=>(source.design?.[kind]??presentation.design?.[kind])))throw new OPFPptxError('missing-furniture-layout','Header/footer export requires coordinated core furniture geometry.',{path:`slides.${slideIndex}.design`});
    const manifest = furnitureManifest(presentation, source, {parts: []}, slideIndex);
    if (manifest) context.furnitureManifests.set(`ppt/slides/slide${slideIndex + 1}.xml`, manifest);
    return;
  }
  const staticDates = new Map();
  // RR-11: the first footer text, date and slide number that fit one line are native placeholders (src/native-furniture.js).
  const natives = nativeFurnitureParts(layout);
  for(const [index,part]of layout.parts.entries()){
    if(part.type==='image'){
      const region={x:part.box.x/96,y:part.box.y/96,w:part.box.width/96,h:part.box.height/96};
      const objectName = await addImagePayload(slide,presentation,part.image,region,part.path,{...context,imageFill:'fit'},options);
      // A generated deck logo is listed beside the manifest topology (see furnitureManifest) and tagged as a logo.
      if (objectName && part.field === 'logo') context.furnitureLogoTags.set(objectName, {v:1, role:'furniture', group:String(slideIndex), furniture:part.kind, zone:part.zone});
      else if (objectName) context.furnitureTags.set(objectName, {v:1, role:'image', group:String(slideIndex), part:manifestPartIndex(layout.parts, index)});
    }else{
      if(!part.fit?.sourceLines)throw new OPFPptxError('missing-furniture-layout','Repeated text requires accepted source lines from core.',{path:part.path});
      // Slide numbers and current dates become native PowerPoint fields; {total}
      // and fixed dates stay fixed text. A current date whose pattern has no
      // en-US field type is written as its laid-out text.
      const fields=[];
      for(const field of furniturePartFields(part)){
        const nativeType=nativeFieldType(field);
        if(nativeType)fields.push({...field,nativeType});
        else options.onDiagnostic?.({code:'furniture-date-fixed',path:part.path,message:`dateFormat '${field.format}' has no PowerPoint en-US date field; the current date is exported as fixed text that PowerPoint will not update.`});
      }
      const liveFields=fields.length?lineFields(part.text,fields,part.fit.sourceLines,part.fit.lines):undefined;
      for(const field of fields.filter(field => !lineFields(part.text,[field],part.fit.sourceLines,part.fit.lines).some(line => line.length))) {
        options.onDiagnostic?.({code:'furniture-field-fixed',path:part.path,message:`The ${field.type} field range ${field.start}..${field.end} does not fit one accepted text line. It is exported as static text that PowerPoint will not update; native compatibility remains a separate gate.`});
        if(context.provenanceMode === 'full') {
          const marker = staticDateFallback(part,field);
          if(marker) staticDates.set(index,marker);
        }
      }
      addMeasuredPayloadText(slide,part.text,part.box,context,options,{path:part.path,fit:part.fit,textStyle:part.style,align:part.alignment,diagnosticsHandled:true,color:context.mutedColor,keepEmpty:true,objectName:`OPF furniture ${slideIndex} part ${index}`,furniture:{group:String(slideIndex),part:manifestPartIndex(layout.parts,index)},liveFields,links:part.links});
      if(natives.has(index))context.nativeFurniture.set(`OPF furniture ${slideIndex} part ${index} line 0`,natives.get(index));
    }
  }
  const manifest = furnitureManifest(presentation, source, layout, slideIndex, staticDates, natives);
  if (manifest) context.furnitureManifests.set(`ppt/slides/slide${slideIndex + 1}.xml`, manifest);
}

const bulletImageName = () => 'OPF bullet image';

function addCodePayload(slide, value, layout, region, context, path, options) {
  if (!layout) throw new OPFPptxError('missing-code-layout', 'Code export requires a coordinated core build with shared code geometry.', {path});
  for (const part of layout.parts) {
    // XML 1.0 Char excludes controls and unpaired UTF-16 surrogates. The u flag
    // keeps valid supplementary characters (surrogate pairs) accepted.
    const invalid = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/u.exec(part.text);
    if (invalid) throw new OPFPptxError('invalid-code-text', `Code text contains U+${invalid[0].codePointAt(0).toString(16).toUpperCase().padStart(4,'0')} at UTF-16 offset ${invalid.index}, which XML cannot represent; edit that character before exporting.`, {path:part.path});
  }
  const group = String(context.codeTags.size + 1), panelName = `OPF code ${group} panel`;
  for (const part of layout.parts) if (!part.fit) throw new OPFPptxError('layout-overflow', 'Code content has no usable internal space; increase its cell size before exporting.', {path:part.path,issues:layout.diagnostics});
  // FA-13: code.highlight is one native rectangle per run of marked lines, between the panel and the line text boxes; marked
  // lines keep the syntax colours, the others are dimmed, from the same core helpers the preview calls.
  const highlight = codeHighlight(value, layout, context);
  context.codeTags.set(panelName,codeManifest(value,layout,group,highlight?.bands.length));
  const syntax = codeSyntax(value, layout, context, path, options);
  slide.addShape('rect', {...region, fill: {color: '111827'}, line: {color: '334155', width: .75}, objectName:panelName});
  if (highlight) {
    const bodyPart = layout.parts.find(part => part.role === 'body');
    highlight.bands.forEach((band, bandIndex) => {
      const lineHeight = bodyPart.fit.lineHeight;
      const bandName = `OPF code ${group} highlight ${bandIndex + 1}`;
      context.codeTags.set(bandName, {v:1, group, role:'highlight', index:bandIndex});
      slide.addShape('rect', {x: region.x + .01, y: (bodyPart.box.y + band.first * lineHeight) / 96, w: region.w - .02, h: (band.last - band.first + 1) * lineHeight / 96,
        fill: {color: highlight.colors.band.slice(1)}, line: {type: 'none'}, objectName: bandName});
    });
  }
  for (const [partIndex,part] of layout.parts.entries()) {
    if (!part.fit) throw new OPFPptxError('layout-overflow', 'Code content has no usable internal space; increase its cell size before exporting.', {path:part.path,issues:layout.diagnostics});
    for (const [index,line] of part.fit.sourceLines.entries()) {
      const tabStops=line.segments.filter(segment=>segment.kind==='tab').map(segment=>({position:(segment.x+segment.width)/96,alignment:'l'}));
      const objectName = `OPF code ${group} ${part.role} line ${index+1}`;
      context.codeTags.set(objectName,{v:1,group,role:'line',part:partIndex,line:index});
      // RR-07: the same token ranges and palette the preview paints; the text of the runs is the line text, unchanged.
      const runs = syntax && part.role==='body' ? opfCore.codeLineRuns(syntax.tokens,line.start,line.end,part.text) : undefined;
      const lineColors = highlight && part.role==='body' ? (highlight.marked.has(highlight.numbers[index]) ? highlight.colors.lit : highlight.colors.dim) : undefined;
      const lineText = part.text.slice(line.start,line.end);
      const lineOptions = {
        ...textBoxOptions({x:part.box.x/96,y:(part.box.y+index*part.fit.lineHeight)/96,w:part.box.width/96,h:part.fit.lineHeight/96},context,part.fit.fontSize*.75),
        ...nativeFontOptions(part.style),
        color:part.role==='body'?(lineColors?.plain.slice(1)??'E5E7EB'):'93C5FD',align:'left',fit:'none',wrap:false,lineSpacingMultiple:1,
        tabStops:tabStops.length?tabStops:undefined,objectName,
      };
      // A run's own options replace the line's, so every run repeats the font, size, alignment and tab stops and differs only in colour.
      slide.addText(runs?.some(run=>run.kind) ? runs.map(run=>({text:part.text.slice(run.start,run.end),options:{...lineOptions,color:(lineColors??syntax.palette)[run.kind??'plain'].slice(1)}})) : lineText,lineOptions);
    }
  }
}

// FA-13: the marked lines of code.highlight, their bands (runs of displayed lines) and the lit/dimmed colours, from core (the preview
// calls the same functions); undefined when the code marks no line.
function codeHighlight(value, layout, context) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.highlight)) return undefined;
  const body = layout.parts.find(part => part.role === 'body');
  if (!body?.fit) return undefined;
  const lines = opfCore.codeHighlightLines(value.highlight, body.text).lines;
  if (!lines.length) return undefined;
  return {marked: new Set(lines), numbers: opfCore.codeLineNumbers(body.fit.sourceLines), bands: opfCore.codeHighlightBands(body.fit.sourceLines, lines), colors: opfCore.codeHighlightColors(context.colorScheme)};
}

// Token ranges and palette for the code body, from core (the preview calls the same functions); undefined for plain code.
function codeSyntax(value, layout, context, path, options) {
  const body = layout.parts.find(part => part.role === 'body');
  const language = typeof value?.language === 'string' ? value.language : layout.parts.find(part => part.role === 'language')?.text;
  if (!body || !language) return undefined;
  if (typeof opfCore.tokenizeCode !== 'function') return undefined;
  const tokens = opfCore.tokenizeCode(body.text, language);
  return tokens.length ? {tokens, palette: opfCore.codeSyntaxPaletteForScheme(context.colorScheme)} : undefined;
}

function addMetricPayload(slide,value,layout,context,path,options) {
  if (!layout) throw new OPFPptxError('missing-metric-layout','Metric export requires coordinated core metric geometry.',{path});
  const group=String(context.metricTags.size+1),manifest=metricManifest(value,layout,group);
  // RR-07: a trend colours the trend and delta text and adds one native arrow shape, from core's accepted geometry.
  const trendMark=typeof opfCore.metricTrendMark==='function'?opfCore.metricTrendMark(layout,{background:`#${normalizeHex(context.colors.background)}`}):undefined;
  const partColor=part=>trendMark&&(part.role==='trend'||part.role==='delta')?trendMark.color.slice(1):part.role==='value'?context.colors.accent:context.textColor;
  for (const [partIndex,part] of layout.parts.entries()) {
    const invalid=/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/u.exec(part.text);
    if (invalid) throw new OPFPptxError('invalid-metric-text',`Metric text contains U+${invalid[0].codePointAt(0).toString(16).toUpperCase().padStart(4,'0')} at UTF-16 offset ${invalid.index}, which XML cannot represent; edit that character before exporting.`,{path:part.path});
    if (!part.visible) continue;
    if (!part.fit||part.linePositions?.length!==part.fit.sourceLines.length) throw new OPFPptxError('layout-overflow','Metric content has no accepted internal line positions; increase its cell size or coordinate package versions.',{path:part.path,issues:layout.diagnostics});
    for (const [index,line] of part.fit.sourceLines.entries()) {
      const origin=part.linePositions[index],objectName=`OPF metric ${group} ${part.role} line ${index+1}`;
      context.metricTags.set(objectName,partIndex===0&&index===0?manifest:{v:1,group,role:'line',part:partIndex,line:index});
      const tabStops=line.segments.filter(segment=>segment.kind==='tab').map(segment=>({position:(segment.x+segment.width)/96,alignment:'l'}));
      // Anchor the native paragraph to the same accepted left/center/right point.
      // Left-aligning at a measured glyph origin loses the intended edge when the
      // native shaper has a slightly different advance. No re-fitting is needed.
      const factor=layout.alignment==='right'?1:layout.alignment==='center'?.5:0;
      const anchor=origin.x+line.width*factor;
      slide.addText(part.text.slice(line.start,line.end),{
        ...textBoxOptions({x:(anchor-part.box.width*factor)/96,y:(origin.baseline-part.fit.fontSize)/96,w:part.box.width/96,h:part.fit.lineHeight/96},context,part.fit.fontSize*.75),
        ...nativeFontOptions(part.style),
        color:partColor(part),align:layout.alignment,...(part.fit.directions?.[index]==='rtl'?{rtlMode:true}:{}),fit:'none',wrap:false,lineSpacingMultiple:1,
        tabStops:tabStops.length?tabStops:undefined,objectName,
      });
    }
  }
  if(trendMark) {
    const objectName=`OPF metric ${group} trend mark`;
    context.metricTags.set(objectName,{v:1,group,role:'mark'});
    context.metricDescriptions.set(objectName,trendMark.ariaLabel);
    slide.addShape(trendMark.shape,{objectName,x:trendMark.box.x/96,y:trendMark.box.y/96,w:trendMark.box.width/96,h:trendMark.box.height/96,fill:{color:trendMark.color.slice(1)},line:{transparency:100},altText:trendMark.ariaLabel});
  }
}

async function addQuotePayload(slide, presentation, value, layout, context, options, path) {
  if (!layout) throw new OPFPptxError('missing-quote-layout', 'Quote export requires a coordinated core build with shared quote geometry.', {path});
  for (const part of layout.parts) if (!part.fit) throw new OPFPptxError('layout-overflow', 'Quote content has no usable internal space; increase its cell size before exporting.', {path:part.path,issues:layout.diagnostics});
  // Every line shape is tagged (OPF_QUOTE_V1) so an unchanged export re-imports as a quote payload (FF-57).
  const group=String(context.quoteTags.size),anchor=quoteManifest(value,layout);
  for (const [index,part] of layout.parts.entries()) {
    // FA-10: a TextRun[] quote body (core's rich lines, quotation marks joined to its first and last run) is exported line by line like rich body text, with the same quote tags.
    if (part.runs && part.fit.richLines) {
      addRichFitLines(slide, part.fit, part.box, context, {
        value: part.text, alignment: part.fit.placement?.alignment ?? context.contentAlignment ?? 'left', fallback: context.textColor,
        objectName: line => `OPF quote ${group} part ${index} line ${line}`,
        tag: (name, line, count, boundary) => context.quoteTags.set(name, {v: 1, role: 'text', group, part: index, line, count, ...boundary, base: richBase(part.fit, part.style, context.colors.text), ...(index === 0 && line === 0 ? {anchor} : {})})
      });
      continue;
    }
    addMeasuredPayloadText(slide,part.text,part.box,context,options,{
      path:part.path,fit:part.fit,textStyle:part.style,diagnosticsHandled:true,
      color:part.role==='footer'?context.mutedColor:context.textColor,
      quote:{group,part:index,anchor},
    });
  }
  if (layout.photo) await addQuotePhoto(slide, presentation, layout.photo, group, context, options);
}

// FA-12: the attributed person's headshot is a native picture in the core circle frame: cropped to fill it (a:srcRect after the bytes
// are embedded) with the `ellipse` preset geometry, the alt text as its description, tagged into the quote's provenance group.
async function addQuotePhoto(slide, presentation, photo, group, context, options) {
  const box = { x: photo.box.x / 96, y: photo.box.y / 96, w: photo.box.width / 96, h: photo.box.height / 96 };
  const outcome = { box, cover: true };
  const resolved = await resolveImage(photo.value, presentation, options, photo.path, outcome);
  if (!resolved) {
    addImagePlaceholder(slide, presentation, photo.value, box, photo.path, context, options);
    return;
  }
  const objectName = quotePhotoName(group);
  // PowerPoint is not confirmed to apply a non-rectangular mask to an SVG picture, so an SVG photo exports as its PNG raster (as a masked slide image does).
  if (outcome.svg) options.onDiagnostic?.({ code: 'svg-image-rasterized', path: photo.path, message: 'An SVG quote photo exports as its PNG raster so the circular mask applies as in the preview; PowerPoint has not been confirmed to apply it to an SVG picture.' });
  context.quotePhotos.set(objectName, { region: box, mode: 'crop', path: photo.path, shape: photo.shape });
  context.quoteTags.set(objectName, { v: 1, role: 'photo', group });
  const alt = assetAlt(photo.value, presentation);
  context.pictureText.set(objectName, pictureText(alt, photo.value, presentation));
  slide.addImage({ ...resolved, objectName, ...box, altText: alt });
}

function addTimelinePayload(slide, value, layout, context, options, path) {
  if(!layout)throw new OPFPptxError('missing-timeline-layout','Timeline export requires a coordinated core build with shared timeline geometry.',{path});
  // Validate optional field fits before the provenance manifest dereferences
  // source lines or any drawing/tag mutation is performed.
  for(const part of layout.parts)if(!part.fit)throw new OPFPptxError('layout-overflow','Timeline field has no usable space; change the arrangement or paginate events.',{path:part.path,issues:layout.diagnostics});
  const scale=Math.min(context.dimensions.widthInches,context.dimensions.heightInches)*96/720;
  const group=String(context.timelineTags.size),anchor=timelineManifest(value,layout),connectorName=`OPF timeline ${group} connector`;
  const {x1,y1,x2,y2}=layout.connector;
  slide.addShape('line',{objectName:connectorName,x:x1/96,y:y1/96,w:(x2-x1)/96,h:(y2-y1)/96,line:{color:context.colors.border,width:3*scale*.75}});
  context.timelineTags.set(connectorName,{v:1,group,role:'connector'});
  // FA-11: a status draws from the deck's colors through core's shared shapes: native ellipses (solid fill, or the
  // background fill plus a line for a hollow marker or a ring) and a muted text color for a planned event. An older core draws plain markers.
  const statusColors={background:`#${normalizeHex(context.colors.background)}`,primary:`#${context.colors.accent}`,text:`#${normalizeHex(context.colors.text)}`,mutedText:`#${context.colors.mutedText}`};
  const statusShapes=typeof opfCore.timelineMarkerShapes==='function';
  for(const marker of layout.markers){
    if(!statusShapes||!marker.status){
      const objectName=`OPF timeline ${group} marker ${marker.eventIndex}`;
      slide.addShape('ellipse',{objectName,x:(marker.x-marker.radius)/96,y:(marker.y-marker.radius)/96,w:marker.radius*2/96,h:marker.radius*2/96,fill:{color:context.colors.accent},line:{transparency:100}});
      context.timelineTags.set(objectName,{v:1,group,role:'marker',eventIndex:marker.eventIndex});
      continue;
    }
    for(const shape of opfCore.timelineMarkerShapes(marker,statusColors)){
      const objectName=`OPF timeline ${group} ${shape.role} ${marker.eventIndex}`;
      slide.addShape(shape.shape,{objectName,x:(shape.cx-shape.radius)/96,y:(shape.cy-shape.radius)/96,w:shape.radius*2/96,h:shape.radius*2/96,
        fill:{color:normalizeHex(shape.fill)},line:shape.stroke?{color:normalizeHex(shape.stroke.color),width:shape.stroke.width*.75}:{transparency:100}});
      context.timelineTags.set(objectName,{v:1,group,role:shape.role,eventIndex:marker.eventIndex,...(shape.role==='marker'?{status:marker.status}:{})});
    }
  }
  for(const [index,part]of layout.parts.entries()){
    const statusColor=part.status==='planned'&&typeof opfCore.timelineTextColor==='function'?normalizeHex(opfCore.timelineTextColor(part,statusColors)):undefined;
    addMeasuredPayloadText(slide,part.text,part.box,context,options,{path:part.path,fit:part.fit,textStyle:part.style,align:part.alignment,diagnosticsHandled:true,timeline:{group,part:index,anchor},...(statusColor?{color:statusColor}:{})});
  }
}

// Mirror the renderer's media placeholder: a bordered surface, a centred 72px
// play badge and a centred caption (title, then source). Native video embedding
// is not attempted; the caption keeps the reference editable.
function addMediaPayload(slide, presentation, value, region, path, context, options) {
  const box = pixelBox(region);
  const icon = {x: box.x + (box.width - 72) / 2, y: box.y + (box.height - 72) / 2};
  // The frame links to a web source (after asset dereferencing), so the
  // reference stays usable in PowerPoint; OPF_MEDIA_V1 keeps the OPF value.
  const resolved = dereferenceAsset(value, presentation, path), source = typeof resolved === "string" ? resolved : resolved?.src;
  const hyperlink = typeof source === "string" && /^https?:\/\//i.test(source) ? {url: source} : undefined;
  const names = {frame: `OPF media ${path} frame`, badge: `OPF media ${path} badge`, play: `OPF media ${path} play`};
  if (context.provenanceMode !== false) {
    context.mediaTags.set(names.frame, mediaFrameRecord(value, path, presentation, context.provenanceMode, options.onDiagnostic));
    context.mediaTags.set(names.badge, {v: 1, role: "badge", path});
    context.mediaTags.set(names.play, {v: 1, role: "play", path});
  }
  slide.addShape("rect", {x: region.x, y: region.y, w: region.w, h: region.h, fill: {color: context.colors.surface}, line: {color: context.colors.border, width: 0.75}, hyperlink, objectName: names.frame});
  slide.addShape("ellipse", {x: icon.x / 96, y: icon.y / 96, w: 72 / 96, h: 72 / 96, fill: {color: context.colors.accent}, line: {transparency: 100}, hyperlink: hyperlink && {url: source}, objectName: names.badge});
  slide.addShape("triangle", {x: (icon.x + 28) / 96, y: (icon.y + 22) / 96, w: 28 / 96, h: 28 / 96, rotate: 90, fill: {color: "FFFFFF"}, line: {transparency: 100}, hyperlink: hyperlink && {url: source}, objectName: names.play});
  addMeasuredPayloadText(slide, mediaCaption(value), {...box, y: icon.y + 72 + 20, height: 50}, context, options,
    {path, fontSize: 18, fontFamily: context.fonts.body, fontWeight: 600, align: "center", color: context.colors.mutedText, objectName: `OPF media ${path} caption`, media: true, keepEmpty: true, hyperlink});
}

// The asset an image block names, layered as the preview layers it: fields on the
// block win over the registry entry it references, and an unknown reference keeps
// the block's own fields.
function placeholderAsset(asset, presentation) {
  const plain = value => typeof value === "string" ? { src: value } : isPlainObject(value) ? value : { src: "" };
  let current = plain(asset);
  const seen = new Set();
  while (typeof current.src === "string" && current.src.startsWith("asset:")) {
    const id = current.src.slice(6);
    if (seen.has(id) || !Object.hasOwn(presentation.assets ?? {}, id)) break;
    seen.add(id);
    const { src: _source, ...overrides } = current;
    current = { ...plain(presentation.assets[id]), ...overrides };
  }
  return current;
}

// An image that cannot be embedded exports the preview's placeholder, not a second
// design: a dashed panel with a centered "Image unavailable" over the asset's alt
// text (else title, else "Image"), set bold at 20 px (shrinking to the composition
// minimum) in the readable text colour for the panel, or a cross when the label
// cannot fit even at that minimum. The panel carries the accessible name the
// preview gives its group, "Image unavailable: <description>".
// {logo: true} names the panel's other shapes after its panel (OPF image placeholder N text line i / icon i) and returns the
// panel's name, so a logo placeholder can be tagged and consumed on import.
function addImagePlaceholder(slide, presentation, asset, region, path, context, options, {logo = false} = {}) {
  const layered = placeholderAsset(asset, presentation);
  const description = String(layered.alt ?? layered.title ?? "Image");
  const label = `Image unavailable\n${description}`;
  // The preview rejects characters DrawingML/SVG XML cannot represent when it draws the label.
  // The cross and the accessible name would otherwise carry them into the slide XML, so check
  // up front and fail the same way whichever form the placeholder takes.
  const invalid = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF￾￿]/u.exec(label);
  if (invalid) throw new OPFPptxError("invalid-text", `Text contains U+${invalid[0].codePointAt(0).toString(16).toUpperCase().padStart(4, "0")} at UTF-16 offset ${invalid.index}, which DrawingML XML cannot represent.`, { path });
  const scale = Math.min(context.dimensions.widthInches, context.dimensions.heightInches) * 96 / 720;
  const box = pixelBox(region);
  const padding = Math.min(24 * scale, box.width * .06, box.height * .1);
  const inner = { x: box.x + padding, y: box.y + padding, width: Math.max(1, box.width - padding * 2), height: Math.max(1, box.height - padding * 2) };
  const surface = normalizeHex(context.colors.surface);
  const textColor = normalizeHex(textColorForFill(`#${surface}`, `#${context.colors.text}`));
  const style = resolveTextStyle({ fontFamily: context.fonts.body, fontWeight: 600, path }, options.textMeasurement);
  const measurer = textWidthMeasurer(style, options.textMeasurement);
  const minimum = (context.composition?.minFontSize ?? 16) * scale;
  const fit = fitText(label, inner, 20 * scale, minimum, measurer);
  const objectName = `OPF image placeholder ${context.imagePlaceholders.size + 1}`;
  context.imagePlaceholders.set(objectName, `Image unavailable: ${description}`);
  slide.addShape("rect", {
    x: region.x, y: region.y, w: region.w, h: region.h,
    fill: { color: surface },
    line: { color: context.colors.border, width: .75, dashType: "dash" },
    objectName
  });
  if (!fit.overflow) {
    // The lines are centered vertically in the padded box. Fit against the shifted
    // box so any per-line placement carries the same offset.
    const offset = Math.max(0, (inner.height - fit.lines.length * fit.lineHeight) / 2);
    const centered = { ...inner, y: inner.y + offset };
    addMeasuredPayloadText(slide, label, centered, context, options, {
      path, fit: fitText(label, centered, 20 * scale, minimum, measurer), textStyle: style,
      diagnosticsHandled: true, align: "center", color: textColor, ...(logo ? {objectName: `${objectName} text`} : {})
    });
    return logo ? objectName : undefined;
  }
  // A status indicator, not shortened authored content: the full description stays
  // in the panel's accessible name.
  const size = Math.max(0, Math.min(inner.width, inner.height, 24 * scale));
  if (!size) return logo ? objectName : undefined;
  const icon = { x: inner.x + (inner.width - size) / 2, y: inner.y + (inner.height - size) / 2 };
  const line = { color: textColor, width: Math.min(2 * scale, size / 8) * .75 };
  for (const flipV of [false, true]) slide.addShape("line", { x: icon.x / 96, y: icon.y / 96, w: size / 96, h: size / 96, line, flipV, ...(logo ? {objectName: `${objectName} icon ${flipV ? 2 : 1}`} : {}) });
  return logo ? objectName : undefined;
}

// A placeholder names what is missing in plain words. It never dumps the source value, so no data or URL lands in slide text.
function addPlaceholderPayload(slide, label, description, region, context) {
  slide.addShape("rect", {
    x: region.x,
    y: region.y,
    w: region.w,
    h: region.h,
    fill: { color: context.colors.surface, transparency: 10 },
    line: { color: context.colors.border, width: 0.75 }
  });
  slide.addText(`${label}\n${description}`, {
    x: region.x + 0.12,
    y: region.y + 0.12,
    w: Math.max(0.2, region.w - 0.24),
    h: Math.max(0.2, region.h - 0.24),
    margin: 0,
    fontFace: context.fonts.body,
    fontSize: 11,
    color: context.mutedColor,
    fit: "shrink",
    valign: "mid",
    align: "center"
  });
}

// FF-31: a measurement provider may preview a chosen family with another face
// (Carlito for Aptos or Calibri, Gelasio for Georgia, a caller alias, a generic
// fallback). That substitute changes measurement and drawing only. The package
// always names the developer's chosen family. Measurement still uses the
// substitute, because the provider resolves the chosen family again on every
// measure/outline call, so layout is unchanged.
function sameTypeface(requested, resolved) {
  if (typeof resolved !== 'string') return false;
  const want = requested.trim().toLowerCase(), got = resolved.trim().toLowerCase();
  // A legacy four-style family such as "Roboto Medium" is the chosen typeface.
  return got === want || got.startsWith(`${want} `) && isFaceStyleSuffix(got.slice(want.length + 1));
}
function chosenFamilyMeasurement(measurement) {
  if (!measurement || typeof measurement.resolveStyle !== 'function') return measurement;
  const resolveFont = typeof measurement.resolveFont === 'function' ? style => measurement.resolveFont(style) : undefined;
  const wrapped = {
    measure: (text, size, style) => measurement.measure(text, size, style),
    resolveStyle: style => {
      const resolved = measurement.resolveStyle(style);
      const requested = style?.fontFamily;
      // Theme tokens are provider business; the exporter always passes concrete families.
      if (typeof requested !== 'string' || requested.startsWith('+')) return resolved;
      // opf-render reports whether a face came from the chosen family or a substitute;
      // other providers are judged by family name.
      const resolution = resolveFont?.(style);
      const faceFamily = resolved?.fontFace?.family;
      const substituted = typeof resolution?.substitute === 'boolean'
        ? resolution.substitute
        : !sameTypeface(requested, resolved?.fontFamily) || typeof faceFamily === 'string' && !sameTypeface(requested, faceFamily);
      if (!substituted) return resolved;
      const chosen = {...style};
      delete chosen.fontFace;
      return chosen;
    },
  };
  if (typeof measurement.outlineBounds === 'function') wrapped.outlineBounds = (text, size, style) => measurement.outlineBounds(text, size, style);
  if (resolveFont) wrapped.resolveFont = resolveFont;
  return wrapped;
}

// FA-13: TextRun.lang as the run's own proofing language (a:rPr lang), when it differs from the deck language.
function langOptions(context, tag) {
  const lang = runLanguageTag(context.scriptFonts, tag);
  return lang ? {lang} : {};
}

function nativeFontOptions(style) {
  const face=style.fontFace;
  if(face!==undefined) {
    if(!face || typeof face.family!=='string' || !face.family.trim() || typeof face.bold!=='boolean' || typeof face.italic!=='boolean')
      throw new OPFPptxError('invalid-font-selection','The font provider must supply a family and explicit bold/italic style-link flags.',{path:style.path});
    return {fontFace:face.family,bold:face.bold,italic:face.italic};
  }
  return {fontFace:style.fontFamily,bold:style.fontWeight>=600,italic:style.italic};
}

function textBoxOptions(region, context, fontSize) {
  return {
    x: region.x,
    y: region.y,
    w: region.w,
    h: region.h,
    margin: 0,
    paraSpaceAfter: 0,
    lineSpacingMultiple: 1.22,
    fontFace: context.fonts.body,
    fontSize,
    color: context.textColor,
    breakLine: false,
    fit: "shrink",
    valign: "top"
  };
}

// The private text helpers annotation-export.js writes captions and footnote lines with (RR-34).
const exportHelpers = {textBoxOptions, nativeFontOptions, exportColor, nativeColor};

function textRuns(value, context, fallbackFontSize) {
  const runs = Array.isArray(value) ? value : [value];
  return runs.map((run) => {
    if (typeof run === "string") {
      return {
        text: run,
        options: {
          color: context.textColor,
          fontFace: context.fonts.body,
          fontSize: fallbackFontSize
        }
      };
    }
    return {
      text: String(run?.text ?? ""),
      options: {
        bold: run?.bold,
        italic: run?.italic,
        underline: run?.underline ? { style: "sng", color: linkColor(run, nativeColor(run?.color, exportColor(run?.color, context, context.colors.text), context, context.textColor), context) } : undefined,
        strike: run?.strikethrough ? "sngStrike" : undefined,
        color: linkColor(run, nativeColor(run?.color, exportColor(run?.color, context, context.colors.text), context, context.textColor), context),
        fontFace: run?.fontFamily ?? context.fonts.body,
        fontSize: run?.fontSize ?? fallbackFontSize,
        superscript: run?.superscript,
        subscript: !run?.superscript && run?.subscript,
        hyperlink: run?.link && /^(https?:|mailto:|tel:)/i.test(run.link) ? { url: run.link } : undefined,
        ...langOptions(context, run?.lang)
      }
    };
  });
}

/**
 * Series for a native chart, or `{reason, message}` when the data cannot be plotted (the caller reports it).
 * A first column that holds categories is the usual shape. Chart types whose data is one column of values
 * (histogram, dot plot) have no category column, so their values are plotted directly: a histogram is binned
 * into equal-width bins and exported as a column chart of the counts, every other type plots the values against
 * their row numbers. `adapted` names that transformation so it is reported, never silent.
 *
 * RR-54: the data is resolved by core (`resolveChartData`, docs/chart-table-data.md): a dataset reference, DataColumn
 * objects and `chart.mapping` become the canonical positional table [category, (x,) ...series], and every value cell
 * goes through core's strict `chartNumber` (a string that is not a plain decimal is a gap, reported once per chart as
 * `chart-value-not-numeric`). `formats` holds the Excel codes of the columns' number formats per exported series.
 */
function toPptxChartData(chart, chartexMode = 'auto', presentation) {
  const unplottable = (reason, summary, message) => ({reason, summary, message: `${message} No native chart was exported; a placeholder frame stands in for it.`});
  // A dataset reference is inlined from the document first (composition normally hands over the inline copy already).
  const source = isDatasetRef(chart?.data) ? inlineChartData(chart, presentation) : chart;
  const authored = source?.data;
  if (isDatasetRef(authored)) {
    return unplottable("dataset-unknown", "The chart's dataset is missing, so it cannot be drawn here.", `The chart references dataset '${stringifyText(authored.dataset)}', which the document does not hold (or a field it names).`);
  }
  if (!authored || !Array.isArray(authored.columns) || !Array.isArray(authored.rows)) {
    return unplottable("no-columns", "The chart has no inline data, so it cannot be drawn here.", "The chart data is not inline columns and rows. Supply inline columns and rows or a dataset.");
  }
  if (authored.rows.length === 0) return unplottable("no-rows", "The chart has no data rows.", "The chart data has no rows.");
  if (authored.columns.length === 0) return unplottable("no-columns", "The chart has no data columns.", "The chart data has no columns.");
  const resolvedData = resolveChartData(source, presentation);
  if (!resolvedData.ok) return unplottable(resolvedData.reason, "The chart data cannot be drawn here.", resolvedData.message);
  const data = {columns: resolvedData.columns, rows: resolvedData.rows};
  const columnCodes = (resolvedData.formats ?? []).map(excelCode);
  const diagnostics = resolvedData.diagnostics.filter((entry) => entry.severity === 'warning' && entry.code !== 'chart-value-not-numeric');
  const rejected = resolvedData.diagnostics.filter((entry) => entry.code === 'chart-value-not-numeric');
  const resolved = resolveChartType(chart.type).spec;
  // A chartex type (treemap, histogram, pareto, box & whisker, waterfall, funnel, map) has no classic construct. Natively
  // it is written as its cx:chartSpace part and the clustered column chart of the same data is its mc:Fallback
  // (src/chartex.js). 'auto' (the default) does that for the constructs the native PowerPoint check confirmed and keeps
  // the unconfirmed map on the clustered column chart alone; 'fallback' keeps every chartex id there. The fallback is
  // reported as chartex-fallback, never silent.
  const native = chartexMode === 'native' || (chartexMode === 'auto' && resolved.family === 'chartex' && !resolved.unconfirmed);
  const chartex = resolved.family === 'chartex' && native ? resolved : null;
  const spec = resolved.family === 'chartex' ? CHARTEX_FALLBACK : resolved;
  const typeName = stringifyText(chart.type);
  const adaptations = [];
  if (resolved.family === 'chartex' && !native) {
    const reason = chartexMode === 'fallback'
      ? 'that this exporter does not write'
      : 'that PowerPoint has not yet accepted natively from this exporter (pass chartex: \'native\' to write its chartex part)';
    adaptations.push({adaptation: "chartex-fallback", message: `The '${typeName}' chart is a PowerPoint extension (chartex) chart ${reason}; its data is exported as a native clustered column chart instead.`});
  }
  // FA-14: the resolved table (category, X, series columns), which chart.highlight names its series and categories in.
  const mapped = {resolved: {columns: data.columns, hasX: resolvedData.hasX === true, rows: data.rows}, type: spec.pptx, spec, chartex, barDir: spec.barDir, barGrouping: spec.pptx === 'bar' || spec.pptx === 'area' ? spec.grouping : undefined, diagnostics, heading: data.columns[0], pointCount: data.rows.length,
    // FA-15: core's combo plan (column series, then the primary-axis lines, then the secondary-axis lines), aligned with the series.
    ...(spec.family === 'combo' ? {combo: comboPlanOf(resolvedData, data.columns.length - 1)} : {})};
  // Number formats only when a column has one: a chart without formats carries no `formats` and is written as before.
  const withFormats = (result, formats) => formats.series.some((code) => code !== undefined) || formats.x !== undefined ? {...result, formats} : result;
  if (data.columns.length === 1) {
    const heading = data.columns[0];
    // The lone column holds the chart's values. Core (opf#376) already reads it with chartNumber and reports each
    // non-numeric cell; a core without RR-54 hands it over as authored, so it is read (and its rejects counted) here. A
    // cell that holds no number is skipped, never plotted as 0.
    const points = data.rows.map((row, index) => ({row: index + 1, value: chartNumber(row?.[0]), cell: row?.[0]}));
    for (const point of points) if (point.value === null && point.cell !== null && point.cell !== undefined && point.cell !== '') rejected.push({path: `/data/rows/${point.row - 1}/0`, cell: point.cell});
    const plottedPoints = points.filter((point) => point.value !== null);
    const notNumeric = notNumericDiagnostic(rejected);
    if (plottedPoints.length === 0) {
      return unplottable("single-column-not-numeric", "The chart's data column has no numbers.", `The only chart data column '${heading}' holds no numbers, and a chart needs values to plot.`);
    }
    const skipped = data.rows.length - plottedPoints.length;
    const skippedNote = skipped ? ` (${skipped} non-numeric ${skipped === 1 ? "cell was" : "cells were"} skipped)` : "";
    if (!native && String(chart.type ?? "").toLowerCase() === "histogram") {
      const bins = histogramBins(plottedPoints.map((point) => point.value));
      return {
        type: "bar", spec: CHARTEX_FALLBACK, barDir: "col", barGrouping: "clustered", heading: "Bin", diagnostics, notNumeric, pointCount: bins.length,
        series: [{name: "Frequency", labels: bins.map((bin) => bin.label), values: bins.map((bin) => bin.count)}],
        adaptations: [{
          adaptation: "histogram-binned",
          message: `The histogram's single data column '${heading}' (${plottedPoints.length} values${skippedNote}) was binned into ${bins.length} equal-width bins and exported as a column chart of the counts; PowerPoint's own histogram chart is not exported, and the binned counts do not restore the raw values on re-import.`
        }]
      };
    }
    // Rows keep their own row numbers, so a skipped cell leaves a gap in the numbering.
    const labels = plottedPoints.map((point) => String(point.row));
    const numbers = plottedPoints.map((point) => point.value);
    const scatter = mapped.type === "scatter";
    const series = scatter
      ? [{name: "Row", labels, values: plottedPoints.map((point) => point.row)}, {name: heading, labels, values: numbers}]
      : [{name: heading, labels, values: numbers}];
    const formats = {series: [columnCodes[0]]};
    // A native histogram or Pareto chart bins the values themselves (PowerPoint's automatic bins); only its classic fallback plots them against row numbers.
    if (chartex?.binning) return withFormats({...mapped, series, heading: "Row", hasCategories: false, adaptations, notNumeric}, formats);
    adaptations.push({adaptation: "row-numbers", message: `The chart's single data column '${heading}' has no category column, so its ${plottedPoints.length} values${skippedNote} are plotted against their row numbers.`});
    return withFormats({...mapped, series, heading: "Row", hasCategories: true, adaptations, notNumeric}, formats);
  }

  const labels = data.rows.map((row) => stringifyText(row?.[0]));
  let series = data.columns.slice(1).map((name, seriesIndex) => ({
    name,
    labels,
    // A cell that holds no number (null, an empty or non-numeric string, a boolean) is a gap, as in the preview and the single-column
    // path above: it is neither plotted as a zero nor written into the cache as one. Core already passed it through chartNumber.
    values: data.rows.map((row) => row?.[seriesIndex + 1] ?? null)
  }));
  let codes = columnCodes.slice(1);
  const plotted = spec.family === 'circular' ? 1 : chartex ? chartex.series : Infinity;
  if (series.length > plotted) {
    // A pie, doughnut or single-series chartex construct plots one series; name the ones left out instead of dropping them silently.
    const dropped = series.slice(plotted).map((entry) => `'${entry.name}'`);
    adaptations.push({adaptation: "series-dropped", message: `The ${typeName} chart plots one series, so its first series '${series[0].name}' is exported and the other ${dropped.length} (${dropped.join(", ")}) ${dropped.length === 1 ? "is" : "are"} not.`});
    series = series.slice(0, plotted);
    codes = codes.slice(0, plotted);
  }
  // Only the exported cells count. Core reports a cell at its authored column, which is its resolved position (1 for the
  // first series) unless a mapping reorders the columns; a series that a pie or a single-series construct drops is not counted.
  const position = (entry) => {
    const column = Number(/\/(\d+)$/.exec(entry.path ?? '')?.[1]);
    return source.mapping === undefined ? column : data.columns.indexOf(dataColumnName(authored.columns[column]));
  };
  const notNumeric = notNumericDiagnostic(rejected.filter((entry) => !(position(entry) > plotted)));
  if (spec.family === 'xy' && series.length === 1) {
    // [Point, X, Y...] carries its own X column; a lone value column is plotted against the row numbers.
    series = [{name: 'X', labels, values: data.rows.map((_, index) => index + 1)}, ...series];
    codes = [undefined, ...codes];
    adaptations.push({adaptation: "row-numbers", message: `The scatter chart has no X column (a point label column and one value column), so its ${data.rows.length} values are plotted against their row numbers.`});
  }
  // A scatter chart's first series is its X values (PptxGenJS writes one c:ser per Y series, each with c:xVal).
  const formats = spec.family === 'xy' ? {series: codes.slice(1), x: codes[0]} : {series: codes};
  return withFormats({...mapped, series, hasCategories: true, adaptations, notNumeric}, formats);
}

/** Core's combo plan; a core without one draws every series as columns except the last, a line on the primary axis (the preview's rule). */
function comboPlanOf(resolved, count) {
  if (Array.isArray(resolved.combo) && resolved.combo.length === count) return resolved.combo;
  return Array.from({length: count}, (_, index) => ({role: count > 1 && index === count - 1 ? 'line' : 'bar', axis: 'primary'}));
}

/** A chart column's name: the string, or a DataColumn's `name`. */
function dataColumnName(column) {
  return typeof column === 'string' ? column : column !== null && typeof column === 'object' && typeof column.name === 'string' ? column.name : undefined;
}

/** One chart-value-not-numeric diagnostic per chart (core reports one per cell), or undefined. */
function notNumericDiagnostic(rejected) {
  if (!rejected.length) return undefined;
  const first = rejected[0];
  const shown = Object.hasOwn(first, 'cell') ? JSON.stringify(first.cell) : /chart value (.*) is not a number/.exec(first.message ?? '')?.[1] ?? 'a value';
  return {count: rejected.length, pointer: first.path, message: `${rejected.length} chart ${rejected.length === 1 ? 'value is' : 'values are'} not ${rejected.length === 1 ? 'a number' : 'numbers'} (first: ${shown} at ${first.path}) and ${rejected.length === 1 ? 'is' : 'are'} exported as ${rejected.length === 1 ? 'a gap' : 'gaps'}. Chart values are numbers, or strings in plain decimal syntax (12, -3.5, 1e6); put units, currency and percent in the column's number format.`};
}


/**
 * Equal-width bins (Sturges' count, at most 50) from the minimum to the maximum; every bin but the last is [low, high).
 * Arithmetic stays finite for any finite input (values of +-1e308 and denormals included): the bin edges are
 * computed by interpolating the edges rather than from a width, and a value is placed by comparing it with the edges.
 * Used by the default (fallback) histogram export only; the native chartex histogram bins in PowerPoint.
 */
function histogramBins(values) {
  const min = values.reduce((a, b) => Math.min(a, b)), max = values.reduce((a, b) => Math.max(a, b));
  const count = min === max ? 1 : Math.min(50, Math.ceil(Math.log2(values.length)) + 1);
  const edge = (index) => index === 0 ? min : index === count ? max : min / count * (count - index) + max / count * index;
  const bins = Array.from({length: count}, (_, index) => ({low: edge(index), high: edge(index + 1), count: 0}));
  // A value belongs to the last bin whose lower edge it reaches, so counts always agree with the labelled edges.
  for (const value of values) {
    let index = 0;
    while (index + 1 < count && value >= bins[index + 1].low) index++;
    bins[index].count++;
  }
  // Labels carry six significant digits, and more when that would make two bins read alike.
  for (let precision = 6; ; precision++) {
    const format = (value) => String(Number(value.toPrecision(precision)));
    const labels = bins.map((bin) => min === max ? format(min) : `${format(bin.low)}–${format(bin.high)}`);
    if (new Set(labels).size === labels.length) return bins.map((bin, index) => ({...bin, label: labels[index]}));
    if (precision === 17) return bins.map((bin, index) => ({...bin, label: `${labels[index]} (bin ${index + 1})`}));
  }
}

// Embedded bytes must be a raster the exporter can measure and PptxGenJS can embed (PNG, JPEG, GIF, WebP), or an SVG,
// which exports as a native SVG picture over a PNG fallback raster (see resolveSvgImage). Bytes that are no readable
// image would otherwise fail deep inside packaging. Like an unresolved asset they are not exported as a picture: the
// caller draws the preview's placeholder (or omits the picture) and one `unresolved-asset` diagnostic names the cause;
// `strictAssets` keeps the `unsupported-image-dimensions` error. `outcome.reported` tells a caller that the diagnostic
// was already emitted. `outcome.box` (inches, in) sizes an SVG's fallback raster; `outcome.svg` (out) carries the SVG to
// attach to the picture the caller adds. Local paths are read by PptxGenJS and checked after embedding.
async function resolveImage(asset, presentation, options, path, outcome = {}) {
  const resolved = await resolveImageSource(asset, presentation, options, path);
  // A local SVG file is read here (PptxGenJS cannot size it); a raster path is read by PptxGenJS itself.
  if (resolved?.path && /\.svg$/i.test(resolved.path)) {
    let file;
    try { file = await readLocalFile(resolved.path); }
    catch (error) {
      if (options.strictAssets) throw new OPFPptxError("invalid-svg-image", `The SVG file could not be read (${errorMessage(error)}).`, { path, reason: "svg-unreadable" });
      options.onDiagnostic?.({ code: "unresolved-asset", path, reason: "svg-unreadable", message: `The SVG file could not be read (${errorMessage(error)}). The image exports as the unavailable-image placeholder.` });
      outcome.reported = true;
      return null;
    }
    return resolveSvgImage(file, options, path, outcome);
  }
  if (!resolved?.data) return resolved;
  const bytes = dataUriBytes(resolved.data);
  const raster = bytes && rasterMetadata(bytes);
  // A raster declared as another type (for example a host that resolves an SVG asset to PNG bytes) is embedded as the
  // raster it is. PptxGenJS treats an image/svg+xml data URI as an SVG picture and adds its own fallback, a broken-image
  // placeholder in Node (pptxgenjs-plus; PptxGenJS 4.0.1 pointed the svgBlip at the raster itself).
  if (raster) return dataUriMediaType(resolved.data) === raster.mediaType ? resolved : {...resolved, data: `data:${raster.mediaType};base64,${bytesToBase64(bytes)}`};
  const svg = svgDataUriBytes(resolved.data);
  if (svg) return resolveSvgImage(svg, options, path, outcome);
  const message = `The image is not a readable PNG, JPEG, GIF or WebP (${dataUriMediaType(resolved.data) ?? "unknown type"}); supply a raster through imageResolver (for example opf-render svgToPng).`;
  if (options.strictAssets) throw new OPFPptxError("unsupported-image-dimensions", `Image fitting requires readable PNG, JPEG, GIF or WebP dimensions. ${message}`, { path });
  options.onDiagnostic?.({ code: "unresolved-asset", path, reason: "unsupported-format", message });
  outcome.reported = true;
  return null;
}

// An SVG picture is PowerPoint 2016's native form: the SVG itself (sanitized, never executed or fetched) plus a PNG
// fallback raster drawn from it at 192 dpi of the displayed size by options.svgRasterizer (default: opf-render's resvg,
// deterministic, with its bundled fonts). The caller adds the PNG as the picture and attaches `outcome.svg` at packaging.
// A malformed SVG, an SVG without an intrinsic size or without a rasterizer exports like any unreadable image.
async function resolveSvgImage(source, options, path, outcome) {
  const unresolved = (code, reason, message) => {
    if (options.strictAssets) throw new OPFPptxError(code, message, { path, reason });
    options.onDiagnostic?.({ code: "unresolved-asset", path, reason, message: `${message} The image exports as the unavailable-image placeholder.` });
    outcome.reported = true;
    return null;
  };
  if (source.error) return unresolved("invalid-svg-image", "svg-malformed", source.error);
  const prepared = prepareSvg(source);
  if (prepared.error) return unresolved("invalid-svg-image", prepared.error.reason, prepared.error.message);
  if (prepared.removed.length) {
    options.onDiagnostic?.({ code: "svg-sanitized", path, message: `The SVG had ${prepared.removed.join(", ")} removed before it was embedded: an exported SVG never runs code or refers to anything outside the file.` });
  }
  const scale = svgRasterScale(prepared, outcome.box, outcome.cover === true);
  const width = Math.max(1, Math.round(prepared.width * scale)), height = Math.max(1, Math.round(prepared.height * scale));
  const cacheKey = `${scale}|${prepared.text}`;
  let png = options.svgRasters.get(cacheKey);
  if (!png) {
    try {
      const rasterize = options.svgRasterizer ?? ((svg, hint) => svgToPng(svg, hint));
      png = await rasterize(prepared.text, { width, height, scale, text: prepared.hasText });
      if (!(png instanceof Uint8Array) || rasterMetadata(png)?.mediaType !== "image/png") throw Object.assign(new Error("The rasterizer did not return a PNG."), { code: "svg-render-failed" });
    } catch (error) {
      const reason = error?.code === "svg-rasterizer-unavailable" ? "svg-rasterizer-unavailable" : "svg-render-failed";
      return unresolved(reason, reason, reason === "svg-rasterizer-unavailable"
        ? "An SVG image needs a rasterizer for its PNG fallback: install the optional peer @openpresentation/opf-render, or pass options.svgRasterizer (or an imageResolver that returns a raster)."
        : `The SVG image could not be rasterized for its PNG fallback (${errorMessage(error)}).`);
    }
    options.svgRasters.set(cacheKey, png);
  }
  outcome.svg = { bytes: prepared.bytes, width: prepared.width, height: prepared.height };
  return { data: `data:image/png;base64,${bytesToBase64(png)}` };
}

function dataUriMediaType(uri) {
  return /^data:([^;,]+)/i.exec(uri)?.[1]?.toLowerCase();
}

// Only base64 data URIs carry bytes the exporter can read; any other encoding is not a readable raster.
function dataUriBytes(uri) {
  const match = /^data:[^,]*;base64,/i.exec(uri);
  if (!match) return null;
  try {
    if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(uri.slice(match[0].length), "base64"));
    const binary = atob(uri.slice(match[0].length));
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  } catch {
    return null;
  }
}

async function resolveImageSource(asset, presentation, options, path) {
  const assetObject = dereferenceAsset(asset, presentation, path);
  const src = typeof assetObject === "string" ? assetObject : assetObject?.src;
  if (!src) {
    if (options.strictAssets) {
      throw new OPFPptxError("missing-asset", "Image asset is missing a source.", { path });
    }
    return null;
  }

  const resolvedByHost = options.imageResolver
    ? await options.imageResolver(src, { asset: assetObject, presentation, path })
    : null;
  if (resolvedByHost) return normalizeResolvedImage(resolvedByHost, assetObject);

  if (src.startsWith("data:")) return { data: src };
  if (/^https?:\/\//i.test(src)) {
    if (options.strictAssets) {
      throw new OPFPptxError("unsupported-asset", "Remote image assets require an imageResolver; network fetch is not used.", {
        path,
        src
      });
    }
    return null;
  }
  if (src.startsWith("asset:")) {
    if (options.strictAssets) {
      throw new OPFPptxError("missing-asset", "Image asset reference could not be resolved.", { path, src });
    }
    return null;
  }

  const pathValue = options.baseDir && !isAbsolutePath(src) ? joinPath(options.baseDir, src) : src;
  return { path: pathValue };
}

function normalizeResolvedImage(value, asset) {
  if (typeof value === "string") {
    if (value.startsWith("data:")) return { data: value };
    return { path: value };
  }
  if (value instanceof Uint8Array) {
    const mediaType = asset?.mediaType ?? "image/png";
    return { data: `data:${mediaType};base64,${bytesToBase64(value)}` };
  }
  if (value && typeof value === "object") {
    if (typeof value.data === "string") return { data: value.data };
    if (value.data instanceof Uint8Array) {
      const mediaType = value.mediaType ?? asset?.mediaType ?? "image/png";
      return { data: `data:${mediaType};base64,${bytesToBase64(value.data)}` };
    }
    if (typeof value.path === "string") return { path: value.path };
  }
  throw new OPFPptxError("invalid-image-resolution", "imageResolver must return a data URI, path, Uint8Array, or { data | path } object.");
}

function dereferenceAsset(asset, presentation, path, seen = new Set()) {
  const source = typeof asset === "string" ? asset : asset?.src;
  if (typeof source === "string" && source.startsWith("asset:")) {
    const id = source.slice("asset:".length);
    if (seen.has(id)) {
      throw new OPFPptxError("invalid-asset-reference", "Circular asset reference detected.", { path, assetId: id });
    }
    seen.add(id);
    const target = presentation.assets?.[id];
    if (!target) return asset;
    return dereferenceAsset(target, presentation, path, seen);
  }
  return asset;
}

// PptxGenJS writes its own stand-in (`preencoded.png`, or the local file path) as the picture's description when it is
// given no alt text. The package writes only what the document authored: the alt text as `descr`, and a distinct asset
// `title` as the native `title` attribute (a picture's tooltip and Alt Text title).
function pictureText(alt, asset, presentation) {
  const resolved = dereferenceAsset(asset, presentation, "asset-title");
  const title = isPlainObject(resolved) && typeof resolved.title === "string" && resolved.title && resolved.title !== alt ? resolved.title : undefined;
  return { alt: typeof alt === "string" && alt ? alt : undefined, title: alt ? title : undefined };
}

function writePictureText(picture, text) {
  const escapes = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;", "\r": "&#13;", "\n": "&#10;", "\t": "&#9;" };
  const escape = value => value.replace(/[&<>"'\r\n\t]/g, char => escapes[char]);
  return picture.replace(/<p:cNvPr\b([^>]*?)(\/?)>/, (tag, attributes, close) => {
    attributes = attributes.replace(/\sdescr="[^"]*"/, "").replace(/\stitle="[^"]*"/, "");
    return `<p:cNvPr${attributes}${text.alt ? ` descr="${escape(text.alt)}"` : ""}${text.title ? ` title="${escape(text.title)}"` : ""}${close}>`;
  });
}

function assetAlt(asset, presentation) {
  const resolved = dereferenceAsset(asset, presentation, "asset-alt");
  if (resolved && typeof resolved === "object" && !Array.isArray(resolved)) {
    return resolved.alt ?? resolved.title ?? resolved.description;
  }
  return undefined;
}

function resolveCatalogRecord(presentation, kind, reference, fallbackId) {
  const id = referenceId(reference) ?? fallbackId;
  const inlineRecords = normalizeRecords(presentation.catalogs?.[kind]);
  return findById(inlineRecords, id)
    ?? findById(defaultCatalog(kind), id)
    ?? findById(defaultCatalog(kind), fallbackId)
    ?? null;
}

function resolveDesignRecord(presentation, kind, reference, fallbackId) {
  const base = resolveCatalogRecord(presentation, kind, reference, fallbackId) ?? {};
  return {
    ...base,
    ...(isPlainObject(reference) ? withoutSchema(reference) : {})
  };
}

function referenceId(reference) {
  if (typeof reference === "string") return reference;
  if (isPlainObject(reference) && typeof reference.id === "string") return reference.id;
  return null;
}

const DEFAULT_SOURCE_PREFIX = "https://www.pptx.gallery/";

// Same order as opf-render's socialPlatformRecords so preview and export format
// socials identically. Core applies inline document records first; then the
// document catalog source (host-supplied options.catalogSources, or the bundled
// catalog for pptx.gallery/pkg sources), injected options.catalogs, and the
// bundled catalog (the engine default source also resolves to it).
function socialPlatformRecords(presentation, options) {
  const kind = "socialPlatforms", declared = presentation.catalogs?.[kind]?.source;
  // `source` is one source or an ordered search path (an array): records of each source in order, first match wins.
  const sourceRecords = (Array.isArray(declared) ? declared : [declared]).filter(source => typeof source === "string").flatMap(source => {
    const bySource = options.catalogSources?.[source];
    return bySource ? normalizeRecords(bySource)
      : source.startsWith(DEFAULT_SOURCE_PREFIX) || source.startsWith("pkg:@openpresentation/opf/") ? defaultCatalog(kind) : [];
  });
  return [...sourceRecords, ...normalizeRecords(options.catalogs?.[kind]), ...defaultCatalog(kind)];
}

function defaultCatalog(kind) {
  return Array.isArray(bundledCatalogs[kind]) ? bundledCatalogs[kind] : [];
}

function normalizeRecords(catalog) {
  if (!catalog) return [];
  if (Array.isArray(catalog)) return catalog;
  if (Array.isArray(catalog.records)) return catalog.records;
  return [];
}

function findById(records, id) {
  return records.find((record) => record?.id === id) ?? null;
}

function withoutSchema(value) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "$schema"));
}

function resolveDimensions(value) {
  const { width, height } = resolveCanvasDimensions(value);
  return { widthInches: width / 96, heightInches: height / 96 };
}

// A solid color or pattern background color is a ColorRef (hex, `var:` variable, colour-scheme slot or role), resolved
// as for table fills and run colours. Roles resolve through the colour scheme alone: the background cannot depend on itself.
function resolveBackgroundColorRef(entry, colorScheme, variables = {}) {
  return resolveColorRefValue(entry, {colorScheme, colors: {}, variables});
}

function resolveBackground(value, colorScheme, variables = {}) {
  const fallback = "FFFFFF";
  const reference = entry => normalizeHex(resolveBackgroundColorRef(entry, colorScheme, variables) ?? entry, fallback);
  if (typeof value === "string") {
    if (value.startsWith("#")) return normalizeHex(value, fallback);
    return normalizeHex(colorScheme[value] ?? opfCore.defaultSlideBackground(colorScheme), fallback);
  }
  if (isPlainObject(value)) {
    if (value.type === "solid" && value.color) return reference(value.color);
    if (value.type === "theme" && value.slot) {
      return normalizeHex(colorScheme[value.slot] ?? opfCore.defaultSlideBackground(colorScheme), fallback);
    }
    // Like the SVG preview, text contrast follows a pattern's background color.
    if (value.type === "pattern") return reference(value.pattern?.backgroundColor ?? "#FFFFFF");
    if (value.backgroundColor) return normalizeHex(value.backgroundColor, fallback);
  }
  return normalizeHex(opfCore.defaultSlideBackground(colorScheme), fallback);
}

function resolveFonts(fontScheme) {
  return {id:fontScheme.id,...resolveFontFamilies(fontScheme),scheme:{type:fontScheme.type,major:fontScheme.major,minor:fontScheme.minor}};
}


function normalizeHex(value, fallback = "000000") {
  if (typeof value !== "string") return fallback.replace(/^#/, "").toUpperCase().slice(0, 6);
  const raw = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return raw.split("").map((char) => char + char).join("").toUpperCase();
  }
  if (/^[0-9a-fA-F]{6,8}$/.test(raw)) {
    return raw.slice(0, 6).toUpperCase();
  }
  return fallback.replace(/^#/, "").toUpperCase().slice(0, 6);
}

// The master, layout and notes master half of the native header/footer (RR-11): placeholders and p:hf on the finished parts.
// Every deck gets them (flags off when no slide uses a type), so Insert > Header & Footer works on a deck with no footer too.
function writeNativeFurnitureMasters(output, context) {
  const size = /<p:sldSz\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/.exec(decodeText(output['ppt/presentation.xml'][0]));
  const defaults = new Map((context.defaultFooterOptions ? defaultFooterParts(context.defaultFooterOptions) ?? [] : []).flatMap(part => {
    const ph = {date: 'dt', text: 'ftr', slideNumber: 'sldNum'}[part.field];
    const geometry = ph && defaultPlaceholderGeometry(part);
    return geometry ? [[ph, geometry]] : [];
  }));
  const info = {used: context.nativePlaceholders.used, first: context.nativePlaceholders.first, names: new Set(context.nativeFurniture.keys()), defaults,
    slideSize: {width: size ? Number(size[1]) : 12192000, height: size ? Number(size[2]) : 6858000}, dateText: nativeDateText(context.hostDate)};
  const paths = Object.keys(output);
  try {
    // The placeholders carry the deck's language and direction like every other generated part (partScriptFonts is idempotent).
    const written = (path, bytes) => { output[path] = [context.scriptFonts ? encodeText(partScriptFonts(path, decodeText(bytes), context.scriptFonts, 0)) : bytes, output[path][1]]; };
    writeNativeMasters(paths, path => output[path][0], written, info);
  } catch (error) {
    throw new OPFPptxError('packaging-failed', 'Native header/footer placeholders could not be written.', {cause: errorMessage(error)});
  }
}

async function normalizePptxZip(raw, context) {
  let entries;
  try {
    // RR-17: the pptxgenjs-plus output changes opf-pptx does not take (src/vendor-compat.js).
    entries = legacyVendorOutput(unzipSync(raw));
  } catch (error) {
    throw new OPFPptxError("packaging-failed", "Generated PPTX could not be read back as a ZIP.", {
      cause: errorMessage(error)
    });
  }

  attachCodeTags(entries, context.codeTags);
  attachMetricTags(entries,context.metricTags,context.metricDescriptions);
  attachCardTags(entries,context.cardTags);
  attachMediaTags(entries,context.mediaTags);
  attachHeadingTags(entries,context.headingTags);
  attachPlainTextTags(entries,context.plainTextTags);
  attachTimelineTags(entries,context.timelineTags);
  attachQuoteTags(entries,context.quoteTags);
  attachAnnotationTags(entries,context);
  attachFurnitureFields(entries,context.furnitureFields);
  attachFurnitureTags(entries,context.furnitureTags,context.furnitureManifests,context.furnitureLogoTags);
  // RR-11: the recorded footer shapes become PowerPoint's date, footer and slide-number placeholders.
  context.nativePlaceholders = attachNativePlaceholders(entries,context.nativeFurniture);
  // The "Image unavailable" panel of an unresolved logo: identity only, so import does not read it as content.
  attachTextTags(entries,context.logoPlaceholderTags,LOGO_TAG,'opfLogoPlaceholder','logo placeholder');
  for(const [part,bytes]of Object.entries(entries)){
    if(!/^ppt\/slides\/slide\d+\.xml$/.test(part))continue;
    const relationships=parseRelationships(entries,part);
    for(const [frame]of decodeText(bytes).matchAll(/<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/g)){
      const name=frame.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1];
      if(!context.chartHeadings.has(name))continue;
      const id=frame.match(/<c:chart\b[^>]*\br:id="([^"]+)"/)?.[1],chartPart=relationships.get(id)?.path;
      if(!chartPart)throw new OPFPptxError('packaging-failed','Generated chart relationship is missing.');
      const {heading,labelColor,spec,textSize}=context.chartHeadings.get(name);
      if(heading!==undefined)writeChartCategoryHeading(entries,chartPart,heading);
      entries[chartPart]=encodeText(omitEmptyNumberPoints(applyChartConstruct(decodeText(entries[chartPart]),spec)));
      const highlight=context.chartHeadings.get(name).highlight;
      if(highlight){
        try{entries[chartPart]=encodeText(applyChartHighlight(decodeText(entries[chartPart]),highlight));}
        catch(error){throw new OPFPptxError('packaging-failed',`Chart highlight could not be written: ${errorMessage(error)}`);}
      }
      // PptxGenJS hardcodes a black fallback in pie/doughnut label properties.
      // Normalize only our generated chart text styles; point/series fills stay intact.
      entries[chartPart]=encodeText(decodeText(entries[chartPart]).replace(/<c:txPr>[\s\S]*?<\/c:txPr>/g,properties=>properties.replace(/<a:solidFill>[\s\S]*?<\/a:solidFill>/g,()=>`<a:solidFill><a:srgbClr val="${labelColor}"/></a:solidFill>`)));
      entries[chartPart]=encodeText(applyChartTextSize(decodeText(entries[chartPart]),textSize));
      // RR-35: data labels last, so their own text colours (contrast inside a mark) are not normalized away.
      const {options:chartOptions,kind:optionKind,pointCount}=context.chartHeadings.get(name);
      if(chartOptions?.dataLabels)entries[chartPart]=encodeText(applyDataLabels(decodeText(entries[chartPart]),{resolved:chartOptions,kind:optionKind,palette:context.chartPalettes.get(name),labelColor,font:context.chartFonts.get(name)?.body??'Arial',textSize,pointCount,highlight}));
      // RR-54: the columns' number formats, after the labels: caches, label and value-axis formats, then the workbook cells.
      const numberFormats=context.chartHeadings.get(name).numberFormats;
      if(numberFormats){
        entries[chartPart]=encodeText(applyChartNumberFormats(decodeText(entries[chartPart]),numberFormats));
        try{writeChartWorkbookFormats(entries,chartPart,numericRanges(decodeText(entries[chartPart]),numberFormats));}
        catch(error){throw new OPFPptxError('packaging-failed',`Chart workbook number formats could not be written: ${errorMessage(error)}`);}
      }
    }
  }
  applyChartFonts(entries,context.chartFonts,parseRelationships);
  if (context.chartAlts.size) for (const [part, bytes] of Object.entries(entries)) if (/^ppt\/slides\/slide\d+\.xml$/.test(part)) { const xml = decodeText(bytes), next = applyChartAlt(xml, context.chartAlts); if (next !== xml) entries[part] = encodeText(next); }
  // Chartex charts: the native cx:chartSpace part, its style parts and the mc:AlternateContent frame (the classic chart above is the fallback).
  try {
    attachChartexParts(entries, context.chartex, parseRelationships);
  } catch (error) {
    throw new OPFPptxError('packaging-failed', `Chartex chart parts could not be attached: ${errorMessage(error)}`);
  }
  applyPitchFamilies(entries,context.fontPitch);
  // Native PowerPoint sections (p14:sectionLst) from slide `section` labels, written whatever the provenance option.
  if (context.sections.some(section => section !== undefined)) {
    try { entries['ppt/presentation.xml'] = encodeText(writeSectionList(decodeText(entries['ppt/presentation.xml']), context.sections)); }
    catch (error) { throw new OPFPptxError('packaging-failed', 'Section list could not be written.', {cause: errorMessage(error)}); }
  }
  const imageSources = new Map();
  for (const [part, bytes] of Object.entries(entries)) {
    if (!/^ppt\/slides\/slide\d+\.xml$/.test(part)) continue;
    const relationships = parseRelationships(entries, part);
    for (const [picture] of decodeText(bytes).matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)) {
      const name = picture.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1];
      const placement = context.imagePlacements.get(name) ?? context.quotePhotos.get(name) ?? context.slideImages.get(name) ?? (name === watermarkName() ? context.watermarks.get(part) : name === logoName() ? context.logos.get(part) : undefined);
      const id = picture.match(/<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1];
      if (placement) imageSources.set(relationships.get(id)?.path, placement.path);
    }
    const background = context.backgroundFills.get(part)?.image;
    const backgroundId = background && decodeText(bytes).match(/<p:bg>[\s\S]*?<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1];
    if (backgroundId) imageSources.set(relationships.get(backgroundId)?.path, background.path);
  }
  // SVG pictures: the media part, its relationship and the asvg:svgBlip extension beside the PNG fallback blip. Fitting then
  // uses the SVG's own proportions (the fallback raster only approximates them at integer pixels).
  const svgSizes = attachSvgPictures(entries, context.svgPictures);
  const imageMetadata = new Map();
  for (const [part, bytes] of Object.entries(entries)) {
    if (!part.startsWith('ppt/media/')) continue;
    let metadata = rasterMetadata(bytes);
    if (metadata && svgSizes.has(part)) metadata = {...metadata, ...svgSizes.get(part)};
    if (metadata?.mediaType === 'image/webp' && context.imageFormat === 'compatible') {
      try {
        if (metadata.width * metadata.height > 40_000_000) throw new Error('Image dimensions exceed the 40 megapixel conversion limit.');
        const png = await webpToPng(bytes);
        metadata = rasterMetadata(png);
        if (metadata?.mediaType !== 'image/png') throw new Error('The local decoder did not return a PNG.');
        entries[part] = png;
      } catch (error) {
        throw new OPFPptxError('image-conversion-failed', 'WebP could not be converted to a compatible PNG.', {path: imageSources.get(part) ?? part, cause: errorMessage(error)});
      }
    }
    imageMetadata.set(part, metadata);
  }
  // Slide images need the embedded dimensions; document provenance (FF-32)
  // later records the placed frames as slide geometry evidence.
  placeSlideImages(entries, context.slideImages, (part, id) => imageMetadata.get(parseRelationships(entries, part).get(id)?.path), path => {
    throw new OPFPptxError("unsupported-image-dimensions", "Image fitting requires readable PNG, JPEG, GIF or WebP dimensions. Supply a supported raster image through imageResolver.", { path });
  });
  tagTextWatermarks(entries, context.textWatermarks);
  placeWatermarks(entries, context.watermarks, (part, id) => imageMetadata.get(parseRelationships(entries, part).get(id)?.path), path => {
    throw new OPFPptxError("unsupported-image-dimensions", "Image fitting requires readable PNG, JPEG, GIF or WebP dimensions. Supply a supported raster image through imageResolver.", { path });
  });
  placeLogos(entries, context.logos, (part, id) => imageMetadata.get(parseRelationships(entries, part).get(id)?.path), path => {
    throw new OPFPptxError("unsupported-image-dimensions", "Image fitting requires readable PNG, JPEG, GIF or WebP dimensions. Supply a supported raster image through imageResolver.", { path });
  });
  // A picture repeated across slides embeds once (after fitting, which needs each slide's own relationship).
  dedupeMedia(entries, imageMetadata, resolveRelationshipTarget);
  // Charts and notes follow the language and fonts of the slide they belong to.
  context.partSlides = new Map();
  for (const part of Object.keys(entries)) {
    const slide = /^ppt\/slides\/slide(\d+)\.xml$/.exec(part);
    if (!slide) continue;
    context.partSlides.set(part, Number(slide[1]) - 1);
    for (const relationship of parseRelationships(entries, part).values()) {
      if (/\/(?:chart|chartEx|notesSlide)$/.test(relationship.type)) context.partSlides.set(relationship.path, Number(slide[1]) - 1);
    }
  }
  const output = {};
  const renameMaps = buildRenameMaps(Object.keys(entries));
  // The host may transform assets or supply a filename/MIME hint that no
  // longer matches its bytes. Native package metadata must describe the bytes.
  renameMaps.media = new Map();
  for (const [path, metadata] of imageMetadata) {
    if (!metadata) continue;
    const extension = metadata.mediaType.slice('image/'.length);
    const currentExtension = path.split('.').at(-1).toLowerCase();
    if (currentExtension === extension || (extension === 'jpeg' && currentExtension === 'jpg')) continue;
    const target = path.replace(/\.[^/.]+$/, `.${extension}`);
    if (target !== path && Object.hasOwn(entries, target)) throw new OPFPptxError('packaging-failed', 'Normalized image paths collide.', {path, target});
    renameMaps.media.set(path, target);
  }
  for (const path of Object.keys(entries).sort()) {
    const normalizedPath = normalizePartPath(path, renameMaps);
    const bytes = normalizePartBytes(path, entries[path], context, renameMaps, entries, imageMetadata);
    output[normalizedPath] = [bytes, {
      level: context.compressionLevel,
      mtime: context.zipDate
    }];
  }

  writeNativeFurnitureMasters(output, context);
  giveNotesMastersOwnThemes(output);
  // opf-pptx#168: one slide master and theme per script profile, so each slide's own East Asian / complex-script fonts
  // reach PowerPoint through its master's theme (runs name none, FF-05). One profile: no change.
  if (context.scriptFonts && output['ppt/theme/theme1.xml']) {
    const slideThemes = planSlideThemes(context.scriptFonts, decodeText(output['ppt/theme/theme1.xml'][0]));
    try {
      giveSlidesScriptMasters(output, slideThemes);
    } catch (error) {
      throw new OPFPptxError('packaging-failed', 'Slide masters for per-slide script fonts could not be written.', {cause: errorMessage(error)});
    }
    reportPerSlideNotesScriptFonts(context.scriptFonts, slideThemes);
  }
  finalizeFontsUsed(output);
  // Document references record evidence from the final normalized parts.
  if (context.documentProvenance) {
    const parts = Object.fromEntries(Object.entries(output).map(([path, [bytes]]) => [path, bytes]));
    try {
      attachDocumentProvenance(parts, context.documentProvenance);
    } catch (error) {
      throw new OPFPptxError("packaging-failed", "Document provenance tags could not be attached.", {cause: errorMessage(error)});
    }
    // RR-54: chart and table data records (on the final chart parts, so their cache evidence is what import reads) and the
    // datasets map beside the document tag.
    if (context.provenanceMode === 'full') {
      try {
        attachDataProvenance(parts, {records: context.dataRecords, paths: context.dataRecordPaths, datasets: context.datasets, parseRelationships, report: context.reportDiagnostic});
      } catch (error) {
        throw new OPFPptxError("packaging-failed", "Chart and table data tags could not be attached.", {cause: errorMessage(error)});
      }
    }
    for (const [path, bytes] of Object.entries(parts)) output[path] = [bytes, {level: context.compressionLevel, mtime: context.zipDate}];
  }

  // Sort after chart/worksheet renaming; source counters can cross digit widths.
  const sortedOutput = Object.fromEntries(Object.keys(output).sort().map(path => [path, output[path]]));
  return stampGeneratedZip(zipSync(sortedOutput, {
    level: context.compressionLevel,
    mtime: context.zipDate
  }), context.zipDateStamp);
}

function preserveCarriageReturns(xml, textElements) {
  // Only our generated text content is rewritten. Escaped literal entity text
  // remains escaped, and XML formatting outside these elements is untouched.
  return xml.replace(/(<([\w:]+)\b[^>]*>)([^<]*)(<\/\2>)/g, (element, open, name, text, close) =>
    textElements.has(name) ? open + text.replace(/\r/g, '&#13;') + close : element);
}

const CORE_TEXT_ELEMENTS = new Set(['dc:title', 'dc:subject', 'dc:description', 'dc:creator']);

function preserveGeneratedNotes(xml, notes, path) {
  // PptxGenJS changes LF to CRLF. For authored CR, write the original text into
  // its one generated native notes body; nothing is retained in hidden tags.
  const text = notes.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/\r/g, '&#13;');
  let bodies = 0, texts = 0;
  const output = xml.replace(/<p:sp\b[^>]*>[\s\S]*?<\/p:sp>/g, shape => {
    if (!/<p:ph\b[^>]*\btype="body"/.test(shape)) return shape;
    bodies++;
    return shape.replace(/(<a:t\b[^>]*>)[^<]*(<\/a:t>)/g, (_, open, close) => {
      texts++;
      return open + text + close;
    });
  });
  if (bodies !== 1 || texts !== 1) throw new OPFPptxError('packaging-failed', 'Generated notes must have one body text element.', {path});
  return output;
}

function normalizeCoreProperties(xml, timestamp) {
  return preserveCarriageReturns(xml, CORE_TEXT_ELEMENTS)
    .replace(/<dcterms:created xsi:type="dcterms:W3CDTF">[^<]*<\/dcterms:created>/g, `<dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created>`)
    .replace(/<dcterms:modified xsi:type="dcterms:W3CDTF">[^<]*<\/dcterms:modified>/g, `<dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified>`);
}

function normalizePartBytes(path, bytes, context, renameMaps, entries, imageMetadata) {
  if (imageMetadata.has(path)) return normalizeImageOrientation(bytes, imageMetadata.get(path));
  if (path.endsWith(".xlsx")) {
    return normalizeNestedZip(bytes, context);
  }
  if (path === "docProps/core.xml") {
    return encodeText(normalizePartReferences(normalizeCoreProperties(decodeText(bytes), context.timestamp), renameMaps));
  }
  if (isXmlPart(path)) {
    let xml=decodeText(bytes);
    if (context.notesWithCarriageReturns.has(path)) xml = preserveGeneratedNotes(xml, context.notesWithCarriageReturns.get(path), path);
    if (path === '[Content_Types].xml') {
      // PptxGenJS 4.0.1 emitted one slide-master override per slide even
      // though it created only the actual master parts (pptxgenjs-plus fixed
      // this, #1444). Omit any phantom master declaration without changing
      // any existing part or relationship.
      xml = xml.replace(/<Override PartName="\/(ppt\/slideMasters\/slideMaster\d+\.xml)"[^>]*\/>/g,
        (override, part) => Object.hasOwn(entries, part) ? override : '');
      // Explicit per-part types describe the actual bytes (PptxGenJS 4.0.1's
      // image/jpg default; pptxgenjs-plus writes image/jpeg).
      const overrides = [...imageMetadata].filter(([, metadata]) => metadata).map(([part, metadata]) =>
        `<Override PartName="/${part}" ContentType="${metadata.mediaType}"/>`).join('');
      xml = xml.replace('</Types>', `${overrides}</Types>`);
    }
    if (/^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(path)) xml = themeMasterBulletFonts(xml);
    if (context.masterBackground && path === 'ppt/slideMasters/slideMaster1.xml') xml = writeMasterBackground(xml, context.masterBackground);
    if (context.masterBackground && /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(path)) xml = inheritLayoutBackground(xml);
    if (path === 'ppt/presentation.xml') xml = presentationInSchemaOrder(xml);
    if (path === 'ppt/theme/theme1.xml') xml = writeThemeColors(xml, {colors: context.themeColors, schemeName: context.schemeName, themeName: context.themeName});
    if (/^ppt\/slides\/slide\d+\.xml$/.test(path)) {
      xml = writeLinkSentinels(xml, context.linkSentinels);
      const fill = context.backgroundFills.get(path);
      if (typeof fill === 'string') xml = xml.replace(/<p:bg>[\s\S]*?<\/p:bg>/, `<p:bg><p:bgPr>${fill}<a:effectLst/></p:bgPr></p:bg>`);
      else if (fill?.image) {
        // Fit the exact raster PptxGenJS embedded for this slide background.
        const backgroundRelationships = parseRelationships(entries, path);
        xml = xml.replace(/<p:bg>[\s\S]*?<\/p:bg>/, background => {
          const id = background.match(/<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1];
          const metadata = imageMetadata.get(backgroundRelationships.get(id)?.path);
          if (!id || !metadata) throw new OPFPptxError("unsupported-image-dimensions", "Background image fitting requires readable PNG, JPEG, GIF or WebP dimensions. Supply a supported raster image through imageResolver.", { path: fill.image.path });
          if ((metadata.orientation ?? 1) !== 1) fill.image.report?.({code: 'unsupported-background-image-orientation', path: fill.image.path, message: 'A slide background picture fill cannot rotate or mirror its image; the JPEG EXIF orientation is not applied in the native background.'});
          return `<p:bg><p:bgPr>${nativeImageBackgroundFill(id, metadata, fill.image)}<a:effectLst/></p:bgPr></p:bg>`;
        });
      }
      // PptxGenJS table IDs can collide with other objects on the same slide.
      // Preserve existing IDs and allocate unused IDs only for duplicates. This
      // export path creates no connector attachments or animation ID references.
      const objectIds = [...xml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)].map(match => Number(match[1]));
      let nextObjectId = Math.max(0, ...objectIds) + 1;
      const seenObjectIds = new Set();
      xml = xml.replace(/(<p:cNvPr\b[^>]*\bid=")(\d+)(")/g, (node, before, rawId, after) => {
        const id = Number(rawId);
        if (seenObjectIds.has(id)) return `${before}${nextObjectId++}${after}`;
        seenObjectIds.add(id);
        return node;
      });
      // PptxGenJS 4 has no firstRow option. Set the native flag explicitly so
      // viewers and later imports distinguish column labels from data rows.
      xml = xml.replace(/<p:graphicFrame>([\s\S]*?)<\/p:graphicFrame>/g, frame => {
        const name = frame.match(/name="(OPF table \d+)"/)?.[1];
        if (!context.tableHeaders.has(name)) return frame;
        frame = frame.replace('<a:tblPr/>', `<a:tblPr firstRow="${context.tableHeaders.get(name) ? 1 : 0}"/>`);
        const table = context.tableCells.get(name);
        if (!table) return frame;
        const anchors = table.layout.rows.flatMap(row => row.cells);
        const ownerAt = (row,column) => anchors.find(anchor => row >= anchor.row && row < anchor.row + anchor.rowSpan && column >= anchor.column && column < anchor.column + anchor.colSpan);
        let rowIndex = 0;
        return frame.replace(/<a:tr\b[^>]*>[\s\S]*?<\/a:tr>/g, rowXml => {
          const currentRow = rowIndex++;
          const cells = table.layout.rows[currentRow].cells;
          let column = 0;
          return rowXml.replace(/<a:tc\b[^>]*>[\s\S]*?<\/a:tc>/g, cellXml => {
            const currentColumn = column++;
            const cell = cells.find(cell => cell.column === currentColumn);
            const owner = cell ?? ownerAt(currentRow,currentColumn);
            if (!owner) return cellXml;
            // PowerPoint reads each physical continuation's perimeter border.
            // Anchor-only styling truncates dashes and restores hidden segments.
            const perimeter = {left:currentColumn === owner.column, right:currentColumn === owner.column + owner.colSpan - 1,
              top:currentRow === owner.row, bottom:currentRow === owner.row + owner.rowSpan - 1};
            const style = cell ? {...cell.style} : {borders:Object.fromEntries(Object.keys(perimeter).map(edge => [edge,perimeter[edge] ? owner.style?.borders?.[edge] ?? table.defaultBorder : {color:'#000000',width:0}]))};
            style.borders = {...style.borders};
            // Native shared-edge precedence can let an implicit neighbor cover
            // an explicit merge border. Give both physical sides that border.
            for (const [edge,opposite,dr,dc] of [['left','right',0,-1],['right','left',0,1],['top','bottom',-1,0],['bottom','top',1,0]]) {
              if (!perimeter[edge] || style.borders[edge] || owner.rowSpan > 1 || owner.colSpan > 1) continue;
              const neighbor = ownerAt(currentRow+dr,currentColumn+dc);
              if (neighbor?.style?.borders?.[opposite]) style.borders[edge] = neighbor.style.borders[opposite];
            }
            cellXml = cellXml.replace(/<a:tcPr\b([^>]*)\/>/, '<a:tcPr$1></a:tcPr>');
            return cellXml.replace(/<a:tcPr\b([^>]*)>([\s\S]*?)<\/a:tcPr>/, (properties, attributes, contents) => {
              if (style.padding) {
                const padding = {top:8, right:10, bottom:4, left:10, ...style.padding};
                for (const [edge, key] of [['top','marT'],['right','marR'],['bottom','marB'],['left','marL']]) {
                  attributes = attributes.replace(new RegExp(` ${key}="[^"]*"`), '');
                  attributes += ` ${key}="${Math.round(padding[edge] * table.scale * 9525)}"`;
                }
              }
              for (const [edge, native] of [['left','lnL'],['right','lnR'],['top','lnT'],['bottom','lnB']]) {
                const border = style.borders?.[edge];
                if (!border) continue;
                const slideContext = table.context, borderHex = exportColor(border.color, slideContext, slideContext.colors.border);
                const borderOpacity = borderHex.length === 8 ? parseInt(borderHex.slice(6), 16) / 255 : 1;
                const borderScheme = borderOpacity === 1 ? schemeColorValue(border.color, borderHex, slideContext) : undefined;
                const fill = border.width === 0 ? '<a:noFill/>' : borderScheme ? `<a:solidFill><a:schemeClr val="${borderScheme}"/></a:solidFill>` : nativeBackgroundFill({type:'solid',color:'#' + borderHex.slice(0, 6), opacity: borderOpacity},{width:1,height:1}, slideContext.colors.border);
                const dash = {solid:'solid',dash:'dash',dot:'sysDot'}[border.dash ?? 'solid'];
                const line = `<a:${native} w="${Math.round(border.width * table.scale * 9525)}" cap="flat" cmpd="sng" algn="ctr">${fill}<a:prstDash val="${dash}"/></a:${native}>`;
                const existing = new RegExp(`<a:${native}\\b[^>]*>[\\s\\S]*?<\\/a:${native}>`);
                contents = existing.test(contents) ? contents.replace(existing, line) : contents + line;
              }
              return `<a:tcPr${attributes}>${contents}</a:tcPr>`;
            });
          });
        });
      });
      // Image data is already resolved and embedded by PptxGenJS. Read those
      // exact bytes instead of fetching or resolving the source a second time.
      const relationships = parseRelationships(entries, path);
      let bulletRelationship;
      xml = xml.replace(/<p:pic>([\s\S]*?)<\/p:pic>/g, picture => {
        if (picture.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1] === bulletImageName()) {
          // Only its media part and relationship are wanted: every picture-bullet paragraph points at them (a:buBlip).
          bulletRelationship = picture.match(/<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1];
          return '';
        }
        const text = context.pictureText.get(picture.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1]);
        if (text) picture = writePictureText(picture, text);
        const placement = context.imagePlacements.get(picture.match(/name="(OPF image \d+)"/)?.[1]) ?? context.quotePhotos.get(picture.match(/name="(OPF quote photo \d+)"/)?.[1]);
        if (!placement) return picture;
        const id = picture.match(/<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1];
        const dimensions = imageMetadata.get(relationships.get(id)?.path);
        if (!dimensions) throw new OPFPptxError("unsupported-image-dimensions", "Image fitting requires readable PNG, JPEG, GIF or WebP dimensions. Supply a supported raster image through imageResolver.", { path: placement.path });
        const fitted = pictureTransform(dimensions, placement.region, placement.mode);
        const emu = value => Math.round(value * EMUS_PER_INCH);
        const transformAttrs = `${fitted.rotation ? ` rot="${fitted.rotation * 60000}"` : ''}${fitted.flipH ? ' flipH="1"' : ''}${fitted.flipV ? ' flipV="1"' : ''}`;
        picture = picture.replace(/<a:xfrm\b[^>]*>[\s\S]*?<\/a:xfrm>/, `<a:xfrm${transformAttrs}><a:off x="${emu(fitted.x)}" y="${emu(fitted.y)}"/><a:ext cx="${emu(fitted.w)}" cy="${emu(fitted.h)}"/></a:xfrm>`);
        if (fitted.crop) {
          const attrs = Object.entries(fitted.crop).map(([key, value]) => `${key}="${value}"`).join(' ');
          picture = picture.replace('<a:stretch>', `<a:srcRect ${attrs}/><a:stretch>`);
        }
        // The circular headshot mask: the core frame's DrawingML preset (ellipse) instead of the rectangle.
        if (placement.shape) picture = picture.replace(/<a:prstGeom\b[\s\S]*?<\/a:prstGeom>/, `<a:prstGeom prst="${placement.shape.preset}"><a:avLst/></a:prstGeom>`);
        return picture;
      });
      // Native bullets otherwise inherit the first rich run's size, font and
      // color, which can differ from the measured list marker.
      xml=xml.replace(/<p:sp>([\s\S]*?)<\/p:sp>/g,(shape)=>{
        const marker=context.listMarkers.get(shape.match(/name="(OPF list [^"]* line \d+)"/)?.[1]);
        if(!marker)return shape;
        if(marker.picture&&bulletRelationship)return shape.replace(/<a:buChar\b[^>]*\/>/g,`<a:buBlip><a:blip r:embed="${bulletRelationship}"/></a:buBlip>`);
        const family=marker.fontFamily.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
        // RR-33: an auto-number takes the measured size, colour and family like a character bullet, and startAt only when it is not 1.
        const autoNumber=/<a:buSzPct val="100000"\/><a:buFont typeface="\+mj-lt"\/><a:buAutoNum type="([A-Za-z]+)" startAt="(\d+)"\/>/;
        if(autoNumber.test(shape))return shape.replace(autoNumber,(_,type,startAt)=>`<a:buClr>${solidColorXml(marker.color)}</a:buClr><a:buSzPts val="${Math.round(marker.fontSize*100)}"/><a:buFont typeface="${family}"/><a:buAutoNum type="${type}"${startAt==='1'?'':` startAt="${startAt}"`}/>`);
        return shape.replace(/<a:buSzPct val="100000"\/>/g,`<a:buClr>${solidColorXml(marker.color)}</a:buClr><a:buSzPts val="${Math.round(marker.fontSize*100)}"/><a:buFont typeface="${family}"/>`);
      });
      // PptxGenJS gives shapes no alternative text. An unavailable image's panel
      // carries the accessible name the preview gives its group.
      xml=xml.replace(/<p:cNvPr id="(\d+)" name="(OPF image placeholder \d+)"(\/?)>/g,(node,id,name,close)=>{
        const description=context.imagePlaceholders.get(name);
        if(description===undefined)return node;
        const escapes={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;','\r':'&#13;','\n':'&#10;','\t':'&#9;'};
        return `<p:cNvPr id="${id}" name="${name}" descr="${description.replace(/[&<>"'\r\n\t]/g,char=>escapes[char])}"${close}>`;
      });
      // PptxGenJS 4.0.1 emitted pPr before each rich run (pptxgenjs-plus writes
      // one). OOXML allows one pPr, before all runs. Paragraph options belong
      // to the first run.
      xml=xml.replace(/<a:p>([\s\S]*?)<\/a:p>/g,(_,body)=>{
        let properties='';
        const content=body.replace(/<a:pPr\b[^>]*(?:\/>|>[\s\S]*?<\/a:pPr>)/g,node=>{properties ||= node;return '';});
        return `<a:p>${properties}${content}</a:p>`;
      });
    }
    // theme1.xml: FF-24 colors and names above, then FF-07 fonts here; they touch disjoint elements.
    if (context.scriptFonts) xml = partScriptFonts(path, xml, context.scriptFonts, context.partSlides.get(path) ?? 0);
    else if (/^ppt\/theme\/theme\d+\.xml$/.test(path)) xml = themeEastAsianFromLatin(xml);
    if (/^ppt\/(?:slides\/slide|notesSlides\/notesSlide)\d+\.xml$/.test(path)) xml = stripRunScriptFonts(xml);
    if (context.scriptFonts && /^ppt\/slides\/slide\d+\.xml$/.test(path)) xml = runLanguageFonts(xml, context.scriptFonts, context.partSlides.get(path) ?? 0);
    return encodeText(normalizePartReferences(xml, renameMaps));
  }
  return bytes;
}

// The vendored PptxGenJS master (4.0.1 and pptxgenjs-plus 4.3.4) hard-codes Arial as the bullet font on
// all nine bodyStyle levels, while each level's text already uses +mn-lt.
// Point those bullets at the same theme minor (body) font so a document's
// fontScheme also governs master bullets. a:buFont is CT_TextFont, like
// a:latin, so the theme reference is schema-valid. Slide list markers keep
// their explicit per-shape buFont; only the master bodyStyle is touched.
const VENDOR_MASTER_BULLET_FONT = '<a:buFont typeface="Arial" pitchFamily="34" charset="0"/>';
const THEME_MINOR_BULLET_FONT = '<a:buFont typeface="+mn-lt"/>';
function themeMasterBulletFonts(xml) {
  return xml.replace(/<p:bodyStyle>[\s\S]*?<\/p:bodyStyle>/, bodyStyle =>
    bodyStyle.split(VENDOR_MASTER_BULLET_FONT).join(THEME_MINOR_BULLET_FONT));
}

// FF-05: PptxGenJS (4.0.1 and pptxgenjs-plus 4.3.4) writes p:notesMasterIdLst after p:sldIdLst, but CT_Presentation is a sequence
// (sldMasterIdLst, notesMasterIdLst, handoutMasterIdLst, sldIdLst, sldSz, ...). PowerPoint reads the out-of-order
// list as no notes master and lists a default-theme font (Aptos) in Presentation.Fonts; schema order restores
// the exporter's own notes master. Only the list's position changes.
function presentationInSchemaOrder(xml) {
  const notes = /<p:notesMasterIdLst>[\s\S]*?<\/p:notesMasterIdLst>/.exec(xml)?.[0];
  if (!notes || xml.indexOf(notes) < xml.indexOf('</p:sldMasterIdLst>')) return xml;
  return xml.replace(notes, '').replace('</p:sldMasterIdLst>', `</p:sldMasterIdLst>${notes}`);
}

function isXmlPart(path) {
  return path.endsWith(".xml") || path.endsWith(".rels") || path === "[Content_Types].xml";
}

function buildRenameMaps(paths) {
  return {
    charts: numberedFilenameMap(paths, /^ppt\/charts\/chart(\d+)\.xml$/),
    worksheets: numberedFilenameMap(paths, /^ppt\/embeddings\/Microsoft_Excel_Worksheet(\d+)\.xlsx$/)
  };
}

function numberedFilenameMap(paths, pattern) {
  const ids = [...new Set(paths.flatMap((path) => {
    const match = pattern.exec(path);
    return match ? [Number(match[1])] : [];
  }))].sort((a, b) => a - b);
  return new Map(ids.map((id, index) => [String(id), String(index + 1)]));
}

function normalizePartPath(path, renameMaps) {
  return normalizePartReferences(renameMaps.media?.get(path) ?? path, renameMaps);
}

function normalizePartReferences(value, renameMaps) {
  let output = value;
  for (const [oldId, newId] of renameMaps.charts) {
    output = output.replace(new RegExp(escapeRegExp(`chart${oldId}.xml`), "g"), `chart${newId}.xml`);
  }
  for (const [oldId, newId] of renameMaps.worksheets) {
    output = output.replace(
      new RegExp(escapeRegExp(`Microsoft_Excel_Worksheet${oldId}.xlsx`), "g"),
      `Microsoft_Excel_Worksheet${newId}.xlsx`
    );
  }
  // Rewrite package references only, not user-visible text containing paths.
  output = output.replace(/\b(Target|PartName)="([^"]+)"/g, (attribute, name, value) => {
    const prefix = value.startsWith('../media/') ? '../' : value.startsWith('/ppt/media/') ? '/ppt/' : null;
    if (!prefix) return attribute;
    const part = 'ppt/' + value.slice(prefix.length);
    const target = renameMaps.media?.get(part);
    return target ? `${name}="${prefix}${target.slice('ppt/'.length)}"` : attribute;
  });
  return output;
}

function normalizeNestedZip(bytes, context) {
  // RR-17 (opf-pptx#162): valid table and dimension ranges, or Keynote drops the chart (see chart-workbook.js).
  const entries = repairChartWorkbookRanges(unzipSync(bytes));
  const output = {};
  for (const path of Object.keys(entries).sort()) {
    // A gap in the chart data is a blank workbook cell, not a numeric cell with an empty value. RR-54 (opf-pptx#172): the
    // engine writes a scatter (and bubble) X gap as `<v>${val}</v>`, so a null X value became `<v>null</v>`, a numeric cell
    // that is no number; it is a gap too. Zero values are kept as `<v>0</v>` (pptxgenjs-plus fixed the `values[idx] || ''`
    // of PptxGenJS 4.0.1, upstream issue #1430; test/chart-workbook-values.mjs).
    const entryBytes = path === "docProps/core.xml"
      ? encodeText(normalizeCoreProperties(decodeText(entries[path]), context.timestamp))
      : /^xl\/worksheets\/sheet\d+\.xml$/.test(path)
        ? encodeText(decodeText(entries[path]).replace(/<c ((?:r|s)="[^"]*"(?: (?:r|s)="[^"]*")*)><v>(?:null|undefined)?<\/v><\/c>/g, "<c $1/>"))
        : entries[path];
    output[path] = [entryBytes, {
      level: context.compressionLevel,
      mtime: context.zipDate
    }];
  }
  return stampGeneratedZip(zipSync(output, {
    level: context.compressionLevel,
    mtime: context.zipDate
  }), context.zipDateStamp);
}

// Explicit ZIP dates use UTC calendar fields. fflate clones mtime and reads
// local fields, so passing a Date cannot express this reliably (including DST
// gaps and skipped civil days). Leave the established default path unchanged.
function resolveZipDateStamp(value) {
  if (value === undefined) return null;
  const invalid = () => {
    throw new OPFPptxError('invalid-zip-date', 'zipDate must be a valid Date, finite epoch milliseconds, an ISO date, or an ISO datetime with Z/offset, within UTC years 1980–2099.', {path: 'options.zipDate'});
  };
  let time;
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:\d{2}))?$/.exec(value);
    if (!match) invalid();
    const [, year, month, day, hour = '00', minute = '00', second = '00', fraction = '', zone = 'Z'] = match;
    const parts = [year, month, day, hour, minute, second].map(Number);
    if (parts[1] < 1 || parts[1] > 12 || parts[2] < 1 || parts[3] > 23 || parts[4] > 59 || parts[5] > 59) invalid();
    const date = new Date(0);
    date.setUTCFullYear(parts[0], parts[1] - 1, parts[2]);
    date.setUTCHours(parts[3], parts[4], parts[5], Number(fraction.slice(0, 3).padEnd(3, '0')));
    if (date.getUTCFullYear() !== parts[0] || date.getUTCMonth() !== parts[1] - 1 || date.getUTCDate() !== parts[2]) invalid();
    const offsetHours = zone === 'Z' ? 0 : Number(zone.slice(1, 3));
    const offsetMinutes = zone === 'Z' ? 0 : Number(zone.slice(4, 6));
    if (offsetHours > 23 || offsetMinutes > 59) invalid();
    const offset = (offsetHours * 60 + offsetMinutes) * (zone[0] === '-' ? -1 : 1);
    time = date.getTime() - offset * 60000;
  } else if (typeof value === 'number') {
    time = value;
  } else {
    // The native brand check accepts cross-realm Dates without coercing objects.
    try { time = Date.prototype.getTime.call(value); } catch { invalid(); }
  }
  const date = new Date(time);
  const year = date.getUTCFullYear();
  if (!Number.isFinite(time) || !Number.isFinite(year) || year < 1980 || year > 2099) invalid();
  return (((year - 1980) << 25) | ((date.getUTCMonth() + 1) << 21) | (date.getUTCDate() << 16) |
    (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1)) >>> 0;
}

function stampGeneratedZip(bytes, stamp) {
  if (stamp === null) return bytes;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fail = () => { throw new OPFPptxError('packaging-failed', 'Generated ZIP headers could not be timestamped safely.'); };
  const end = bytes.length - 22;
  if (end < 0 || view.getUint32(end, true) !== 0x06054b50 || view.getUint16(end + 4, true) !== 0 ||
    view.getUint16(end + 6, true) !== 0 || view.getUint16(end + 20, true) !== 0) fail();
  const count = view.getUint16(end + 10, true);
  const start = view.getUint32(end + 16, true);
  if (count !== view.getUint16(end + 8, true) || start + view.getUint32(end + 12, true) !== end) fail();
  const positions = [];
  let central = start, localEnd = 0;
  for (let i = 0; i < count; i++) {
    if (central + 46 > end || view.getUint32(central, true) !== 0x02014b50) fail();
    const nameSize = view.getUint16(central + 28, true);
    const next = central + 46 + nameSize + view.getUint16(central + 30, true) + view.getUint16(central + 32, true);
    const local = view.getUint32(central + 42, true);
    if (next > end || local !== localEnd || local + 30 > start || view.getUint32(local, true) !== 0x04034b50 ||
      view.getUint16(local + 26, true) !== nameSize || view.getUint16(central + 34, true) !== 0) fail();
    const content = local + 30 + nameSize + view.getUint16(local + 28, true);
    localEnd = content + view.getUint32(central + 20, true);
    if (content > start || localEnd > start || view.getUint32(local + 18, true) !== view.getUint32(central + 20, true) ||
      view.getUint32(local + 14, true) !== view.getUint32(central + 16, true) ||
      view.getUint32(local + 22, true) !== view.getUint32(central + 24, true) ||
      view.getUint16(local + 6, true) !== view.getUint16(central + 8, true) ||
      view.getUint16(local + 8, true) !== view.getUint16(central + 10, true)) fail();
    for (let j = 0; j < nameSize; j++) if (bytes[local + 30 + j] !== bytes[central + 46 + j]) fail();
    positions.push(local + 10, central + 12);
    central = next;
  }
  if (central !== end || localEnd !== start) fail();
  for (const position of positions) view.setUint32(position, stamp, true);
  return bytes;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function withDeterministicRandom(seed, callback) {
  const originalRandom = Math.random;
  let state = seed >>> 0;
  Math.random = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  try {
    return await callback();
  } finally {
    Math.random = originalRandom;
  }
}

function asUint8Array(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw new OPFPptxError("invalid-output", "PPTX generator returned an unsupported output type.");
}

function stringifyText(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(stringifyText).join("");
  if (isPlainObject(value)) {
    if (value.text !== undefined) return stringifyText(value.text);
    if (value.value !== undefined) return stringifyText(value.value);
    return JSON.stringify(value);
  }
  return String(value);
}

// PptxGenJS writes a gap (null) as `<c:pt idx="n"><c:v></c:v></c:pt>`. A native gap is a numeric cache with no point at that
// index (ptCount keeps the row count); an empty value is not a number, so drop those points, leaving the index unwritten.
function omitEmptyNumberPoints(xml) {
  return xml.replace(/<c:numCache>[\s\S]*?<\/c:numCache>/g, cache => cache.replace(/<c:pt idx="\d+"><c:v><\/c:v><\/c:pt>/g, ""));
}

function normalizeAuthor(author) {
  if (typeof author === "string") return author;
  if (Array.isArray(author)) return joinAuthors(author);
  return null;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isAbsolutePath(value) {
  return /^(?:[a-zA-Z]:[\\/]|\/)/.test(value);
}

function joinPath(base, relative) {
  return `${String(base).replace(/[\\/]+$/, "")}/${String(relative).replace(/^[\\/]+/, "")}`;
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function decodeText(bytes) {
  return new TextDecoder().decode(bytes);
}

function encodeText(value) {
  return new TextEncoder().encode(value);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
