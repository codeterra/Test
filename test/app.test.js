const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createApp } = require('../app');

async function withApp(run) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'names-api-'));
  const dataFile = path.join(directory, 'names.json');
  const server = http.createServer(createApp(dataFile));

  await new Promise((resolve) => server.listen(0, resolve));

  try {
    await run(server, dataFile);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  }
}

function request(server, method, pathname, body) {
  return new Promise((resolve, reject) => {
    const payload = body && JSON.stringify(body);
    const call = http.request({
      host: '127.0.0.1',
      port: server.address().port,
      path: pathname,
      method,
      headers: payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : undefined
    }, (response) => {
      let text = '';
      response.on('data', (chunk) => { text += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(text) }));
    });

    call.on('error', reject);
    call.end(payload);
  });
}

test('creates, lists, and persists names', async () => {
  await withApp(async (server, dataFile) => {
    assert.deepEqual(await request(server, 'GET', '/name'), { status: 200, body: { names: [] } });
    assert.deepEqual(await request(server, 'PUT', '/name', { name: 'Ada' }), { status: 201, body: { name: 'Ada' } });
    assert.deepEqual(await request(server, 'GET', '/name'), { status: 200, body: { names: ['Ada'] } });
    assert.deepEqual(JSON.parse(await fs.readFile(dataFile, 'utf8')), ['Ada']);
  });
});

test('rejects duplicate names', async () => {
  await withApp(async (server) => {
    await request(server, 'PUT', '/name', { name: 'Ada' });
    assert.deepEqual(await request(server, 'PUT', '/name', { name: 'Ada' }), { status: 409, body: { error: 'Name already exists' } });
    assert.deepEqual(await request(server, 'PATCH', '/name/Ada', { name: 'Ada' }), { status: 409, body: { error: 'Name already exists' } });
  });
});

test('renames existing names and reports missing names', async () => {
  await withApp(async (server) => {
    await request(server, 'PUT', '/name', { name: 'Ada' });
    assert.deepEqual(await request(server, 'PATCH', '/name/Ada', { name: 'Grace' }), { status: 200, body: { name: 'Grace' } });
    assert.deepEqual(await request(server, 'PATCH', '/name/Ada', { name: 'Lin' }), { status: 404, body: { error: 'Name not found' } });
  });
});

test('reports malformed data files', async () => {
  await withApp(async (server, dataFile) => {
    await fs.writeFile(dataFile, '{');
    assert.deepEqual(await request(server, 'GET', '/name'), { status: 500, body: { error: 'Unable to read names' } });
  });
});
