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
  const releaseMatch = html.match(/src="\.\/(releases\/[a-f0-9]{12})\/src\/app.js"/);
  assert.ok(releaseMatch, "The entry must select one immutable module graph.");
  const release = releaseMatch[1];
  const labHtml = await (await fetch(new URL("lab/", scope))).text();
  assert.ok(labHtml.includes(`../${release}/src/app.js`));
  assert.match(labHtml, /data-site-base="\.\.\/" data-neighborhood-renderer="three"/);
  const importMap = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
  const vendorUrl = new URL(importMap.imports.three, scope).href;
  assert.ok(vendorUrl.includes(`/${release}/vendor/`));
  for (const path of [
    `${release}/src/view/neighborhood-three-view.js`,
    `${release}/assets/courtyard-three.json`,
    new URL("three.core.js", vendorUrl).href,
    new URL("controls/OrbitControls.js", new URL(importMap.imports["three/addons/"], scope)).href,
  ]) {
    const response = await fetch(new URL(path, scope));
    assert.equal(response.status, 200, `Optional scene asset ${path}`);
    if (path.endsWith(".js")) assert.match(response.headers.get("content-type"), /javascript/);
  }
  const script = await readFile("dist/sw.js", "utf8");
  const handlers = new Map(),
    stores = new Map([
      ["unrelated-cache", new Map()],
      ["worldweaver-ancient", new Map()],
      ["worldweaver-old", new Map([
        [scope, new Response("Legacy HTML")],
        [new URL("src/app.js", scope).href, new Response("Legacy script")],
      ])],
    ]);
  let offline = false;
  let failRuntimeWrites = false;
  let networkRequests = 0;
  const requestedUrls = [];
  const network = async (request, options = {}) => {
    networkRequests++;
    if (offline) throw new Error("Simulated offline network");
    const url = typeof request === "string" ? request : request.url;
    requestedUrls.push(url);
    const path = new URL(url).pathname;
    const cacheMode = options.cache || request.cache;
    if ((path.endsWith("/") || path.endsWith("/index.html")) && !["no-cache", "reload"].includes(cacheMode)) {
      return new Response("Stale HTTP-cached HTML");
    }
    const response = await fetch(url);
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
          const additions = [];
          for (const path of paths) {
            const url = absolute(path);
            const response = await network(path);
            assert.equal(response.status, 200, `Precache asset ${url}`);
            additions.push([url, response]);
          }
          for (const [url, response] of additions) store.set(url, response);
        },
        match: async (request) => store.get(absolute(request))?.clone(),
        put: async (request, response) => {
          if (failRuntimeWrites) throw new Error("Cache quota exhausted");
          store.set(absolute(request), response.clone());
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
  let activatedEarly = false;
  const context = {
    caches,
    fetch: network,
    URL,
    Promise,
    Response,
    Request,
    self: {
      location: { origin: new URL(scope).origin, href: new URL("sw.js", scope).href },
      clients: { claim: async () => {} },
      skipWaiting: async () => { activatedEarly = true; },
      addEventListener: (name, fn) => handlers.set(name, fn),
    },
  };
  vm.runInNewContext(script, context, { timeout: 1000 });
  let pending;
  handlers.get("install")({ waitUntil: (promise) => (pending = promise) });
  assert.equal(activatedEarly, false, "Activation must wait for the complete core cache.");
  await pending;
  assert.equal(activatedEarly, true);
  assert.equal(requestedUrls.some(url => url.includes("/vendor/")), false, "Ordinary install must not download Three.js.");
  handlers.get("activate")({ waitUntil: (promise) => (pending = promise) });
  await pending;
  assert.ok(stores.has("unrelated-cache"));
  assert.equal(stores.has("worldweaver-ancient"), false);
  assert.equal(stores.has("worldweaver-old"), true, "One prior graph remains for an already-open tab.");
  const active = [...stores.entries()].find(([key]) =>
    key.startsWith("worldweaver-") && key !== "worldweaver-old",
  );
  assert.ok(active);
  assert.ok(active[1].size >= 10);
  const coreAssetCount = active[1].size;
  assert.ok((await active[1].get(scope).clone().text()).includes(`${release}/src/app.js`), "Install must bypass stale HTTP-cached entry documents.");
  const respond = (request) => {
    let response;
    handlers.get("fetch")({ request, respondWith: value => { response = value; } });
    return response;
  };
  for (const path of ["?from=old-tab", "lab/?renderer=canvas"]) {
    const request = { url: new URL(path, scope).href, method: "GET", mode: "navigate" };
    const response = await respond(request);
    const content = await response.text();
    assert.ok(content.includes(`${release}/src/app.js`), "Online navigation must not return legacy HTML.");
    assert.doesNotMatch(content, /Legacy HTML|src="\.\/src\/app.js"/);
  }
  assert.equal(requestedUrls.some(url => url.includes("/vendor/")), false);
  const vendorResponse = await respond(new Request(vendorUrl));
  assert.equal(vendorResponse.status, 200);
  assert.ok(active[1].has(vendorUrl), "Optional renderer code is cached after use.");
  const missingVersion = new URL("releases/000000000000/src/app.js", scope).href;
  assert.equal((await respond(new Request(missingVersion))).status, 404, "Missing release never receives a different version's code.");
  failRuntimeWrites = true;
  const freshNavigation = await respond({ url: new URL("lab/?quota=yes", scope).href, method: "GET", mode: "navigate" });
  assert.ok((await freshNavigation.text()).includes(`${release}/src/app.js`), "Cache quota must not discard a successful navigation response.");
  const uncachedAsset = await respond(new Request(`${vendorUrl}?quota=yes`));
  assert.equal(uncachedAsset.status, 200, "Cache quota must not fail a successful module download.");
  assert.ok((await uncachedAsset.text()).length > 1000);
  failRuntimeWrites = false;
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
  for (const [path, expected] of [["?offline=yes", 'data-site-base="./"'], ["lab/?renderer=canvas", 'data-neighborhood-renderer="three"']]) {
    const response = await respond({ url: new URL(path, scope).href, method: "GET", mode: "navigate" });
    assert.ok((await response.text()).includes(expected), "Offline fallback must keep the selected entry.");
  }
  assert.equal(respond(new Request("https://example.com/asset.js")), undefined);
  assert.equal(respond(new Request(new URL("/another-site/", scope))), undefined);
  assert.equal(respond(new Request(scope, { method: "POST" })), undefined);
  const failedHandlers = new Map();
  let failedActivated = false;
  vm.runInNewContext(script, {
    ...context,
    caches: { ...caches, open: async () => ({ addAll: async () => { throw new Error("Core download failed"); } }) },
    self: { ...context.self, addEventListener: (name, fn) => failedHandlers.set(name, fn), skipWaiting: async () => { failedActivated = true; } },
  });
  failedHandlers.get("install")({ waitUntil: promise => { pending = promise; } });
  await assert.rejects(pending, /Core download failed/);
  assert.equal(failedActivated, false);
  assert.equal(await stores.get("worldweaver-old").get(scope).clone().text(), "Legacy HTML");
  const report = {
    kind: "Node HTTP and service-worker contract checks; not a browser offline/install test.",
    subpath: "/WorldWeaver/",
    assets: coreAssetCount,
    optionalAssetsCachedDuringTest: active[1].size - coreAssetCount,
    cache: active[0],
    checks: [
      "Subpath serves HTML and all precached relative assets",
      "Generated worker installs complete asset set",
      "Main and comparison entry select the same immutable graph under the repository subpath",
      "Online navigation replaces legacy HTML without mixing old modules",
      "Entry documents revalidate HTTP caches and runtime cache-write failures preserve network responses",
      "Activation waits for complete core download and preserves unrelated cache plus one prior graph",
      "Main installation avoids Three.js; opting in caches its exact version for offline reuse",
      "Missing releases never substitute another version's scripts",
      "Every precached response works with network made unavailable",
      "Offline query URLs fall back to their own main or comparison entry",
      "Failed core installation leaves prior cache and worker intact",
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
