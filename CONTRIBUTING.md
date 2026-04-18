# Contributing to MPP32

Thanks for your interest in contributing. Here's how to get involved.

## Reporting bugs

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Browser / OS / wallet if relevant

## Feature requests

Open an issue tagged `enhancement`. Describe the use case, not just the solution.

## Pull requests

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Ensure the app builds without errors
4. Open a PR with a clear description of what changed and why

## Code style

- TypeScript throughout — no `any` types
- Zod schemas for all API contracts (defined in `backend/src/types.ts`)
- Tailwind for styling — no inline styles or CSS modules
- Components should be small, focused, and composable

## Development setup

```bash
# Backend
cd backend
bun install
bun run dev

# Frontend
cd webapp
bun install
bun run dev
```

## Questions?

Reach out on [X (@MPP32_dev)](https://x.com/MPP32_dev) or open a discussion.
