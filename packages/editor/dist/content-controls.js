// Content controls (RR-26): the DOM controls for the content actions, mounted by `createDesignControls` in its
// "Selected content" and "Slide structure" sections. Each action is a native button or select with a visible label;
// it shows what the change would not carry over BEFORE it is applied (a dry run through the same prepare function the
// action uses), is disabled with its reason when it does not apply, and commits one undoable change through the
// session. Nothing here owns document state: `sync` re-reads the session after every change, Undo and Redo included.
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

/** Where an image block can go in the slide's design. The value is `<target>` or `<target>:<position>`. */
export const IMAGE_DESTINATIONS = Object.freeze([
  { value: "slideImage:right", label: "Slide image, on the right", target: "slideImage", options: { position: "right" } },
  { value: "slideImage:left", label: "Slide image, on the left", target: "slideImage", options: { position: "left" } },
  { value: "slideImage:top", label: "Slide image, along the top", target: "slideImage", options: { position: "top" } },
  { value: "slideImage:bottom", label: "Slide image, along the bottom", target: "slideImage", options: { position: "bottom" } },
  { value: "slideImage:background", label: "Slide image, full slide behind the content", target: "slideImage", options: { position: "background" } },
  { value: "background", label: "Slide background", target: "background", options: {} },
  { value: "watermark", label: "Watermark", target: "watermark", options: {} },
]);

const REGION_KEY = /^(?:(?:top|middle|bottom)(?:\+(?:top|middle|bottom))*(?::(?:left|center|right)(?:\+(?:left|center|right))*)?|(?:left|center|right)(?:\+(?:left|center|right))*)$/;
const regionKeysOfSlide = (slide) => Object.keys(slide).filter((key) => REGION_KEY.test(key));
const DESIGN_IMAGE_LABELS = { slideImage: "slide image", background: "background image", watermark: "watermark" };
const messageOf = (error) => error?.issues?.[0]?.message ?? error?.message ?? String(error);
const lossText = (prepared) => (prepared.loss.length ? `Not carried over: ${prepared.loss.join(", ")}.` : "Nothing is lost.");

/**
 * Build the content controls. `ctx` supplies the panel's helpers: `editor`, `h` (element builder), `selectField`,
 * `run(action, done)` (commit, report, restore on failure), `nextId`, `getSlide()` and `reselect(path)`.
 * Returns the nodes to place and `sync(state)`, where `state` is `{ blockPath, content, selectedPath, slideIndex }`.
 */
