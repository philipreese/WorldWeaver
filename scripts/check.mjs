import { readdir, readFile, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
async function walk(dir) {
  const all = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    all.push(
      ...(e.isDirectory() ? await walk(p) : /\.m?js$/.test(p) ? [p] : []),
    );
  }
  return all;
}
for (const file of [...(await walk("src")), ...(await walk("scripts"))]) {
  const r = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });
  if (r.status) process.exit(r.status);
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(
    /(?:from\s+|import\s*)["'](\.[^"']+)["']/g,
  )) {
    await access(resolve(dirname(file), match[1])).catch(() => {
      throw new Error(`${file} imports missing module ${match[1]}`);
    });
  }
}
console.log("JavaScript syntax and relative module targets checked.");
