import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve(process.argv[2] || "."),
  port = Number(process.env.PORT || 4173);
const development = !process.argv[2];
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webm": "video/webm",
};
http
  .createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      // Production can be exercised at /WorldWeaver/ with the same immutable files.
      if (pathname.startsWith("/WorldWeaver/"))
        pathname = pathname.slice("/WorldWeaver".length);
      const labEntry = development && /^\/lab\/(?:index\.html)?$/.test(pathname);
      if (development && pathname.startsWith("/lab/")) pathname = pathname.slice(4);
      let target = resolve(root, "." + pathname);
      if (target !== root && !target.startsWith(root + sep))
        throw new Error("Forbidden");
      let entry;
      try {
        entry = await stat(target);
      } catch {
        target = resolve(root, "public", "." + pathname);
        entry = await stat(target);
      }
      if (entry.isDirectory()) target = resolve(target, "index.html");
      let body = await readFile(target);
      if (labEntry) body = Buffer.from(body.toString("utf8")
        .replace('data-site-base="./"', 'data-site-base="../" data-neighborhood-renderer="three"')
        .replace('href="./icon.svg"', 'href="../icon.svg"')
        .replace('href="./manifest.webmanifest"', 'href="../manifest.webmanifest"'));
      res.writeHead(200, {
        "Content-Type": mime[extname(target)] || "application/octet-stream",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(body);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
  })
  .listen(port, "0.0.0.0", () =>
    console.log(`Worldweaver: http://localhost:${port} (root: ${root})`),
  );
