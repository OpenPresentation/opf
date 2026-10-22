import type { Catalog, CatalogKind, CatalogRecordChange, EmbeddedRecord, UnresolvedReferenceDiagnostic, ValidationReport } from "@openpresentation/opf";
import type { CatalogOption, EditorChange, EditorSession, JsonPatchOperation } from "./index.js";

/** One catalog list: the session's registration first, then each host list; the first catalog with a `source` wins. Throws `invalid-catalogs` for an entry without a source. */
export declare function mergeCatalogs(...lists: (readonly Catalog[] | Catalog | undefined | null)[]): readonly Catalog[];
/** The catalogs for one operation: `editor.catalogs`, then `options.catalogs`. */
export declare function catalogsFor(editor: EditorSession | undefined, options?: { catalogs?: readonly Catalog[] }): readonly Catalog[];
/** A record's picker label: its name, then its gallery label, then the id. */
export declare function catalogRecordLabel(record: Record<string, unknown> | undefined, id: string): string;
/** Core's `catalogRecords` as picker options: embedded records first, then registered ones; `id` is the reference to write. */
export declare function listCatalogRecords(presentation: unknown, kind: CatalogKind, options?: { catalogs?: readonly Catalog[] }): CatalogOption[];

export interface SavedDocument {
  /** The self-contained document: every referenced record embedded once under its group, `x-*` stripped. */
  document: unknown;
  added: EmbeddedRecord[];
  unresolved: UnresolvedReferenceDiagnostic[];
}
/** Core's `embed`: the document to save or hand on, which renders the same with no catalog registered. The input is not changed. */
export declare function prepareSave(presentation: unknown, options?: { catalogs?: readonly Catalog[] }): SavedDocument;
/** `prepareSave` of the session's document with its registered catalogs (and `options.catalogs`). The session is not changed. */
export declare function saveDocument(editor: EditorSession, options?: { catalogs?: readonly Catalog[] }): SavedDocument;

export interface CatalogUpdateCheck {
  /** One per embedded record (under `default` or a named group) whose registered record differs. */
  changes: CatalogRecordChange[];
  /** RFC 6902; apply only after the author approves (`applyCatalogUpdate`). */
  patch: JsonPatchOperation[];
}
/** The "Update from catalog" check (core's `updateFromCatalog`). Applies nothing. `refs` limits it to some references. */
export declare function checkCatalogUpdates(presentation: unknown, options?: { catalogs?: readonly Catalog[]; refs?: readonly { kind: CatalogKind; reference: string }[] }): CatalogUpdateCheck;
/** Apply the approved updates (`refs`) as ONE undoable step, recomputed against the session's current document. */
export declare function applyCatalogUpdate(
  editor: EditorSession,
  options: { refs: readonly { kind: CatalogKind; reference: string }[]; catalogs?: readonly Catalog[]; meta?: Record<string, unknown> },
): EditorChange & { changed: boolean; changes: CatalogRecordChange[] };

export declare const REFERENCE_FINDING_CODES: readonly ["opf/unresolved-reference", "opf/undeclared-catalog", "opf/catalog-record-not-in-source"];
/** The reference and embedded-record findings (`REFERENCE_FINDING_CODES`) of a report. */
export declare function referenceFindings(validation: ValidationReport | undefined): ValidationReport["findings"];

export interface CatalogRecordRef { group: string; kind: CatalogKind; id: string }
/** The record a `opf/catalog-record-not-in-source` finding path names (`/catalogs/<group>/<kind>/<id>`). */
export declare function catalogRecordAt(path: string): CatalogRecordRef | undefined;
/** Move a record embedded under `default` or a named group into `catalogs.custom`, rewriting the references that resolved to it. */
export declare function prepareMoveToCustom(presentation: unknown, target: CatalogRecordRef, options?: { catalogs?: readonly Catalog[] }): { presentation: unknown; patches: JsonPatchOperation[]; changed: boolean; from: CatalogRecordRef; to: CatalogRecordRef };
/** `prepareMoveToCustom` as one undoable step on the session. */
export declare function moveToCustom(editor: EditorSession, target: CatalogRecordRef, options?: { catalogs?: readonly Catalog[]; meta?: Record<string, unknown> }): EditorChange & { changed: boolean; from: CatalogRecordRef; to: CatalogRecordRef };
