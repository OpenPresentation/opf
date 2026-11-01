// #region define
import "@openpresentation/opf-editor/element/define";
import { gallery } from "@openpresentation/gallery";

// The tag is defined by the import above. Give it its catalogs before it mounts (it starts after the first microtask).
document.querySelector("#hero").catalogs = [gallery];
// #endregion

// #region listen
const label = document.querySelector("#deck-name");
document.addEventListener("opf-deck-name", ({ detail }) => {
  label.textContent = detail.name || "Untitled presentation";
});
// #endregion
