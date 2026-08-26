import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import process from "node:process";

const roots = ["packages/identity/src", "packages/conversations/src"];
const forbidden = [
  /from\s+["']@issuespan\/database["']/,
  /from\s+["'](?:fastify|bullmq|@baileys\/|@whiskeysockets\/)["']/,
  /require\(\s*["']@issuespan\/database["']\s*\)/,
];
const violations = [];

for (const root of roots) {
  await scan(root);
}

if (violations.length > 0) {
  console.error("Architecture boundary violations:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
}

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "infrastructure") await scan(path);
      continue;
    }
    if (!entry.name.endsWith(".ts")) continue;
    const source = await readFile(path, "utf8");
    const isBoundaryCode = directory.endsWith("/src") || directory.endsWith("/domain") || directory.endsWith("/application");
    if (!isBoundaryCode) continue;
    for (const pattern of forbidden) {
      if (pattern.test(source)) violations.push(`${path}: ${pattern}`);
    }
  }
}
