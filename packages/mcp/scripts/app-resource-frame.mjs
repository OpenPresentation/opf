import { serializeMessage } from "@modelcontextprotocol/sdk/shared/stdio.js";

export const APP_RESOURCE_FRAME_LIMIT = 10 * 1024 * 1024;

// Match server.ts's actual ui://opf/deck resource result. Tests compare this with the live server result.
export function appResourceMessage(html, id = Number.MAX_SAFE_INTEGER) {
  return {jsonrpc:"2.0",id,result:{contents:[{uri:"ui://opf/deck",mimeType:"text/html;profile=mcp-app",text:html,_meta:{ui:{prefersBorder:false}}}]}};
}

export function appResourceFrame(html, id) {
  return Buffer.from(serializeMessage(appResourceMessage(html,id)));
}

export function assertAppResourceFrame(html) {
  const bytes=appResourceFrame(html).length;
  if(bytes>APP_RESOURCE_FRAME_LIMIT)throw new Error(`The MCP viewer resource needs ${bytes} JSON-RPC bytes, exceeding the default SDK stdio limit of ${APP_RESOURCE_FRAME_LIMIT}. Reduce the viewer payload; do not raise client limits.`);
  return {bytes,limit:APP_RESOURCE_FRAME_LIMIT,headroom:APP_RESOURCE_FRAME_LIMIT-bytes};
}
