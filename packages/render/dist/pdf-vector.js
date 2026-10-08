import { FontEmbedder, FontLibrary, nominalAdvance } from "./pdf-fonts.js";
import { actualTextFor, layoutText, textClusters } from "./pdf-text.js";
import { IDENTITY, viewBoxTransform, applyPoint, applyStyleSheets, attributesOf, inheritStyle, invert, multiply, parseColor, parseFontWeight, parseLength, parseNumberList, parsePath, parseTransform, pathBounds, ROOT_STYLE, shapeToPath, transformPath } from "./pdf-style.js";
import { PdfFile, asciiString, name, num, ref, sha256, hex, textString, utf16Hex, utf8Encoder } from "./pdf-writer.js";
import { isElement, parseXml, serialize, escapeAttribute } from "./pdf-xml.js";

// Vector PDF export (RR-12). This converts the renderer's own SVG (the same SVG the preview rasterizes) to PDF:
// shapes and paths as PDF paths, gradients and hatch patterns as PDF shadings and tiling patterns, pictures as
// image XObjects, and text as real text objects drawn with embedded TrueType subsets. It performs no layout of its
// own: every position, line break and width comes from the SVG. Effects the PDF cannot express (SVG filters,
// masks, nested SVG pictures) are rasterized for that element alone and reported as `pdf-raster-fallback`.

const VIEWPORT_FALLBACK = { width: 1280, height: 720 };
// Space separators other than U+0020: they are copied as plain spaces, so text that uses one carries /ActualText.
const NON_ASCII_SPACE = new RegExp("[" + ["\u00a0", "\u1680", "\u2000-\u200a", "\u202f", "\u205f", "\u3000"].join("") + "]");
// Per page: elements drawn (a <use> expansion counts every copy) and group nesting.
const MAX_ELEMENTS = 50000;
const MAX_NESTING = 256;
// Attributes with no PDF equivalent here, and the values that mean "default" (nothing to report).
const UNSUPPORTED_ATTRIBUTES = [
  ["rotate", /^(0|)$/], ["dominant-baseline", /^(auto|alphabetic|normal)$/], ["alignment-baseline", /^(auto|baseline|alphabetic)$/],
  ["baseline-shift", /^(baseline|0|0px|)$/], ["paint-order", /^(normal)$/], ["mix-blend-mode", /^(normal)$/], ["text-transform", /^(none)$/],
  ["font-variant", /^(normal|none)$/], ["font-variant-caps", /^(normal)$/], ["writing-mode", /^(lr|lr-tb|horizontal-tb)$/],
  ["marker-start", /^none$/], ["marker-mid", /^none$/], ["marker-end", /^none$/], ["vector-effect", /^none$/], ["mask-image", /^none$/],
].map(([key, ignored]) => [key, ignored]);
const SKIPPED = new Set(["defs", "title", "desc", "metadata", "style", "script", "clipPath", "mask", "marker", "pattern", "linearGradient", "radialGradient", "symbol", "filter", "font", "font-face"]);
const SHAPES = new Set(["rect", "circle", "ellipse", "line", "polyline", "polygon", "path"]);

class Content {
  constructor(doc) {
    this.doc = doc;
    this.ops = [];
    this.fonts = new Map();
    this.xobjects = new Map();
    this.states = new Map();
    this.patterns = new Map();
  }

  op(text) { this.ops.push(text); }

  font(entry) { this.fonts.set(entry.resource, entry.object); return entry.resource; }

  xobject(resource, object) { this.xobjects.set(resource, object); return resource; }

  graphicsState(ca, CA) {
    const state = this.doc.graphicsState(ca, CA);
    this.states.set(state.name, state.object);
    return state.name;
  }

  pattern(resource, object) { this.patterns.set(resource, object); return resource; }

  resources() {
    const section = (label, map) => (map.size ? `/${label}<<${[...map].map(([key, object]) => `/${key} ${ref(object)}`).join("")}>>` : "");
    return `${section("Font", this.fonts)}${section("XObject", this.xobjects)}${section("ExtGState", this.states)}${section("Pattern", this.patterns)}`;
  }

  text() { return this.ops.join("\n"); }
}

class Converter {
  constructor(options) {
    this.options = options;
    this.file = new PdfFile({ compress: options.compress !== false });
    this.fonts = new FontLibrary({
      onDiagnostic: (d) => this.diagnostic(d),
      genericFamilies: (generic) => {
        const base = generic === "monospace" || generic === "ui-monospace" ? options.monospaceFamily : generic === "sans-serif" || generic === "system-ui" || generic === "ui-sans-serif" ? options.sansSerifFamily : options.serifFamily ?? options.defaultFontFamily;
        return [base ?? options.defaultFontFamily];
      },
    });
    this.embedder = new FontEmbedder(this.file);
    this.states = new Map();
    this.images = new Map();
    this.counters = { Fm: 0, Im: 0, P: 0, GS: 0 };
    this.pages = [];
    this.tagged = options.tagged !== false;
    this.defaults = [options.defaultFontFamily, options.sansSerifFamily].filter(Boolean);
    this.reported = new Set();
    this.fallbackCount = 0;
    this.env = {
      fonts: this.fonts,
      defaults: this.defaults,
      diagnostic: (d) => this.diagnostic(d),
      // A feature the PDF cannot give: reported once per character and family, fatal under `strict`.
      missing: (d) => {
        const key = d.code + d.fontFamily + d.codePoint;
        if (this.reported.has(key)) return;
        this.reported.add(key);
        this.unsupported(d.code, d.message, { fontFamily: d.fontFamily, codePoint: d.codePoint });
      },
      unavailable: (families) => this.error("pdf-font-unavailable", `No embeddable font face is available for ${families.length ? `'${families.join("', '")}'` : "the requested text"}. Supply font files (fontFiles/fontDirs) or keep useBundledFonts enabled.`, {}),
    };
  }

  diagnostic(d) {
    if (d.code === "pdf-font-substituted" || d.code === "pdf-font-fallback") {
      const key = d.code + (d.requestedFamily ?? d.fontFamily) + (d.resolvedFamily ?? d.fallbackFamily) + (d.codePoint ?? "");
      if (this.reported.has(key)) return;
      this.reported.add(key);
    }
    this.options.onDiagnostic?.(d);
  }

  error(code, message, details = {}) {
    // Imported lazily to avoid a circular import with svg.js at module load.
    return new this.options.ErrorClass(code, message, details);
  }

  /** A feature the PDF cannot express as vectors: reported, or fatal under `strict`. */
  unsupported(code, message, details = {}) {
    if (this.options.strict) throw this.error(code, `${message} (strict: the vector PDF export does not fall back).`, details);
    this.diagnostic({ code, message, ...details });
  }

  graphicsState(ca, CA) {
    const key = `${num(ca, 4)}:${num(CA, 4)}`;
    let state = this.states.get(key);
    if (!state) {
      state = { name: `GS${++this.counters.GS}`, object: this.file.add(`/Type/ExtGState/ca ${num(ca, 4)}/CA ${num(CA, 4)}/AIS false`) };
      this.states.set(key, state);
    }
    return state;
  }

  // -----------------------------------------------------------------------------------------------------------
  // Fonts

