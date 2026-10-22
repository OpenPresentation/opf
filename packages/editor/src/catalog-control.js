// Framework-neutral event handling: rejected edits restore the committed value
// and reach the host callback and a bubbling opferror event.
export function commitCatalogControl(node, onError, sync, commit) {
  try {
    commit();
    node.setCustomValidity?.("");
    node.removeAttribute?.("aria-invalid");
    node.removeAttribute?.("data-opf-error");
    return true;
  } catch (error) {
    sync();
    node.setCustomValidity?.(error.message);
    node.setAttribute?.("aria-invalid", "true");
    node.setAttribute?.("data-opf-error", error.message);
    onError?.(error);
    const Event = node.ownerDocument?.defaultView?.CustomEvent;
    if (Event) node.dispatchEvent?.(new Event("opferror", { detail: error, bubbles: true }));
    node.reportValidity?.();
    return false;
  }
}
