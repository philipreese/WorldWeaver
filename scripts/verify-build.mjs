/** HTTP/subpath and service-worker contract verification in Node.
 * This does not establish browser offline reload or PWA installation behavior.
 */
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import vm from "node:vm";
const port = Number(process.env.VERIFY_PORT || 4197);
const server = spawn(process.execPath, ["scripts/serve.mjs", "dist"], {
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Preview did not start")),
      5000,
    );
    server.once("error", reject);
    server.stdout.once("data", () => {
      clearTimeout(timeout);
      resolve();
    });
    server.once("exit", (code) => {
      if (code) reject(new Error(`Preview exited ${code}`));
    });
  });
  const scope = `http://127.0.0.1:${port}/WorldWeaver/`;
  const index = await fetch(scope);
  assert.equal(index.status, 200);
  const html = await index.text();
  assert.match(html, /src="\.\/src\/app.js"/);
  const script = await readFile("dist/sw.js", "utf8");
  const handlers = new Map(),
    stores = new Map([
      ["unrelated-cache", new Map()],
      ["worldweaver-old", new Map()],
    ]);
  let offline = false;
  let networkRequests = 0;
  const network = async (request) => {
    networkRequests++;
    if (offline) throw new Error("Simulated offline network");
    const url = typeof request === "string" ? request : request.url;
    const response = await fetch(url);
    assert.equal(response.status, 200, `Asset ${url}`);
    return response;
  };
  const absolute = (input) =>
    new URL(typeof input === "string" ? input : input.url, scope).href;
  const caches = {
    open: async (name) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        addAll: async (paths) => {
          for (const path of paths) {
            const url = absolute(path);
            store.set(url, await network(url));
          }
        },
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
    match: async (request) => {
      for (const store of stores.values()) {
        const response = store.get(absolute(request));
        if (response) return response.clone();
      }
    },
  };
  const context = {
    caches,
    fetch: network,
    URL,
    Promise,
    self: {
      location: { origin: new URL(scope).origin },
      clients: { claim: async () => {} },
      addEventListener: (name, fn) => handlers.set(name, fn),
    },
  };
  vm.runInNewContext(script, context, { timeout: 1000 });
  let pending;
  handlers.get("install")({ waitUntil: (promise) => (pending = promise) });
  await pending;
  handlers.get("activate")({ waitUntil: (promise) => (pending = promise) });
  await pending;
  assert.ok(stores.has("unrelated-cache"));
  assert.equal(stores.has("worldweaver-old"), false);
  const active = [...stores.entries()].find(([key]) =>
    key.startsWith("worldweaver-"),
  );
  assert.ok(active);
  assert.ok(active[1].size >= 10);
  const count = networkRequests;
  offline = true;
  for (const [url] of active[1]) {
    let response;
    handlers.get("fetch")({
      request: new Request(url),
      respondWith: (value) => (response = value),
    });
    const result = await response;
    assert.equal(result.status, 200);
    assert.ok((await result.arrayBuffer()).byteLength > 0);
  }
  assert.equal(
    networkRequests,
    count,
    "Cached requests must not require network",
  );
  const report = {
    kind: "Node HTTP and service-worker contract checks; not a browser offline/install test.",
    subpath: "/WorldWeaver/",
    assets: active[1].size,
    cache: active[0],
    checks: [
      "Subpath serves HTML and all precached relative assets",
      "Generated worker installs complete asset set",
      "Activation deletes only old Worldweaver caches",
      "Every precached response works with network made unavailable",
    ],
  };
  await mkdir("evidence", { recursive: true });
  await writeFile(
    "evidence/build-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  server.kill();
}
