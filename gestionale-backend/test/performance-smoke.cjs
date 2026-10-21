// Run after npm run build: node test/performance-smoke.cjs
// Exercises the compiled middleware with an isolated controller; never loads Firebase.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRequire } = require('node:module');
const { Module, Controller, Get } = require('@nestjs/common');
const core = require('@nestjs/core');
const request = require('supertest');

async function main() {
  const rows = Array.from({ length: 1000 }, (_, id) => ({
    id, name: `Property ${id}`, city: 'Milano', amount: 1234,
  }));
  class ProbeController { list() { return rows; } }
  Controller('probe')(ProbeController);
  Get()(ProbeController.prototype, 'list', Object.getOwnPropertyDescriptor(ProbeController.prototype, 'list'));
  class ProbeModule {}
  Module({ controllers: [ProbeController] })(ProbeModule);

  const app = await core.NestFactory.create(ProbeModule, { logger: false });
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const adapter = {
    use: app.use.bind(app),
    useGlobalPipes: app.useGlobalPipes.bind(app),
    enableCors: app.enableCors.bind(app),
    async listen() {
      try {
        await app.init();
        resolveReady();
      } catch (error) {
        rejectReady(error);
      }
    },
  };
  const filename = path.resolve(__dirname, '../dist/src/main.js');
  const localRequire = createRequire(filename);
  const isolatedRequire = (id) => {
    if (id === './app.module') return { AppModule: ProbeModule };
    if (id === '@nestjs/core') {
      return { ...core, NestFactory: { create: async () => adapter } };
    }
    return localRequire(id);
  };

  try {
    // Pin only this VM's environment so local deployment settings cannot affect the fixture.
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
      require: isolatedRequire,
      exports: {},
      process: { env: { PORT: '3001', FRONTEND_ORIGINS: 'http://localhost:3000' } },
      console,
    }, { filename });
    await ready;
    const server = app.getHttpServer();

    const compressed = await request(server).get('/probe')
      .set('Accept-Encoding', 'gzip').timeout(3000).expect(200);
    assert.equal(compressed.headers['content-encoding'], 'gzip');
    assert.deepEqual(compressed.body, rows);

    const plain = await request(server).get('/probe')
      .set('Accept-Encoding', 'identity').timeout(3000).expect(200);
    assert.equal(plain.headers['content-encoding'], undefined);
    assert.deepEqual(plain.body, rows);

    const allowed = await request(server).options('/probe')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization').timeout(3000).expect(204);
    assert.equal(allowed.headers['access-control-max-age'], '600');
    assert.equal(allowed.headers['access-control-allow-origin'], 'http://localhost:3000');

    const rejected = await request(server).options('/probe')
      .set('Origin', 'https://untrusted.invalid')
      .set('Access-Control-Request-Method', 'GET').timeout(3000);
    assert.equal(rejected.headers['access-control-allow-origin'], undefined);

    console.log('PASS: gzip round trip; identity compatibility; cached allowed-origin preflight; rejected-origin protection.');
  } finally {
    await app.close();
  }
}

const deadline = setTimeout(() => {
  console.error('HTTP performance smoke timed out.');
  process.exit(1);
}, 15000);
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => clearTimeout(deadline));
