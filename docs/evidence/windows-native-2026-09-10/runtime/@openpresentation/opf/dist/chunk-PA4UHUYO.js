// src/table.ts
var record = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
function tableGrid(value, path = "table") {
  const table = record(value), hasHeaders = Array.isArray(table.columns) && table.columns.length > 0;
  const values = [...hasHeaders ? [table.columns] : [], ...Array.isArray(table.rows) ? table.rows : []];
  const columnCount = values.reduce((count, row) => Math.max(count, Array.isArray(row) ? row.length : 0), 1), rowCount = values.length;
  const owners = Array.from({ length: rowCount }, () => Array(columnCount));
  const rows2 = Array.from({ length: rowCount }, () => []), issues = [];
  const location = (r, c) => `${path}.${hasHeaders && r === 0 ? "columns" : `rows.${r - Number(hasHeaders)}`}.${c}`;
  for (let r = 0; r < rowCount; r++) for (let c = 0; c < columnCount; c++) {
    const input = values[r]?.[c], cellPath = location(r, c), existing = owners[r][c];
    if (existing) {
      if (input !== null) issues.push({ path: cellPath, message: "A position covered by a spanning cell must explicitly contain null; content cannot be hidden." });
      continue;
    }
    const object = record(input), styled = Object.hasOwn(object, "value");
    const rowSpan = styled ? object.rowSpan ?? 1 : 1, colSpan = styled ? object.colSpan ?? 1 : 1;
    if (!Number.isSafeInteger(rowSpan) || !Number.isSafeInteger(colSpan) || rowSpan < 1 || colSpan < 1 || r + rowSpan > rowCount || c + colSpan > columnCount || hasHeaders && r === 0 && rowSpan > 1) {
      issues.push({ path: cellPath, message: "Cell spans must be positive integers within the table grid and cannot cross from headers into body rows." });
      continue;
    }
    const cell = { input, value: styled ? object.value : input, style: styled ? record(object.style) : {}, row: r, column: c, rowSpan, colSpan, header: hasHeaders && r === 0, path: cellPath, valuePath: styled ? cellPath + ".value" : cellPath };
    rows2[r].push(cell);
    for (let y = r; y < r + rowSpan; y++) for (let x = c; x < c + colSpan; x++) {
      if (owners[y][x]) issues.push({ path: cellPath, message: "Cell spans cannot overlap another spanning cell." });
      else owners[y][x] = cell;
    }
  }
  return { rows: rows2, columnCount, rowCount, hasHeaders, owners, issues };
}
function tableRowBoundaries(value) {
  const grid = tableGrid(value), offset = Number(grid.hasHeaders), count = grid.rowCount - offset;
  const allowed = new Set(Array.from({ length: count + 1 }, (_, i) => i));
  for (const row of grid.rows) for (const cell of row) if (!cell.header) for (let r = 1; r < cell.rowSpan; r++) allowed.delete(cell.row - offset + r);
  return [...allowed];
}

