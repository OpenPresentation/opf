// NT-02: the ledger of the documents a run opened in Keynote, kept in the run directory as ledger.jsonl (one JSON line per
// change, appended, so a run that stops part way still leaves a true record). Keynote cannot tie an imported .pptx to its
// path (`file of document` is missing value), so a document is "ours" only by its id: check() refuses while a document
// that is not in the ledger is open, and the driver closes only ids it finds here.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const LEDGER_FILE = 'ledger.jsonl';

/**
 * Opens (or starts) the ledger of a run directory. Entries: { documentId, input, sha256Before, state, at }; state is
 * "open", "opened-after-timeout", "opened-after-error" or "closed". The latest line for an id wins.
 */
export function openLedger(runDir, { now = () => new Date() } = {}) {
  const file = path.join(runDir, LEDGER_FILE);
  const entries = new Map();
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (line.trim() === '') continue;
      const entry = JSON.parse(line);
      entries.set(entry.documentId, { ...entries.get(entry.documentId), ...entry });
    }
  }
  const write = (entry) => {
    mkdirSync(runDir, { recursive: true });
    appendFileSync(file, `${JSON.stringify(entry)}\n`);
  };
  return {
    file,
    /** Records a document this run opened. */
    add({ documentId, input, sha256Before, state = 'open' }) {
      if (typeof documentId !== 'string' || documentId === '') throw new Error('ledger: a document id is required');
      const entry = { documentId, input, sha256Before, state, at: now().toISOString() };
      entries.set(documentId, entry);
      write(entry);
      return entry;
    },
    /** Records a new state ("closed") for a document already in the ledger. */
    mark(documentId, state) {
      const previous = entries.get(documentId);
      if (!previous) throw new Error(`ledger: ${documentId} was not opened by this run`);
      const entry = { ...previous, state, at: now().toISOString() };
      entries.set(documentId, entry);
      write({ documentId, state, at: entry.at });
      return entry;
    },
    has: (documentId) => entries.has(documentId),
    get: (documentId) => entries.get(documentId),
    /** Ids this run opened and has not closed. */
    open: () => [...entries.values()].filter((entry) => entry.state !== 'closed').map((entry) => entry.documentId),
    entries: () => [...entries.values()],
  };
}

/** The open documents ([{ id, name }]) this run did not open: any one of them makes check() refuse. */
export function foreignDocuments(openDocuments, ledger) {
  return (openDocuments ?? []).filter((document) => !ledger.has(document.id));
}
