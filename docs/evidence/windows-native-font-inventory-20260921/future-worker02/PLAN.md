# Native PowerPoint font inventory worker (preparation only)

This worker is prepared for independent review. It has not opened PowerPoint,
registered fonts, or written a native presentation. Root alone may decide whether
to execute a frozen and reviewed copy.

The parent validates the corrected offline candidate and pinned registry source,
copies source/report/runtime metadata plus the four already licensed Carlito
faces into one fresh local run directory, then owns the temporary session font
registrations and the worker process. The child opens only its immutable PPTX
snapshot read-only, confirms the path/read-only/one-slide/one-text-shape
preconditions, reads the current text and four authored rich-run ranges, and
enumerates at most 64 `Presentation.Fonts` entries (`Name`, `Embeddable`, and
`Embedded`). It performs one exact owned close and no edit, save, embedding,
reopen, font replacement, PDF, or application quit.

COM observations have durable individual begin/success/error stages and a stop
latch. A COM error prevents later Office calls; the worker does not retry or
close through the failed latch. Content/style checks and the permitted
Carlito-family/style inventory gate are computed after close. A non-Carlito
entry is an acceptance failure, not a COM failure. The observed name/flags do
not prove which physical file supplied a glyph.

`-ValidateInputs` and `-PureRegression` must remain offline. They may be run
before review. They do not register fonts or call Office/COM.
