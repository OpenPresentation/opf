import assert from "node:assert/strict";
import {test} from "node:test";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StdioClientTransport} from "@modelcontextprotocol/sdk/client/stdio.js";
import {ReadBuffer,STDIO_DEFAULT_MAX_BUFFER_SIZE,serializeMessage} from "@modelcontextprotocol/sdk/shared/stdio.js";
import {appResourceFrame,appResourceMessage,assertAppResourceFrame} from "../scripts/app-resource-frame.mjs";
import {DECK_APP_HTML} from "../dist/index.js";
import {BIN} from "./helpers/mcp-client.mjs";

test("the exact escaped viewer frame fits the unchanged default SDK transport",()=>{
  const frame=appResourceFrame(DECK_APP_HTML);
  assert.equal(frame.toString(),serializeMessage(appResourceMessage(DECK_APP_HTML)));
  assert.equal(assertAppResourceFrame(DECK_APP_HTML).limit,STDIO_DEFAULT_MAX_BUFFER_SIZE);
  const reader=new ReadBuffer();reader.append(frame.subarray(0,65536));reader.append(frame.subarray(65536));
  assert.deepEqual(reader.readMessage(),appResourceMessage(DECK_APP_HTML));
});

test("exact-limit frames pass and one additional byte fails both build guard and SDK",()=>{
  const overhead=appResourceFrame("").length;
  const html="x".repeat(STDIO_DEFAULT_MAX_BUFFER_SIZE-overhead),frame=appResourceFrame(html);
  assert.equal(frame.length,STDIO_DEFAULT_MAX_BUFFER_SIZE);
  assert.equal(assertAppResourceFrame(html).headroom,0);
  const accepted=new ReadBuffer();accepted.append(frame);assert.equal(accepted.readMessage().result.contents[0].text.length,html.length);
  assert.throws(()=>assertAppResourceFrame(html+"x"),/exceeding the default SDK stdio limit/);
  assert.throws(()=>new ReadBuffer().append(appResourceFrame(html+"x")),/ReadBuffer exceeded maximum size/);
  const escaping="\"".repeat(Math.floor(STDIO_DEFAULT_MAX_BUFFER_SIZE/2));
  assert.ok(Buffer.byteLength(escaping)<STDIO_DEFAULT_MAX_BUFFER_SIZE);
  assert.throws(()=>assertAppResourceFrame(escaping),/exceeding the default SDK stdio limit/,"raw HTML below the cap is insufficient when its JSON escapes cross it");
});

test("a default real stdio client reads the entire viewer then remains connected",async()=>{
  const transport=new StdioClientTransport({command:process.execPath,args:[BIN],stderr:"pipe"});
  let stderr="";transport.stderr.on("data",chunk=>{if(stderr.length<65536)stderr+=chunk.toString().slice(0,65536-stderr.length);});
  const errors=[],client=new Client({name:"frame-contract",version:"1"});client.onerror=error=>errors.push(String(error));
  try{
    await client.connect(transport);
    const result=await client.readResource({uri:"ui://opf/deck"});
    assert.deepEqual(result,appResourceMessage(DECK_APP_HTML).result,"the build budget sizes the real production resource shape and metadata");
    assert.equal(result.contents[0].text,DECK_APP_HTML);
    const schema=await client.callTool({name:"get_schema",arguments:{name:"Chart"}});
    assert.equal(schema.structuredContent.pointer,"/$defs/Chart");
    assert.deepEqual(errors,[],stderr);
  }finally{await client.close();}
});
