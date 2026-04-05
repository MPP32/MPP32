# Contributing to MPP32

Thanks for your interest in contributing. This document covers the basics — read it before opening a PR.

## Ways to contribute

- **Bug reports** — Open an issue with a clear description and reproduction steps.
- **Feature requests** — Open an issue explaining the use case and expected behavior.
- **Pull requests** — For bug fixes and small improvements. For significant changes, open an issue first to align on approach.
- **Ecosystem submissions** — List your own MPP service at [mpp32.org/build](https://mpp32.org/build).

## Development setup

See [docs/QUICKSTART.md](docs/QUICKSTART.md) for full instructions on running the project locally.

## Pull request guidelines

- Keep PRs focused. One logical change per PR.
- Write a short, clear title — e.g. `fix: handle empty token symbol in oracle response`.
- Reference any related issue in the PR description.
- Make sure the app builds and runs locally before submitting.

## Commit style

We loosely follow [Conventional Commits](https://www.conventionalcommits.org):

```
feat: add whale activity chart to playground
fix: handle missing liquidity field from DexScreener
docs: clarify authentication in API reference
chore: update dependencies
refactor: extract scoring logic into separate module
```

## Code style

- TypeScript everywhere. Avoid `any` where possible.
- Zod schemas for all API boundaries — defined in `backend/src/types.ts`.
- Component files in PascalCase, utility files in camelCase.
- Tailwind for styling. Avoid inline styles.

## Questions

Open an issue or reach out at contact@mpp32.org.