import { relative, sep } from "node:path";

const persistencePackages = [
  "@issuespan/database",
  "prisma",
];

const runtimeAndProviderPackages = [
  "@linear/sdk",
  "bullmq",
  "fastify",
  "jira.js",
  "postmark",
];

const persistencePrefixes = ["@prisma/"];

const runtimeAndProviderPrefixes = [
  "@aws-sdk/",
  "@baileys/",
  "@octokit/",
  "@whiskeysockets/",
  "@issuespan/zapo",
];

const importSpecifierPattern =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s*)(["'`])([^"'`]+)\1/g;

export function isBoundarySource(root, filePath) {
  const relativePath = relative(root, filePath);
  const segments = relativePath.split(sep);
  return filePath.endsWith(".ts") && !segments.includes("infrastructure");
}

export function findForbiddenImports(source, options = {}) {
  const violations = [];
  for (const match of source.matchAll(importSpecifierPattern)) {
    const quote = match[1];
    const specifier = match[2];
    if (quote === "`" && specifier.includes("${")) {
      continue;
    }
    if (isRuntimeOrProviderSpecifier(specifier)) {
      violations.push(specifier);
      continue;
    }
    if (!options.allowPersistence && isPersistenceSpecifier(specifier)) {
      violations.push(specifier);
    }
  }
  return violations;
}

export function isInfrastructureSource(root, filePath) {
  return relative(root, filePath).split(sep).includes("infrastructure");
}

function isPersistenceSpecifier(specifier) {
  return (
    persistencePackages.includes(specifier)
    || persistencePackages.some((packageName) => specifier.startsWith(`${packageName}/`))
    || persistencePrefixes.some((prefix) => specifier.startsWith(prefix))
  );
}

function isRuntimeOrProviderSpecifier(specifier) {
  return (
    runtimeAndProviderPackages.includes(specifier)
    || runtimeAndProviderPackages.some((packageName) => specifier.startsWith(`${packageName}/`))
    || runtimeAndProviderPrefixes.some((prefix) => specifier.startsWith(prefix))
  );
}