// src/color.ts
function luminance(value) {
  if (typeof value !== "string") return void 0;
  let hex = value.trim();
  if (/^#[0-9a-f]{3}$/i.test(hex)) hex = `#${[...hex.slice(1)].map((c) => c + c).join("")}`;
  if (/^#[0-9a-f]{6}ff$/i.test(hex)) hex = hex.slice(0, 7);
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return void 0;
  return [0.2126, 0.7152, 0.0722].reduce((sum, weight, index) => {
    const offset = index * 2 + 1;
    const n = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return sum + weight * (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
  }, 0);
}
function colorContrast(foreground, background) {
  const a = luminance(foreground), b = luminance(background);
  return a === void 0 || b === void 0 ? void 0 : (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function textColorForFill(fill, preferred) {
  const background = luminance(fill), contrast = colorContrast(preferred, fill);
  if (background === void 0 || contrast === void 0 || contrast >= 4.5) return preferred;
  return (background + 0.05) / 0.05 >= 1.05 / (background + 0.05) ? "#000000" : "#FFFFFF";
}
function chartColorForFill(fill, preferred) {
  const contrast = colorContrast(preferred, fill);
  if (contrast === void 0 || contrast >= 3) return preferred;
  let hex = preferred.trim();
  if (hex.length === 4) hex = `#${[...hex.slice(1)].map((c) => c + c).join("")}`;
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  for (let step = 1; step <= 255; step++) {
    const candidates = [0, 255].map((target) => {
      const color = `#${channels.map((channel) => Math.round(channel + (target - channel) * step / 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
      return { color, contrast: colorContrast(color, fill) ?? 0 };
    }).sort((a, b) => b.contrast - a.contrast);
    const best = candidates[0];
    if (best && best.contrast >= 3) return best.color;
  }
  return textColorForFill(fill, preferred);
}

// src/composition.ts
var MAX_COMPOSITION_DEPTH = 32;
function resolveFontFamilies(input) {
  const scheme = record2(input);
  const family = (value) => typeof value === "string" ? value : record2(value).family;
  return {
    heading: family(scheme.heading) ?? scheme.major ?? scheme.minor ?? "Roboto",
    body: family(scheme.body) ?? scheme.minor ?? scheme.major ?? "Roboto",
    code: family(scheme.code) ?? "Roboto Mono"
  };
}
function resolveTextStyle(style, measurement) {
  return measurement?.resolveStyle ? measurement.resolveStyle(style) : style;
}
function textWidthMeasurer(style, measurement) {
  if (!measurement) return measureText;
  return (text, size) => {
    const width = measurement.measure(text, size, style);
    if (!Number.isFinite(width) || width < 0) throw new RangeError("Text measurement must return a finite, nonnegative width.");
    return width;
  };
}
function measureTextOutline(text, fontSize, style, measurement) {
  if (measurement?.outlineBounds === void 0) return void 0;
  if (typeof measurement.outlineBounds !== "function") throw new TypeError("Text outline provider must be a function.");
  const bounds = measurement.outlineBounds(text, fontSize, style);
  if (bounds === null) return null;
  if (!bounds || ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) || bounds.width < 0 || bounds.height < 0) {
    throw new RangeError("Text outline measurement must return null or finite bounds with nonnegative dimensions.");
  }
  return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
}
function placeTextLines(lines, box, alignment = "left", rasterPadding = 0) {
  if (!Array.isArray(lines) || !box || ![box.x, box.y, box.width, box.height, rasterPadding].every(Number.isFinite) || box.width <= 0 || box.height <= 0 || rasterPadding < 0 || !["left", "center", "right"].includes(alignment)) throw new RangeError("Text placement requires lines, finite positive dimensions, nonnegative padding and a valid alignment.");
  const factor = alignment === "right" ? 1 : alignment === "center" ? 0.5 : 0, placed = [];
  let shift = 0, bottom = box.y, height = 0, overflow = false;
  for (const line of lines) {
    if (!line || ![line.width, line.y, line.baseline, line.height].every(Number.isFinite) || line.width < 0 || line.height <= 0 || line.y < 0 || line.baseline < line.y) throw new RangeError("Text lines require finite coordinates, nonnegative advances and a baseline at or below their top.");
    const ink = line.outline;
    if (ink !== null && (!ink || ![ink.x, ink.y, ink.width, ink.height].every(Number.isFinite) || ink.width < 0 || ink.height < 0)) throw new RangeError("Text outlines must be null or finite coordinates with nonnegative dimensions.");
    let x = box.x + (box.width - line.width) * factor;
    if (ink) {
      const low = box.x + rasterPadding - ink.x, high = box.x + box.width - rasterPadding - ink.x - ink.width;
      if (low > high + 0.01) overflow = true;
      else x = Math.max(low, Math.min(x, high));
      shift += Math.max(0, bottom + rasterPadding - (box.y + line.baseline + shift + ink.y));
    }
    const y = box.y + line.y + shift, baseline = box.y + line.baseline + shift;
    const outline = ink ? { ...ink, x: x + ink.x, y: baseline + ink.y } : null;
    if (outline) bottom = outline.y + outline.height + rasterPadding;
    height = Math.max(height, y + line.height - box.y, outline ? bottom - box.y : 0);
    if (line.width > box.width + 0.01 || height > box.height + 0.01) overflow = true;
    placed.push({ x, y, baseline, height: line.height, width: line.width, outline });
  }
  return { alignment, rasterPadding, lines: placed, height, overflow };
}
var OPFCompositionError = class extends Error {
  constructor(diagnostics, explanation) {
    super("Slide content does not fit its composition.");
    this.diagnostics = diagnostics;
    this.name = "OPFCompositionError";
    if (explanation) this.explanation = explanation;
  }
  diagnostics;
  code = "layout-overflow";
  explanation;
};
var fields = ["text", "items", "bullets", "image", "video", "chart", "table", "code", "metric", "quote", "timeline"];
var headings = /* @__PURE__ */ new Set(["title", "subtitle", "tag"]);
var rows = ["top", "middle", "bottom"];
var columns = ["left", "center", "right"];
var record2 = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
var kind = (field) => field === "items" || field === "bullets" ? "list" : field;
var round = (value) => Math.round(value * 1e6) / 1e6 || value;
var textSegments = new Intl.Segmenter("und", { granularity: "grapheme" });
function measureText(text, fontSize) {
  let units = 0;
  for (const character of text) {
    if (/\p{Mark}|\u200d|\ufe0f/u.test(character)) continue;
    units += character === " " ? 0.32 : /[A-Z0-9]/.test(character) ? 0.62 : character.codePointAt(0) > 11904 ? 1 : 0.54;
  }
  return units * fontSize;
}
function wrapText(text, width, fontSize, measure = measureText) {
  const result = [];
  for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/u).filter(Boolean)) {
      if (line && measure(`${line} ${word}`, fontSize) > width) {
        result.push(line);
        line = "";
      }
      if (measure(word, fontSize) <= width) {
        line += (line ? " " : "") + word;
        continue;
      }
      for (const { segment: character } of textSegments.segment(word)) {
        if (line && measure(line + character, fontSize) > width) {
          result.push(line);
          line = "";
        }
        line += character;
      }
    }
    result.push(line);
  }
  return result;
}
function fitText(text, box, requestedSize = 25, minFontSize = 16, measure = measureText) {
  if (![box.width, box.height, requestedSize, minFontSize].every(Number.isFinite) || box.width <= 0 || box.height <= 0 || requestedSize <= 0 || minFontSize <= 0) {
    throw new RangeError("Text dimensions and font sizes must be finite and positive.");
  }
  const minimum = Math.min(minFontSize, requestedSize);
  let fontSize = requestedSize;
  let lines = wrapText(text, box.width, fontSize, measure);
  while (fontSize > minimum && (lines.length * fontSize * 1.22 > box.height || lines.some((line) => measure(line, fontSize) > box.width))) {
    fontSize = Math.max(minimum, fontSize - 1);
    lines = wrapText(text, box.width, fontSize, measure);
  }
  return { lines, fontSize, lineHeight: fontSize * 1.22, overflow: lines.length * fontSize * 1.22 > box.height + 0.01 || lines.some((line) => measure(line, fontSize) > box.width + 0.01) };
}
function layoutQuote(value, box, options = {}) {
  const shorthand = typeof value === "string";
  const quote = shorthand ? { text: value } : value;
  if (!quote || Array.isArray(quote) || typeof quote.text !== "string" || [quote.attribution, quote.source].some((field) => field !== void 0 && typeof field !== "string")) {
    throw new TypeError("Quote content must be a string or a text object with optional string attribution/source.");
  }
  const scale = options.scale ?? 1, minimum = (options.minFontSize ?? 16) * scale;
  if (![box.x, box.y, box.width, box.height, scale, minimum].every(Number.isFinite) || box.width <= 0 || box.height <= 0 || scale <= 0 || minimum <= 0) {
    throw new RangeError("Quote dimensions, scale and minimum font size must be finite and positive.");
  }
  if (options.overflow !== void 0 && !["warn", "error"].includes(options.overflow)) throw new RangeError("Invalid quote overflow policy.");
  const path = options.path ?? "quote";
  const diagnostics = [], parts = [];
  const report = (reason, diagnosticPath, roles, message) => diagnostics.push({ code: "text-overflow", reason, path: diagnosticPath, parts: roles, message });
  const source = (sourcePath, text, outputStart) => ({ path: sourcePath, start: 0, end: text.length, outputStart, outputEnd: outputStart + text.length });
  const add = (role, text, sources, area, fontSize, fontFamily, fontWeight, partPath) => {
    const requestedStyle = { fontFamily, fontWeight, italic: false, path: partPath };
    const style = resolveTextStyle({ ...requestedStyle }, options.textMeasurement);
    const requestedFontSize = Math.max(fontSize * scale, minimum);
    const part = { role, path: partPath, text, sources, box: area, requestedFontSize, minFontSize: minimum, requestedStyle, style };
    parts.push(part);
    return part;
  };
  let footer = "";
  const footerSources = [];
  for (const field of ["attribution", "source"]) {
    const text = quote[field];
    if (!text) continue;
    if (footer) footer += " - ";
    footerSources.push(source(`${path}.${field}`, text, footer.length));
    footer += text;
  }
  const bodyPath = shorthand ? path : `${path}.text`;
  const body = add(
    "body",
    `"${quote.text}"`,
    [source(bodyPath, quote.text, 1)],
    { x: box.x + 18, y: box.y + 18, width: box.width - 36, height: box.height - (footer ? 94 : 36) },
    28,
    options.fonts?.heading ?? "sans-serif",
    600,
    bodyPath
  );
  const attribution = footer ? add(
    "footer",
    footer,
    footerSources,
    { x: box.x + 18, y: box.y + box.height - 58, width: box.width - 36, height: 40 },
    17,
    options.fonts?.body ?? "sans-serif",
    500,
    path
  ) : void 0;
  const usable = (area) => [area.x, area.y, area.width, area.height].every(Number.isFinite) && area.width > 0 && area.height > 0;
  const fit = (part, area, size = part.requestedFontSize, floor = minimum) => usable(area) ? fitText(part.text, area, size, floor, textWidthMeasurer(part.style, options.textMeasurement)) : void 0;
  const inner = { x: box.x + 18, y: box.y + 18, width: box.width - 36, height: box.height - 36 };
  if (!attribution) body.fit = fit(body, body.box);
  else if (usable(inner) && inner.height > 18) {
    const available = inner.height - 18;
    const preferredBody = fit(body, inner, body.requestedFontSize, body.requestedFontSize);
    const minimumBody = body.requestedFontSize === minimum ? preferredBody : fit(body, inner, minimum, minimum);
    const preferredBodyHeight = preferredBody.lines.length * preferredBody.lineHeight;
    const minimumBodyHeight = minimumBody.lines.length * minimumBody.lineHeight;
    let selected;
    for (const size of /* @__PURE__ */ new Set([attribution.requestedFontSize, minimum])) {
      const natural = fit(attribution, inner, size, size);
      const naturalHeight = natural.lines.length * natural.lineHeight;
      const preferredHeight = Math.max(40, naturalHeight);
      const bodyReservation = Math.min(minimumBodyHeight, Math.max(minimumBody.lineHeight, available - natural.lineHeight));
      const footerHeight = preferredBodyHeight + preferredHeight <= available + 0.01 ? preferredHeight : Math.min(naturalHeight, Math.max(0, available - bodyReservation));
      const bodyBox = { ...inner, height: available - footerHeight };
      const footerBox = { ...inner, y: inner.y + inner.height - footerHeight, height: footerHeight };
      const bodyFit = fit(body, bodyBox);
      const footerFit = usable(footerBox) ? { ...natural, overflow: natural.overflow || naturalHeight > footerHeight + 0.01 } : void 0;
      const overflow = !bodyFit || !footerFit || bodyFit.overflow || footerFit.overflow;
      const score = (body.requestedFontSize - (bodyFit?.fontSize ?? minimum) + attribution.requestedFontSize - size) / scale;
      if (!selected || !overflow && (selected.overflow || score < selected.score) || overflow && selected.overflow) {
        selected = { bodyBox, footerBox, bodyFit, footerFit, score, overflow };
      }
    }
    if (selected) {
      body.box = selected.bodyBox;
      body.fit = selected.bodyFit;
      attribution.box = selected.footerBox;
      attribution.fit = selected.footerFit;
    }
  }
  for (const part of parts) {
    const area = part.box;
    if (!part.fit) {
      report("invalid-part-box", part.path, [part.role], `Quote ${part.role} has no usable space after its insets; increase the cell size or change the arrangement.`);
    } else if (part.fit.overflow) {
      report("text-fit", part.path, [part.role], `Quote ${part.role} exceeds its available space at the readability floor; increase its space or change the arrangement.`);
    }
    if (usable(area) && (area.x < box.x || area.y < box.y || area.x + area.width > box.x + box.width + 0.01 || area.y + area.height > box.y + box.height + 0.01)) {
      report("part-outside-cell", part.path, [part.role], `Quote ${part.role} extends outside its cell; increase the cell size or change the arrangement.`);
    }
  }
  if (body?.fit && attribution?.fit && body.box.y + body.fit.lines.length * body.fit.lineHeight > attribution.box.y + 0.01 && attribution.box.y + attribution.fit.lines.length * attribution.fit.lineHeight > body.box.y + 0.01) {
    report("part-overlap", path, ["body", "footer"], "Quote body and footer line boxes overlap; do not accept this layout without more space.");
  }
  if (diagnostics.length && options.overflow === "error") throw new OPFCompositionError(diagnostics);
  return { algorithm: "quote-flow-v1", textMeasurement: options.textMeasurement ? "provided" : "estimated", parts, diagnostics, overflow: diagnostics.length > 0 };
}
function layoutMetric(value, box, options = {}) {
  const scalar = typeof value === "string" || typeof value === "number";
  const metric = scalar ? { value } : value;
  const isValue = (input) => typeof input === "string" || typeof input === "number" && Number.isFinite(input);
  if (!metric || Array.isArray(metric) || !isValue(metric.value) || [metric.label, metric.description, metric.unit].some((field) => field !== void 0 && typeof field !== "string") || metric.delta !== void 0 && !isValue(metric.delta) || metric.trend !== void 0 && !["up", "down", "flat"].includes(metric.trend)) {
    throw new TypeError("Metric content requires a finite numeric or string value and schema-valid display metadata.");
  }
  const scale = options.scale ?? 1, minimum = (options.minFontSize ?? 16) * scale;
  if (![box.x, box.y, box.width, box.height, box.x + box.width, box.y + box.height, scale, minimum, Math.max(76 * scale, minimum) * 1.22].every(Number.isFinite) || box.width <= 0 || box.height <= 0 || scale <= 0 || minimum <= 0) {
    throw new RangeError("Metric dimensions, scale and minimum font size must be finite and positive.");
  }
  if (options.overflow !== void 0 && !["warn", "error"].includes(options.overflow)) throw new RangeError("Invalid metric overflow policy.");
  const alignment = options.align ?? "left";
  if (!["left", "center", "right"].includes(alignment)) throw new RangeError("Invalid metric alignment.");
  const sourcePath = options.path ?? "metric", parts = [], diagnostics = [];
  for (const role of ["value", "unit", "label", "description", "delta", "trend"]) {
    const sourceValue = metric[role];
    if (sourceValue === void 0) continue;
    const text = String(sourceValue), path = scalar ? sourcePath : `${sourcePath}.${role}`;
    const nominal = role === "value" ? Math.min(76 * scale, box.height * 0.28) : (role === "description" ? 20 : role === "trend" ? 18 : 23) * scale;
    const requestedStyle = { fontFamily: (role === "value" ? options.fonts?.heading : options.fonts?.body) ?? "sans-serif", fontWeight: role === "value" ? 800 : role === "description" ? 400 : 500, italic: false, path };
    const part = {
      role,
      path,
      text,
      sources: [{ path, value: sourceValue, start: 0, end: text.length }],
      visible: role === "value" || text.length > 0,
      linePositions: [],
      box: { ...box, height: 0 },
      requestedFontSize: Math.max(nominal, minimum),
      minFontSize: minimum,
      requestedStyle,
      style: resolveTextStyle({ ...requestedStyle }, options.textMeasurement)
    };
    if (!part.visible) part.fit = { lines: [], sourceLines: [], fontSize: part.requestedFontSize, lineHeight: part.requestedFontSize * 1.22, tabSize: 4, tabWidth: 0, overflow: false };
    parts.push(part);
  }
  const primary = parts[0], metadata = parts.filter((part) => part !== primary && part.visible), unit = metadata.find((part) => part.role === "unit");
  const usable = (area) => [area.x, area.y, area.width, area.height, area.x + area.width, area.y + area.height].every(Number.isFinite) && area.width > 0 && area.height > 0;
  const occupied = (fit) => fit.lines.length * fit.lineHeight;
  const gap = 8 * scale, primaryGap = 12 * scale;
  const cache = /* @__PURE__ */ new Map();
  const measure = (part, size, width) => {
    const key = JSON.stringify([part.role, size, width]);
    let fit = cache.get(key);
    if (!fit) {
      fit = fitCodeText(part.text, { ...box, width }, size, size, scale, textWidthMeasurer(part.style, options.textMeasurement));
      if (!Number.isFinite(occupied(fit))) throw new RangeError("Metric text layout exceeds finite coordinates.");
      cache.set(key, fit);
    }
    return fit;
  };
  const fitValue = (area, singleLine) => {
    if (!usable(area)) return void 0;
    for (let step = 0; step <= 76; step++) {
      const size = Math.max(minimum, primary.requestedFontSize - step * scale);
      const natural = measure(primary, size, area.width);
      const fit = { ...natural, overflow: singleLine && natural.lines.length !== 1 || occupied(natural) > area.height + 0.01 || natural.sourceLines.some((line) => line.width > area.width + 0.01) };
      if (!fit.overflow || size === minimum) return fit;
    }
  };
  let selected, attempts = 0;
  const reductions = Math.min(23, Math.ceil(Math.max(0, ...metadata.map((part) => (part.requestedFontSize - minimum) / scale))));
  for (let reduction = 0; reduction <= reductions; reduction++) {
    const measured = new Map(metadata.map((part) => [part, measure(part, Math.max(minimum, part.requestedFontSize - reduction * scale), box.width)]));
    const unitFit = unit ? measured.get(unit) : void 0;
    const unitWidth = unitFit?.sourceLines[0]?.width ?? 0;
    const inline = unitFit?.lines.length === 1 && unitWidth > 0 && unitWidth <= box.width * 0.35 && unitWidth + gap < box.width;
    for (const arrangement of inline ? ["inline-unit", "stacked"] : ["stacked"]) {
      attempts++;
      const tail = metadata.filter((part) => arrangement !== "inline-unit" || part !== unit);
      const tailHeight = tail.reduce((sum, part) => sum + occupied(measured.get(part)), 0) + Math.max(0, tail.length - 1) * gap;
      if (!Number.isFinite(tailHeight)) throw new RangeError("Metric metadata exceeds finite coordinates.");
      const area = { ...box, width: arrangement === "inline-unit" ? box.width - unitWidth - gap : box.width, height: box.height - tailHeight - (tail.length ? primaryGap : 0) };
      const valueFit = fitValue(area, arrangement === "inline-unit"), valueHeight = valueFit ? occupied(valueFit) : 0;
      const allocations = [];
      let primaryHeight = valueHeight;
      if (arrangement === "inline-unit" && unit && unitFit && valueFit) {
        const valueBaseline = valueHeight - valueFit.lineHeight + valueFit.fontSize;
        const unitBaseline = occupied(unitFit) - unitFit.lineHeight + unitFit.fontSize;
        const valueY = box.y + Math.max(0, unitBaseline - valueBaseline), unitY = box.y + Math.max(0, valueBaseline - unitBaseline);
        const measuredWidth = Math.max(...valueFit.sourceLines.map((line) => line.width));
        const valueWidth = Math.min(area.width, measuredWidth || valueFit.fontSize);
        allocations.push({ part: primary, box: { ...area, y: valueY, width: valueWidth, height: valueHeight }, fit: valueFit });
        allocations.push({ part: unit, box: { x: box.x + valueWidth + gap, y: unitY, width: unitWidth, height: occupied(unitFit) }, fit: { ...unitFit, overflow: false } });
        primaryHeight = Math.max(valueY - box.y + valueHeight, unitY - box.y + occupied(unitFit));
      } else allocations.push({ part: primary, box: valueFit ? { ...area, height: valueHeight } : area, fit: valueFit });
      let y = box.y + primaryHeight + (tail.length ? primaryGap : 0);
      for (const part of tail) {
        const natural = measured.get(part), height = occupied(natural);
        allocations.push({ part, box: { ...box, y, height }, fit: { ...natural, overflow: natural.sourceLines.some((line) => line.width > box.width + 0.01) } });
        y += height + gap;
      }
      const overflow = !valueFit || valueFit.overflow || arrangement === "inline-unit" && valueFit.lines.length !== 1 || primaryHeight > area.height + 0.01 || allocations.some(({ box: area2, fit }) => !fit || fit.overflow || !usable(area2) || area2.y + area2.height > box.y + box.height + 0.01);
      const score = allocations.reduce((sum, { part, fit }) => sum + (part.requestedFontSize - (fit?.fontSize ?? minimum)) / scale, 0);
      const candidate = { arrangement, allocations, score, overflow };
      if (!selected || !overflow && (selected.overflow || score < selected.score) || overflow && selected.overflow) selected = candidate;
    }
    if (selected && !selected.overflow && selected.score === 0) break;
  }
  for (const allocation of selected.allocations) {
    allocation.part.box = allocation.box;
    allocation.part.fit = allocation.fit;
  }
  const alignmentFactor = alignment === "center" ? 0.5 : alignment === "right" ? 1 : 0;
  if (selected.arrangement === "inline-unit" && unit) {
    const offset = (box.width - (unit.box.x + unit.box.width - box.x)) * alignmentFactor;
    primary.box.x += offset;
    unit.box.x += offset;
  }
  for (const part of parts) if (part.fit) part.linePositions = part.fit.sourceLines.map((line, index) => ({
    x: part.box.x + (part.box.width - line.width) * alignmentFactor,
    baseline: part.box.y + part.fit.fontSize + index * part.fit.lineHeight
  }));
  const report = (reason, part, roles, message) => diagnostics.push({ code: "text-overflow", reason, path: part.path, parts: roles, message });
  for (const part of parts.filter((part2) => part2.visible)) {
    if (!part.fit || !usable(part.box)) report("invalid-part-box", part, [part.role], `Metric ${part.role} has no usable space after metadata; increase the cell or change the arrangement.`);
    else if (part.fit.overflow) report("text-fit", part, [part.role], `Metric ${part.role} exceeds its space at the readability floor; increase the cell or change the arrangement.`);
    if (usable(part.box) && (part.box.x < box.x || part.box.y < box.y || part.box.x + part.box.width > box.x + box.width + 0.01 || part.box.y + part.box.height > box.y + box.height + 0.01)) {
      report("part-outside-cell", part, [part.role], `Metric ${part.role} extends outside its cell; increase the cell or change the arrangement.`);
    }
  }
  const visible = parts.filter((part) => part.visible && part.fit);
  for (const [index, first] of visible.entries()) for (const second of visible.slice(index + 1)) {
    if (first.box.x < second.box.x + second.box.width - 0.01 && second.box.x < first.box.x + first.box.width - 0.01 && first.box.y < second.box.y + occupied(second.fit) - 0.01 && second.box.y < first.box.y + occupied(first.fit) - 0.01) {
      report("part-overlap", first, [first.role, second.role], "Metric part line boxes overlap; do not accept this layout without more space.");
    }
  }
  if (diagnostics.length && options.overflow === "error") throw new OPFCompositionError(diagnostics);
  return { algorithm: "metric-flow-v1", alignment, textMeasurement: options.textMeasurement ? "provided" : "estimated", arrangement: selected.arrangement, attempts, parts, diagnostics, overflow: diagnostics.length > 0 };
}
function fitCodeText(text, box, size, minimum, step, measure) {
  const layout = (fontSize) => {
    const tabWidth = measure(" ", fontSize) * 4;
    if (!Number.isFinite(tabWidth) || text.includes("	") && tabWidth <= 0) throw new RangeError("Code tabs require a positive finite measured space advance.");
    const measureLine = (start2, end2, record3 = false) => {
      let x = 0, offset = start2;
      const segments = [];
      for (const [index, segment] of text.slice(start2, end2).split("	").entries()) {
        if (index) {
          const next = (Math.floor(x / tabWidth + 1e-9) + 1) * tabWidth;
          if (record3) segments.push({ kind: "tab", start: offset, end: offset + 1, x, width: next - x });
          x = next;
          offset++;
        }
        if (segment) {
          const advance = measure(segment, fontSize);
          if (record3) segments.push({ kind: "text", start: offset, end: offset + segment.length, x, width: advance });
          x += advance;
          offset += segment.length;
        }
      }
      return { width: x, segments };
    };
    const width = (start2, end2) => measureLine(start2, end2).width;
    const sourceLines = [];
    let start = 0, end = 0;
    const push = (last, nextStart, boundary) => {
      sourceLines.push({ start, end: last, nextStart, boundary, ...measureLine(start, last, true) });
      start = nextStart;
      end = nextStart;
    };
    for (const token of text.matchAll(/\r\n|\r|\n|[^\S\r\n]+|[^\s]+/gu)) {
      if (token.index === void 0) throw new Error("Missing code token source offset.");
      const a = token.index, b = a + token[0].length;
      if (/^[\r\n]/.test(token[0])) {
        push(a, b, "hard");
        continue;
      }
      if (width(start, b) <= box.width + 0.01) {
        end = b;
        continue;
      }
      if (end > start && /\S/u.test(text.slice(start, end))) push(a, a, "soft");
      if (width(start, b) <= box.width + 0.01) {
        end = b;
        continue;
      }
      for (const segment of textSegments.segment(token[0])) {
        const next = a + segment.index + segment.segment.length;
        if (end > start && width(start, next) > box.width + 0.01) push(a + segment.index, a + segment.index, "soft");
        end = next;
      }
    }
    push(end, end, "end");
    const lineHeight = fontSize * 1.22;
    return {
      lines: sourceLines.map((line) => text.slice(line.start, line.end)),
      sourceLines,
      fontSize,
      lineHeight,
      tabSize: 4,
      tabWidth,
      overflow: sourceLines.length * lineHeight > box.height + 0.01 || sourceLines.some((line) => line.width > box.width + 0.01)
    };
  };
  let result = layout(size);
  while (result.overflow && size > minimum) {
    size = Math.max(minimum, size - step);
    result = layout(size);
  }
  return result;
}
function layoutCode(value, box, options = {}) {
  const shorthand = typeof value === "string", code = shorthand ? { source: value } : value;
  if (!code || Array.isArray(code) || typeof code.source !== "string" || [code.language, code.filename].some((field) => field !== void 0 && typeof field !== "string")) {
    throw new TypeError("Code content must be a string or source object with optional string language/filename.");
  }
  const scale = options.scale ?? 1, minimum = (options.minFontSize ?? 16) * scale;
  if (![box.x, box.y, box.width, box.height, box.x + box.width, box.y + box.height, scale, minimum, Math.max(18 * scale, minimum) * 1.22].every(Number.isFinite) || box.width <= 0 || box.height <= 0 || scale <= 0 || minimum <= 0) {
    throw new RangeError("Code dimensions, scale and minimum font size must be finite and positive.");
  }
  if (options.overflow !== void 0 && !["warn", "error"].includes(options.overflow)) throw new RangeError("Invalid code overflow policy.");
  const path = options.path ?? "code", inner = { x: box.x + 18, y: box.y + 18, width: box.width - 36, height: box.height - 36 };
  const parts = [], diagnostics = [];
  const add = (role, text, partPath, generated = false) => {
    const requestedStyle = { fontFamily: options.fonts?.code ?? "monospace", fontWeight: role === "body" ? 400 : 700, italic: false, path: partPath };
    const part = {
      role,
      path: partPath,
      text,
      sources: generated ? [] : [{ path: partPath, start: 0, end: text.length }],
      generated,
      box: { ...inner },
      requestedFontSize: Math.max((role === "body" ? 18 : 14) * scale, minimum),
      minFontSize: minimum,
      requestedStyle,
      style: resolveTextStyle({ ...requestedStyle }, options.textMeasurement)
    };
    parts.push(part);
    return part;
  };
  if (code.filename) add("filename", code.filename, `${path}.filename`);
  if (code.language) add("language", code.language, `${path}.language`);
  if (!parts.length) add("language", "code", path, true);
  const body = add("body", code.source, shorthand ? path : `${path}.source`), headers = parts.filter((part) => part !== body);
  const usable = (area) => [area.x, area.y, area.width, area.height].every(Number.isFinite) && area.width > 0 && area.height > 0;
  const fit = (part, area, size = part.requestedFontSize, floor = minimum) => usable(area) ? fitCodeText(part.text, area, size, floor, scale, textWidthMeasurer(part.style, options.textMeasurement)) : void 0;
  if (usable(inner)) {
    const combinations = headers.reduce((choices, part) => choices.flatMap((choice) => [.../* @__PURE__ */ new Set([part.requestedFontSize, minimum])].map((size) => [...choice, { part, size }])), [[]]);
    let selected;
    for (const combination of combinations) {
      let y = inner.y;
      const allocations = [];
      for (const [index, { part, size }] of combination.entries()) {
        const measured = fitCodeText(part.text, inner, size, size, scale, textWidthMeasurer(part.style, options.textMeasurement));
        const area2 = { ...inner, y, height: measured.lines.length * measured.lineHeight };
        allocations.push({ part, box: area2, fit: usable(area2) ? { ...measured, overflow: measured.sourceLines.some((line) => line.width > area2.width + 0.01) } : void 0 });
        y += area2.height + (index < headers.length - 1 ? 8 : 12);
      }
      const area = { ...inner, y, height: inner.y + inner.height - y };
      allocations.push({ part: body, box: area, fit: fit(body, area) });
      const overflow = allocations.some(({ box: box2, fit: fit2 }) => !fit2 || fit2.overflow || !usable(box2) || box2.y + box2.height > inner.y + inner.height + 0.01);
      const score = allocations.reduce((sum, { part, fit: fit2 }) => sum + (part.requestedFontSize - (fit2?.fontSize ?? minimum)) / scale, 0);
      if (!selected || !overflow && (selected.overflow || score < selected.score) || overflow && selected.overflow) selected = { allocations, score, overflow };
    }
    if (selected) for (const { part, box: box2, fit: fit2 } of selected.allocations) {
      part.box = box2;
      part.fit = fit2;
    }
  }
  const report = (reason, part, roles, message) => diagnostics.push({ code: "text-overflow", reason, path: part.path, parts: roles, message });
  for (const part of parts) {
    if (!part.fit) report("invalid-part-box", part, [part.role], `Code ${part.role} has no usable space after metadata and insets; increase the cell or change the arrangement.`);
    else if (part.fit.overflow) report("text-fit", part, [part.role], `Code ${part.role} exceeds its space at the readability floor; increase its space or change the arrangement.`);
    const area = part.box;
    if (usable(area) && (area.x < box.x || area.y < box.y || area.x + area.width > box.x + box.width + 0.01 || area.y + area.height > box.y + box.height + 0.01)) {
      report("part-outside-cell", part, [part.role], `Code ${part.role} extends outside its cell; increase the cell or change the arrangement.`);
    }
  }
  for (const [index, first] of parts.entries()) {
    const second = parts[index + 1];
    if (first.fit && second?.fit && first.box.y + first.fit.lines.length * first.fit.lineHeight > second.box.y + 0.01) {
      report("part-overlap", first, [first.role, second.role], "Code part line boxes overlap; do not accept this layout without more space.");
    }
  }
  if (diagnostics.length && options.overflow === "error") throw new OPFCompositionError(diagnostics);
  return { algorithm: "code-flow-v1", textMeasurement: options.textMeasurement ? "provided" : "estimated", parts, diagnostics, overflow: diagnostics.length > 0 };
}
function fitRichText(input, box, requestedSize = 25, minFontSize = 16, options = { style: { fontFamily: "sans-serif", fontWeight: 400 } }) {
  if (![box.width, box.height, requestedSize, minFontSize].every((value) => Number.isFinite(value) && value > 0)) throw new RangeError("Rich text dimensions and font sizes must be finite and positive.");
  const layout = richTextLayouter(input, box, requestedSize, options), minimum = Math.min(requestedSize, minFontSize);
  let size = requestedSize, result = layout(size);
  while (result.overflow && size > minimum) {
    size = Math.max(minimum, size - 1);
    result = layout(size);
  }
  return result;
}
function richTextLayouter(input, box, requestedSize, options) {
  let offset = 0;
  const source = input.map((value, runIndex) => {
    const run = typeof value === "string" ? { text: value } : value;
    if (typeof run?.text !== "string" || run.fontSize !== void 0 && (!Number.isFinite(run.fontSize) || run.fontSize <= 0)) throw new RangeError("Rich text runs need text and a positive finite font size.");
    const start = offset;
    offset += run.text.length;
    const style = resolveTextStyle({ ...options.style, fontFamily: run.fontFamily ?? options.style.fontFamily, fontWeight: run.bold === void 0 ? options.style.fontWeight : run.bold ? 700 : 400, italic: run.italic ?? options.style.italic, path: options.style.path ? `${options.style.path}.${runIndex}` : void 0 }, options.textMeasurement);
    return { run, runIndex, start, end: offset, style };
  });
  const whole = source.map((entry) => entry.run.text).join("");
  const layout = (fontSize) => {
    const ratio = fontSize / requestedSize;
    const fragments = (start, end) => {
      let x = 0;
      const result = [];
      for (const entry of source) {
        const a = Math.max(start, entry.start), b = Math.min(end, entry.end);
        if (b <= a) continue;
        const text = whole.slice(a, b), normalSize = (entry.run.fontSize !== void 0 ? entry.run.fontSize * 4 / 3 : requestedSize) * ratio;
        const script = entry.run.superscript || entry.run.subscript;
        const size = normalSize * (script ? 0.7 : 1), baselineShift = entry.run.superscript ? -normalSize * 0.35 : entry.run.subscript ? normalSize * 0.2 : 0;
        const width2 = textWidthMeasurer(entry.style, options.textMeasurement)(text, size);
        result.push({ text, runIndex: entry.runIndex, start: a - entry.start, end: b - entry.start, x, width: width2, fontSize: size, baselineShift, style: entry.style, run: entry.run });
        x += width2;
      }
      return result;
    };
    const width = (start, end) => fragments(start, end).reduce((sum, fragment) => sum + fragment.width, 0);
    const ranges = [];
    let lineStart = 0, lineEnd = 0;
    const push = (end) => {
      ranges.push({ start: lineStart, end });
      lineStart = end;
      lineEnd = end;
    };
    for (const match of whole.matchAll(/\r\n|\r|\n|[^\S\r\n]+|[^\s]+/gu)) {
      const start = match.index, end = start + match[0].length;
      if (/^[\r\n]/.test(match[0])) {
        push(start);
        lineStart = end;
        lineEnd = end;
        continue;
      }
      if (width(lineStart, end) <= box.width) {
        lineEnd = end;
        continue;
      }
      if (lineEnd > lineStart) push(start);
      if (width(start, end) <= box.width) {
        lineEnd = end;
        continue;
      }
      for (const { segment, index } of textSegments.segment(match[0])) {
        const next = start + index + segment.length;
        if (lineEnd > lineStart && width(lineStart, next) > box.width) push(start + index);
        lineEnd = next;
      }
    }
    ranges.push({ start: lineStart, end: lineEnd });
    let y = 0;
    const richLines = ranges.map((range) => {
      const parts = fragments(range.start, range.end), ascent = Math.max(fontSize, ...parts.map((part) => part.fontSize - part.baselineShift)), descent = Math.max(fontSize * 0.22, ...parts.map((part) => part.fontSize * 0.22 + part.baselineShift));
      const height = ascent + descent, line = { fragments: parts, width: parts.reduce((sum, p) => sum + p.width, 0), y, baseline: y + ascent, height };
      y += height;
      return line;
    });
    if (options.uniformLineHeight) {
      const height = Math.max(...richLines.map((line) => line.height));
      y = 0;
      for (const line of richLines) {
        line.baseline += y - line.y;
        line.y = y;
        line.height = height;
        y += height;
      }
    }
    return { lines: ranges.map((range) => whole.slice(range.start, range.end)), fontSize, lineHeight: Math.max(fontSize * 1.22, ...richLines.map((line) => line.height)), richLines, height: y, overflow: y > box.height + 0.01 || richLines.some((line) => line.width > box.width + 0.01) };
  };
  return layout;
}
function fitList(input, box, requestedSize = 25, minFontSize = 16, options = { style: { fontFamily: "sans-serif", fontWeight: 400 } }) {
  if (!Array.isArray(input) || ![box.width, box.height, requestedSize, minFontSize].every((value) => Number.isFinite(value) && value > 0)) throw new RangeError("List content, dimensions and font sizes must be valid.");
  const source = input.map((value, index) => {
    const object = typeof value === "object" && !Array.isArray(value) ? value : void 0;
    const text = object ? object.text : value, description = object?.description, level = object?.level ?? 0;
    if (!Number.isInteger(level) || level < 0) throw new RangeError("List levels must be nonnegative integers.");
    const runs = (value2) => typeof value2 === "string" ? [value2] : value2;
    if (!Array.isArray(runs(text)) || description !== void 0 && !Array.isArray(runs(description))) throw new TypeError("List text and descriptions must be strings or text runs.");
    const base = options.style.path ? `${options.style.path}.${index}` : void 0;
    return { index, level, value: text, descriptionValue: description, textPath: base ? base + (object ? ".text" : "") : void 0, descriptionPath: base ? base + ".description" : void 0, runs: runs(text), descriptionRuns: description === void 0 ? void 0 : runs(description) };
  });
  const layout = (fontSize) => {
    let y = box.y, overflow = false;
    const entries = [], lines = [];
    for (const item of source) {
      const indent = fontSize * 1.1, offset = Math.min(box.width, item.level * indent), x = box.x + offset + indent, width = Math.max(1, box.x + box.width - x);
      if (offset + indent >= box.width) overflow = true;
      const textBox = { x, y, width, height: box.height };
      const style = { ...options.style, path: item.textPath };
      const text = richTextLayouter(item.runs, textBox, requestedSize, { ...options, style })(fontSize);
      textBox.height = text.height;
      lines.push(...text.lines);
      y += text.height;
      let description, descriptionBox;
      if (item.descriptionRuns !== void 0) {
        y += fontSize * 0.12;
        descriptionBox = { x, y, width, height: box.height };
        description = richTextLayouter(item.descriptionRuns, descriptionBox, requestedSize * 0.82, { ...options, style: { ...options.style, path: item.descriptionPath } })(fontSize * 0.82);
        descriptionBox.height = description.height;
        lines.push(...description.lines);
        y += description.height;
      }
      overflow ||= text.overflow || !!description?.overflow;
      entries.push({
        index: item.index,
        level: item.level,
        value: item.value,
        descriptionValue: item.descriptionValue,
        textPath: item.textPath,
        descriptionPath: item.descriptionPath,
        text,
        textBox,
        description,
        descriptionBox,
        marker: { text: ["\u2022", "\u25E6", "\u25AA"][item.level % 3], x: box.x + offset, y: textBox.y + (text.richLines[0]?.baseline ?? fontSize), fontSize, style: resolveTextStyle(style, options.textMeasurement), indent }
      });
      if (item.index < source.length - 1) y += fontSize * 0.28;
    }
    const height = y - box.y;
    return { listEntries: entries, lines, fontSize, lineHeight: fontSize * 1.22, height, overflow: overflow || height > box.height + 0.01 };
  };
  const minimum = Math.min(requestedSize, minFontSize);
  let size = requestedSize, result = layout(size);
  while (result.overflow && size > minimum) {
    size = Math.max(minimum, size - 1);
    result = layout(size);
  }
  return result;
}
function contentText(field, value) {
  if (field === "text" || headings.has(field)) return flatten(value);
  if (field === "items" || field === "bullets") return (Array.isArray(value) ? value : [value]).map((item) => {
    const entry = record2(item);
    return `\u2022 ${flatten(item)}${entry.description ? `
${flatten(entry.description)}` : ""}`;
  }).join("\n");
  if (field === "code") return flatten(record2(value).source ?? value);
  if (field === "quote") return flatten(record2(value).text ?? value);
  return void 0;
}
function layoutTable(value, box, options = {}) {
  const scale = options.scale ?? 1, requested = 15 * scale, minimum = (options.minFontSize ?? 16) * scale;
  if (![box.x, box.y, box.width, box.height, scale, minimum].every(Number.isFinite) || box.width <= 0 || box.height <= 0 || scale <= 0 || minimum <= 0) throw new RangeError("Table dimensions, scale and font sizes must be finite and positive.");
  const grid = tableGrid(value, options.path ?? "table");
  if (grid.issues.length) throw new RangeError(`${grid.issues[0].path}: ${grid.issues[0].message}`);
  const columnCount = grid.columnCount, cellWidth = box.width / columnCount;
  const cells = grid.rows.flat().map((cell) => {
    const padding = { top: 8, right: 10, bottom: 4, left: 10, ...cell.style.padding };
    const width = cellWidth * cell.colSpan - (padding.left + padding.right) * scale;
    const style = { fontFamily: options.fontFamily ?? "sans-serif", fontWeight: cell.header ? 700 : 400, italic: false, path: cell.valuePath };
    return { ...cell, padding, width, textStyle: style };
  });
  const fitCell = (cell, height, min) => {
    const textBox = { width: Math.max(scale, cell.width), height: Math.max(scale, height) };
    return Array.isArray(cell.value) ? fitRichText(cell.value, textBox, requested, min, { style: cell.textStyle, textMeasurement: options.textMeasurement, uniformLineHeight: true }) : fitText(flatten(cell.value), textBox, requested, min, textWidthMeasurer(resolveTextStyle(cell.textStyle, options.textMeasurement), options.textMeasurement));
  };
  const textHeight = (fit) => "height" in fit ? fit.height : fit.lines.length * fit.lineHeight;
  const required = (cell, size) => textHeight(fitCell(cell, scale, size)) + (cell.padding.top + cell.padding.bottom) * scale;
  const natural = Array(grid.rowCount).fill(0), needed = Array(grid.rowCount).fill(0);
  for (const cell of cells) if (cell.rowSpan === 1) {
    natural[cell.row] = Math.max(natural[cell.row], required(cell, requested));
    needed[cell.row] = Math.max(needed[cell.row], required(cell, minimum));
  }
  for (const cell of cells) if (cell.rowSpan > 1) for (const [heights2, size] of [[natural, requested], [needed, minimum]]) {
    const current = heights2.slice(cell.row, cell.row + cell.rowSpan).reduce((a, b) => a + b, 0);
    const extra = Math.max(0, required(cell, size) - current) / cell.rowSpan;
    for (let r = cell.row; r < cell.row + cell.rowSpan; r++) heights2[r] += extra;
  }
  const preferred = natural.map((height) => Math.max(54 * scale, height));
  for (let r = 0; r < needed.length; r++) needed[r] = Math.min(preferred[r], needed[r]);
  const sum = (values) => values.reduce((a, b) => a + b, 0);
  const preferredTotal = sum(preferred), naturalTotal = sum(natural), neededTotal = sum(needed);
  const heights = preferred.map((height, r) => preferredTotal <= box.height ? height : naturalTotal <= box.height ? natural[r] + (height - natural[r]) * (box.height - naturalTotal) / Math.max(Number.EPSILON, preferredTotal - naturalTotal) : neededTotal <= box.height ? needed[r] + (natural[r] - needed[r]) * (box.height - neededTotal) / Math.max(Number.EPSILON, naturalTotal - neededTotal) : needed[r] * box.height / neededTotal);
  const ys = [box.y];
  for (const height of heights) ys.push(ys.at(-1) + height);
  let overflow = false;
  const rows2 = heights.map((height, r) => ({ box: { x: box.x, y: ys[r], width: box.width, height }, cells: [] }));
  for (const cell of cells) {
    const cellBox = { x: box.x + cell.column * cellWidth, y: ys[cell.row], width: cell.colSpan * cellWidth, height: ys[cell.row + cell.rowSpan] - ys[cell.row] };
    const available = cellBox.height - (cell.padding.top + cell.padding.bottom) * scale;
    const fit = fitCell(cell, available, minimum), height = textHeight(fit);
    const offset = cell.style.verticalAlign === "bottom" ? Math.max(0, available - height) : cell.style.verticalAlign === "middle" ? Math.max(0, (available - height) / 2) : 0;
    const textBox = { x: cellBox.x + cell.padding.left * scale, y: cellBox.y + cell.padding.top * scale + offset, width: Math.max(scale, cell.width), height: Math.max(scale, available - offset) };
    overflow ||= cell.width <= 0 || available <= 0 || fit.overflow;
    rows2[cell.row].cells.push({ value: cell.value, input: cell.input, path: cell.valuePath, sourcePath: cell.path, style: cell.style, row: cell.row, column: cell.column, rowSpan: cell.rowSpan, colSpan: cell.colSpan, header: cell.header, rich: Array.isArray(cell.value), box: cellBox, textBox, textStyle: resolveTextStyle(cell.textStyle, options.textMeasurement), fit });
  }
  return { rows: rows2, columnCount, height: sum(heights), overflow };
}
function tableOverflows(value, box, scale, settings, options, path) {
  return box.width <= 0 || box.height <= 0 || layoutTable(value, box, { scale, minFontSize: settings.minFontSize, fontFamily: options.fonts?.body, textMeasurement: options.textMeasurement, path }).overflow;
}
function flatten(value) {
  if (value == null) return "";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return value.map(flatten).join("");
  const item = record2(value);
  return flatten(item.text ?? item.value ?? item.source ?? JSON.stringify(value));
}
function regionParts(key) {
  const span = (part, order) => {
    const indices = part.split("+").map((value) => order.indexOf(value));
    return indices.every((index) => index >= 0) ? indices : void 0;
  };
  const parts = key.split(":");
  if (parts.length === 2) {
    const r = span(parts[0], rows), c = span(parts[1], columns);
    if (r && c) return [r, c];
  } else if (parts.length === 1) {
    const r = span(key, rows), c = span(key, columns);
    if (r) return [r, [0, 1, 2]];
    if (c) return [[0, 1, 2], c];
  }
  return void 0;
}
function regionBox(parts, area, requestedGap) {
  const gap = Math.min(requestedGap, area.width / 6, area.height / 6);
  const cw = (area.width - gap * 2) / 3, ch = (area.height - gap * 2) / 3;
  const [r, c] = parts;
  return { x: area.x + Math.min(...c) * (cw + gap), y: area.y + Math.min(...r) * (ch + gap), width: (Math.max(...c) - Math.min(...c) + 1) * (cw + gap) - gap, height: (Math.max(...r) - Math.min(...r) + 1) * (ch + gap) - gap };
}
function gridGeometry(count, area, cols, gap, weights, vertical) {
  const rowCount = Math.ceil(count / cols);
  gap = Math.min(gap, area.width / (cols * 2), area.height / (rowCount * 2));
  const tracks = (length, total, weighted) => {
    const values = Array.from({ length }, (_, i) => weighted ? weights[i] ?? 1 : 1);
    const sum = values.reduce((a, b) => a + b, 0);
    let cursor = 0;
    return values.map((weight) => {
      const size = (total - gap * (length - 1)) * weight / sum;
      const track = { offset: cursor, size };
      cursor += size + gap;
      return track;
    });
  };
  const xs = tracks(cols, area.width, !vertical), ys = tracks(rowCount, area.height, vertical);
  const boxes = Array.from({ length: count }, (_, i) => ({ x: area.x + xs[i % cols].offset, y: area.y + ys[Math.floor(i / cols)].offset, width: xs[i % cols].size, height: ys[Math.floor(i / cols)].size }));
  return { boxes, columns: xs, rows: ys, gap };
}
function gridBoxes(count, area, cols, gap, weights, vertical) {
  return gridGeometry(count, area, cols, gap, weights, vertical).boxes;
}
function assertComposition(value) {
  if (value.mode !== void 0 && !["auto", "grid", "row", "column"].includes(value.mode)) throw new RangeError("Unknown composition mode.");
  for (const [key, min, max] of [["gap", 0, 0.1], ["padding", 0, 0.2], ["minFontSize", 8, 32], ["columns", 1, 12]]) {
    const number = value[key];
    if (number !== void 0 && (!Number.isFinite(number) || number < min || number > max || key === "columns" && !Number.isInteger(number))) throw new RangeError(`Invalid composition.${key}.`);
  }
  if (value.weights !== void 0 && (!Array.isArray(value.weights) || !value.weights.length || value.weights.length > 12 || value.weights.some((weight) => !Number.isFinite(weight) || weight <= 0 || weight > 100))) throw new RangeError("Invalid composition.weights.");
  if (value.overflow !== void 0 && !["warn", "error"].includes(value.overflow)) throw new RangeError("Invalid composition.overflow.");
}
function composeSlide(input, options = {}) {
  const slide = record2(input), layout = record2(options.layout);
  const width = options.width ?? 1280, height = options.height ?? 720;
  if (![width, height].every((value) => Number.isFinite(value) && value > 0)) throw new RangeError("Canvas dimensions must be finite and positive.");
  const scale = Math.min(width, height) / 720;
  const hasCards = record2(slide.design).contentBox ?? options.contentBox ?? false;
  const composition = { ...record2(layout.composition), ...record2(slide.composition) };
  assertComposition(composition);
  const padding = (composition.padding ?? 0.08) * Math.min(width, height);
  const gap = (composition.gap ?? 1 / 30) * Math.min(width, height);
  const minSize = (composition.minFontSize ?? 16) * scale;
  const rasterPadding = (options.textRasterPadding ?? 1) * scale;
  if (!Number.isFinite(rasterPadding) || rasterPadding < 0) throw new RangeError("Text raster padding must be finite and nonnegative.");
  const styleFor = (field, path2) => resolveTextStyle({
    fontFamily: (field === "title" ? options.fonts?.heading : field === "code" ? options.fonts?.code : options.fonts?.body) ?? (field === "code" ? "monospace" : "sans-serif"),
    fontWeight: field === "title" ? 700 : 400,
    path: path2
  }, options.textMeasurement);
  const widthFor = (field, path2) => textWidthMeasurer(styleFor(field, path2), options.textMeasurement);
  const fitPlacedText = (field, value, text, box, size, minimum, path2) => {
    const style = styleFor(field, path2), rich = field === "text" && Array.isArray(value);
    if (!options.textMeasurement?.outlineBounds) return rich ? fitRichText(value, box, size, minimum, { style, textMeasurement: options.textMeasurement }) : fitText(text, box, size, minimum, textWidthMeasurer(style, options.textMeasurement));
    const alignment = (field === "title" ? record2(slide.design).titleAlignment ?? options.titleAlignment : record2(slide.design).contentAlignment ?? options.contentAlignment) ?? "left";
    const richLayout = rich ? richTextLayouter(value, box, size, { style, textMeasurement: options.textMeasurement }) : void 0;
    const measure = textWidthMeasurer(style, options.textMeasurement), floor = Math.min(size, minimum);
    for (let trial = 0; trial <= 64; trial++) {
      const fontSize = trial === 64 ? floor : Math.max(floor, size - trial * scale);
      const fit = richLayout ? richLayout(fontSize) : fitText(text, box, fontSize, fontSize, measure);
      const richLines = "richLines" in fit ? fit.richLines : void 0;
      const lines = richLines ? richLines.map((line) => {
        let outline = null;
        for (const fragment of line.fragments) {
          const bounds = measureTextOutline(fragment.text, fragment.fontSize, fragment.style, options.textMeasurement);
          if (!bounds) continue;
          const next = { ...bounds, x: fragment.x + bounds.x, y: fragment.baselineShift + bounds.y };
          if (!outline) outline = next;
          else {
            const right = Math.max(outline.x + outline.width, next.x + next.width), bottom = Math.max(outline.y + outline.height, next.y + next.height);
            outline.x = Math.min(outline.x, next.x);
            outline.y = Math.min(outline.y, next.y);
            outline.width = right - outline.x;
            outline.height = bottom - outline.y;
          }
        }
        return { width: line.width, y: line.y, baseline: line.baseline, height: line.height, outline };
      }) : fit.lines.map((line, index) => ({ width: measure(line, fontSize), y: index * fit.lineHeight, baseline: fontSize + index * fit.lineHeight, height: fit.lineHeight, outline: measureTextOutline(line, fontSize, style, options.textMeasurement) ?? null }));
      const placement = placeTextLines(lines, box, alignment, rasterPadding), result = { ...fit, placement, overflow: fit.overflow || placement.overflow };
      if (!result.overflow || fontSize === floor) return result;
    }
    throw new Error("Text placement did not evaluate its bounded floor trial.");
  };
  const fitContent = (field, value, text, box, size, minimum, path2) => field === "text" ? fitPlacedText(field, value, text, box, size, minimum, path2) : field === "items" || field === "bullets" ? fitList(value, box, size, minimum, { style: styleFor(field, path2), textMeasurement: options.textMeasurement }) : fitText(text, box, size, minimum, widthFor(field, path2));
  const path = `slides.${options.slideIndex ?? 0}`;
  const items = [], diagnostics = [];
  let y = padding;
  for (const field of ["tag", "title", "subtitle"]) {
    if (!slide[field]) continue;
    const requested = (field === "title" ? 54 : field === "tag" ? 16 : 25) * scale;
    const maxHeight = height * (field === "title" ? 0.26 : field === "subtitle" ? 0.12 : 0.045);
    const box = { x: padding, y, width: width - padding * 2, height: maxHeight };
    const text = fitPlacedText(field, slide[field], String(slide[field]), box, requested, minSize, `${path}.${field}`);
    box.height = Math.min(maxHeight, Math.max(text.lines.length * text.lineHeight, text.placement?.height ?? 0));
    items.push({ path: `${path}.${field}`, field, type: "text", value: slide[field], payload: { text: slide[field] }, box, text, textStyle: styleFor(field, `${path}.${field}`), composition });
    y += box.height + gap * 0.5;
  }
  if (items.length) y += gap * 0.5;
  const contentBox = { x: padding, y, width: width - padding * 2, height: Math.max(scale, height - padding - y) };
  const collect = (host, basePath, depth = 0, ancestors = []) => {
    if (Array.isArray(host.blocks)) {
      if (depth >= MAX_COMPOSITION_DEPTH || ancestors.includes(host)) throw new RangeError(`Content groups must be acyclic and nest at most ${MAX_COMPOSITION_DEPTH} levels.`);
      const settings = record2(host.composition);
      assertComposition(settings);
      return [{
        field: "blocks",
        type: "group",
        value: host.blocks,
        path: basePath,
        payload: host,
        composition: settings,
        children: host.blocks.flatMap((block, index) => collect(record2(block), `${basePath}.blocks.${index}`, depth + 1, [...ancestors, host]))
      }];
    }
    return fields.filter((field) => host[field] !== void 0).map((field) => ({ field, type: host.type ?? kind(field), value: host[field], path: `${basePath}.${field}`, payload: { type: host.type ?? kind(field), [field]: host[field] } }));
  };
  const regions = Object.keys(slide).filter((key) => regionParts(key)).sort();
  const pending = regions.length ? regions.flatMap((key) => collect(record2(slide[key]), `${path}.${key}`).map((item) => ({ ...item, region: regionParts(key) }))) : Array.isArray(slide.blocks) ? slide.blocks.flatMap((block, index) => collect(record2(block), `${path}.blocks.${index}`)) : collect(slide, path);
  const groups = [], flows = [];
  const decisions = options.explain ? [] : void 0;
  const inheritedSettings = (parent, own = {}) => ({
    minFontSize: parent.minFontSize,
    ...own,
    overflow: parent.overflow === "error" ? "error" : own.overflow ?? parent.overflow
  });
  const inset = (box, settings) => {
    const amount = (settings.padding ?? 0) * Math.min(box.width, box.height);
    return { x: box.x + amount, y: box.y + amount, width: box.width - amount * 2, height: box.height - amount * 2 };
  };
  const acceptedBox = (box) => ({ x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) });
  const payloadBox = (box) => {
    if (!hasCards) return box;
    const frame = acceptedBox(box), padding2 = Math.min(12 * scale, frame.width / 4, frame.height / 4);
    return acceptedBox({ x: frame.x + padding2, y: frame.y + padding2, width: frame.width - 2 * padding2, height: frame.height - 2 * padding2 });
  };
  const measureQuote = (node, box, settings) => layoutQuote(node.value, acceptedBox(box), {
    fonts: options.fonts,
    textMeasurement: options.textMeasurement,
    scale,
    minFontSize: settings.minFontSize,
    path: node.path
  });
  const measureCode = (node, box, settings) => layoutCode(node.value, acceptedBox(box), {
    fonts: options.fonts,
    textMeasurement: options.textMeasurement,
    scale,
    minFontSize: settings.minFontSize,
    path: node.path
  });
  const measureMetric = (node, box, settings) => layoutMetric(node.value, acceptedBox(box), {
    fonts: options.fonts,
    textMeasurement: options.textMeasurement,
    scale,
    minFontSize: settings.minFontSize,
    path: node.path,
    align: record2(slide.design).contentAlignment ?? options.contentAlignment
  });
  const leafScore = (node, box, settings, penalties) => {
    box = payloadBox(box);
    const text = contentText(node.field, node.value);
    let score = Math.abs(Math.log(box.width / box.height / 1.6));
    if (penalties) penalties.cellProportions += score;
    if (node.field === "quote" || node.field === "code" || node.field === "metric") {
      const internal = node.field === "quote" ? measureQuote(node, box, settings) : node.field === "code" ? measureCode(node, box, settings) : measureMetric(node, box, settings);
      const reduction = internal.parts.reduce((sum, part) => sum + (part.fit ? (part.requestedFontSize - part.fit.fontSize) / scale : 0), 0);
      score += reduction + (internal.overflow ? 1e3 : 0);
      if (penalties) {
        penalties.fontReduction += reduction;
        penalties.textOverflow += internal.overflow ? 1e3 : 0;
      }
    } else if (text) {
      const fit = fitContent(node.field, node.value, text, box, 25 * scale, (settings.minFontSize ?? 16) * scale, node.path);
      const reduction = (25 * scale - fit.fontSize) / scale;
      score += reduction + (fit.overflow ? 1e3 : 0);
      if (penalties) {
        penalties.fontReduction += reduction;
        penalties.textOverflow += fit.overflow ? 1e3 : 0;
      }
    }
    if (node.field === "table" && tableOverflows(node.value, box, scale, settings, options, node.path)) {
      score += 1e3;
      if (penalties) penalties.tableOverflow += 1e3;
    }
    if (box.width < 100 * scale || box.height < 60 * scale) {
      score += 100;
      if (penalties) penalties.smallCells += 100;
    }
    return score;
  };
  const modeFor = (settings) => settings.mode ?? "auto";
  const defaultColumns = (count, area, settings) => {
    const mode = modeFor(settings);
    return mode === "column" ? 1 : mode === "row" ? Math.max(1, count) : settings.columns ?? Math.max(1, Math.min(count, Math.ceil(Math.sqrt(count * area.width / area.height / 1.6))));
  };
  const scoreNode = (node, box, settings, penalties) => {
    if (!node.children) return leafScore(node, box, settings, penalties);
    const own = inheritedSettings(settings, node.composition), area = inset(box, own);
    const cols = defaultColumns(node.children.length, area, own);
    const boxes = gridBoxes(node.children.length, area, cols, (own.gap ?? 1 / 30) * Math.min(box.width, box.height), own.weights ?? [], modeFor(own) === "column");
    return node.children.reduce((score, child, index) => score + scoreNode(child, boxes[index], own, penalties), 0);
  };
  const arrange = (nodes, area, settings, reserved = 0, gapOverride, containerPath = path) => {
    const count = Math.max(nodes.length, reserved);
    if (!count) return;
    const mode = modeFor(settings), localGap = (settings.gap ?? 1 / 30) * Math.min(area.width, area.height);
    const actualGap = gapOverride ?? (settings === rootSettings ? gap : localGap);
    let cols = defaultColumns(count, area, settings);
    const hasRegions = nodes.some((node) => node.region);
    const candidates = decisions ? [] : void 0;
    if (mode === "auto" && !hasRegions) {
      let best = Infinity;
      for (let candidate = 1; candidate <= Math.min(count, settings.columns ?? 6); candidate++) {
        const boxes2 = gridBoxes(count, area, candidate, actualGap, settings.weights ?? [], false);
        const emptySlots = (Math.ceil(count / candidate) * candidate - count) * 2;
        const penalties = candidates ? { cellProportions: 0, fontReduction: 0, textOverflow: 0, tableOverflow: 0, smallCells: 0, emptySlots } : void 0;
        const score = nodes.reduce((sum, node, i) => sum + scoreNode(node, boxes2[i], settings, penalties), 0) + emptySlots;
        if (penalties && candidates) candidates.push({ columns: candidate, rows: Math.ceil(count / candidate), score, penalties });
        if (score < best) {
          best = score;
          cols = candidate;
        }
      }
    }
    decisions?.push({
      path: containerPath,
      mode: hasRegions ? "regions" : mode,
      reason: hasRegions ? "promoted-regions" : mode === "auto" ? "lowest-score" : "configured-mode",
      ...hasRegions ? {} : { selectedColumns: cols },
      candidates: candidates ?? []
    });
    const grid = gridGeometry(count, area, cols, actualGap, settings.weights ?? [], mode === "column");
    const boxes = grid.boxes;
    if (!nodes.some((node) => node.region)) flows.push({ path: containerPath, box: { ...area }, composition: { ...settings }, columns: grid.columns, rows: grid.rows, gap: grid.gap, itemCount: nodes.length, slotCount: count });
    nodes.forEach((node, index) => {
      let box = node.region ? regionBox(node.region, area, actualGap) : boxes[index];
      if (node.children) {
        const own = inheritedSettings(settings, node.composition), inner = inset(box, own);
        groups.push({ path: node.path, box, contentBox: inner, composition: own });
        arrange(node.children, inner, own, 0, (own.gap ?? 1 / 30) * Math.min(box.width, box.height), node.path);
      } else {
        const frameBox = hasCards ? acceptedBox(box) : void 0;
        box = payloadBox(box);
        const textValue = contentText(node.field, node.value);
        const quoteLayout = node.field === "quote" ? measureQuote(node, box, settings) : void 0;
        const codeLayout = node.field === "code" ? measureCode(node, box, settings) : void 0;
        const metricLayout = node.field === "metric" ? measureMetric(node, box, settings) : void 0;
        const internal = quoteLayout ?? codeLayout ?? metricLayout, body = internal?.parts.find((part) => part.role === "body" || part.role === "value");
        const text = internal ? body?.fit : textValue !== void 0 ? fitContent(node.field, node.value, textValue, box, 25 * scale, (settings.minFontSize ?? 16) * scale, node.path) : void 0;
        items.push({
          path: node.path,
          field: node.field,
          type: node.type,
          value: node.value,
          payload: node.payload,
          box: internal ? acceptedBox(box) : box,
          ...frameBox ? { frameBox } : {},
          text,
          textStyle: body?.style ?? styleFor(node.field, node.path),
          composition: settings,
          ...quoteLayout ? { quoteLayout } : {},
          ...codeLayout ? { codeLayout } : {},
          ...metricLayout ? { metricLayout } : {}
        });
        if (box.width < 100 * scale || box.height < 60 * scale) diagnostics.push({ code: "small-cell", path: node.path, message: "Content cell is too small for comfortable reading; use fewer blocks or a different composition." });
      }
    });
  };
  const placeholders = Array.isArray(layout.placeholders) ? layout.placeholders.filter((p) => !headings.has(p.type)) : [];
  const rootSettings = { ...composition, mode: composition.mode ?? (layout.slideLayoutDirection === "Vertical" ? "column" : layout.slideLayoutDirection === "Horizontal" ? "row" : "auto") };
  arrange(pending, contentBox, rootSettings, composition.mode ? 0 : placeholders.length);
  for (const item of items) {
    for (const key of ["x", "y", "width", "height"]) item.box[key] = round(item.box[key]);
    if (item.field === "table" && tableOverflows(item.value, item.box, scale, item.composition, options, item.path)) diagnostics.push({ code: "text-overflow", path: item.path, message: "Table cells do not fit; use fewer rows, fewer columns, or split the table across slides." });
    if (item.quoteLayout) diagnostics.push(...item.quoteLayout.diagnostics);
    else if (item.codeLayout) diagnostics.push(...item.codeLayout.diagnostics);
    else if (item.metricLayout) diagnostics.push(...item.metricLayout.diagnostics);
    else if (item.text?.overflow) diagnostics.push({ code: "text-overflow", path: item.path, message: "Text exceeds its cell at the minimum font size; shorten it, increase its space, or split the slide." });
  }
  for (const group of groups) for (const box of [group.box, group.contentBox]) for (const key of ["x", "y", "width", "height"]) box[key] = round(box[key]);
  const strictPaths = new Set(items.filter((item) => item.composition.overflow === "error").map((item) => item.path));
  const failures = diagnostics.filter((diagnostic) => {
    let path2 = diagnostic.path;
    while (path2) {
      if (strictPaths.has(path2)) return true;
      const boundary = path2.lastIndexOf(".");
      if (boundary < 0) break;
      path2 = path2.slice(0, boundary);
    }
    return false;
  });
  const explanation = decisions ? {
    algorithm: "grid-score-v6",
    textMeasurement: options.textMeasurement ? "provided" : "estimated",
    textOutlines: options.textMeasurement?.outlineBounds ? "provided" : "unavailable",
    textRasterPadding: rasterPadding,
    decisions,
    unmeasuredPayloads: items.filter((item) => !headings.has(item.field) && !item.quoteLayout && !item.codeLayout && !item.metricLayout && !["text", "items", "bullets", "table"].includes(item.field)).map((item) => item.path)
  } : void 0;
  if (failures.length) throw new OPFCompositionError(failures, explanation);
  return { width, height, contentBox, items, groups, flows, diagnostics, composition, ...explanation ? { explanation } : {} };
}
function resolveCanvasDimensions(input) {
  const presets = {
    widescreen: [40 / 3, 7.5],
    "16:9": [40 / 3, 7.5],
    standard: [10, 7.5],
    "4:3": [10, 7.5],
    "16:10": [10, 6.25],
    letter: [11, 8.5],
    a4: [11.69, 8.27]
  };
  const value = record2(input);
  const preset = presets[typeof input === "string" ? input : value.preset] ?? presets.widescreen;
  const width = (value.widthInches ?? preset[0]) * 96;
  const height = (value.heightInches ?? preset[1]) * 96;
  if (![width, height].every((n) => Number.isFinite(n) && n > 0)) throw new RangeError("Canvas dimensions must be finite and positive.");
  return { width, height };
}

export { MAX_COMPOSITION_DEPTH, OPFCompositionError, chartColorForFill, colorContrast, composeSlide, fitList, fitRichText, fitText, layoutCode, layoutMetric, layoutQuote, layoutTable, measureText, measureTextOutline, placeTextLines, resolveCanvasDimensions, resolveFontFamilies, resolveTextStyle, tableGrid, tableRowBoundaries, textColorForFill, textWidthMeasurer, wrapText };
