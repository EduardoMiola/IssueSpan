import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import {
  findForbiddenImports,
  isInfrastructureSource,
} from "./boundary-rules.mjs";

const roots = ["packages/identity/src", "packages/conversations/src"];
const violations = [];

for (const root of roots) {
  await scan(root, root);
}

if (violations.length > 0) {
  console.error("Architecture boundary violations:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
}

async function scan(root, directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await scan(root, path);
      continue;
    }
    if (!path.endsWith(".ts")) continue;

    const source = await readFile(path, "utf8");
    const allowPersistence = isInfrastructureSource(root, path);
    for (const specifier of findForbiddenImports(source, { allowPersistence })) {
      violations.push(`${path}: forbidden import ${specifier}`);
    }
  }
}
