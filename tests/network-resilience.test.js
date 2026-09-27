import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const response = (body, status = 200, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => headers[name.toLowerCase()] || (name.toLowerCase() === "content-type" ? "application/json" : null) },
  text: async () => body
});

function createApiClient(fetchHandler) {
  const window = {
    APPBEY_CONFIG: { apiBaseUrl: "/api/v1" },
    dispatchEvent() {},
    addEventListener() {}
  };
  const context = vm.createContext({
    window,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    CustomEvent: class CustomEvent {},
    AbortController,
    TypeError,
    structuredClone,
    setTimeout,
    clearTimeout,
    fetch: fetchHandler,
    console: { warn() {} }
  });
  vm.runInContext(fs.readFileSync("frontend/js/api.js", "utf8"), context);
  return window.api;
}

test("GET retries transient failures and noCache does not repopulate memory cache", async () => {
  let calls = 0;
  const api = createApiClient(async () => {
    calls += 1;
    if (calls === 1) throw new TypeError("temporary network failure");
    return response('{"ok":true}');
  });

  const result = await api.request("/retry", { noCache: true });
  assert.equal(JSON.stringify(result), '{"ok":true}');
  assert.equal(calls, 2);
  assert.equal(api.cache.has("/retry"), false);
});

test("identical concurrent GETs share one network request", async () => {
  let calls = 0;
  const api = createApiClient(async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return response('{"shared":true}');
  });

  const results = await Promise.all([
    api.request("/shared", { noCache: true }),
    api.request("/shared", { noCache: true })
  ]);
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(results[0]), JSON.stringify(results[1]));
});

test("fresh GETs do not join an older cacheable request", async () => {
  let calls = 0;
  let resolveCachedRequest;
  const api = createApiClient(() => {
    calls += 1;
    if (calls === 1) {
      return new Promise((resolve) => { resolveCachedRequest = resolve; });
    }
    return Promise.resolve(response('{"fresh":true}'));
  });

  const cachedRequest = api.request("/snapshot");
  const freshRequest = api.request("/snapshot", { noCache: true });
  const freshResult = await freshRequest;
  resolveCachedRequest(response('{"fresh":false}'));
  await cachedRequest;

  assert.equal(calls, 2);
  assert.equal(freshResult.fresh, true);
  assert.equal(api.cache.get("/snapshot").data.fresh, false);
});

test("mutations are not retried after server errors", async () => {
  let calls = 0;
  const api = createApiClient(async () => {
    calls += 1;
    return response('{"message":"unavailable"}', 503);
  });

  await assert.rejects(api.request("/write", { method: "POST", body: {} }), (error) => error.status === 503);
  assert.equal(calls, 1);
});

test("WebSocket reconnects with a fresh connection and emits snapshot signal", async () => {
  const listeners = new Map();
  class MockWebSocket {
    static OPEN = 1;
    static CONNECTING = 0;
    static CLOSED = 3;
    static instances = [];

    constructor(url) {
      this.url = url;
      this.readyState = MockWebSocket.CONNECTING;
      MockWebSocket.instances.push(this);
      setTimeout(() => this.open(), 0);
    }

    open() {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.();
    }

    close() {
      this.readyState = MockWebSocket.CLOSED;
      this.onclose?.();
    }
  }

  const window = {
    APPBEY_CONFIG: {},
    location: { protocol: "https:", host: "appbey.test" },
    addEventListener: (name, callback) => listeners.set(name, callback),
    dispatchEvent() {}
  };
  const context = vm.createContext({
    window,
    navigator: { onLine: true },
    WebSocket: MockWebSocket,
    CustomEvent: class CustomEvent {},
    setTimeout,
    clearTimeout,
    console: { log() {}, error() {} }
  });
  vm.runInContext(fs.readFileSync("frontend/js/ws.js", "utf8"), context);
  const hub = window.wsHub;
  let reconnected = false;
  hub.on("reconnected", () => { reconnected = true; });
  hub.connect(42);
  await new Promise((resolve) => setTimeout(resolve, 5));
  MockWebSocket.instances[0].close();
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("WebSocket did not reconnect")), 1800);
    const check = setInterval(() => {
      if (reconnected) {
        clearTimeout(timeout);
        clearInterval(check);
        resolve();
      }
    }, 10);
  });
  assert.equal(MockWebSocket.instances.length, 2);
  hub.disconnect();
});

test("service worker serves the cached SPA shell when offline", async () => {
  const listeners = new Map();
  const shell = { marker: "cached-shell" };
  const context = vm.createContext({
    self: {
      location: { origin: "https://appbey.test" },
      addEventListener: (name, callback) => listeners.set(name, callback)
    },
    caches: {
      match: async (request) => request === "/?v=3.7.0" ? shell : undefined
    },
    fetch: async () => { throw new Error("offline"); },
    URL,
    console
  });
  vm.runInContext(fs.readFileSync("frontend/sw.js", "utf8"), context);

  let responsePromise;
  listeners.get("fetch")({
    request: { method: "GET", url: "https://appbey.test/", mode: "navigate" },
    respondWith: (promise) => { responsePromise = promise; }
  });
  assert.equal(await responsePromise, shell);
});
