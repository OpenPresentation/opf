// Keep evidence readable by repository text-integrity tooling. JSON escaping
// preserves every original UTF-16 code unit after parsing; it is not normalization.
export const json = value => JSON.stringify(value).replace(/[\u007f-\uffff]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4,'0')}`);