export function createContentControls(ctx) {
  const { editor, h, selectField, run, nextId, getSlide, reselect } = ctx;
  const updaters = [];
  const ctxState = { current: {} };

  /** A button that shows the dry-run report under it before it is pressed and is disabled, with the reason, when it does not apply. */
  function action(label, { prepare, apply, done, selectAfter, role }) {
    const id = nextId("content-note");
    const note = h("p", { class: "opf-dc-help", id, "data-role": `${role}-note` });
    const button = h("button", { type: "button", class: "secondary", "aria-describedby": id, "data-role": role }, label);
    button.addEventListener("click", () => {
      run(
        () => {
          const change = apply();
          if (selectAfter) reselect(selectAfter(change));
          return change;
        },
        (change) => `${typeof done === "function" ? done(change) : done} ${lossText(change)}`,
      );
    });
    const wrap = h("div", { class: "opf-dc-action" }, button, note);
    let current = {};
    const update = (state) => {
      current = state;
      let prepared;
      try {
        prepared = prepare(state);
      } catch (error) {
        button.disabled = true;
        note.textContent = messageOf(error);
        return;
      }
      button.disabled = !prepared.changed;
      note.textContent = prepared.changed ? lossText(prepared) : (prepared.reason ?? "");
    };
    return { wrap, update, state: () => current };
  }

  // --- list levels ---------------------------------------------------------------------------------

  const list = h("div", { class: "opf-dc-actions-block", role: "group", "aria-label": "List levels", "data-role": "list-levels" });
  {
    const index = (state) => listItemIndexForSelection(state.selectedPath, state.blockPath);
    const prepare = (delta) => (state) => {
      const item = index(state);
      if (item === undefined) return { changed: false, loss: [], reason: "Select a list item to change its level." };
      return prepareListShift(editor.document, state.blockPath, [item], delta, { validate: false });
    };
    const apply = (delta) => () => {
      const state = ctxState.current;
      return shiftListItems(editor, state.blockPath, [index(state)], delta);
    };
    const indent = action("Indent item", { role: "indent", prepare: prepare(1), apply: apply(1), done: "Item moved in." });
    const outdent = action("Outdent item", { role: "outdent", prepare: prepare(-1), apply: apply(-1), done: "Item moved out." });
    list.append(h("p", { class: "opf-dc-help" }, "Select an item, then change its level. Items under it move with it."), indent.wrap, outdent.wrap);
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
    empty: "Convert the group to…",
    help: "Every block in this group is a metric. Converting keeps their labels, values, units and deltas.",
    onChange: (value) => {
      if (!value) return;
      const path = ctxState.current.metricGroupPath;
      run(
        () => convertBlock(editor, path, value),
        (change) => `Converted the group to ${BLOCK_KIND_LABELS[value]?.toLowerCase() ?? value}. ${lossText(change)}`,
      );
      reselect(path);
    },
  });
  updaters.push((state) => {
    metrics.wrap.hidden = !state.metricGroupPath;
    if (!state.metricGroupPath) return;
    const targets = blockConversionTargets(editor.document, state.metricGroupPath);
    metrics.setOptions(
      targets.map((target) => ({
        value: target.kind,
        label: target.available ? `${target.label}${target.lossless ? "" : ` (loses ${target.loss.join(", ")})`}` : `${target.label} (unavailable)`,
        disabled: !target.available,
        title: target.reason,
      })),
    );
    metrics.set("");
  });

  // --- arrange the selected block -------------------------------------------------------------------

  const arrange = h("div", { class: "opf-dc-actions-block", role: "group", "aria-label": "Arrange the selected block", "data-role": "arrange" });
  {
    const parts = (state) => state.blockPath?.split(".") ?? [];
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
      prepare: (state) => {
        const indices = next(state);
        if (!indices) return { changed: false, loss: [], reason: "There is no block after this one in its container." };
        return prepareGroupBlocks(editor.document, containerPath(state), indices, { validate: false });
      },
      apply: () => {
        const state = ctxState.current;
        return groupBlocks(editor, containerPath(state), next(state));
      },
      selectAfter: (change) => change.path,
      done: "Blocks grouped.",
    });
    const parentGroup = (state) => {
      const found = parts(state);
      return found.length >= 6 && found.at(-4) === "blocks" ? found.slice(0, -2).join(".") : undefined;
    };
    const ungroup = action("Ungroup these blocks", {
      role: "ungroup",
      prepare: (state) => {
        const path = parentGroup(state);
        if (!path) return { changed: false, loss: [], reason: "This block is not inside a group." };
        return prepareUngroupBlock(editor.document, path, { validate: false });
      },
      apply: () => ungroupBlock(editor, parentGroup(ctxState.current)),
      selectAfter: (change) => change.path,
      done: "Group dissolved.",
    });
    const image = selectField("image-destination", "Use this image as", {
      empty: "Choose where it goes…",
      help: "Moves the image out of the content into the slide's design. Undo puts it back.",
      onChange: (value) => {
        const destination = IMAGE_DESTINATIONS.find((entry) => entry.value === value);
        if (!destination) return;
        const state = ctxState.current;
        run(
          () => moveImageToDesign(editor, state.blockPath, destination.target, destination.options),
          (change) => `Image is now the ${destination.label.toLowerCase()}. ${lossText(change)}`,
        );
        reselect(`slides.${state.slideIndex}`);
      },
    });
    arrange.append(group.wrap, ungroup.wrap, image.wrap);
    updaters.push((state) => {
      arrange.hidden = !state.content;
      if (arrange.hidden) return;
      group.update(state);
      ungroup.update(state);
      const isImage = state.imageBlock === true;
      image.wrap.hidden = !isImage;
      if (isImage) {
        image.setOptions(
          IMAGE_DESTINATIONS.map((entry) => {
            try {
              const prepared = prepareImageToDesign(editor.document, state.blockPath, entry.target, { ...entry.options, validate: false });
              return { value: entry.value, label: `${entry.label}${prepared.loss.length ? ` (loses ${prepared.loss.join(", ")})` : ""}` };
            } catch (error) {
              return { value: entry.value, label: `${entry.label} (unavailable)`, disabled: true, title: messageOf(error) };
            }
          }),
        );
        image.set("");
      }
    });
  }

  // --- slide structure -----------------------------------------------------------------------------

  const slideBox = h("div", { class: "opf-dc-actions-block", "data-role": "slide-structure" });
  {
    const layouts = selectField("region-layout", "Place the blocks in regions", {
      empty: "Choose a layout…",
      help: "Each block gets its own part of the slide. Undo returns them to one list.",
      onChange: (value) => {
        const slideIndex = getSlide();
        const choice = REGION_LAYOUTS[blockCount(slideIndex)]?.find((entry) => entry.id === value);
        if (!choice) return;
        run(() => placeBlocksInRegions(editor, slideIndex, choice.regions), (change) => `Blocks placed: ${choice.label.toLowerCase()}. ${lossText(change)}`);
        reselect(`slides.${slideIndex}`);
      },
    });
    const toBlocks = action("Turn regions into blocks", {
      role: "regions-to-blocks",
      prepare: () => prepareRegionsToBlocks(editor.document, getSlide(), { validate: false }),
      apply: () => regionsAsBlocks(editor, getSlide()),
      done: "Regions are now blocks, in reading order.",
    });
    const designImages = Object.keys(DESIGN_IMAGE_LABELS).map((source) =>
      action(`Move the ${DESIGN_IMAGE_LABELS[source]} into the content`, {
        role: `back-${source}`,
        prepare: () => prepareImageToContent(editor.document, getSlide(), source, { validate: false }),
        apply: () => moveImageToContent(editor, getSlide(), source),
        done: `The ${DESIGN_IMAGE_LABELS[source]} is now an image block.`,
      }),
    );
    slideBox.append(layouts.wrap, toBlocks.wrap, ...designImages.map((entry) => entry.wrap));
    updaters.push((state) => {
      const slide = editor.document.slides?.[state.slideIndex];
      if (!slide) return;
      const regions = regionKeysOfSlide(slide);
      const count = blockCount(state.slideIndex);
      const choices = regions.length ? [] : (REGION_LAYOUTS[count] ?? []);
      layouts.wrap.hidden = choices.length === 0;
      if (choices.length) {
        layouts.setOptions(
          choices.map((choice) => {
            try {
              const prepared = prepareBlocksToRegions(editor.document, state.slideIndex, choice.regions, { validate: false });
              return { value: choice.id, label: `${choice.label}${prepared.loss.length ? ` (loses ${prepared.loss.join(", ")})` : ""}` };
            } catch (error) {
              return { value: choice.id, label: `${choice.label} (unavailable)`, disabled: true, title: messageOf(error) };
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
    const slide = editor.document.slides?.[slideIndex];
    if (!slide) return 0;
    if (Array.isArray(slide.blocks)) return slide.blocks.length;
    return ["text", "items", "bullets", "image", "video", "chart", "table", "code", "metric", "quote", "timeline"].filter((key) => slide[key] !== undefined).length;
  }

  return {
    /** Nodes for the "Selected content" section: list levels, the group-of-metrics conversion and the arrange actions. */
    nodes: { list, metrics: metrics.wrap, arrange },
    /** The node for the "Slide structure" section. */
    slideNode: slideBox,
    /** Update every control from the session and the current selection. */
    sync(state) {
      const slide = editor.document.slides?.[state.slideIndex];
      const imageBlock = state.blockPath ? isImageBlock(editor, state.blockPath) : false;
      const full = { ...state, imageBlock, metricGroupPath: state.selectedPath ? metricGroupForSelection(editor.document, state.selectedPath) : undefined, slide };
      ctxState.current = full;
      for (const update of updaters) update(full);
    },
  };
}

function isImageBlock(editor, blockPath) {
  const block = editor.get(blockPath);
  if (!block || typeof block !== "object" || Array.isArray(block)) return false;
  const keys = Object.keys(block).filter((key) => key !== "id" && key !== "extensions" && key !== "type");
  return keys.length === 1 && keys[0] === "image";
}
