import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/search.js';
function response() { return { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(data) { this.data = data; return this; } }; }
test('rejects invalid input and non-GET without upstream requests', async () => {
  for (const [req, code] of [[{ method: 'POST' }, 405], [{ method: 'GET', query: { q: 'a' } }, 400], [{ method: 'GET', query: { q: ['aa', 'bb'] } }, 400]]) {
    const res = response(); await handler(req, res); assert.equal(res.code, code);
  }
});
test('search normalizes results, reuses cache and throttles new queries', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async url => { calls++; assert.equal(new URL(url).searchParams.get('q'), '서울역'); return { ok: true, json: async () => [{ name: '서울역', display_name: '서울역, 서울', lat: '37.55', lon: '126.97' }] }; };
  try {
    const req = { method: 'GET', query: { q: '서울역' } };
    const a = response(); await handler(req, a); assert.equal(a.code, 200); assert.equal(a.data[0].lat, 37.55);
    const b = response(); await handler(req, b); assert.deepEqual(b.data, a.data); assert.equal(calls, 1);
    const c = response(); await handler({ method: 'GET', query: { q: '부산역' } }, c); assert.equal(c.code, 429); assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
test('deployed search fails closed without shared rate limiter', async () => {
  const previous = process.env.VERCEL;
  process.env.VERCEL = '1';
  try {
    const res = response(); await handler({ method: 'GET', query: { q: '서울역' } }, res);
    assert.equal(res.code, 503);
  } finally { if (previous === undefined) delete process.env.VERCEL; else process.env.VERCEL = previous; }
});
test('Redis lock blocks concurrent upstream calls across function requests', async () => {
  const original = globalThis.fetch;
  const env = { ...process.env };
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test';
  process.env.NOMINATIM_USER_AGENT = 'SaiTest/1.0';
  let locked = false, upstreamCalls = 0, release;
  const pending = new Promise(resolve => { release = resolve; });
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  globalThis.fetch = async (url, options) => {
    if (String(url) === 'https://redis.test') {
      const command = JSON.parse(options.body);
      let result = null;
      if (command[0] === 'SET' && command.includes('NX')) { result = locked ? null : 'OK'; locked = true; }
      else if (command[0] === 'SET') result = 'OK';
      else if (command[0] === 'EVAL') { assert.equal(command[2], '1'); assert.match(command[1], /1100/); result = 1; }
      return { ok: true, json: async () => ({ result }) };
    }
    upstreamCalls++; entered(); await pending;
    return { ok: true, json: async () => [] };
  };
  try {
    const first = response();
    const firstRequest = handler({ method: 'GET', query: { q: '서울역' } }, first);
    await started;
    const second = response(); await handler({ method: 'GET', query: { q: '부산역' } }, second);
    assert.equal(second.code, 429); assert.equal(upstreamCalls, 1);
    release(); await firstRequest; assert.equal(first.code, 200);
  } finally {
    release(); globalThis.fetch = original;
    for (const key of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'NOMINATIM_USER_AGENT']) {
      if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key];
    }
  }
});
