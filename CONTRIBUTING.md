# Contributing to MPP32

Thanks for your interest in contributing. This document covers the workflow
and standards for code changes.

## Workflow

1. Open an issue describing the bug or proposed change before opening a PR
   for non-trivial work.
2. Create a feature branch off `main`: `git checkout -b feature/<short-name>`.
3. Make your changes. Keep PRs focused; split unrelated work into separate
   branches.
4. Run typecheck and tests locally before pushing (see below).
5. Open a pull request. PRs require typecheck + tests to pass.

## Local development

Each subproject runs independently.

```bash
# backend (Hono on Bun, Prisma, SQLite)
cd backend && bun install && bun run dev

# webapp (React + Vite)
cd webapp && bun install && bun run dev

# mcp-server (Node, published to npm)
cd mcp-server && npm install && npm run build

# sdk
cd sdk && npm install && npm run build
```

## Required checks

Before opening a PR:

```bash
# typecheck
cd backend && npx tsc --noEmit
cd webapp && npx tsc --noEmit

# tests (backend)
cd backend && bun test
```

CI will re-run these on every push.

## Commit signing

All commits to `main` must be **signed and Verified** on GitHub. Configure
GPG or SSH commit signing locally:

```bash
git config --global commit.gpgsign true
git config --global user.signingkey <YOUR_KEY_ID>
```

GitHub docs: <https://docs.github.com/en/authentication/managing-commit-signature-verification>.

## Secrets and configuration

- **Never** commit production secrets. The committed `backend/.env` is a
  development placeholder; real production values live in the deployment
  platform's environment-variable UI.
- Rotate any credential that appears in a commit message, comment, or chat,
  even briefly. Treat exposure as compromise.

## Code style

- TypeScript strict where possible; explicit return types on exported
  functions.
- Validate all inbound payloads with Zod schemas (`backend/src/types.ts`
  is the source of truth).
- New backend routes: define the schema, add a route file in
  `backend/src/routes/`, mount it in `backend/src/index.ts`, add a test in
  `backend/src/__tests__/`.

## Reporting security issues

Do **not** open a public issue. Follow [`SECURITY.md`](./SECURITY.md).
