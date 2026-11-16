import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createOpfServer } from '../dist/index.js';

// Lucide renamed triangle-alert (and alert-triangle before it) to triangle-exclamation-point; search_icons finds it by either old name.
test('search_icons finds a renamed icon by its former names, first', async () => {
  const server = createOpfServer({ version: '0.0.0-test' });
  const client = new Client({ name: 'renamed-icons', version: '1' });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  try {
    await client.connect(clientSide);
    for (const query of ['triangle-alert', 'alert-triangle']) {
      const result = await client.callTool({ name: 'search_icons', arguments: { query, set: 'lucide', limit: 3 } });
      assert.equal(result.isError, undefined);
      assert.equal(result.structuredContent.icons[0].icon, 'lucide:triangle-exclamation-point', query);
    }
  } finally { await client.close(); await server.close(); }
});
