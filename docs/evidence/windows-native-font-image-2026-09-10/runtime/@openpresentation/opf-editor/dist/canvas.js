import {
  createEditorSession,
  opfPathToJsonPointer,
  applyJsonPatch,
  validateOpfDocument,
  getValueAtPath,
  splitOpfPath,
} from "./index.js";
import {
  renderSvg,
  resolvePresentation,
} from "@openpresentation/opf-render/svg";
import {
  getEditableFields,
  parseCanvasValue,
  createCanvasDraft,
} from "./canvas-fields.js";
import { createBlockControls } from "./block-controls.js";
import { createLayoutHandles } from "./layout-handles.js";
import { createRichTextInput } from "./rich-text-input.js";
import { createRichTextToolbar } from "./rich-text-toolbar.js";
export { getEditableFields } from "./canvas-fields.js";

/** A framework-independent SVG canvas. Drafts render immediately; each edit commits once. */
export function createCanvasEditor(container, options = {}) {
  if (!container?.ownerDocument)
    throw new TypeError("A DOM container is required.");
  const doc = container.ownerDocument,
    win = doc.defaultView;
  const editor =
    options.editor ??
    createEditorSession(options.document, { rejectInvalid: true });
  let slideIndex = options.slideIndex ?? 0,
    renderOptions = options.renderOptions ?? {},
    active = null,
    selectedPath = null,
    disposed = false,
    frame = 0,
    committing = false;
  const root = doc.createElement("div"),
    preview = doc.createElement("div"),
    overlay = doc.createElement("div"),
    notice = doc.createElement("div");
  root.className = "opf-canvas";
  root.style.cssText = "position:relative;width:100%;isolation:isolate";
  preview.className = "opf-canvas-preview";
  overlay.className = "opf-canvas-overlay";
  overlay.style.cssText = "position:absolute;inset:0;pointer-events:none";
  notice.setAttribute("role", "status");
  notice.style.cssText =
    "position:absolute;left:8px;bottom:8px;max-width:calc(100% - 16px);font:12px/1.4 system-ui;background:#fff8ed;color:#875217;border:1px solid #ead5b3;border-radius:5px;padding:6px 10px;z-index:4";
  notice.hidden = true;
  const style = doc.createElement("style");
  style.textContent =
    ".opf-canvas-preview>svg{display:block;width:100%;height:auto}.opf-canvas [data-canvas-target]{cursor:text}.opf-canvas .opf-inline-input::selection{background:#8975d933;color:var(--opf-inline-selection-color,transparent)}.opf-canvas [data-canvas-target]:focus{outline:none}.opf-canvas [data-canvas-target]:hover>.opf-selection{stroke:#9c90df}.opf-canvas [data-canvas-selected]>.opf-selection,.opf-canvas [data-canvas-target]:focus-visible>.opf-selection{stroke:#7765d0}.opf-canvas button:focus-visible,.opf-canvas textarea:focus-visible,.opf-canvas input:focus-visible{outline:2px solid #8170d5;outline-offset:2px}";
  root.append(style, preview, overlay, notice);
  container.replaceChildren(root);
  const report = (error) => {
    notice.hidden = false;
    notice.textContent = error.message;
    options.onError?.(error);
  };
  const clearNotice = () => {
    notice.hidden = true;
    notice.textContent = "";
  };
  const richToolbar = createRichTextToolbar(root, { editor, report, beforeChange: commit,
    onTyping: beginEdit,
    onProperties(path) { if (commit()) openProperties(path, editor.get(path)); },
    validateChange(path, value) {
      renderSvg(createCanvasDraft(editor.document, path, value), {...renderOptions, slideIndex});
    },
    onChange(path) { clearNotice(); options.onCommit?.({path, editor}); }
  });
  const layoutHandles = createLayoutHandles(root, {
    editor, enabled: options.layoutEditing, render, beforeEdit: commit,
    isTextEditing: () => !!active,
    clearError: clearNotice, onError: report,
    onDraft: value => options.onDraft?.(value),
    onCommit: value => options.onCommit?.(value),
    onCancel: value => { clearNotice(); options.onCancel?.(value); },
  });
  const blockControls = createBlockControls(root, {
    editor, render, beforeEdit: () => {if(!commit())return false;richToolbar.hide();return true;}, enabled: () => layoutHandles.enabled,
    isEditing: () => !!active || !!layoutHandles.editingPath, slideIndex: () => slideIndex,
    validate: document => renderSvg(document, {...renderOptions, slideIndex}),
    clearError: clearNotice, onError: report,
    onMove: path => choose(splitOpfPath(path).join(".")),
    onCommit: value => options.onCommit?.(value),
  });
  function targets() {
    return [...preview.querySelectorAll("[data-canvas-target]")];
  }
  function getTarget(path) {
    return targets().find(
      (node) => node.getAttribute("data-opf-path") === path,
    );
  }
  function choose(path) {
    selectedPath = path;
    for (const node of targets())
      node.toggleAttribute(
        "data-canvas-selected",
        node.getAttribute("data-opf-path") === path,
      );
    options.onSelect?.({
      path,
      value: editor.get(path),
      element: getTarget(path),
      editor,
    });
  }
  function render(document = editor.document) {
    if (disposed) return;
    const slides = document.slides ?? [];
    slideIndex = Math.max(0, Math.min(slideIndex, slides.length - 1));
    const svgText = renderSvg(document, {
      ...renderOptions,
      slideIndex,
      trace: true,
    });
    preview.innerHTML = svgText;
    const svg = preview.querySelector("svg");
    svg.setAttribute("role", "group");
    svg.setAttribute("aria-label", "Editable slide");
    svg.removeAttribute("aria-labelledby");
    const geometry = resolvePresentation(document, renderOptions).slides[
      slideIndex
    ].geometry;
    const candidates = [...svg.querySelectorAll("[data-opf-path]")];
    const seen = new Set();
    for (const node of candidates) {
      const path = node.getAttribute("data-opf-path");
      const item = geometry.items.find((item) => item.path === path);
      const value = getValueAtPath(document, path);
      if (
        seen.has(path) ||
        node.getAttribute('data-opf-generated') === 'true' ||
        (node.hasAttribute('data-opf-code-container') && typeof value === 'string') ||
        (node.hasAttribute('data-opf-metric-container') && ['string','number'].includes(typeof value)) ||
        (!item && !node.matches("g") && !node.matches("image")) ||
        value === undefined ||
        path === `slides.${slideIndex}` ||
        path.includes(".design.")
      )
        continue;
      // Prefer the containing group over its duplicate text/shape trace attributes.
      if (
        !node.matches("g,image") ||
        (node.matches("g") && !node.querySelector("text,image,rect,path") && !node.hasAttribute("data-opf-rich-text"))
      )
        continue;
      seen.add(path);
      node.setAttribute("data-canvas-target", "");
      node.setAttribute("role", "button");
      node.setAttribute("tabindex", "0");
      node.setAttribute(
        "aria-label",
        `Edit ${path.split(".").at(-1)}: ${["string", "number"].includes(typeof value) ? String(value).slice(0, 80) : "content properties"}`,
      );
      if (node.matches("g")) {
        let bounds = node.getBBox();
        if (!bounds.width && !bounds.height && (node.hasAttribute('data-opf-code-role')||node.hasAttribute('data-opf-metric-role'))) bounds={x:Number(node.dataset.opfBoxX),y:Number(node.dataset.opfBoxY),width:Number(node.dataset.opfBoxWidth),height:Number(node.dataset.opfBoxHeight)};
        const lines = JSON.parse(node.getAttribute("data-opf-rich-lines") ?? "[]");
        if (!bounds.width && !bounds.height && lines.length) bounds = {x:lines[0].x,y:lines[0].y,width:Number(node.getAttribute("data-opf-box-width"))||8,height:lines.reduce((sum,line)=>sum+line.height,0)};
        const rect = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
        for (const [key, value] of Object.entries({
          x: bounds.x - 4,
          y: bounds.y - 4,
          width: Math.max(8, bounds.width + 8),
          height: Math.max(8, bounds.height + 8),
          fill: "transparent",
          stroke: "transparent",
          "stroke-width": 1.5,
          "vector-effect": "non-scaling-stroke",
          "pointer-events": "all",
        }))
          rect.setAttribute(key, value);
        rect.classList.add("opf-selection");
        node.prepend(rect);
      }
      node.addEventListener("click", (event) => {
        event.stopPropagation();
        if (event.target.closest("a")) event.preventDefault();
        if (active && active.path !== path && !commit()) return;
        choose(path);
      });
      node.addEventListener("dblclick", (event) => {
        event.preventDefault();
        event.stopPropagation();
        beginEdit(path);
      });
      node.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          beginEdit(path);
        }
      });
      if (path === selectedPath) node.setAttribute("data-canvas-selected", "");
    }
    layoutHandles.update(document, geometry);
    blockControls.update(document, geometry);
    if (active?.kind === "text") positionInput();
    if (active?.kind === "rich-text") active.rich?.update();
    options.onRender?.({
      document,
      slideIndex,
      svg,
      geometry,
      draft: !!active || !!layoutHandles.editingPath,
    });
  }
  function queueDraft() {
    if (frame) win.cancelAnimationFrame(frame);
    frame = win.requestAnimationFrame(() => {
      frame = 0;
      if (!active || active.composing) return;
      if (active.kind === "properties") {
        try {
          const draft = propertyDraft(active);
          clearNotice();
          render(draft);
          options.onDraft?.({
            document: draft,
            path: active.path,
            value: undefined,
          });
        } catch (error) {
          report(error);
        }
        return;
      }
      try {
        const value = active.kind === "rich-text" ? active.rich.value : parseCanvasValue(active.input.value, active.type, active.originalValue);
        const draft = createCanvasDraft(editor.document, active.path, value);
        clearNotice();
        active.valid = true;
        active.draft = draft;
        render(draft);
        options.onDraft?.({ document: draft, path: active.path, value });
      } catch (error) {
        active.valid = false;
        report(error);
      }
    });
  }
  function positionInput() {
    if (!active || active.kind !== "text") return;
    const target = getTarget(active.path),
      text = target?.matches("text") ? target : target?.querySelector("text");
    if (!text) return;
    const svg = preview.querySelector("svg"),
      svgRect = svg.getBoundingClientRect(),
      rootRect = root.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal,
      scale = svgRect.width / viewBox.width;
    const font = win.getComputedStyle(text),
      fontSize = parseFloat(font.fontSize),
      geometry = resolvePresentation(
        active.draft ?? editor.document,
        renderOptions,
      ).slides[slideIndex].geometry;
    const item = geometry.items.find((item) => item.path === active.path);
    const metricLayout=geometry.items.find(item=>item.metricLayout?.parts.some(part=>part.path===active.path))?.metricLayout;
    const metricPart=metricLayout?.parts.find(part=>part.path===active.path);
    const allText = target.querySelectorAll("text");
    const lineHeight = metricPart?.fit?.lineHeight ?? (
      allText.length > 1
        ? Number(allText[1].getAttribute("y")) - Number(text.getAttribute("y"))
        : fontSize * 1.22);
    const canvas = doc.createElement("canvas"),
      ctx = canvas.getContext("2d");
    ctx.font = `${font.fontStyle} ${font.fontWeight} ${fontSize}px ${font.fontFamily}`;
    const metrics = ctx.measureText("Mg"),
      ascent = metrics.fontBoundingBoxAscent ?? fontSize * 0.9,
      descent = metrics.fontBoundingBoxDescent ?? fontSize * 0.2;
    const baseline = ascent + (lineHeight - ascent - descent) / 2;
    const x = Number(text.getAttribute("x")),
      y = Number(text.getAttribute("y")) - baseline;
    const bounds = target.getBBox(),
      anchor = text.getAttribute("text-anchor");
    const tracedWidth = Number(target.getAttribute("data-opf-box-width"));
    const width = metricPart?.box.width ?? item?.box.width ?? (tracedWidth > 0 ? tracedWidth : Math.max(80, bounds.width + 20));
    const left = metricPart?.box.x ?? (anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x);
    const visibleText=active.composing||active.isCode||active.isMetric;
    Object.assign(active.input.style, {
      fontFamily: font.fontFamily,
      fontSize: `${fontSize * scale}px`,
      fontWeight: font.fontWeight,
      fontStyle: font.fontStyle,
      lineHeight: `${lineHeight * scale}px`,
      color: visibleText ? font.fill : "transparent",
      caretColor: font.fill,
      textAlign: metricLayout?.alignment ?? (anchor === "middle" ? "center" : anchor === "end" ? "right" : "left"),
      width: `${width * scale}px`,
      height: `${Math.max(lineHeight, allText.length * lineHeight) * scale + 2}px`,
      minHeight: "0",
      letterSpacing: font.letterSpacing,
    });
    active.input.style.left = `${svgRect.left - rootRect.left + (left - viewBox.x) * scale}px`;
    active.input.style.top = `${svgRect.top - rootRect.top + (y - viewBox.y) * scale}px`;
    // When the input supplies visible text, its selected text needs the same fill.
    active.input.style.setProperty('--opf-inline-selection-color',visibleText ? font.fill : 'transparent');
    // Other text keeps the canonical SVG visible beneath the transparent input.
    target.style.opacity = visibleText ? "0" : "1";
  }
  function beginEdit(path) {
    if (disposed) return;
    if (active && active.path === path) return;
    if (active && !commit()) return;
    clearNotice();
    layoutHandles.hide();
    blockControls.hide();
    richToolbar.hide();
    choose(path);
    const value = editor.get(path);
    if (value === undefined) {
      report(new Error("This content no longer exists."));
      return;
    }
    const target = getTarget(path),
      text = target?.querySelector("text");
    if (
      (typeof value === "string" || typeof value === "number") &&
      text &&
      !/\.(image|video)$/.test(path)
    ) {
      const input = doc.createElement("textarea");
      input.className = "opf-inline-input";
      input.value = String(value);
      input.setAttribute("aria-label", `Edit ${path.split(".").at(-1)} inline`);
      const isCode=text.hasAttribute('data-opf-code-role');
      const isMetric=text.hasAttribute('data-opf-metric-role');
      input.spellcheck = !isCode;
      input.style.cssText =
        "position:absolute;pointer-events:auto;resize:none;border:0;outline:1px solid #8975d9;outline-offset:4px;margin:0;padding:0;background:transparent;overflow:hidden;min-height:0;box-shadow:none;border-radius:0;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:border-box;z-index:2";
      active = {
        kind: "text",
        path,
        base: JSON.stringify(value),
        originalValue:value,
        isCode,
        isMetric,
        type: typeof value,
        input,
        valid: true,
      };
      overlay.append(input);
      if(isCode){input.style.background='#111827';input.style.tabSize='4';input.style.overflow='auto';}
      if(isMetric){input.style.tabSize='4';input.style.overflow='auto';}
      // Only offer rich text where the canonical schema accepts TextRun[].
      if (typeof value === "string") {
        try {
          createCanvasDraft(editor.document, path, [value]);
          const format = doc.createElement("button");
          format.type = "button";
          format.textContent = "Format text";
          format.style.cssText = "position:absolute;bottom:8px;left:8px;pointer-events:auto;z-index:4;background:#fff;color:#574774;border:1px solid #d5cce5;border-radius:5px;padding:6px 10px";
          format.onmousedown = event => event.preventDefault();
          format.onclick = () => {
            if (!commit()) return;
            try {
              editor.set(path, [editor.get(path)], {source:"canvas-rich-text", rejectInvalid:true});
              richToolbar.selectAll(path);
            } catch (error) { report(error); }
          };
          overlay.append(format);
        } catch { /* This scalar field does not accept rich text. */ }
      }
      positionInput();
      input.addEventListener("input", queueDraft);
      input.addEventListener("compositionstart", () => {
        if (active) {
          active.composing = true;
          positionInput();
        }
      });
      input.addEventListener("compositionend", () => {
        active && (active.composing = false);
        queueDraft();
      });
      input.addEventListener("keydown", (event) => {
        if (event.isComposing) return;
        if (isCode && event.key === 'Tab' && !event.shiftKey) {
          event.preventDefault();input.setRangeText('\t',input.selectionStart,input.selectionEnd,'end');input.dispatchEvent(new win.Event('input',{bubbles:true}));
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          cancel();
        } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          commit();
        }
      });
      input.addEventListener("blur", () => {
        if (active?.input === input && !active.composing) commit();
      });
      input.focus();
      input.select();
    } else if (Array.isArray(value) && target?.hasAttribute("data-opf-rich-text")) {
      active = {kind:"rich-text",path,base:JSON.stringify(value),valid:true};
      active.rich = createRichTextInput(root, overlay, {
        path, value, getTarget,
        onInput: queueDraft, onCommit: commit, onCancel: cancel, onError: report,
        onFormat(start,end) {
          if (!commit()) return;
          if(start===end)richToolbar.selectAll(path);else richToolbar.selectRange(path,start,end);
        },
      });
      active.input = active.rich.input;
    } else openProperties(path, value);
  }
  function propertyPatches(edit) {
    return edit.inputs.map(({ field, input }) => ({
      op: "replace",
      path: opfPathToJsonPointer(field.path),
      value: parseCanvasValue(
        field.type === "boolean" ? input.checked : input.value,
        field.type,
        field.value,
      ),
    }));
  }
  function propertyDraft(edit) {
    const draft = applyJsonPatch(editor.document, propertyPatches(edit)),
      validation = validateOpfDocument(draft);
    if (!validation.valid)
      throw new Error(
        validation.errors[0]?.message ?? "This change is not valid OPF.",
      );
    return draft;
  }
  function openProperties(path, value) {
    const panel = doc.createElement("form");
    panel.setAttribute("aria-label", "Content properties");
    panel.style.cssText =
      "position:absolute;right:10px;top:10px;width:min(330px,calc(100% - 20px));max-height:calc(100% - 20px);overflow:auto;pointer-events:auto;background:#fff;color:#332e40;border:1px solid #dcd5eb;border-radius:8px;padding:16px;box-shadow:0 8px 35px #28203922;z-index:3;font:12px/1.5 system-ui";
    const heading = doc.createElement("strong");
    heading.textContent = `Edit ${path.split(".").at(-1)}`;
    panel.append(heading);
    const { fields, arrays } = getEditableFields(value, path),
      inputs = [];
    for (const field of fields) {
      const label = doc.createElement("label");
      label.style.cssText =
        "display:block;margin-top:10px;color:#756b85;font-size:11px";
      label.textContent = field.label;
      const input = doc.createElement(
        field.type === "boolean" ? "input" : "textarea",
      );
      if (field.type === "boolean") {
        input.type = "checkbox";
        input.checked = field.value;
      } else {
        input.rows = field.type === "number" ? 1 : 2;
        input.value = field.value === null ? "null" : String(field.value);
      }
      input.setAttribute("aria-label", label.textContent);
      input.style.cssText =
        "display:block;width:100%;font:12px/1.5 system-ui;padding:6px;min-height:0;box-sizing:border-box;border:1px solid #e0dae8;border-radius:4px;color:#332e40;background:white";
      if (field.type === "boolean") input.style.width = "auto";
      label.append(input);
      panel.append(label);
      inputs.push({ field, input });
      input.addEventListener("input", queueDraft);
    }
    if (/(^|\.)image($|\.)/.test(path)) {
      const upload = doc.createElement("input");
      upload.type = "file";
      upload.accept = "image/png,image/jpeg,image/gif,image/webp";
      upload.setAttribute("aria-label", "Replace image");
      upload.style.cssText = "display:block;max-width:100%;margin-top:12px";
      upload.onchange = async () => {
        const file = upload.files?.[0];
        if (!file) return;
        if (file.size > 20 * 1024 * 1024) {
          report(new Error("Choose an image smaller than 20 MB."));
          return;
        }
        const edit = active;
        const reader = new win.FileReader();
        reader.onload = () => {
          if (active !== edit) return;
          const source = inputs.find(
            ({ field }) =>
              field.path === opfPathToJsonPointer(path) ||
              splitOpfPath(field.path).at(-1) === "src",
          );
          if (source) {
            source.input.value = reader.result;
            queueDraft();
          } else
            report(
              new Error("Select an image source field to replace this image."),
            );
        };
        reader.onerror = () => report(new Error("Could not read the image."));
        reader.readAsDataURL(file);
      };
      panel.append(upload);
    }
    for (const array of arrays) {
      const row = doc.createElement("div");
      row.style.cssText =
        "display:flex;justify-content:space-between;gap:8px;margin-top:10px";
      const label = doc.createElement("span");
      label.textContent = array.label || "Items";
      row.append(label);
      for (const [label, remove] of [
        ["Add", false],
        ["Remove last", true],
      ]) {
        const button = doc.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.setAttribute("aria-label", `${label} ${array.path}`);
        button.disabled = remove && !array.length;
        button.onclick = () => {
          if (!commit()) return;
          try {
            const values = editor.get(array.path);
            const empty = (value, key = "") =>
              Array.isArray(value)
                ? value.map((child) => empty(child))
                : value && typeof value === "object"
                  ? Object.fromEntries(
                      Object.entries(value).map(([key, child]) => [
                        key,
                        empty(child, key),
                      ]),
                    )
                  : typeof value === "number"
                    ? 0
                    : typeof value === "boolean"
                      ? false
                      : ["type", "mode", "language"].includes(key)
                        ? value
                        : "";
            const next = remove
              ? values.slice(0, -1)
              : [...values, empty(values.at(-1) ?? "")];
            editor.set(array.path, next, {
              source: "canvas-collection",
              rejectInvalid: true,
            });
            beginEdit(path);
          } catch (error) {
            report(error);
          }
        };
        row.append(button);
      }
      panel.append(row);
    }
    const controls = doc.createElement("div");
    controls.style.cssText =
      "display:flex;gap:8px;justify-content:flex-end;margin-top:14px";
    for (const [title, action] of [
      ["Cancel", () => cancel()],
      ["Apply", () => commit()],
    ]) {
      const button = doc.createElement("button");
      button.type = "button";
      button.textContent = title;
      button.style.cssText =
        "border:1px solid #d5cce5;border-radius:5px;padding:5px 10px;background:#f5f2fb;color:#574774;cursor:pointer";
      button.onclick = action;
      controls.append(button);
    }
    panel.append(controls);
    panel.onsubmit = (event) => {
      event.preventDefault();
      commit();
    };
    panel.onkeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
    };
    active = {
      kind: "properties",
      path,
      base: JSON.stringify(value),
      panel,
      inputs,
      valid: true,
    };
    if (options.propertiesContainer) {
      panel.style.cssText =
        "position:relative;width:100%;font:12px/1.5 system-ui;color:inherit";
      options.propertiesContainer.replaceChildren(panel);
    } else overlay.append(panel);
    inputs[0]?.input.focus();
  }
  function commit() {
    if (blockControls.editingPath) return false;
    if (!committing && layoutHandles.editingPath) return layoutHandles.commit();
    if (committing || !active) return true;
    if (active.composing || active.rich?.composing) return false;
    if (JSON.stringify(editor.get(active.path)) !== active.base) {
      report(
        new Error(
          "This content changed elsewhere. Your draft was cancelled to preserve the newer edit.",
        ),
      );
      cancel(false);
      return false;
    }
    const edit = active;
    try {
      let value;
      if (edit.kind === "rich-text") value = edit.rich.value;
      else if (edit.kind === "text")
        value = parseCanvasValue(edit.input.value, edit.type, edit.originalValue);
      else value = propertyDraft(edit);
      if (edit.kind === "text" || edit.kind === "rich-text")
        renderSvg(createCanvasDraft(editor.document, edit.path, value), {...renderOptions,slideIndex});
      committing = true;
      if ((edit.kind === "text" || edit.kind === "rich-text") && JSON.stringify(value) !== edit.base)
        editor.set(edit.path, value, { source: "canvas", rejectInvalid: true });
      if (edit.kind === "properties") {
        const patches = propertyPatches(edit).filter(
          (patch) =>
            JSON.stringify(editor.get(patch.path)) !==
            JSON.stringify(patch.value),
        );
        if (patches.length)
          editor.applyPatch(patches, {
            source: "canvas-properties",
            rejectInvalid: true,
          });
      }
      committing = false;
      active = null;
      edit.rich?.destroy();
      overlay.replaceChildren();
      options.propertiesContainer?.replaceChildren();
      clearNotice();
      render();
      getTarget(edit.path)?.focus();
      options.onCommit?.({ path: edit.path, editor });
      return true;
    } catch (error) {
      committing = false;
      report(error);
      return false;
    }
  }
  function cancel(clear = true) {
    if (blockControls.editingPath) { blockControls.cancel(); render(); return; }
    blockControls.cancel();
    if (layoutHandles.editingPath) { layoutHandles.cancel(clear); return; }
    const path = active?.path, rich = active?.rich;
    active = null;
    rich?.destroy();
    if (frame) {
      win.cancelAnimationFrame(frame);
      frame = 0;
    }
    overlay.replaceChildren();
    richToolbar.hide();
    options.propertiesContainer?.replaceChildren();
    if (clear) clearNotice();
    render();
    getTarget(path)?.focus();
    options.onCancel?.({ path });
  }
  const unsubscribe = editor.subscribe(() => {
    if (committing || layoutHandles.editingPath) return;
    if (active) {
      if (JSON.stringify(editor.get(active.path)) !== active.base) {
        report(
          new Error(
            "The selected content changed elsewhere; the draft was cancelled.",
          ),
        );
        cancel(false);
        return;
      }
      queueDraft();
      return;
    }
    try {
      render();
    } catch (error) {
      report(error);
    }
  });
  const resize = new win.ResizeObserver(() => {
    if (active?.kind === "text") positionInput();
    active?.rich?.update();
  });
  resize.observe(root);
  root.addEventListener("keydown", (event) => {
    if (
      (event.metaKey || event.ctrlKey) &&
      event.key.toLowerCase() === "z" &&
      !event.target.closest("textarea,input")
    ) {
      event.preventDefault();
      event.stopPropagation();
      event.shiftKey ? editor.redo() : editor.undo();
    }
  });
  try {
    render();
  } catch (error) {
    unsubscribe();
    resize.disconnect();
    richToolbar.destroy();
    layoutHandles.destroy();
    blockControls.destroy();
    root.remove();
    throw error;
  }
  const ready = Promise.resolve(doc.fonts?.ready).then(() => {
    if (!disposed && !active) render();
  });
  return {
    editor,
    ready,
    get slideIndex() {
      return slideIndex;
    },
    get editingPath() {
      return active?.path ?? layoutHandles.editingPath ?? blockControls.editingPath ?? null;
    },
    get layoutEditing() { return layoutHandles.enabled; },
    setLayoutEditing(enabled) {
      if (!commit()) return false;
      return layoutHandles.setEnabled(enabled);
    },
    openBlockMenu: path => blockControls.open(path),
    openInsertMenu: (containerPath,index) => blockControls.openInsert(containerPath,index),
    select: choose,
    beginEdit,
    editProperties(path) {
      if (active && !commit()) return false;
      richToolbar.hide();
      const value = editor.get(path);
      if (value === undefined) return false;
      choose(path);
      openProperties(path, value);
      return true;
    },
    commit,
    cancel,
    render,
    setSlide(index) {
      if (!Number.isInteger(index) || !editor.document.slides?.[index])
        throw new RangeError("Slide index is out of range.");
      if (index === slideIndex) {
        if (!active) render();
        return true;
      }
      if (!commit()) return false;
      richToolbar.hide();
      slideIndex = index;
      selectedPath = null;
      render();
      return true;
    },
    setRenderOptions(next) {
      if (!commit()) return false;
      richToolbar.hide();
      renderOptions = next;
      render();
      return true;
    },
    destroy() {
      disposed = true;
      active?.rich?.destroy();
      richToolbar.destroy();
      layoutHandles.destroy();
      blockControls.destroy();
      unsubscribe();
      resize.disconnect();
      if (frame) win.cancelAnimationFrame(frame);
      root.remove();
      options.propertiesContainer?.replaceChildren();
      active = null;
    },
  };
}
