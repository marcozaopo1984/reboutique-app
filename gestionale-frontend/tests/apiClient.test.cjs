const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function setup(fetch, authReady = Promise.resolve()) {
  const auth = {
    currentUser: { uid: 'user-a', getIdToken: async () => 'token-a' },
    authStateReady: () => authReady,
  };
  const source = fs.readFileSync(path.join(__dirname, '../lib/apiClient.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, require: () => ({ auth }), process: { env: {} },
    fetch, Headers, structuredClone,
  });
  return { auth, read: exports.fetchWithAuth };
}

test('concurrent identical reads share one request and return independent data', async () => {
  const gate = deferred();
  let calls = 0;
  const { read } = setup(async () => { calls++; await gate.promise; return Response.json([{ id: 1 }]); });
  const first = read('/payments');
  const second = read('/payments');
  await new Promise(setImmediate);
  assert.equal(calls, 1);
  gate.resolve();
  const [a, b] = await Promise.all([first, second]);
  a[0].id = 2;
  assert.equal(b[0].id, 1);
});

test('completed reads are always fetched again', async () => {
  let calls = 0;
  const { read } = setup(async () => Response.json({ version: ++calls }));
  assert.equal((await read('/payments')).version, 1);
  assert.equal((await read('/payments')).version, 2);
});

test('pending requests are isolated by user', async () => {
  const gate = deferred();
  let calls = 0;
  const { read, auth } = setup(async () => { calls++; await gate.promise; return Response.json([]); });
  const a = read('/payments');
  await new Promise(setImmediate);
  auth.currentUser = { uid: 'user-b', getIdToken: async () => 'token-b' };
  const b = read('/payments');
  await new Promise(setImmediate);
  assert.equal(calls, 2);
  gate.resolve();
  await Promise.all([a, b]);
});

test('failed reads do not prevent a fresh retry', async () => {
  let calls = 0;
  const { read } = setup(async () => ++calls === 1
    ? new Response('Temporary error', { status: 503 }) : Response.json([]));
  await assert.rejects(read('/payments'), /503/);
  await read('/payments');
  assert.equal(calls, 2);
});

test('a mutation prevents reuse of a read started before it', async () => {
  const gate = deferred();
  let gets = 0;
  const { read } = setup(async (_, options) => {
    if (options.method === 'PATCH') return Response.json({ ok: true });
    gets++;
    if (gets === 1) await gate.promise;
    return Response.json([]);
  });
  const oldRead = read('/payments');
  await new Promise(setImmediate);
  await read('/payments/1', { method: 'PATCH', body: '{}' });
  await read('/payments');
  assert.equal(gets, 2);
  gate.resolve();
  await oldRead;
});

test('abortable requests stay independent', async () => {
  let calls = 0;
  const { read } = setup(async () => { calls++; return Response.json([]); });
  await Promise.all([
    read('/payments', { signal: new AbortController().signal }),
    read('/payments', { signal: new AbortController().signal }),
  ]);
  assert.equal(calls, 2);
});

test('reads begun during a mutation are not reused after it completes', async () => {
  const mutation = deferred();
  const reads = deferred();
  let gets = 0;
  const { read } = setup(async (_, options) => {
    if (options.method === 'PATCH') {
      await mutation.promise;
    } else {
      gets++;
      await reads.promise;
    }
    return Response.json([]);
  });
  const write = read('/payments/1', { method: 'PATCH', body: '{}' });
  await new Promise(setImmediate);
  const during = read('/payments');
  await new Promise(setImmediate);
  mutation.resolve();
  await write;
  const after = read('/payments');
  await new Promise(setImmediate);
  assert.equal(gets, 2);
  reads.resolve();
  await Promise.all([during, after]);
});

test('an older read completing cannot remove its pending replacement', async () => {
  const old = deferred();
  const replacement = deferred();
  let gets = 0;
  const { read } = setup(async (_, options) => {
    if (options.method !== 'PATCH') {
      gets++;
      await (gets === 1 ? old.promise : replacement.promise);
    }
    return Response.json([]);
  });
  const first = read('/payments');
  await new Promise(setImmediate);
  await read('/payments/1', { method: 'PATCH', body: '{}' });
  const second = read('/payments');
  await new Promise(setImmediate);
  old.resolve();
  await first;
  const third = read('/payments');
  await new Promise(setImmediate);
  assert.equal(gets, 2);
  replacement.resolve();
  await Promise.all([second, third]);
});

test('waits for Firebase persistence before reading current user', async () => {
  const ready = deferred();
  const { auth, read } = setup(async () => Response.json([]), ready.promise);
  const user = auth.currentUser;
  auth.currentUser = null;
  const request = read('/payments');
  auth.currentUser = user;
  ready.resolve();
  await request;
});

test('supports Headers instances and keeps different headers independent', async () => {
  const seen = [];
  const { read } = setup(async (_, options) => {
    seen.push(options.headers.get('X-View'));
    assert.equal(options.headers.get('Authorization'), 'Bearer token-a');
    return Response.json([]);
  });
  await Promise.all([
    read('/payments', { headers: new Headers({ 'X-View': 'a' }) }),
    read('/payments', { headers: new Headers({ 'X-View': 'b' }) }),
  ]);
  assert.deepEqual(seen, ['a', 'b']);
});
