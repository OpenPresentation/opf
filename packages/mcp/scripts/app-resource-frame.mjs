import { createHash } from "node:crypto";
import { serializeMessage } from "@modelcontextprotocol/sdk/shared/stdio.js";

export const APP_RESOURCE_FRAME_LIMIT = 10 * 1024 * 1024;

// The viewer's resource URI: ui://opf/deck/ and the first 12 hex digits of the SHA-256 of its HTML. A host caches a view by its URI
// (ChatGPT says so), so the URI changes exactly when the page does. tsup builds it into DECK_APP_URI from app-dist/deck-app.html.
export function deckAppUri(html) {
  return `ui://opf/deck/${createHash("sha256").update(html).digest("hex").slice(0, 12)}`;
}

// Match server.ts's actual resource result for the viewer. Tests compare this with the live server result.
export function appResourceMessage(html, id = Number.MAX_SAFE_INTEGER) {
  return {jsonrpc:"2.0",id,result:{contents:[{uri:deckAppUri(html),mimeType:"text/html;profile=mcp-app",text:html,_meta:{ui:{prefersBorder:false,preferredDisplayMode:"fullscreen"}}}]}};
}

export function appResourceFrame(html, id) {
  return Buffer.from(serializeMessage(appResourceMessage(html,id)));
}

export function assertAppResourceFrame(html) {
  const bytes=appResourceFrame(html).length;
  if(bytes>APP_RESOURCE_FRAME_LIMIT)throw new Error(`The MCP viewer resource needs ${bytes} JSON-RPC bytes, exceeding the default SDK stdio limit of ${APP_RESOURCE_FRAME_LIMIT}. Reduce the viewer payload; do not raise client limits.`);
  return {bytes,limit:APP_RESOURCE_FRAME_LIMIT,headroom:APP_RESOURCE_FRAME_LIMIT-bytes};
}
