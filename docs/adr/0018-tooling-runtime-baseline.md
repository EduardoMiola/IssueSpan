# ADR-0018: Tooling and runtime baseline

Status: ACCEPTED

## Context

The repository had drifted from the engineering baseline: CI used Node 22, while package metadata and the project baseline target Node 24; API validation used Zod 3 and tests used Vitest 3. A fresh clone did not have one explicit runtime contract.

## Decision

IssueSpan supports Node.js 24.x, declared in `.node-version`, the root `engines` field, and every GitHub Actions Node setup. The package manager is pnpm 10.15.0. Zod 4 is the validation baseline and Vitest 4 is the test baseline across all TypeScript workspaces. Root `typecheck`, `test`, and `build` commands remain explicit or recursive only where every workspace provides the corresponding script.

The versions were checked against the official Node.js release schedule, Zod 4 release notes, and Vitest 4 release documentation on 2026-08-26. Future major changes require updating this ADR and the local/CI contract together.

## Consequences

Local development and CI use the same Node major, and dependency upgrades are visible in package manifests and the lockfile. Node 22 is no longer a supported runtime for this repository.
