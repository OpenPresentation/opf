// Content controls (RR-26): the DOM controls for the content actions, mounted by `createDesignControls` in its
// "Selected content" and "Slide structure" sections. The structural actions of a block are one row of icon buttons
// (each named, with a tooltip); the others are native buttons or selects with a short label. An action runs a dry run
// through the same prepare function it uses, so before it is applied its tooltip names what it would not carry over,
// and when it does not apply it is shown disabled (aria-disabled, so it stays focusable) with the reason as its tooltip
// and accessible description. Each commits one undoable change through the session. Nothing here owns document state:
// `sync` re-reads the session after every change, Undo and Redo included.
import { BLOCK_KIND_LABELS, blockConversionTargets, convertBlock, metricGroupForSelection } from "./block-convert.js";
import {
  listItemIndexForSelection,
  moveImageToContent,
  moveImageToDesign,
  placeBlocksInRegions,
  prepareBlocksToRegions,
  prepareGroupBlocks,
  prepareImageToContent,
  prepareImageToDesign,
  prepareListShift,
  prepareRegionsToBlocks,
  prepareUngroupBlock,
  regionsAsBlocks,
  groupBlocks,
  shiftListItems,
  ungroupBlock,
} from "./content-actions.js";
import { ICONS } from "./studio-kit/dom.js";

/** Region layouts offered for a slide with this many blocks (each block gets its own region, none overlap). */
export const REGION_LAYOUTS = Object.freeze({
  2: [
    { id: "left-right", label: "Side by side", regions: ["left", "right"] },
    { id: "top-bottom", label: "Stacked", regions: ["top", "bottom"] },
  ],
  3: [
    { id: "three-columns", label: "Three columns", regions: ["left", "center", "right"] },
    { id: "top-two-columns", label: "One on top, two below", regions: ["top", "bottom:left", "bottom:right"] },
    { id: "left-two-rows", label: "One on the left, two on the right", regions: ["left", "top:right", "bottom:right"] },
  ],
  4: [{ id: "grid", label: "Two by two", regions: ["top:left", "top:right", "bottom:left", "bottom:right"] }],
});

/**
 * Where an image block can go in the slide's design (OPF 0.15): its background (a full-bleed photo behind the content) or its
 * watermark. Bleeding an image to one edge beside the content is not a move: it is the block's `placement` (image-options.js).
 */
export const IMAGE_DESTINATIONS = Object.freeze([
  { value: "background", label: "Slide background, full slide behind the content", target: "background", options: {} },
  { value: "watermark", label: "Watermark", target: "watermark", options: {} },
]);

const REGION_KEY = /^(?:(?:top|middle|bottom)(?:\+(?:top|middle|bottom))*(?::(?:left|center|right)(?:\+(?:left|center|right))*)?|(?:left|center|right)(?:\+(?:left|center|right))*)$/;
const regionKeysOfSlide = (slide) => Object.keys(slide).filter((key) => REGION_KEY.test(key));
const DESIGN_IMAGE_LABELS = { background: "background image", watermark: "watermark" };
// An image block's own framing fields (FA-22) do not stop it being "a block that holds only an image".
const IMAGE_BLOCK_FIELDS = new Set(["id", "extensions", "type", "fit", "focus", "aspectRatio", "shape", "cornerRadius", "border", "opacity", "recolor", "overlay", "placement"]);
const messageOf = (error) => error?.issues?.[0]?.message ?? error?.message ?? String(error);
const lossText = (prepared) => (prepared.loss?.length ? `Not carried over: ${prepared.loss.join(", ")}.` : "");
const SVG = "http://www.w3.org/2000/svg";