  async loadFontFiles(files, directories) {
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
        await this.fonts.addFile(resolved, stat, () => readFile(resolved));
      } catch (error) {
        this.diagnostic({ code: "pdf-font-unreadable", message: `Font file ${resolved} could not be read: ${error.code ?? error.message}.`, origin: resolved });
      }
    };
    for (const directory of directories) {
      for (const file of await listFonts(directory, { readdir, path })) await read(file);
    }
    for (const file of files) await read(file);
  }

  addEmbeddedFontFaces(root) {
    const stack = [root];
    while (stack.length) {
      const node = stack.pop();
      if (node.name === "style") {
        const css = node.children.map((child) => child.text ?? "").join("");
        for (const rule of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
          const source = /url\(\s*(["']?)(data:[^"')]*)\1\s*\)/.exec(rule[1]);
          if (!source) continue;
          const comma = source[2].indexOf(",");
          const header = source[2].slice(0, comma), payload = source[2].slice(comma + 1);
          try {
            const bytes = dataUriBytes(header, payload);
            const declared = /font-family\s*:\s*(?:"([^"]*)"|'([^']*)'|([^;"']+))/.exec(rule[1]);
            this.fonts.addData(new Uint8Array(bytes), "svg @font-face", (declared?.[1] ?? declared?.[2] ?? declared?.[3])?.trim());
          } catch { /* a malformed embedded font is skipped; text falls back to the loaded faces */ }
        }
      }
      for (const child of node.children) if (isElement(child)) stack.push(child);
    }
  }

  // -----------------------------------------------------------------------------------------------------------
  // Pages

  async addPage(source, index) {
    let svg;
    try { svg = parseXml(source); } catch (error) {
      throw this.error("svg-too-deep", error instanceof Error ? error.message : String(error), {});
    }
    if (!svg) throw this.error("invalid-svg", "SVG input must contain a root <svg> element.", {});
    this.addEmbeddedFontFaces(svg);
    applyStyleSheets(svg, (message) => this.unsupported("pdf-unsupported-css", message, {}));
    const attrs = attributesOf(svg);
    const viewBox = parseNumberList(attrs.viewBox);
    const hasBox = viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0;
    const width = positive(parseLength(attrs.width), hasBox ? viewBox[2] : VIEWPORT_FALLBACK.width);
    const height = positive(parseLength(attrs.height), hasBox ? viewBox[3] : VIEWPORT_FALLBACK.height);
    // viewBox to page: scale to fit (xMidYMid meet unless the SVG says otherwise).
    const root = hasBox ? viewBoxTransform(viewBox, attrs.preserveAspectRatio, 0, 0, width, height) : IDENTITY;
    const defs = new Map();
    const collect = (node) => { if (node.attrs?.id) defs.set(node.attrs.id, node); for (const child of node.children ?? []) if (isElement(child)) collect(child); };
    collect(svg);

    const content = new Content(this);
    const page = {
      index, width, height, source, defs, root, svg,
      viewport: hasBox ? { w: viewBox[2], h: viewBox[3] } : { w: width, h: height },
      elements: 0, limited: false, reportedAttributes: new Set(),
      object: this.file.reserve(), content, annotations: [], mcids: [], blocks: new Map(),
      section: { role: "Sect", kids: [], page: null },
      label: attrs["aria-label"], language: attrs.lang ?? attrs["xml:lang"],
    };
    page.section.page = page;
    this.pages.push(page);
    // The page is painted white unless `background` says otherwise (raster mode composites on white too), so the page looks
    // the same in viewers that show a dark or transparent paper.
    const background = parseColor(this.options.background ?? "#FFFFFF");
    if (background && background.a > 0) {
      if (this.tagged) content.op("/Artifact BMC");
      content.op(`q ${rgb(background)} rg 0 0 ${num(width)} ${num(height)} re f Q`);
      if (this.tagged) content.op("EMC");
    }
    content.op(`q 1 0 0 -1 0 ${num(height)} cm ${matrixOps(root)}`);
    const style = inheritStyle({ ...ROOT_STYLE, "font-family": this.defaults[0] ?? "Roboto" }, attrs);
    const ctx = { page, content, matrix: root, rel: multiply([1, 0, 0, -1, 0, height], root), T: IDENTITY, style, alpha: 1, link: null, inForm: false };
    for (const child of svg.children) await this.walk(child, ctx);
    content.op("Q");
  }

  // -----------------------------------------------------------------------------------------------------------
  // Traversal

  async walk(node, ctx) {
    if (!isElement(node) || SKIPPED.has(node.name)) return;
    // Budgets against hostile input (a <use> chain that doubles at every level, enormous trees).
    if (ctx.page.limited) return;
    if (++ctx.page.elements > MAX_ELEMENTS) { this.expansionLimit(ctx, node, `more than ${MAX_ELEMENTS} elements`); return; }
    if ((ctx.nesting ?? 0) > MAX_NESTING) { this.expansionLimit(ctx, node, `groups nested deeper than ${MAX_NESTING}`); return; }
    const attrs = attributesOf(node);
    if (attrs.display === "none") return;
    this.checkAttributes(node, attrs, ctx);
    if (node.name === "svg") return this.viewport(node, attrs, ctx, attrs, node);
    if (node.name === "switch") {
      // The first child that is an element (conditional processing attributes are not evaluated).
      const first = node.children.find((child) => isElement(child) && !SKIPPED.has(child.name));
      return first ? this.walk(first, ctx) : undefined;
    }
    if (node.name === "g" || node.name === "a") return this.element(node, attrs, ctx, (inner) => this.children(node, inner));
    if (node.name === "use") return this.use(node, attrs, ctx);
    if (SHAPES.has(node.name)) return this.element(node, attrs, ctx, (inner) => this.shape(node, attrs, inner), { leaf: "shape" });
    if (node.name === "text") return this.element(node, attrs, ctx, (inner) => this.text(node, attrs, inner), { leaf: "text" });
    if (node.name === "image") return this.element(node, attrs, ctx, (inner) => this.image(node, attrs, inner), { leaf: "image" });
    this.unsupported("pdf-unsupported-element", `The <${node.name}> element is not drawn in the vector PDF.`, { path: node.attrs["data-opf-path"], element: node.name });
  }

  /** Presentation features this export does not draw: reported once per page and attribute, never silently dropped. */
  checkAttributes(node, attrs, ctx) {
    const page = ctx.page;
    for (const [key, ignored] of UNSUPPORTED_ATTRIBUTES) {
      const value = attrs[key];
      if (value === undefined || ignored.test(String(value).trim())) continue;
      const mark = `${key}=${value}`;
      if (page.reportedAttributes.has(mark)) continue;
      page.reportedAttributes.add(mark);
      this.unsupported("pdf-unsupported-feature", `${key}="${String(value).slice(0, 40)}" on <${node.name}> is not drawn in the vector PDF.`, { path: node.attrs["data-opf-path"], element: node.name, attribute: key });
    }
    if (node.name === "textPath" && !page.reportedAttributes.has("textPath")) {
      page.reportedAttributes.add("textPath");
      this.unsupported("pdf-unsupported-feature", "<textPath> text is drawn along a straight line, not along its path.", { path: node.attrs["data-opf-path"], element: node.name });
    }
  }

  async children(node, ctx) {
    for (const child of node.children) await this.walk(child, ctx);
  }

  async use(node, attrs, ctx) {
    const target = ctx.page.defs.get(String(attrs.href ?? attrs["xlink:href"] ?? "").replace(/^#/, ""));
    if (!target || target === node) return;
    if ((ctx.depth ?? 0) > 12) { this.expansionLimit(ctx, node, "nested <use> references"); return; }
    const deeper = { ...ctx, depth: (ctx.depth ?? 0) + 1 };
    // A <symbol> or <svg> target is a viewport: <use> width and height (default 100%) size it.
    if (target.name === "symbol" || target.name === "svg") {
      const own = attributesOf(target);
      return this.viewport(target, { ...own, ...attrs, viewBox: own.viewBox, preserveAspectRatio: own.preserveAspectRatio }, deeper, own, node);
    }
    const wrapper = { name: "g", attrs: { ...node.attrs, transform: `${node.attrs.transform ?? ""} translate(${parseLength(attrs.x) ?? 0} ${parseLength(attrs.y) ?? 0})` }, children: [target], parent: node.parent };
    delete wrapper.attrs.href; delete wrapper.attrs["xlink:href"];
    return this.walk(wrapper, deeper);
  }

  /**
   * Draw a nested <svg> (or a <symbol> a <use> instantiates): its x, y, width and height place a viewport, its viewBox is
   * fitted into it, and content outside it is clipped unless overflow is visible. `sizing` gives x, y, width, height and the
   * viewBox, `source` the element whose children are drawn, `origin` the element whose presentation attributes apply.
   */
  async viewport(source, sizing, ctx, source2, origin) {
    const page = ctx.page;
    const fontSize = parseFloat(ctx.style["font-size"]) || 16;
    const length = (value, reference, fallback) => parseLength(value, { reference, fontSize }) ?? fallback;
    const x = length(sizing.x, page.viewport.w, 0), y = length(sizing.y, page.viewport.h, 0);
    const width = length(sizing.width, page.viewport.w, page.viewport.w), height = length(sizing.height, page.viewport.h, page.viewport.h);
    if (!(width > 0 && height > 0)) return;
    const box = parseNumberList(source2.viewBox ?? sizing.viewBox);
    const matrix = box.length === 4 && box[2] > 0 && box[3] > 0 ? viewBoxTransform(box, source2.preserveAspectRatio ?? sizing.preserveAspectRatio, x, y, width, height) : [1, 0, 0, 1, x, y];
    const inherited = { ...origin.attrs };
    for (const key of ["x", "y", "width", "height", "viewBox", "preserveAspectRatio", "transform", "overflow", "href", "xlink:href", "id"]) delete inherited[key];
    const wrapper = { name: "g", attrs: { ...inherited, transform: `matrix(${matrix.join(" ")})` }, children: source.children, parent: source.parent };
    const content = ctx.content;
    content.op("q");
    if (attributesOf(source).overflow !== "visible" && attributesOf(origin).overflow !== "visible") content.op(`${num(x)} ${num(y)} ${num(width)} ${num(height)} re W n`);
    await this.element(wrapper, attributesOf(wrapper), ctx, (inner) => this.children(wrapper, inner));
    content.op("Q");
  }

  /** The `<use>`-expansion and element budgets: report once per page, stop expanding. */
  expansionLimit(ctx, node, what) {
    const page = ctx.page;
    if (page.limited) return;
    page.limited = true;
    this.unsupported("pdf-expansion-limit", `Too much content to draw (${what}); the rest of this page is not drawn.`, { path: node.attrs?.["data-opf-path"] });
  }

  /** Common element handling: transform, clip, opacity, link, and the fallback for filters and masks. */
  async element(node, attrs, ctx, painter, { leaf } = {}) {
    if (attrs.filter !== undefined && attrs.filter !== "none") return this.fallback(node, ctx, `filter ${attrs.filter}`);
    if (attrs.mask !== undefined && attrs.mask !== "none") return this.fallback(node, ctx, `mask ${attrs.mask}`);
    if (node.name === "image" && /^data:image\/svg\+xml/i.test(attrs.href ?? attrs["xlink:href"] ?? "")) return this.fallback(node, ctx, "nested SVG picture");
    const transform = parseTransform(attrs.transform);
    const isIdentity = transform.every((value, index) => value === IDENTITY[index]);
    const style = inheritStyle(ctx.style, attrs);
    if (style.visibility === "hidden" || style.visibility === "collapse") return;
    const content = ctx.content;
    const next = {
      ...ctx, style,
      matrix: isIdentity ? ctx.matrix : multiply(ctx.matrix, transform),
      rel: isIdentity ? ctx.rel : multiply(ctx.rel, transform),
      T: isIdentity ? ctx.T : multiply(ctx.T, transform),
      parentStyle: ctx.style,
      nesting: (ctx.nesting ?? 0) + 1,
    };
    if (node.name === "a") {
      const href = attrs.href ?? attrs["xlink:href"];
      if (href !== undefined) next.link = { href, node };
    }
    const opacity = attrs.opacity === undefined ? 1 : Math.min(1, Math.max(0, parseFloat(attrs.opacity)));
    if (opacity === 0 || Number.isNaN(opacity)) return;
    content.op("q");
    if (!isIdentity) content.op(`${transform.map((value) => num(value, 5)).join(" ")} cm`);
    const clip = attrs["clip-path"];
    if (clip && clip !== "none") this.clip(clip, ctx, next);
    const needsGroup = opacity < 1 && !leaf && countLeaves(node) > 1;
    if (needsGroup && !next.inForm) {
      await this.group(node, next, opacity, painter);
    } else {
      next.alpha = ctx.alpha * opacity;
      await painter(next);
    }
    content.op("Q");
  }

  /** Opacity applied to a group of several drawings: a transparency-group form XObject drawn with the constant alpha. */
  async group(node, ctx, opacity, painter) {
    const form = new Content(this);
    const inverse = invert(ctx.matrix);
    const box = inverse
      ? boundsOf([[0, 0], [ctx.page.width, 0], [ctx.page.width, ctx.page.height], [0, ctx.page.height]].map(([x, y]) => applyPoint(inverse, x, y)))
      : { x: -1e5, y: -1e5, width: 2e5, height: 2e5 };
    const inner = { ...ctx, content: form, rel: IDENTITY, alpha: 1, inForm: true };
    await painter(inner);
    const resource = `Fm${++this.counters.Fm}`;
    const object = this.file.addStream(
      `/Type/XObject/Subtype/Form/FormType 1/BBox[${num(box.x)} ${num(box.y)} ${num(box.x + box.width)} ${num(box.y + box.height)}]/Group<</S/Transparency/CS/DeviceRGB/I true/K false>>/Resources<<${form.resources()}>>`,
      form.text(),
    );
    const c = ctx.content;
    this.markArtifact(ctx, () => {
      c.op(`/${c.graphicsState(opacity * ctx.alpha, opacity * ctx.alpha)} gs`);
      c.op(`/${c.xobject(resource, object)} Do`);
    });
  }

  clip(value, parentCtx, ctx) {
    const id = /url\(\s*#([^)\s]+)\s*\)/.exec(value)?.[1];
    const def = id && parentCtx.page.defs.get(id);
    if (!def || def.name !== "clipPath") {
      this.unsupported("pdf-unsupported-clip", `clip-path ${value} does not reference a clipPath; the clip is ignored.`, {});
      return;
    }
    const attrs = attributesOf(def);
    if (attrs.clipPathUnits === "objectBoundingBox") {
      this.unsupported("pdf-unsupported-clip", "clipPathUnits=objectBoundingBox is not supported; the clip is ignored.", {});
      return;
    }
    const base = parseTransform(attrs.transform);
    const ops = [];
    let evenOdd = false;
    for (const child of def.children) {
      if (!isElement(child) || !(SHAPES.has(child.name))) continue;
      const childAttrs = attributesOf(child);
      if (childAttrs["clip-rule"] === "evenodd") evenOdd = true;
      let commands = shapeToPath(child, childAttrs, (v, ref) => parseLength(v, { reference: ref }), parentCtx.page.viewport);
      if (!commands) continue;
      commands = transformPath(commands, multiply(base, parseTransform(childAttrs.transform)));
      ops.push(pathOps(commands));
    }
    if (ops.length) ctx.content.op(`${ops.join(" ")} ${evenOdd ? "W*" : "W"} n`);
  }

  // -----------------------------------------------------------------------------------------------------------
  // Marked content (tagged PDF)

  markArtifact(ctx, draw) {
    if (!this.tagged || ctx.inForm) { draw(); return; }
    ctx.content.op("/Artifact BMC");
    draw();
    ctx.content.op("EMC");
  }

  /** Run `draw` inside a marked-content sequence bound to a structure element; returns nothing. */
  markContent(ctx, node, role, extra, draw) {
    if (!this.tagged || ctx.inForm) { draw(); return null; }
    const page = ctx.page;
    const mcid = page.mcids.length;
    const parent = this.structureParent(ctx, node, role, extra);
    page.mcids.push(parent);
    parent.kids.push({ mcid });
    ctx.content.op(`/${role} <</MCID ${mcid}>> BDC`);
    draw();
    ctx.content.op("EMC");
    return { parent, mcid };
  }

  structureParent(ctx, node, role, extra) {
    const page = ctx.page;
    if (role === "Figure") {
      const figure = { role: "Figure", alt: extra?.alt, kids: [], parent: page.section, page };
      page.section.kids.push(figure);
      return figure;
    }
    // Text lines of one block (the nearest traced group) share one structure element, in source order.
    let owner = node.parent;
    while (owner && !(owner.name === "g" && owner.attrs?.["data-opf-path"])) owner = owner.parent;
    const key = owner ?? node;
    let block = page.blocks.get(key);
    if (!block) {
      const tracePath = String(owner?.attrs?.["data-opf-path"] ?? "");
      block = { role: /\.title$/.test(tracePath) ? "H1" : "P", kids: [], parent: page.section, page };
      page.blocks.set(key, block);
      page.section.kids.push(block);
    }
    if (ctx.link) {
      let linkElement = block.links?.get(ctx.link.node);
      if (!linkElement) {
        linkElement = { role: "Link", kids: [], parent: block, page, href: ctx.link.href };
        (block.links ??= new Map()).set(ctx.link.node, linkElement);
        block.kids.push(linkElement);
      }
      return linkElement;
    }
    return block;
  }

  // -----------------------------------------------------------------------------------------------------------
  // Shapes and paint

  async shape(node, attrs, ctx) {
    const style = ctx.style;
    const fontSize = parseFloat(style["font-size"]) || 16;
    const viewport = ctx.page.viewport;
    const resolve = (value, reference) => parseLength(value, { reference: reference ?? viewport.w, fontSize });
    const commands = shapeToPath(node, attrs, (value, reference) => resolve(value, reference), ctx.page.viewport);
    if (!commands) return;
    const isLine = node.name === "line";
    const fill = isLine ? null : await this.paint(style.fill, style, ctx, commands, "fill");
    const strokeWidth = resolve(style["stroke-width"]) ?? 1;
    const stroke = strokeWidth > 0 ? await this.paint(style.stroke, style, ctx, commands, "stroke") : null;
    if (!fill && !stroke) return;
    const content = ctx.content;
    this.markArtifact(ctx, () => {
      content.op("q");
      const fillOpacity = fill?.color ? fill.color.a * num2(style["fill-opacity"]) : num2(style["fill-opacity"]);
      const strokeOpacity = stroke?.color ? stroke.color.a * num2(style["stroke-opacity"]) : num2(style["stroke-opacity"]);
      const ca = ctx.alpha * fillOpacity, CA = ctx.alpha * strokeOpacity;
      if (ca < 1 || CA < 1) content.op(`/${content.graphicsState(fill ? ca : 1, stroke ? CA : 1)} gs`);
      if (fill) this.setPaint(content, fill, "fill");
      if (stroke) {
        this.setPaint(content, stroke, "stroke");
        content.op(`${num(strokeWidth, 4)} w`);
        const cap = { butt: 0, round: 1, square: 2 }[style["stroke-linecap"]] ?? 0;
        const join = { miter: 0, round: 1, bevel: 2, "miter-clip": 0, arcs: 0 }[style["stroke-linejoin"]] ?? 0;
        content.op(`${cap} J ${join} j ${num(parseFloat(style["stroke-miterlimit"]) || 4, 3)} M`);
        const dashes = parseNumberList(style["stroke-dasharray"]);
        if (dashes.length && dashes.every((value) => value >= 0) && dashes.some((value) => value > 0)) {
          const list = dashes.length % 2 ? [...dashes, ...dashes] : dashes;
          content.op(`[${list.map((value) => num(value, 3)).join(" ")}] ${num(parseLength(style["stroke-dashoffset"], { fontSize }) ?? 0, 3)} d`);
        }
      }
      content.op(pathOps(commands));
      const evenOdd = style["fill-rule"] === "evenodd" ? "*" : "";
      content.op(fill && stroke ? `B${evenOdd}` : fill ? `f${evenOdd}` : "S");
      content.op("Q");
    });
  }

  setPaint(content, paint, kind) {
    if (paint.color) content.op(`${rgb(paint.color)} ${kind === "fill" ? "rg" : "RG"}`);
    else content.op(`/Pattern ${kind === "fill" ? "cs" : "CS"} /${content.pattern(paint.resource, paint.object)} ${kind === "fill" ? "scn" : "SCN"}`);
  }

  /** Resolve a fill/stroke value to {color} or {resource, object} (a pattern), or null for none. */
  async paint(value, style, ctx, commands, kind) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    if (text === "none") return null;
    const url = /^url\(\s*#([^)\s]+)\s*\)\s*(.*)$/.exec(text);
    if (url) {
      const def = ctx.page.defs.get(url[1]);
      if (def?.name === "linearGradient" || def?.name === "radialGradient") {
        const made = this.gradient(def, ctx, commands);
        if (made) return made;
      } else if (def?.name === "pattern") {
        const made = await this.tilingPattern(def, ctx, commands);
        if (made) return made;
      }
      const fallback = url[2] ? parseColor(url[2], parseColor(style.color)) : undefined;
      if (fallback) return { color: fallback };
      this.unsupported("pdf-unsupported-paint", `Paint ${text} could not be resolved; nothing is drawn for it.`, { kind });
      return null;
    }
    const color = parseColor(text, parseColor(style.color));
    if (!color) {
      if (!/^(none|inherit|context-(fill|stroke))$/i.test(text)) this.unsupported("pdf-unsupported-paint", `The colour "${text.slice(0, 40)}" is not understood; nothing is drawn for it.`, { kind });
      return null;
    }
    return color.a === 0 ? null : { color };
  }

  stops(def, ctx) {
    let source = def;
    const seen = new Set();
    while (source && !source.children.some((child) => child.name === "stop") && !seen.has(source)) {
      seen.add(source);
      const href = attributesOf(source).href ?? attributesOf(source)["xlink:href"];
      source = href && ctx.page.defs.get(href.replace(/^#/, ""));
    }
    if (!source) return [];
    const stops = [];
    let last = 0;
    for (const child of source.children) {
      if (child.name !== "stop") continue;
      const attrs = attributesOf(child);
      let offset = String(attrs.offset ?? "0").trim();
      offset = offset.endsWith("%") ? parseFloat(offset) / 100 : parseFloat(offset);
      offset = Math.min(1, Math.max(last, Number.isFinite(offset) ? offset : 0));
      last = offset;
      const color = parseColor(attrs["stop-color"] ?? "#000000") ?? { r: 0, g: 0, b: 0, a: 1 };
      stops.push({ offset, color: { ...color, a: color.a * (attrs["stop-opacity"] === undefined ? 1 : parseFloat(attrs["stop-opacity"])) } });
    }
    return stops;
  }

  inheritedAttribute(def, key, ctx) {
    let current = def;
    const seen = new Set();
    while (current && !seen.has(current)) {
      seen.add(current);
      const value = attributesOf(current)[key];
      if (value !== undefined) return value;
      const href = attributesOf(current).href ?? attributesOf(current)["xlink:href"];
      current = href && ctx.page.defs.get(href.replace(/^#/, ""));
    }
    return undefined;
  }

  gradient(def, ctx, commands) {
    const stops = this.stops(def, ctx);
    if (!stops.length) return null;
    if (stops.length === 1) return { color: stops[0].color };
    if (stops.some((stop) => stop.color.a < 1)) {
      this.unsupported("pdf-unsupported-paint", "A gradient with transparent stops is drawn opaque in the vector PDF.", { element: def.attrs.id });
    }
    const spread = this.inheritedAttribute(def, "spreadMethod", ctx);
    if (spread === "reflect" || spread === "repeat") {
      this.unsupported("pdf-unsupported-paint", `spreadMethod="${spread}" is drawn as pad in the vector PDF.`, { element: def.attrs.id });
    }
    const units = this.inheritedAttribute(def, "gradientUnits", ctx) ?? "objectBoundingBox";
    const bbox = pathBounds(commands);
    if (units === "objectBoundingBox" && (!bbox || !(bbox.width > 0) || !(bbox.height > 0))) return null;
    const unitMatrix = units === "objectBoundingBox" ? [bbox.width, 0, 0, bbox.height, bbox.x, bbox.y] : IDENTITY;
    const read = (key, fallback) => {
      const raw = this.inheritedAttribute(def, key, ctx);
      if (raw === undefined) return fallback;
      const text = String(raw).trim();
      if (units === "objectBoundingBox") return text.endsWith("%") ? parseFloat(text) / 100 : parseFloat(text);
      return parseLength(text, { reference: ctx.page.width }) ?? fallback;
    };
    const transform = parseTransform(this.inheritedAttribute(def, "gradientTransform", ctx));
    const matrix = multiply(multiply(ctx.rel, unitMatrix), transform);
    const functions = [], bounds = [], encode = [];
    const padded = [...stops];
    if (padded[0].offset > 0) padded.unshift({ offset: 0, color: padded[0].color });
    if (padded.at(-1).offset < 1) padded.push({ offset: 1, color: padded.at(-1).color });
    for (let index = 0; index + 1 < padded.length; index++) {
      functions.push(`<</FunctionType 2/Domain[0 1]/C0[${rgb(padded[index].color)}]/C1[${rgb(padded[index + 1].color)}]/N 1>>`);
      if (index + 2 < padded.length) bounds.push(num(padded[index + 1].offset, 5));
      encode.push("0 1");
    }
    const fn = functions.length === 1 ? functions[0] : `<</FunctionType 3/Domain[0 1]/Functions[${functions.join("")}]/Bounds[${bounds.join(" ")}]/Encode[${encode.join(" ")}]>>`;
    let shading;
    if (def.name === "linearGradient") {
      const coords = [read("x1", 0), read("y1", 0), read("x2", units === "objectBoundingBox" ? 1 : ctx.page.width), read("y2", 0)];
      shading = `<</ShadingType 2/ColorSpace/DeviceRGB/Coords[${coords.map((value) => num(value, 5)).join(" ")}]/Function ${fn}/Extend[true true]>>`;
    } else {
      const half = units === "objectBoundingBox" ? 0.5 : ctx.page.width / 2;
      const cx = read("cx", half), cy = read("cy", half), r = read("r", half);
      const fx = read("fx", cx), fy = read("fy", cy);
      shading = `<</ShadingType 3/ColorSpace/DeviceRGB/Coords[${[fx, fy, 0, cx, cy, r].map((value) => num(value, 5)).join(" ")}]/Function ${fn}/Extend[true true]>>`;
    }
    const resource = `P${++this.counters.P}`;
    const object = this.file.add(`/Type/Pattern/PatternType 2/Matrix[${matrix.map((value) => num(value, 5)).join(" ")}]/Shading ${shading}`);
    return { resource, object };
  }

  async tilingPattern(def, ctx, commands) {
    const attrs = attributesOf(def);
    const units = attrs.patternUnits ?? "objectBoundingBox";
    const bbox = pathBounds(commands);
    const read = (key, reference) => {
      const raw = attrs[key];
      if (raw === undefined) return 0;
      if (units === "objectBoundingBox") return (String(raw).endsWith("%") ? parseFloat(raw) / 100 : parseFloat(raw)) * reference;
      return parseLength(raw, { reference: ctx.page.width }) ?? 0;
    };
    if (units === "objectBoundingBox" && !bbox) return null;
    const x = read("x", bbox?.width ?? 1) + (units === "objectBoundingBox" ? bbox.x : 0);
    const y = read("y", bbox?.height ?? 1) + (units === "objectBoundingBox" ? bbox.y : 0);
    const width = read("width", bbox?.width ?? 1), height = read("height", bbox?.height ?? 1);
    if (!(width > 0 && height > 0)) return null;
    const matrix = multiply(multiply(ctx.rel, parseTransform(attrs.patternTransform)), [1, 0, 0, 1, x, y]);
    const cell = new Content(this);
    const style = inheritStyle({ ...ROOT_STYLE }, attrs);
    const viewBox = parseNumberList(attrs.viewBox);
    let inner = IDENTITY;
    if (viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) inner = [width / viewBox[2], 0, 0, height / viewBox[3], -viewBox[0] * width / viewBox[2], -viewBox[1] * height / viewBox[3]];
    else if (attrs.patternContentUnits === "objectBoundingBox" && bbox) inner = [bbox.width, 0, 0, bbox.height, 0, 0];
    const cellCtx = { page: ctx.page, content: cell, matrix: multiply(ctx.matrix, inner), rel: inner, T: inner, style, alpha: 1, link: null, inForm: true, depth: (ctx.depth ?? 0) + 1 };
    if (cellCtx.depth > 4) return null;
    cell.op(`q ${matrixOps(inner)}`);
    for (const child of def.children) await this.walk(child, cellCtx);
    cell.op("Q");
    const resource = `P${++this.counters.P}`;
    const object = this.file.addStream(`/Type/Pattern/PatternType 1/PaintType 1/TilingType 1/BBox[0 0 ${num(width, 4)} ${num(height, 4)}]/XStep ${num(width, 4)}/YStep ${num(height, 4)}/Matrix[${matrix.map((value) => num(value, 5)).join(" ")}]/Resources<<${cell.resources()}>>`, cell.text());
    return { resource, object };
  }

  // -----------------------------------------------------------------------------------------------------------
  // Images

  async image(node, attrs, ctx) {
    const href = attrs.href ?? attrs["xlink:href"];
    const tracePath = node.attrs["data-opf-path"];
    if (typeof href !== "string" || !/^data:/i.test(href)) {
      this.unsupported("pdf-image-skipped", "An image that is not an embedded data URI is not drawn (the export performs no network or file access).", { path: tracePath });
      return;
    }
    const decoded = await this.decodeImage(href, tracePath);
    if (!decoded) return;
    const x = parseLength(attrs.x) ?? 0, y = parseLength(attrs.y) ?? 0;
    const width = parseLength(attrs.width, { reference: ctx.page.width }) ?? decoded.width, height = parseLength(attrs.height, { reference: ctx.page.height }) ?? decoded.height;
    if (!(width > 0 && height > 0)) return;
    const [align, mode] = String(attrs.preserveAspectRatio ?? "xMidYMid meet").trim().split(/\s+/);
    let draw = { x, y, w: width, h: height }, clipBox = null;
    if (align !== "none") {
      const slice = mode === "slice";
      const scale = slice ? Math.max(width / decoded.width, height / decoded.height) : Math.min(width / decoded.width, height / decoded.height);
      const w = decoded.width * scale, h = decoded.height * scale;
      const ax = /xMin/.test(align) ? 0 : /xMax/.test(align) ? 1 : 0.5, ay = /YMin/.test(align) ? 0 : /YMax/.test(align) ? 1 : 0.5;
      draw = { x: x + (width - w) * ax, y: y + (height - h) * ay, w, h };
      if (slice) clipBox = { x, y, w: width, h: height };
    }
    const content = ctx.content;
    const alt = attrs["aria-label"] ?? attrs.alt ?? node.attrs["aria-label"];
    const emit = () => {
      content.op("q");
      if (ctx.alpha < 1) content.op(`/${content.graphicsState(ctx.alpha, ctx.alpha)} gs`);
      if (clipBox) content.op(`${num(clipBox.x)} ${num(clipBox.y)} ${num(clipBox.w)} ${num(clipBox.h)} re W n`);
      content.op(`${num(draw.w, 4)} 0 0 ${num(-draw.h, 4)} ${num(draw.x, 4)} ${num(draw.y + draw.h, 4)} cm /${content.xobject(decoded.resource, decoded.object)} Do`);
      content.op("Q");
    };
    if (alt) this.markContent(ctx, node, "Figure", { alt }, emit);
    else this.markArtifact(ctx, emit);
  }

  async decodeImage(href, tracePath) {
    const comma = href.indexOf(",");
    if (comma < 0) return null;
    const header = href.slice(0, comma), payload = href.slice(comma + 1);
    let bytes;
    try {
      bytes = dataUriBytes(header, payload);
    } catch {
      this.unsupported("pdf-image-skipped", "An embedded image could not be decoded and is not drawn.", { path: tracePath });
      return null;
    }
    const digest = hex(sha256(bytes));
    if (this.images.has(digest)) return this.images.get(digest);
    let result = null;
    try {
      const codec = requireCodec(this.options);
      const meta = await codec.metadata(bytes);
      const resource = `Im${++this.counters.Im}`;
      const isJpeg = meta.format === "jpeg" && (meta.orientation === undefined || meta.orientation === 1) && (meta.channels === 3 || meta.channels === 1) && meta.space !== "cmyk";
      if (isJpeg) {
        const object = this.file.add(`/Type/XObject/Subtype/Image/Width ${meta.width}/Height ${meta.height}/ColorSpace/${meta.channels === 1 ? "DeviceGray" : "DeviceRGB"}/BitsPerComponent 8/Interpolate true/Filter/DCTDecode`, new Uint8Array(bytes));
        result = { resource, object, width: meta.width, height: meta.height };
      } else {
        const { data, info } = await codec.rgba(bytes, { orient: true });
        const pixels = info.width * info.height;
        const color = new Uint8Array(pixels * 3), alpha = new Uint8Array(pixels);
        let opaque = true;
        for (let index = 0; index < pixels; index++) {
          color[index * 3] = data[index * 4]; color[index * 3 + 1] = data[index * 4 + 1]; color[index * 3 + 2] = data[index * 4 + 2];
          alpha[index] = data[index * 4 + 3];
          if (alpha[index] !== 255) opaque = false;
        }
        let mask = "";
        if (!opaque) {
          const maskObject = this.file.addStream(`/Type/XObject/Subtype/Image/Width ${info.width}/Height ${info.height}/ColorSpace/DeviceGray/BitsPerComponent 8/Interpolate true`, alpha);
          mask = `/SMask ${ref(maskObject)}`;
        }
        const object = this.file.addStream(`/Type/XObject/Subtype/Image/Width ${info.width}/Height ${info.height}/ColorSpace/DeviceRGB/BitsPerComponent 8/Interpolate true${mask}`, color);
        result = { resource, object, width: info.width, height: info.height };
      }
    } catch (error) {
      // A missing converter is the host's install, not a bad picture: say so instead of writing a PDF without its pictures.
      if (error?.code === "converter-missing") throw error;
      this.unsupported("pdf-image-skipped", `An embedded image could not be decoded and is not drawn: ${error instanceof Error ? error.message : String(error)}`, { path: tracePath });
    }
    this.images.set(digest, result);
    return result;
  }

  // -----------------------------------------------------------------------------------------------------------
  // Text

  async text(node, attrs, ctx) {
    const { runs } = layoutText(node, this.env, ctx.parentStyle, ctx.link);
    if (!runs.length) return;
    for (const run of runs) {
      // Gradients and patterns on text are fitted to the run's box.
      const box = runBox(run);
      run.fill = await this.paint(run.style.fill, run.style, ctx, box, "fill");
      run.stroke = await this.paint(run.style.stroke, run.style, ctx, box, "stroke");
    }
    // Runs are drawn in visual (left to right) order. Right-to-left runs are marked /ReversedChars so extractors read
    // their characters back to front, and a cluster whose glyph-to-Unicode map cannot give its text (a ligature, a
    // letter split into base and dots, a mirrored bracket) carries /ActualText; a left-to-right run the map cannot
    // recover (reordered Indic or Khmer clusters, a no-break space) carries one /ActualText for its text object.
    for (const run of runs) {
      run.entry = this.embedder.use(run.face);
      for (const glyph of run.glyphs) glyph.cid = this.embedder.record(run.entry, glyph);
    }
    const draw = () => { for (const run of runs) this.drawRun(run, ctx); };
    if (attrs["aria-hidden"] === "true") this.markArtifact(ctx, draw);
    else this.markContent(ctx, node, "P", {}, draw);
  }

  drawRun(run, ctx) {
    const content = ctx.content;
    const resource = content.font(run.entry);
    const nominalCache = run.face.nominalCache;
    const size = run.size, upem = run.face.upem;
    const fill = run.fill;
    const strokeWidth = parseLength(run.style["stroke-width"], { fontSize: size }) ?? 1;
    const stroke = run.stroke;
    const solidFill = fill;
    if (!solidFill && !stroke) return;
    const rtl = run.level % 2 === 1;
    const runActual = !rtl && (!sameText(run) || NON_ASCII_SPACE.test(run.logical)) ? run.logical : null;
    const operations = [];
    let current = null, pending = 0, hex = "";
    const flushHex = () => { if (hex) { current.items.push(`<${hex}>`); hex = ""; } };
    // Adjustments are whole thousandths of an em; the remainder is carried to the next one, so rounding never accumulates.
    const addNumber = () => {
      const whole = Math.round(pending);
      if (whole !== 0) { flushHex(); current.items.push(String(whole)); pending -= whole; }
    };
    const extra = run.extraSpacing ?? 0;
    const scale = size / upem;
    let pen = 0;
    const decorations = [];
    // A glyph the font displaced (a mark placed by GPOS) is shown alone with its own text matrix, and so is the glyph after
    // it, so no text rise or large kerning number splits it into text objects that PDFium reads twice inside one span.
    let placedBefore = false;
    const showGlyph = (glyph, penBefore) => {
      const nominal = nominalAdvance(run.face, glyph.gid, nominalCache);
      const shaped = glyph.advance * 1000 / upem + (glyph.spacing + extra) * 1000 / size;
      const placed = Math.abs(glyph.xOffset * scale) > 0.025 * size || Math.abs(glyph.yOffset * scale) > 0.03 * size;
      const code = glyph.cid.toString(16).toUpperCase().padStart(4, "0");
      if (placed || placedBefore) {
        if (current) { addNumber(); flushHex(); }
        // The text object starts at the glyph's natural position (PDFium merges an /ActualText span across adjacent objects only),
        // and the font's horizontal placement is a leading adjustment inside it.
        const shift = glyph.xOffset ? [num(-glyph.xOffset * 1000 / upem, 3)] : [];
        operations.push({ at: [run.x + run.scaleX * penBefore, run.y - glyph.yOffset * scale], items: [...shift, `<${code}>`] });
        current = null;
        pending = 0;
        placedBefore = placed;
        return;
      }
      if (current === null) { current = { items: [] }; operations.push(current); }
      addNumber();
      hex += code;
      pending += nominal - shaped;
    };
    // Each unit is a glyph, or for a left-to-right run the glyph map cannot give back (reordered Indic or Khmer clusters, a
    // no-break space) a cluster of glyphs. A unit whose text the map cannot give carries it as /ActualText, one span per
    // unit as Chromium writes them; a run that cannot be split into clusters gets one span for the whole run.
    let units, wholeRun = false;
    if (runActual === null) units = run.glyphs.map((glyph) => ({ glyphs: [glyph], actual: actualTextFor(run, glyph) }));
    else {
      units = textClusters(run);
      if (units === null) { wholeRun = true; units = [{ glyphs: run.glyphs, actual: null }]; }
    }
    const openSpan = (text) => {
      if (current) { addNumber(); flushHex(); }
      current = null;
      operations.push({ actual: text });
    };
    const closeSpan = () => {
      if (current) { addNumber(); flushHex(); }
      current = null;
      operations.push({ end: true });
    };
    if (wholeRun) openSpan(runActual);
    for (const unit of units) {
      if (unit.actual !== null) openSpan(unit.actual);
      for (const glyph of unit.glyphs) {
        const advance = glyph.advance * scale + glyph.spacing + extra;
        if (glyph.codePoints.length === 0) {
          // A glyph that stands for no character (a dot or mark the font split off a letter) is drawn as a filled outline,
          // so extractors see only the letters.
          decorations.push({ glyph, pen });
          pending -= advance * 1000 / size;
        } else showGlyph(glyph, pen);
        pen += advance;
      }
      if (unit.actual !== null) closeSpan();
    }
    if (wholeRun) closeSpan();
    if (current) { addNumber(); flushHex(); }
    const alpha = ctx.alpha;
    const ca = alpha * (solidFill ? (solidFill.color?.a ?? 1) * num2(run.style["fill-opacity"]) : 1), CA = alpha * (stroke?.color ? stroke.color.a * num2(run.style["stroke-opacity"]) : 1);
    content.op("q");
    if (ca < 1 || CA < 1) content.op(`/${content.graphicsState(ca, CA)} gs`);
    if (solidFill) this.setPaint(content, solidFill, "fill");
    if (stroke) { this.setPaint(content, stroke, "stroke"); content.op(`${num(strokeWidth, 3)} w`); }
    content.op("BT");
    if (rtl) content.op("/ReversedChars BMC");
    content.op(`/${resource} ${num(size, 3)} Tf`);
    const mode = solidFill && stroke ? 2 : stroke ? 1 : 0;
    if (mode) content.op(`${mode} Tr`);
    if (run.scaleX !== 1) content.op(`${num(run.scaleX * 100, 4)} Tz`);
    content.op(`1 0 0 -1 ${num(run.x, 4)} ${num(run.y, 4)} Tm`);
    let line = [run.x, run.y];
    for (const operation of operations) {
      if (operation.actual !== undefined) content.op(`/Span <</ActualText <FEFF${utf16Hex(operation.actual)}> >> BDC`);
      else if (operation.end) content.op("EMC");
      else {
        if (!operation.items.length) continue;
        if (operation.at) {
          // Td moves from the start of the current line, which is where the last Td or Tm put it.
          content.op(`${num(operation.at[0] - line[0], 4)} ${num(line[1] - operation.at[1], 4)} Td`);
          line = operation.at;
        }
        content.op(operation.items.length === 1 && operation.items[0][0] === "<" ? `${operation.items[0]} Tj` : `[${operation.items.join("")}] TJ`);
      }
    }
    if (rtl) content.op("EMC");
    content.op("ET");
    for (const { glyph, pen: origin } of decorations) {
      const commands = glyphOutline(run.face.font, glyph.gid, (x, y) => [run.x + (origin + (glyph.xOffset + x) * scale) * run.scaleX, run.y - (glyph.yOffset + y) * scale]);
      if (commands.length) content.op(`${pathOps(commands)} f`);
    }
    // Underline / strike-through / overline in the text colour, from the font's own metrics.
    if (run.decoration.size && solidFill) {
      const font = run.face.font, scale = size / upem;
      for (const kind of run.decoration) {
        let position, thickness;
        if (kind === "underline") { position = -(font.underlinePosition || -upem * 0.1) * scale; thickness = (font.underlineThickness || upem * 0.05) * scale; }
        else if (kind === "line-through") { position = -(font["OS/2"]?.yStrikeoutPosition || upem * 0.3) * scale; thickness = (font["OS/2"]?.yStrikeoutSize || upem * 0.05) * scale; }
        else { position = font.ascent * scale; thickness = (font.underlineThickness || upem * 0.05) * scale; position = -position; }
        const lineWidth = run.width;
        content.op(`${num(run.x, 3)} ${num(run.y + position - thickness / 2, 3)} ${num(lineWidth, 3)} ${num(thickness, 3)} re f`);
      }
    }
    content.op("Q");
    if (run.link) this.linkAnnotation(run, ctx);
  }

  linkAnnotation(run, ctx) {
    const uri = safeUri(run.link.href);
    if (uri === null) {
      this.unsupported("pdf-link-skipped", `The link target ${JSON.stringify(run.link.href).slice(0, 80)} is not an http, https, mailto or tel address; no PDF link is created.`, {});
      return;
    }
    const scale = run.size / run.face.upem;
    const top = run.y - run.face.font.ascent * scale, bottom = run.y - run.face.font.descent * scale;
    const corners = [[run.x, top], [run.x + run.width, top], [run.x + run.width, bottom], [run.x, bottom]].map(([x, y]) => applyPoint(ctx.matrix, x, y));
    const box = boundsOf(corners);
    const page = ctx.page;
    const annotation = { rect: [box.x, page.height - box.y - box.height, box.x + box.width, page.height - box.y], uri, object: this.file.reserve(), parent: null };
    page.annotations.push(annotation);
    const last = page.mcids.at(-1);
    annotation.parent = last?.role === "Link" ? last : null;
    if (annotation.parent) (annotation.parent.annots ??= []).push(annotation);
  }

  // -----------------------------------------------------------------------------------------------------------
  // Raster fallback for effects with no PDF equivalent

  async fallback(node, ctx, reason) {
    const tracePath = node.attrs["data-opf-path"];
    this.unsupported("pdf-raster-fallback", `<${node.name}> uses ${reason}, which has no PDF vector equivalent; this element alone is rasterized.`, { path: tracePath, element: node.name, reason });
    if (!this.options.rasterize) return;
    const page = ctx.page;
    // A standalone SVG of the page's defs, the element's ancestors' inherited style and transform, and the element.
    const chain = [];
    for (let parent = node.parent; parent && parent !== page.svg; parent = parent.parent) {
      if (parent.name === "g" || parent.name === "a") chain.unshift(parent);
    }
    const inheritedKeys = ["fill", "fill-opacity", "fill-rule", "stroke", "stroke-opacity", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "font-family", "font-size", "font-style", "font-weight", "color", "text-anchor", "transform", "direction", "style"];
    const open = chain.map((parent) => `<g${inheritedKeys.filter((key) => parent.attrs[key] !== undefined).map((key) => ` ${key}="${escapeAttribute(parent.attrs[key])}"`).join("")}>`).join("");
    const defs = [];
    const collect = (element) => { for (const child of element.children ?? []) if (isElement(child)) { if (child.name === "defs") defs.push(serialize(child, onlyLocalReferences)); collect(child); } };
    collect(page.svg);
    const rootAttrs = page.svg.attrs;
    const standalone = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${page.width}" height="${page.height}" viewBox="${escapeAttribute(rootAttrs.viewBox ?? `0 0 ${page.width} ${page.height}`)}">${defs.join("")}${open}${serialize(node, onlyLocalReferences)}${"</g>".repeat(chain.length)}</svg>`;
    const scale = this.options.rasterFallbackScale;
    const { png } = await this.options.rasterize(standalone, scale);
    const { data, info } = await requireCodec(this.options).rgba(png, { orient: false });
    let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3]) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    if (maxX < 0) return;
    const w = maxX - minX + 1, h = maxY - minY + 1;
    const color = new Uint8Array(w * h * 3), alpha = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const from = ((y + minY) * info.width + x + minX) * 4, to = y * w + x;
      color[to * 3] = data[from]; color[to * 3 + 1] = data[from + 1]; color[to * 3 + 2] = data[from + 2]; alpha[to] = data[from + 3];
    }
    const mask = this.file.addStream(`/Type/XObject/Subtype/Image/Width ${w}/Height ${h}/ColorSpace/DeviceGray/BitsPerComponent 8/Interpolate true`, alpha);
    const object = this.file.addStream(`/Type/XObject/Subtype/Image/Width ${w}/Height ${h}/ColorSpace/DeviceRGB/BitsPerComponent 8/Interpolate true/SMask ${ref(mask)}`, color);
    const resource = `Im${++this.counters.Im}`;
    const content = ctx.content;
    const inverse = invert(ctx.matrix) ?? IDENTITY;
    const sx = page.width / info.width, sy = page.height / info.height;
    this.markArtifact(ctx, () => {
      content.op("q");
      content.op(`${matrixOps(inverse)} ${num(w * sx, 4)} 0 0 ${num(-h * sy, 4)} ${num(minX * sx, 4)} ${num((minY + h) * sy, 4)} cm /${content.xobject(resource, object)} Do`);
      content.op("Q");
    });
  }

  // -----------------------------------------------------------------------------------------------------------
  // Document assembly

  async finish(metadata, language) {
    let reports;
    try { reports = this.embedder.finish(); } catch (error) {
      throw this.error("pdf-font-unreadable", `A font could not be embedded: ${error instanceof Error ? error.message : String(error)}`, {});
    }
    for (const report of reports) this.diagnostic(report);
    const file = this.file;
    const pagesObject = file.reserve();
    const pageObjects = [];
    const tagged = this.tagged;
    const structure = tagged ? this.buildStructure(pagesObject, language) : null;

    for (const page of this.pages) {
      const contents = file.addStream("", page.content.text());
      const annotations = page.annotations.map((annotation) => {
        const struct = tagged && annotation.parent ? ` /StructParent ${structure.annotationKey(annotation)}` : "";
        file.set(annotation.object, `/Type/Annot/Subtype/Link/Rect[${annotation.rect.map((value) => num(value, 3)).join(" ")}]/Border[0 0 0]/F 4/A<</S/URI/URI${asciiString(annotation.uri)}>>/P ${ref(page.object)}${struct}`);
        return ref(annotation.object);
      });
      const structParents = tagged && page.mcids.length ? `/StructParents ${structure.pageKey(page)}` : "";
      file.set(page.object,
        `/Type/Page/Parent ${ref(pagesObject)}/MediaBox[0 0 ${num(page.width)} ${num(page.height)}]/Resources<<${page.content.resources()}>>/Contents ${ref(contents)}` +
        `/Group<</S/Transparency/CS/DeviceRGB>>${annotations.length ? `/Annots[${annotations.join(" ")}]` : ""}${structParents}${tagged ? "/Tabs/S" : ""}`);
      pageObjects.push(page.object);
    }
    file.set(pagesObject, `/Type/Pages/Count ${pageObjects.length}/Kids[${pageObjects.map(ref).join(" ")}]`);

    const info = this.infoDictionary(metadata);
    const xmp = file.addStream("/Type/Metadata/Subtype/XML", utf8Encoder.encode(xmpPacket(metadata, language, this.options.producer)), { raw: true });
    const catalogParts = [`/Type/Catalog/Pages ${ref(pagesObject)}/Metadata ${ref(xmp)}`];
    if (language) catalogParts.push(`/Lang${asciiString(language)}`);
    if (metadata.title) catalogParts.push("/ViewerPreferences<</DisplayDocTitle true>>");
    if (tagged) catalogParts.push(`/MarkInfo<</Marked true>>/StructTreeRoot ${ref(structure.root)}`);
    const catalog = file.add(catalogParts.join(""));
    return file.serialize({ catalog, info });
  }

  infoDictionary(metadata) {
    const parts = [];
    if (metadata.title) parts.push(`/Title${textString(metadata.title)}`);
    if (metadata.author) parts.push(`/Author${textString(metadata.author)}`);
    if (metadata.subject) parts.push(`/Subject${textString(metadata.subject)}`);
    if (metadata.keywords) parts.push(`/Keywords${textString(Array.isArray(metadata.keywords) ? metadata.keywords.join(", ") : metadata.keywords)}`);
    parts.push(`/Creator${textString(metadata.creator ?? this.options.producer)}/Producer${textString(this.options.producer)}`);
    const created = pdfDate(metadata.creationDate);
    if (created) parts.push(`/CreationDate${asciiString(created)}`);
    const modified = pdfDate(metadata.modificationDate ?? metadata.creationDate);
    if (modified) parts.push(`/ModDate${asciiString(modified)}`);
    return this.file.add(parts.join(""));
  }

  /** The logical structure tree: Document > one Sect per slide > H1/P/Figure (> Link) in source order. */
  buildStructure(pagesObject, documentLanguage) {
    const file = this.file;
    const root = file.reserve();
    const documentElement = file.reserve();
    const objects = new Map();
    const numberOf = (element) => {
      let object = objects.get(element);
      if (!object) { object = file.reserve(); objects.set(element, object); }
      return object;
    };
    const parentTree = [];
    let nextKey = 0;
    const pageKeys = new Map(), annotationKeys = new Map();
    const sections = [];
    for (const page of this.pages) {
      const section = page.section;
      if (!section.kids.length) continue;
      sections.push(section);
    }
    const emit = (element, parentObject) => {
      const object = numberOf(element);
      const kids = element.kids.map((kid) => {
        if (kid.mcid !== undefined) return String(kid.mcid);
        emit(kid, object);
        return ref(numberOf(kid));
      });
      for (const annotation of element.annots ?? []) kids.push(`<</Type/OBJR/Obj ${ref(annotation.object)}/Pg ${ref(element.page.object)}>>`);
      const alt = element.alt ? `/Alt${textString(element.alt)}` : "";
      // A slide whose SVG declares another language than the document says so on its section.
      const lang = element.role === "Sect" && element.page.language && element.page.language !== documentLanguage ? `/Lang${asciiString(element.page.language)}` : "";
      file.set(object, `/Type/StructElem/S${name(element.role)}/P ${ref(parentObject)}/Pg ${ref(element.page.object)}${alt}${lang}/K[${kids.join(" ")}]`);
    };
    for (const section of sections) emit(section, documentElement);
    file.set(documentElement, `/Type/StructElem/S/Document/P ${ref(root)}/K[${sections.map((section) => ref(numberOf(section))).join(" ")}]`);
    for (const page of this.pages) {
      if (!page.mcids.length) continue;
      const key = nextKey++;
      pageKeys.set(page, key);
      parentTree.push(`${key}[${page.mcids.map((element) => ref(numberOf(element))).join(" ")}]`);
    }
    for (const page of this.pages) {
      for (const annotation of page.annotations) {
        if (!annotation.parent) continue;
        const key = nextKey++;
        annotationKeys.set(annotation, key);
        parentTree.push(`${key} ${ref(numberOf(annotation.parent))}`);
      }
    }
    const tree = file.add(`/Nums[${parentTree.join(" ")}]`);
    file.set(root, `/Type/StructTreeRoot/K ${ref(documentElement)}/ParentTree ${ref(tree)}/ParentTreeNextKey ${nextKey}`);
    return { root, pageKey: (page) => pageKeys.get(page), annotationKey: (annotation) => annotationKeys.get(annotation) };
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Helpers

function positive(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function num2(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 1;
}

function rgb(color) {
  return `${num(color.r, 4)} ${num(color.g, 4)} ${num(color.b, 4)}`;
}

function matrixOps(matrix) {
  return `${matrix.map((value) => num(value, 5)).join(" ")} cm`;
}

function pathOps(commands) {
  return commands.map(([type, ...values]) => {
    const coordinates = values.map((value) => num(value, 3)).join(" ");
    return { M: `${coordinates} m`, L: `${coordinates} l`, C: `${coordinates} c`, Z: "h" }[type];
  }).join(" ");
}

/** A glyph's outline as absolute path commands, each point mapped by `place(fontX, fontY)`. */
function glyphOutline(font, gid, place) {
  const commands = [];
  let x = 0, y = 0;
  for (const { command, args } of font.getGlyph(gid).path.commands) {
    if (command === "moveTo") { [x, y] = args; commands.push(["M", ...place(x, y)]); }
    else if (command === "lineTo") { [x, y] = args; commands.push(["L", ...place(x, y)]); }
    else if (command === "quadraticCurveTo") {
      const [cx, cy, ex, ey] = args;
      commands.push(["C", ...place(x + 2 / 3 * (cx - x), y + 2 / 3 * (cy - y)), ...place(ex + 2 / 3 * (cx - ex), ey + 2 / 3 * (cy - ey)), ...place(ex, ey)]);
      x = ex; y = ey;
    } else if (command === "bezierCurveTo") {
      commands.push(["C", ...place(args[0], args[1]), ...place(args[2], args[3]), ...place(args[4], args[5])]);
      x = args[4]; y = args[5];
    } else if (command === "closePath") commands.push(["Z"]);
  }
  return commands;
}

function boundsOf(points) {
  const xs = points.map((point) => point[0]), ys = points.map((point) => point[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

function countLeaves(node) {
  if (!isElement(node)) return 0;
  if (SKIPPED.has(node.name)) return 0;
  if (SHAPES.has(node.name) || node.name === "image") return 1;
  if (node.name === "text") return 1;
  let count = 0;
  for (const child of node.children) { count += countLeaves(child); if (count > 1) break; }
  return count;
}

// The rasterizer may read files: a rasterized fragment keeps only embedded (data:) and in-document (#id) references.
function onlyLocalReferences(key, value) {
  return !(key === "href" || key === "xlink:href") || /^(data:|#)/i.test(String(value).trim());
}

function runBox(run) {
  const scale = run.size / run.face.upem;
  const top = run.y - run.face.font.ascent * scale, bottom = run.y - run.face.font.descent * scale;
  return [["M", run.x, top], ["L", run.x + run.width, top], ["L", run.x + run.width, bottom], ["L", run.x, bottom], ["Z"]];
}


function sameText(run) {
  if (run.level % 2 === 1) return false;
  const got = run.glyphs.flatMap((glyph) => glyph.codePoints);
  const expected = [...run.text].map((character) => character.codePointAt(0));
  return got.length === expected.length && got.every((value, index) => value === expected[index]);
}

function safeUri(value) {
  const text = String(value).trim();
  if (!/^(https?:|mailto:|tel:)/i.test(text)) return null;
  // PDF URI strings are 7-bit ASCII: percent-encode anything else (UTF-8).
  let out = "";
  for (const byte of utf8Encoder.encode(text)) out += byte > 0x20 && byte < 0x7f ? String.fromCharCode(byte) : "%" + byte.toString(16).toUpperCase().padStart(2, "0");
  return out;
}

function pdfDate(value) {
  if (value === undefined || value === null) return null;
  // A date-time without a zone designator would be read in the machine's time zone; the export reads it as UTC.
  const text = typeof value === "string" && /^\d{4}-\d{2}-\d{2}[T ][\d:.]+$/.test(value.trim()) ? value.trim().replace(" ", "T") + "Z" : value;
  const date = text instanceof Date ? text : new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (number, length = 2) => String(number).padStart(length, "0");
  return `D:${pad(date.getUTCFullYear(), 4)}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function xmpEscape(value) {
  const control = new RegExp("[" + [0,8,11,12].map((c) => "\\x" + c.toString(16).padStart(2, "0")).join("") + "\\x0e-\\x1f\\ufffe\\uffff]", "g");
  return String(value).replace(control, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function xmpPacket(metadata, language, producer) {
  const alt = (tag, value) => `<dc:${tag}><rdf:Alt><rdf:li xml:lang="x-default">${xmpEscape(value)}</rdf:li></rdf:Alt></dc:${tag}>`;
  const created = pdfDate(metadata.creationDate);
  const iso = created ? `${created.slice(2, 6)}-${created.slice(6, 8)}-${created.slice(8, 10)}T${created.slice(10, 12)}:${created.slice(12, 14)}:${created.slice(14, 16)}Z` : null;
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>\n<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:pdfuaid="http://www.aiim.org/pdfua/ns/id/">` +
    `<dc:format>application/pdf</dc:format>${metadata.title ? alt("title", metadata.title) : ""}${metadata.author ? `<dc:creator><rdf:Seq><rdf:li>${xmpEscape(metadata.author)}</rdf:li></rdf:Seq></dc:creator>` : ""}${metadata.subject ? alt("description", metadata.subject) : ""}${language ? `<dc:language><rdf:Bag><rdf:li>${xmpEscape(language)}</rdf:li></rdf:Bag></dc:language>` : ""}` +
    `<pdf:Producer>${xmpEscape(producer)}</pdf:Producer>${iso ? `<xmp:CreateDate>${iso}</xmp:CreateDate>` : ""}</rdf:Description></rdf:RDF></x:xmpmeta>\n<?xpacket end="w"?>`;
}

// The Node modules the font-file paths need, loaded only when a path is given. The specifiers are not literals, so a browser bundler
// leaves them alone: a browser host never passes a font path.
async function nodeFileSystem() {
  const fsName = "node:fs/promises", pathName = "node:path";
  const [fs, path] = await Promise.all([import(/* webpackIgnore: true */ /* @vite-ignore */ fsName), import(/* webpackIgnore: true */ /* @vite-ignore */ pathName)]);
  return { readdir: fs.readdir, readFile: fs.readFile, stat: fs.stat, path: path.default ?? path };
}

// Pictures are decoded by the host's `imageCodec` (sharp in Node, see raster.js; a canvas in a browser, see export-browser.js):
// `metadata(bytes)` gives {format, width, height, orientation, channels, space} and `rgba(bytes, {orient})` gives
// {data, info: {width, height}} with 8-bit RGBA pixels (EXIF orientation applied when `orient`). This module imports no decoder, so a
// browser bundle never reaches the native ones.
function requireCodec(options) {
  if (!options.imageCodec) throw new Error("This conversion has no image codec.");
  return options.imageCodec;
}

/** The bytes of a data: URI payload (base64, or percent-encoded text read as Latin-1 bytes), without Buffer. */
export function dataUriBytes(header, payload) {
  const text = decodeURIComponent(payload);
  if (/;base64/i.test(header)) {
    // Lenient like Buffer.from(..., "base64"): characters outside the alphabet are skipped and missing padding is added.
    const clean = text.replace(/[^A-Za-z0-9+/]/g, "");
    const binary = atob(clean + "=".repeat((4 - (clean.length % 4)) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index++) bytes[index] = text.charCodeAt(index) & 0xff;
  return bytes;
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

/**
 * Convert SVG slides to a vector PDF. `options` carries the resolved conversion settings (see svgToPdf in raster.js).
 */
export async function svgsToVectorPdf(svgs, options) {
  const converter = new Converter(options);
  await converter.loadFontFiles(options.fontFiles ?? [], options.fontDirs ?? []);
  // Faces handed over as bytes (a browser host has no file paths): { data, family? }.
  for (const face of options.fontData ?? []) converter.fonts.addData(face.data, face.origin ?? "fontData", face.family);
  // `signal` cancels between pages, `onProgress({ page, pages })` reports after each one, and `yieldToHost` lets a browser repaint between them.
  for (const [index, source] of svgs.entries()) {
    options.signal?.throwIfAborted?.();
    await converter.addPage(source, index);
    options.onProgress?.({ page: index + 1, pages: svgs.length });
    if (options.yieldToHost) await options.yieldToHost();
  }
  options.signal?.throwIfAborted?.();
  const first = converter.pages[0];
  // Control characters have no place in document properties.
  const control = new RegExp("[" + String.fromCharCode(0) + "-" + String.fromCharCode(31) + String.fromCharCode(127) + "]", "g");
  const metadata = Object.fromEntries(Object.entries(options.metadata ?? {}).map(([key, value]) => [key, typeof value === "string" ? value.replace(control, "") : Array.isArray(value) ? value.map((item) => String(item).replace(control, "")) : value]));
  const language = metadata.language ?? first?.language;
  return converter.finish(metadata, language);
}


