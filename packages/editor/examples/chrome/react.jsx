import { useState } from "react";
import { createRoot } from "react-dom/client";
// #region imports
import { OpfEditor, useOpfDeckName, useOpfDirty } from "@openpresentation/opf-editor/react";
import { gallery } from "@openpresentation/gallery";
import { loadPreviewFonts } from "@openpresentation/opf-render/preview-fonts";
// #endregion
import { deck } from "./deck.js";

const fonts = loadPreviewFonts("./opf-fonts/");

// #region app
function App() {
  const [editor, setEditor] = useState(null);
  const [name, setName] = useOpfDeckName(editor);
  const dirty = useOpfDirty(editor);
  const [draft, setDraft] = useState(null); // what is typed, until Enter or blur renames the deck

  return (
    <>
      <div className="row">
        <input
          className="host-field"
          aria-label="Deck name"
          value={draft ?? name}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => { if (draft !== null) setName(draft); setDraft(null); }}
          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
        />
        <span id="dirty" className="badge" data-dirty={dirty}>{dirty ? "Unsaved changes" : "Saved"}</span>
      </div>
      <div className="card">
        <OpfEditor
          layout="embed"
          document={deck}
          catalogs={[gallery]}
          fonts={fonts}
          style={{ height: "100%" }}
          onEditor={setEditor}
        />
      </div>
    </>
  );
}
// #endregion

createRoot(document.querySelector("#root")).render(<App />);
