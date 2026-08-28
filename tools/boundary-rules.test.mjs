import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findForbiddenImports,
  isBoundarySource,
  isInfrastructureSource,
} from "./boundary-rules.mjs";

test("detects infrastructure imports across supported module syntaxes", () => {
  const source = `
    import { PrismaClient } from "@prisma/client";
    import type { Database } from "@issuespan/database";
    import("bullmq");
    require("@whiskeysockets/baileys");
    import Fastify from "fastify";
  `;

  assert.deepEqual(findForbiddenImports(source), [
    "@prisma/client",
    "@issuespan/database",
    "bullmq",
    "@whiskeysockets/baileys",
    "fastify",
  ]);
});

test("allows domain and application dependencies", () => {
  const source = `
    import { Conversation } from "./domain.js";
    import type { TenantContext } from "@issuespan/identity";
  `;

  assert.deepEqual(findForbiddenImports(source), []);
});

test("checks nested public and ports code while excluding infrastructure adapters", () => {
  const root = "packages/conversations/src";

  assert.equal(isBoundarySource(root, `${root}/public/nested/index.ts`), true);
  assert.equal(isBoundarySource(root, `${root}/ports/repository.ts`), true);
  assert.equal(isBoundarySource(root, `${root}/infrastructure/prisma-adapter.ts`), false);
  assert.equal(isBoundarySource(root, `${root}/domain/readme.md`), false);
});

test("allows persistence only in infrastructure while still rejecting runtime coupling", () => {
  const root = "packages/conversations/src";
  const infrastructurePath = `${root}/infrastructure/prisma-adapter.ts`;
  const source = `
    import { PrismaClient } from "@issuespan/database";
    import Fastify from "fastify";
  `;

  assert.equal(isInfrastructureSource(root, infrastructurePath), true);
  assert.deepEqual(findForbiddenImports(source, { allowPersistence: true }), ["fastify"]);
});
