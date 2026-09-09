import {
  parseOpfTransfer,
  serializeOpfTransfer,
  prepareOpfImport,
  MAX_OPF_BYTES,
} from "../src/transfer.js";
import {
  loadOpfGallery,
  loadOpfGalleryItem,
  galleryItemUrl,
  normalizeGalleryUrl,
} from "../src/galleries.js";
import { renderSvg } from "@openpresentation/opf-render/svg";
import { readPptxFile, showConversionDiagnostics } from './pptx-controls.js';

export function installTransferControls({
  editor,
  getCanvas,
  getSlideIndex,
  getSelectedPath,
  setSlideIndex,
  status,
  renderOptions,
  galleries,
}) {
  const $ = (id) => document.getElementById(id),
    importDialog = $("import-dialog"),
    copyDialog = $("copy-dialog");
  let transfer = null,
    prepared = null,
    requestId = 0,
    controller,
    loadedGallery,
    custom = [],
    source = "paste";
  const sourceKey = "opf.editor.galleries.v1";
  try {
    custom = JSON.parse(localStorage.getItem(sourceKey) ?? "[]")
      .filter(
        (item) =>
          item &&
          typeof item.name === "string" &&
          typeof item.url === "string" &&
          (() => {
            try {
              normalizeGalleryUrl(item.url, location.href);
              return true;
            } catch {
              return false;
            }
          })(),
      )
      .slice(0, 20);
  } catch {}
  const commit = () => !getCanvas() || getCanvas().commit();
  const error = (message) => {
    $("import-error").textContent = message;
    if (message) $("import-summary").textContent = "Review the message below";
  };
  const busy = (message) => {
    error("");
    $("import-conversion").hidden = true;
    $("import-diagnostics").replaceChildren();
    prepared = null;
    transfer = null;
    $("import-apply").disabled = true;
    $("import-copy").disabled = true;
    $("import-preview").replaceChildren();
    $("import-summary").textContent = message;
  };
  function cancelRequest() {
    requestId++;
    controller?.abort();
    controller = null;
  }
  function beginRequest() {
    cancelRequest();
    controller = new AbortController();
    return { id: requestId, signal: controller.signal };
  }
  function updatePreview() {
    prepared = null;
    $("import-apply").disabled = true;
    $("import-copy").disabled = !transfer;
    if (!transfer) return;
    try {
      const mode = $("import-action").value;
      const result = prepareOpfImport(editor.document, transfer, {
        mode,
        slideIndex: getSlideIndex(),
        path: getSelectedPath(),
      });
      const svg = renderSvg(result.document, {
        ...renderOptions,
        slideIndex: result.slideIndex,
      });
      $("import-preview").innerHTML = svg;
      prepared = result;
      error("");
      $("import-apply").disabled = false;
      const count = transfer.document?.slides.length;
      $("import-summary").textContent =
        mode === "selection"
          ? "Replace selected content"
          : `${count} ${count === 1 ? "slide" : "slides"} · ${mode === "insert" ? `insert after slide ${getSlideIndex() + 1}` : "open as presentation (undoable)"}`;
      $("import-apply").textContent =
        mode === "insert"
          ? "Insert slides"
          : mode === "replace"
            ? "Open presentation"
            : "Replace content";
    } catch (cause) {
      $("import-preview").replaceChildren();
      $("import-summary").textContent = "Review the source before importing";
      error(cause.message);
    }
  }
  function receive(value) {
    transfer =
      typeof value === "string"
        ? parseOpfTransfer(value)
        : parseOpfTransfer(JSON.stringify(value));
    if (!transfer.document) $("import-action").value = "selection";
    updatePreview();
  }
  function showTab(name) {
    source = name;
    cancelRequest();
    busy("Choose content to preview");
    for (const key of ["paste", "file", "gallery", "url"]) {
      $(`import-tab-${key}`).setAttribute(
        "aria-selected",
        String(key === name),
      );
      $(`import-tab-${key}`).tabIndex = key === name ? 0 : -1;
      $(`import-panel-${key}`).hidden = key !== name;
    }
    if (name === "paste" && $("import-text").value.trim())
      try {
        receive($("import-text").value);
      } catch (cause) {
        error(cause.message);
      }
    if (name === "gallery") {
      if (!loadedGallery) loadGallery();
      else renderEntries();
    }
  }
  function openImport(name = "paste", text) {
    if (!commit()) return;
    cancelRequest();
    loadedGallery = undefined;
    transfer = null;
    prepared = null;
    $("import-action").value = "insert";
    $("import-text").value = text ?? "";
    importDialog.showModal();
    showTab(name);
    if (name === "paste") $("import-text").focus();
  }
  function closeImport() {
    cancelRequest();
    importDialog.close();
  }
  async function copyText(text, output) {
    try {
      await navigator.clipboard.writeText(text);
      status("Copied OPF to clipboard");
      if (output)
        $("copy-status").textContent =
          "Copied. Ready to paste into an editor or LLM.";
    } catch {
      if (output) {
        output.focus();
        output.select();
        $("copy-status").textContent =
          "Press ⌘/Ctrl C to copy the selected OPF.";
      } else {
        openCopyText(text);
      }
    }
  }
  function copyValue() {
    const text = serializeOpfTransfer(editor.document, {
      scope: $("copy-scope").value,
      slideIndex: getSlideIndex(),
      path: getSelectedPath(),
      format: $("copy-format").value,
    });
    $("copy-output").value = text;
    $("copy-status").textContent =
      `${new TextEncoder().encode(text).length.toLocaleString()} bytes · ready to copy`;
    return text;
  }
  function openCopyText(text) {
    copyDialog.showModal();
    $("copy-output").value = text;
    $("copy-status").textContent =
      "Press Copy or select the text to copy it manually.";
  }
  function openCopy(scope = "presentation") {
    if (!commit()) return;
    $("copy-scope").value = scope;
    copyDialog.showModal();
    copyValue();
  }
  $("copy-opf").onclick = () => openCopy();
  $("copy-slide").onclick = () => openCopy("slide");
  $("copy-selection").onclick = () => openCopy("selection");
  $("copy-scope").onchange = copyValue;
  $("copy-format").onchange = copyValue;
  $("copy-confirm").onclick = () =>
    copyText($("copy-output").value, $("copy-output"));
  $("copy-select-all").onclick = () => {
    $("copy-output").focus();
    $("copy-output").select();
  };
  $("close-copy").onclick = () => copyDialog.close();
  $("add-opf").onclick = () => openImport();
  $("browse-gallery").onclick = () => openImport("gallery");
  $("close-import").onclick = closeImport;
  importDialog.addEventListener("cancel", cancelRequest);
  $("import-action").onchange = updatePreview;
  for (const tab of ["paste", "file", "gallery", "url"]) {
    $(`import-tab-${tab}`).onclick = () => showTab(tab);
    $(`import-tab-${tab}`).onkeydown = (event) => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const names = ["paste", "file", "gallery", "url"];
        const index =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? 3
              : (names.indexOf(tab) + (event.key === "ArrowRight" ? 1 : 3)) % 4;
        showTab(names[index]);
        $(`import-tab-${names[index]}`).focus();
      }
    };
  }
  $("import-text").oninput = () => {
    cancelRequest();
    busy("Reading OPF…");
    try {
      receive($("import-text").value);
    } catch (cause) {
      error(cause.message);
    }
  };
  $("read-clipboard").onclick = async () => {
    const { id } = beginRequest();
    busy("Reading clipboard…");
    try {
      const text = await navigator.clipboard.readText();
      if (id !== requestId || !importDialog.open) return;
      $("import-text").value = text;
      receive(text);
    } catch {
      if (id !== requestId || !importDialog.open) return;
      error(
        "Paste with ⌘/Ctrl V in the text box. Clipboard access is unavailable.",
      );
      $("import-text").focus();
    }
  };
  async function loadFile(file) {
    if (!file || !importDialog.open) return;
    const { id } = beginRequest();
    busy(`Reading ${file.name}…`);
    try {
      if (file.size > MAX_OPF_BYTES)
        throw new Error("Choose a file smaller than 20 MB.");
      const pptx = /\.pptx$/i.test(file.name) || file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      const result = pptx ? await readPptxFile(file) : { document: await file.text() };
      if (id !== requestId || !importDialog.open) return;
      if (pptx) {
        $("import-conversion").hidden = false;
        showConversionDiagnostics($("import-diagnostics"), result.diagnostics);
      }
      receive(result.document);
      $("file-name").textContent = file.name;
    } catch (cause) {
      if (id === requestId) error(cause.message);
    }
  }
  $("choose-opf-file").onclick = () => $("opf-file").click();
  $("opf-file").onchange = () => {
    loadFile($("opf-file").files[0]);
    $("opf-file").value = "";
  };
  const urlLoad = async () => {
    const { id, signal } = beginRequest();
    busy("Loading OPF…");
    try {
      const document = await loadOpfGalleryItem(
        { url: galleryItemUrl($("opf-url").value, location.href) },
        { signal, base: location.href },
      );
      if (id !== requestId) return;
      receive(document);
    } catch (cause) {
      if (id === requestId)
        error(`${cause.message} The source must allow browser access (CORS).`);
    }
  };
  $("load-opf-url").onclick = urlLoad;
  $("opf-url").onkeydown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      urlLoad();
    }
  };
  function sources() {
    return [...galleries, ...custom];
  }
  function renderSources(selected) {
    const choices = sources();
    $("gallery-source").replaceChildren(
      ...choices.map((item) => {
        const option = document.createElement("option");
        option.value = normalizeGalleryUrl(item.url, location.href);
        option.textContent = item.name;
        return option;
      }),
    );
    if (selected) $("gallery-source").value = selected;
    $("remove-gallery").disabled = !custom.some(
      (item) =>
        normalizeGalleryUrl(item.url, location.href) ===
        $("gallery-source").value,
    );
  }
  renderSources();
  function renderEntries() {
    const query = $("gallery-search").value.trim().toLowerCase();
    const matches = (loadedGallery?.items ?? []).filter((item) =>
      `${item.name} ${item.description} ${item.category}`
        .toLowerCase()
        .includes(query),
    );
    $("gallery-count").textContent =
      `${matches.length} examples${matches.length > 60 ? " · refine your search to see more" : ""}`;
    $("gallery-results").replaceChildren(
      ...matches.slice(0, 60).map((item) => {
        const button = document.createElement("button");
        button.className = "gallery-result";
        button.type = "button";
        const name = document.createElement("strong"),
          category = document.createElement("span");
        name.textContent = item.name;
        category.textContent = item.category;
        button.append(name, category);
        button.onclick = () => pickItem(item, button);
        return button;
      }),
    );
  }
  async function loadGallery(url = $("gallery-source").value, save = false) {
    const { id, signal } = beginRequest();
    busy("Loading gallery…");
    loadedGallery = undefined;
    $("gallery-results").replaceChildren();
    $("gallery-count").textContent = "Loading…";
    try {
      const gallery = await loadOpfGallery(url, {
        signal,
        base: location.href,
      });
      if (id !== requestId) return;
      loadedGallery = gallery;
      if (save) {
        if (
          !sources().some(
            (item) =>
              normalizeGalleryUrl(item.url, location.href) === gallery.url,
          )
        ) {
          custom.push({ name: gallery.name, url: gallery.url });
          custom = custom.slice(-20);
          try {
            localStorage.setItem(sourceKey, JSON.stringify(custom));
          } catch {
            error(
              "Gallery loaded for this session; browser storage is unavailable.",
            );
          }
        }
        renderSources(gallery.url);
      }
      $("gallery-search").value = "";
      renderEntries();
      $("import-summary").textContent = "Select an example to preview";
    } catch (cause) {
      if (id !== requestId) return;
      $("gallery-count").textContent = "Could not load gallery";
      error(`${cause.message} Check the registry URL and CORS settings.`);
    }
  }
  async function pickItem(item, button) {
    const { id, signal } = beginRequest();
    busy(`Loading ${item.name}…`);
    for (const child of $("gallery-results").children)
      child.setAttribute("aria-pressed", String(child === button));
    try {
      const document = await loadOpfGalleryItem(item, {
        gallery: loadedGallery.url,
        signal,
      });
      if (id !== requestId) return;
      receive(document);
    } catch (cause) {
      if (id === requestId) error(cause.message);
    }
  }
  $("gallery-source").onchange = () => {
    loadedGallery = undefined;
    $("remove-gallery").disabled = !custom.some(
      (item) => item.url === $("gallery-source").value,
    );
    loadGallery();
  };
  $("reload-gallery").onclick = () => loadGallery();
  $("gallery-search").oninput = renderEntries;
  $("add-gallery").onclick = () => {
    try {
      const url = normalizeGalleryUrl($("gallery-url").value, location.href);
      loadGallery(url, true);
    } catch (cause) {
      error(cause.message);
    }
  };
  $("remove-gallery").onclick = () => {
    custom = custom.filter((item) => item.url !== $("gallery-source").value);
    try {
      localStorage.setItem(sourceKey, JSON.stringify(custom));
    } catch {}
    renderSources();
    loadGallery();
  };
  $("import-copy").onclick = () => {
    if (transfer)
      copyText(JSON.stringify(transfer.document ?? transfer.value, null, 2));
  };
  $("import-apply").onclick = () => {
    if (!transfer || !prepared || !commit()) return;
    try {
      const result = prepareOpfImport(editor.document, transfer, {
        mode: $("import-action").value,
        slideIndex: getSlideIndex(),
        path: getSelectedPath(),
      });
      renderSvg(result.document, {
        ...renderOptions,
        slideIndex: result.slideIndex,
      });
      setSlideIndex(result.slideIndex);
      editor.applyPatch([{ op: "replace", path: "", value: result.document }], {
        source: "import",
        rejectInvalid: true,
      });
      closeImport();
      status("OPF imported · Undo restores the previous document");
    } catch (cause) {
      error(cause.message);
    }
  };
  const editing = (target) =>
    target?.closest?.('input,textarea,[contenteditable="true"],dialog[open]');
  document.addEventListener("copy", (event) => {
    if (editing(event.target) || !event.clipboardData || !window.getSelection()?.isCollapsed) return;
    if (!commit()) return;
    event.clipboardData.setData(
      "text/plain",
      serializeOpfTransfer(editor.document, {
        scope: event.target.closest?.("#preview") ? "selection" : "slide",
        slideIndex: getSlideIndex(),
        path: getSelectedPath(),
      }),
    );
    event.preventDefault();
    status("Copied OPF");
  });
  document.addEventListener("paste", (event) => {
    if (editing(event.target)) return;
    const text = event.clipboardData?.getData("text/plain");
    if (text) {
      event.preventDefault();
      openImport("paste", text);
    }
  });
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && !editing(event.target)) {
      if (event.key.toLowerCase() === "o") {
        event.preventDefault();
        openImport("file");
        $("opf-file").click();
      }
      if (event.key.toLowerCase() === "c" && event.shiftKey) {
        event.preventDefault();
        openCopy();
      }
    }
  });
  document.addEventListener("dragover", (event) => {
    if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
  });
  document.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    event.preventDefault();
    if (!/\.(opf|json|pptx)$/i.test(file.name)) {
      status("Drop an .opf, .json or .pptx file to import it.");
      return;
    }
    if (importDialog.open) showTab("file");
    else openImport("file");
    if (importDialog.open) loadFile(file);
  });
  return { openImport, openCopy };
}
