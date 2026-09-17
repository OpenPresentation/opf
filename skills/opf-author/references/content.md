# Content shape guide

Consult the installed schema for optional fields and constraints. This guide selects the common forms; it is not a second schema.

| Intent | OPF shape |
| --- | --- |
| Plain text | `{"text":"A useful assertion"}` |
| Rich text | `{"text":[{"text":"Important","bold":true}," detail"]}` |
| List | `{"items":["First point","Second point"]}` |
| Image | `{"image":{"src":"asset:diagram","alt":"Description of the diagram"}}` |
| Video | `{"video":{"src":"asset:demo","title":"Demo"}}` |
| Table | `{"table":{"columns":["Quarter","Revenue"],"rows":[["Q1",12],["Q2",18]]}}` |
| Chart | `{"chart":{"type":"column","data":{"columns":["Quarter","Revenue"],"rows":[["Q1",12],["Q2",18]]}}}` |
| Metric | `{"metric":{"value":98,"unit":"%","label":"Retention"}}` |
| Quote | `{"quote":{"text":"Quoted words","attribution":"Source speaker","source":"Source reference"}}` |
| Code | `{"code":{"source":"const answer = 42;","language":"javascript"}}` |
| Timeline | `{"timeline":[{"when":"Now","what":"Prototype"},{"when":"Next","what":"Review"}]}` |
| Nested group | `{"composition":{"mode":"column"},"blocks":[{"text":"One"},{"text":"Two"}]}` |

These numeric examples are illustrative; replace them only with supported data. Chart type strings must resolve to actual catalog IDs or supported chart types. A richer chart record does not guarantee the current renderer implements every visual detail.

Keep numbers numeric where the schema permits them. Tables use `columns` and `rows`, not `headers` and `cells`. OPF slide content is not an `elements` array or arbitrary HTML. Promoted region values are content payloads, for example `"left":{"text":"Context"}`.

The presentation root accepts identity, organizations, speakers, author, audience, purpose, language, tone, takeaway, duration, tags, design, narrative, slides, assets, catalogs, and extensions. Query the schema for object alternatives and required fields. Do not put old `version`/`meta` wrappers into the current canonical document.

Assets may be source strings or asset metadata objects. Reusable references use `asset:<id>`. Inline catalog records live in `catalogs.<kind>.records`; record `$schema` identifies its companion schema. Asset and catalog sources are declarations, not evidence that a renderer fetched them.

Validation in a project with the package installed:

```js
import { validatePresentation } from '@openpresentation/opf';
const result = validatePresentation(document);
if (!result.valid) throw new Error(JSON.stringify(result.errors));
console.log(result.warnings);
```
