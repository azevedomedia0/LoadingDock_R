import { readFileSync, writeFileSync, existsSync } from "node:fs";

const targets = [
  "node_modules/electrobun/dist/api/bun/core/Socket.ts",
  "node_modules/electrobun/dist-macos-arm64/api/bun/core/Socket.ts",
];

for (const file of targets) {
  if (!existsSync(file)) continue;
  const src = readFileSync(file, "utf8");
  if (src.includes('return new Response("Not found", { status: 404 });')) continue;
  const needle = 'console.log("unhandled RPC Server request", req.url);';
  if (!src.includes(needle)) continue;
  const out = src.replace(
    needle,
    `${needle}\n\t\t\t\t\treturn new Response("Not found", { status: 404 });`,
  );
  writeFileSync(file, out, "utf8");
  console.log(`[patch-electrobun-rpc] Patched ${file}`);
}
