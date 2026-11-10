// ext-apps 2 uses split SDK peers in its inlined browser View. The public server
// remains SDK1; no SDK2 object crosses that boundary, only MCP wire data.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {App} from '@modelcontextprotocol/ext-apps';
import {Protocol} from '@modelcontextprotocol/client';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {createOpfServer, DECK_APP_HTML} from '../dist/index.js';

test('the actual View SDK imports its required split peers while the public server keeps its SDK1 API', async () => {
  assert.ok(App.prototype instanceof Protocol, 'the installed App really uses the SDK2 client Protocol');
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(manifest.devDependencies['@modelcontextprotocol/ext-apps'], '2.0.4');
  assert.equal(manifest.devDependencies['@modelcontextprotocol/client'], '2.0.0');
  assert.equal(manifest.devDependencies['@modelcontextprotocol/core'], '2.0.0');
  assert.equal(manifest.dependencies['@modelcontextprotocol/sdk'], '1.32.2');
  for (const name of ['@modelcontextprotocol/ext-apps', '@modelcontextprotocol/client', '@modelcontextprotocol/core'])
    assert.equal(manifest.dependencies[name], undefined, name + ' is compiled into the View rather than added to the server runtime graph');
  const server = createOpfServer({version: '0.0.0-dependency-test'});
  assert.ok(server instanceof McpServer, 'published server return type retains its real SDK1 constructor');
  assert.match(DECK_APP_HTML, /<script type="module">/);
  await server.close();
});


test('the real server exposes the newly generated icon through its existing SDK1 wire client', async () => {
  const server = createOpfServer({version: '0.0.0-dependency-test'});
  const client = new Client({name: 'dependency-wire-client', version: '1.0.0'});
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  try {
    await client.connect(clientSide);
    const result = await client.callTool({name: 'search_icons', arguments: {query: 'moped', set: 'lucide', limit: 1}});
    assert.equal(result.isError, undefined);
    assert.equal(result.structuredContent.icons[0].icon, 'lucide:moped');
  } finally { await client.close(); await server.close(); }
});