/** An inline Lucide icon (aria-hidden) from the studio kit's set. */
export function iconNode(doc, name, size = 16) {
  const svg = doc.createElementNS(SVG, "svg");
  for (const [key, value] of Object.entries({ viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false", class: "opf-dc-icon" })) svg.setAttribute(key, String(value));
  svg.innerHTML = ICONS[name] ?? "";
  return svg;
}

/** The first sentence of a refusal, for a tooltip: "The first line is longer than 24 characters." */
export function shortReason(reason) {
  if (!reason) return "";
  const first = String(reason).split(/(?<=[.!?])\s/)[0];
  return first.replace(/, which [^.]*\./, ".");
}

/**
 * Show a button as available or not. A disabled action keeps its focus (aria-disabled) so the reason in its tooltip is reachable from the
 * keyboard; the tooltip is the label (with its shortcut) when it is available, and the label and the reason when it is not.
 */
export function setActionState(button, { label, enabled, reason, shortcut, loss }) {
  if (enabled) button.removeAttribute("aria-disabled");
  else button.setAttribute("aria-disabled", "true");
  const tip = enabled ? `${label}${shortcut ? ` (${shortcut})` : ""}${loss ? `. ${loss}` : ""}` : `${label}: ${shortReason(reason) || "not available here."}`;
  button.title = tip;
}

/**
 * Build the content controls. `ctx` supplies the panel's helpers: `editor`, `doc`, `h` (element builder), `selectField`,
 * `run(action, done)` (commit, report, restore on failure), `nextId`, `getSlide()`, `reselect(path)` and, optionally,
 * `blockActions` (`{ before, after }`: host actions for the arrange toolbar, each `{ role, label, icon, state(), run() }`).
 * Returns the nodes to place and `sync(state)`, where `state` is `{ blockPath, groupPath, content, selectedPath, slideIndex }`
 * (`groupPath` is a selected group, which has no content of its own).
 */
export function createContentControls(ctx) {
  const { editor, h, selectField, run, nextId, getSlide, reselect } = ctx;
  const updaters = [];
  const ctxState = { current: {} };

  /**
   * A button for one content action: an icon button in a toolbar when `icon` is given, otherwise a text button. Before it is pressed its
   * tooltip names what the change would not carry over; it is disabled, with the reason as its tooltip, when it does not apply.
   */
  function action(label, { prepare, apply, done, selectAfter, role, icon }) {
    const button = icon
      ? h("button", { type: "button", class: "opf-dc-tool", "aria-label": label, "data-role": role }, iconNode(ctx.doc, icon))
      : h("button", { type: "button", class: "secondary", "data-role": role }, label);
    button.addEventListener("click", () => {
      if (button.getAttribute("aria-disabled") === "true") return;
      run(
        () => {
          const change = apply();
          if (selectAfter) reselect(selectAfter(change));
          return change;
        },
        (change) => `${typeof done === "function" ? done(change) : done}${lossText(change) ? ` ${lossText(change)}` : ""}`,
      );
    });
    const wrap = icon ? button : h("div", { class: "opf-dc-action" }, button);
    let current = {};
    const update = (state) => {
      current = state;
      let prepared;
      try {
        prepared = prepare(state);
      } catch (error) {
        setActionState(button, { label, enabled: false, reason: messageOf(error) });
        return;
      }
      setActionState(button, { label, enabled: prepared.changed, reason: prepared.reason, loss: prepared.changed ? lossText(prepared) : "" });
    };
    return { wrap, button, update, state: () => current };
  }

  /** A host action in the toolbar (the Studio's move, duplicate and delete): `{ role, label, icon, state() → { enabled, reason, shortcut }, run() }`. */
  function hostAction(entry) {
    const button = h("button", { type: "button", class: "opf-dc-tool", "aria-label": entry.label, "data-role": entry.role }, iconNode(ctx.doc, entry.icon));
    button.addEventListener("click", () => {
      if (button.getAttribute("aria-disabled") === "true") return;
      entry.run();
    });
    return { wrap: button, update: () => setActionState(button, { label: entry.label, ...entry.state() }) };
  }

  // --- list levels ---------------------------------------------------------------------------------

  const listTools = h("div", { class: "opf-dc-toolbar", role: "group", "aria-label": "List level" });
  const list = h("div", { class: "opf-dc-row", "data-role": "list-levels" }, h("span", { class: "opf-dc-row-label", "aria-hidden": "true" }, "List level"), listTools);
  {
    const index = (state) => listItemIndexForSelection(state.selectedPath, state.blockPath);
    const prepare = (delta) => (state) => {
      const item = index(state);
      if (item === undefined) return { changed: false, loss: [], reason: "Select a list item to change its level." };
      return prepareListShift(editor.presentation, state.blockPath, [item], delta, { validate: false });
    };
    const apply = (delta) => () => {
      const state = ctxState.current;
      return shiftListItems(editor, state.blockPath, [index(state)], delta);
    };
    const outdent = action("Outdent item", { role: "outdent", icon: "IndentDecrease", prepare: prepare(-1), apply: apply(-1), done: "Item moved out." });
    const indent = action("Indent item", { role: "indent", icon: "IndentIncrease", prepare: prepare(1), apply: apply(1), done: "Item moved in." });
    listTools.append(outdent.wrap, indent.wrap);
    updaters.push((state) => {
      list.hidden = state.content?.kind !== "list";
      if (!list.hidden) {
        indent.update(state);
        outdent.update(state);
      }
    });
  }

  // --- a group of metrics --------------------------------------------------------------------------

  const metrics = selectField("metric-group", "Group of metrics", {
    empty: "Convert to…",
    onChange: (value) => {
      if (!value) return;
      const path = ctxState.current.metricGroupPath;
      run(
        () => convertBlock(editor, path, value),
        (change) => `Converted the group to ${BLOCK_KIND_LABELS[value]?.toLowerCase() ?? value}.${lossText(change) ? ` ${lossText(change)}` : ""}`,
      );
      reselect(path);
    },
  });
  updaters.push((state) => {
    metrics.wrap.hidden = !state.metricGroupPath;
    if (!state.metricGroupPath) return;
    const targets = blockConversionTargets(editor.presentation, state.metricGroupPath);
    metrics.setOptions(
      targets.map((target) => ({
        value: target.kind,
        label: target.available ? `${target.label}${target.lossless ? "" : ` (loses ${target.loss.join(", ")})`}` : target.label,
        disabled: !target.available,
        title: target.available ? undefined : shortReason(target.reason),
      })),
    );
    metrics.set("");
  });

  // --- arrange the selected block -------------------------------------------------------------------

  // One row of icon buttons: the host's actions before (the Studio's Move up and Move down), Group with the next block and Ungroup, then the
  // host's actions after (Duplicate, Delete). `target` is the selected block, or the selected group (which has no content to convert).
  const arrange = h("div", { class: "opf-dc-toolbar", role: "group", "aria-label": "Arrange", "data-role": "arrange" });
  const imageUse = selectField("image-destination", "Use image as", {
    empty: "Choose…",
    onChange: (value) => {
      const destination = IMAGE_DESTINATIONS.find((entry) => entry.value === value);
      if (!destination) return;
      const state = ctxState.current;
      run(
        () => moveImageToDesign(editor, state.blockPath, destination.target, destination.options),
        (change) => `Image is now the ${destination.label.toLowerCase()}.${lossText(change) ? ` ${lossText(change)}` : ""}`,
      );
      reselect(`slides.${state.slideIndex}`);
    },
  });
  {
    const target = (state) => state.blockPath ?? state.groupPath;
    const parts = (state) => target(state)?.split(".") ?? [];
    const blockIndex = (state) => {
      const found = parts(state);
      return found.at(-2) === "blocks" && /^\d+$/.test(found.at(-1)) ? Number(found.at(-1)) : undefined;
    };
    const containerPath = (state) => parts(state).slice(0, -2).join(".");
    const next = (state) => {
      const index = blockIndex(state);
      const blocks = index === undefined ? undefined : editor.get(`${containerPath(state)}.blocks`);
      return Array.isArray(blocks) && index + 1 < blocks.length ? [index, index + 1] : undefined;
    };
    const group = action("Group with the next block", {
      role: "group-next",
      icon: "Group",
      prepare: (state) => {
        const indices = next(state);
        if (!indices) return { changed: false, loss: [], reason: "There is no block after this one." };
        return prepareGroupBlocks(editor.presentation, containerPath(state), indices, { validate: false });
      },
      apply: () => {
        const state = ctxState.current;
        return groupBlocks(editor, containerPath(state), next(state));
      },
      selectAfter: (change) => change.path,
      done: "Blocks grouped.",
    });
    // The group to dissolve: the selected group itself, or the group the selected block is in.
    const groupToUndo = (state) => {
      if (state.groupPath && !state.blockPath) return state.groupPath;
      const found = parts(state);
      return found.length >= 6 && found.at(-4) === "blocks" ? found.slice(0, -2).join(".") : undefined;
    };
    const ungroup = action("Ungroup", {
      role: "ungroup",
      icon: "Ungroup",
      prepare: (state) => {
        const path = groupToUndo(state);
        if (!path) return { changed: false, loss: [], reason: "This block is not inside a group." };
        return prepareUngroupBlock(editor.presentation, path, { validate: false });
      },
      apply: () => ungroupBlock(editor, groupToUndo(ctxState.current)),
      selectAfter: (change) => change.path,
      done: "Group dissolved.",
    });
    const host = ctx.blockActions ?? {};
    const before = (host.before ?? []).map(hostAction);
    const after = (host.after ?? []).map(hostAction);
    const separator = () => h("span", { class: "opf-dc-toolbar-separator", "aria-hidden": "true" });
    arrange.append(...before.map((entry) => entry.wrap), ...(before.length ? [separator()] : []), group.wrap, ungroup.wrap, ...(after.length ? [separator()] : []), ...after.map((entry) => entry.wrap));
    updaters.push((state) => {
      arrange.hidden = !state.content && !state.groupPath;
      if (arrange.hidden) return;
      for (const entry of [...before, group, ungroup, ...after]) entry.update(state);
    });
    updaters.push((state) => {
      const isImage = state.imageBlock === true;
      imageUse.wrap.hidden = !isImage;
      if (!isImage) return;
      imageUse.setOptions(
        IMAGE_DESTINATIONS.map((entry) => {
          try {
            const prepared = prepareImageToDesign(editor.presentation, state.blockPath, entry.target, { ...entry.options, validate: false });
            return { value: entry.value, label: `${entry.label}${prepared.loss.length ? ` (loses ${prepared.loss.join(", ")})` : ""}` };
          } catch (error) {
            return { value: entry.value, label: entry.label, disabled: true, title: shortReason(messageOf(error)) };
          }
        }),
      );
      imageUse.set("");
    });
  }

  // --- slide structure -----------------------------------------------------------------------------

  const slideBox = h("div", { class: "opf-dc-actions-block", "data-role": "slide-structure" });
  {
    const layouts = selectField("region-layout", "Place blocks in regions", {
      empty: "Choose a layout…",
      onChange: (value) => {
        const slideIndex = getSlide();
        const choice = REGION_LAYOUTS[blockCount(slideIndex)]?.find((entry) => entry.id === value);
        if (!choice) return;
        run(() => placeBlocksInRegions(editor, slideIndex, choice.regions), (change) => `Blocks placed: ${choice.label.toLowerCase()}.${lossText(change) ? ` ${lossText(change)}` : ""}`);
        reselect(`slides.${slideIndex}`);
      },
    });
    const toBlocks = action("Turn regions into blocks", {
      role: "regions-to-blocks",
      prepare: () => prepareRegionsToBlocks(editor.presentation, getSlide(), { validate: false }),
      apply: () => regionsAsBlocks(editor, getSlide()),
      done: "Regions are now blocks, in reading order.",
    });
    const designImages = Object.keys(DESIGN_IMAGE_LABELS).map((source) =>
      action(`Move the ${DESIGN_IMAGE_LABELS[source]} into the content`, {
        role: `back-${source}`,
        prepare: () => prepareImageToContent(editor.presentation, getSlide(), source, { validate: false }),
        apply: () => moveImageToContent(editor, getSlide(), source),
        done: `The ${DESIGN_IMAGE_LABELS[source]} is now an image block.`,
      }),
    );
    slideBox.append(layouts.wrap, toBlocks.wrap, ...designImages.map((entry) => entry.wrap));
    updaters.push((state) => {
      const slide = editor.presentation.slides?.[state.slideIndex];
      if (!slide) return;
      const regions = regionKeysOfSlide(slide);
      const count = blockCount(state.slideIndex);
      const choices = regions.length ? [] : (REGION_LAYOUTS[count] ?? []);
      layouts.wrap.hidden = choices.length === 0;
      if (choices.length) {
        layouts.setOptions(
          choices.map((choice) => {
            try {
              const prepared = prepareBlocksToRegions(editor.presentation, state.slideIndex, choice.regions, { validate: false });
              return { value: choice.id, label: `${choice.label}${prepared.loss.length ? ` (loses ${prepared.loss.join(", ")})` : ""}` };
            } catch (error) {
              return { value: choice.id, label: choice.label, disabled: true, title: shortReason(messageOf(error)) };
            }
          }),
        );
        layouts.set("");
      }
      toBlocks.wrap.hidden = regions.length === 0;
      if (regions.length) toBlocks.update(state);
      Object.keys(DESIGN_IMAGE_LABELS).forEach((source, index) => {
        const present = slide.design?.[source] !== undefined && slide.design[source] !== false;
        designImages[index].wrap.hidden = !present;
        if (present) designImages[index].update(state);
      });
    });
  }

  /** The number of blocks a slide can place in regions: its `blocks`, or the content fields it holds inline. */
  function blockCount(slideIndex) {
    const slide = editor.presentation.slides?.[slideIndex];
    if (!slide) return 0;
    if (Array.isArray(slide.blocks)) return slide.blocks.length;
    return ["text", "items", "bullets", "image", "video", "chart", "table", "code", "metric", "quote", "timeline"].filter((key) => slide[key] !== undefined).length;
  }

  return {
    /** Nodes for the "Selected content" section: the arrange toolbar, list levels, the group-of-metrics conversion and the image destination. */
    nodes: { arrange, list, metrics: metrics.wrap, image: imageUse.wrap },
    /** The node for the "Slide structure" section. */
    slideNode: slideBox,
    /** Update every control from the session and the current selection. */
    sync(state) {
      const slide = editor.presentation.slides?.[state.slideIndex];
      const imageBlock = state.blockPath ? isImageBlock(editor, state.blockPath) : false;
      const full = { ...state, imageBlock, metricGroupPath: state.selectedPath ? metricGroupForSelection(editor.presentation, state.selectedPath) : undefined, slide };
      ctxState.current = full;
      for (const update of updaters) update(full);
    },
  };
}

function isImageBlock(editor, blockPath) {
  const block = editor.get(blockPath);
  if (!block || typeof block !== "object" || Array.isArray(block)) return false;
  const keys = Object.keys(block).filter((key) => !IMAGE_BLOCK_FIELDS.has(key));
  return keys.length === 1 && keys[0] === "image";
}
