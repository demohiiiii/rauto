<!-- FOR AI AGENTS - Human readability is a side effect, not a goal -->
<!-- Managed by agent: keep project facts synchronized with the repository -->
<!-- Last verified: 2026-09-02 -->

# AGENTS.md

<!-- Precedence: closest AGENTS.md wins -->

**Precedence:** explicit user instructions override this file. The closest
`AGENTS.md` to the files being changed wins over this root file.

## Scope

These instructions apply to the entire repository. This repository is one Rust
package that builds the `rauto` binary and embeds a Svelte frontend. It is not a
Cargo workspace. Keep domain boundaries as modules and folders unless the user
explicitly requests a packaging change.

## Repository Map

| Area                   | Path                                                                        | Responsibility                                                          |
| ---------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Backend domain         | `src/domain/`                                                               | Business models, invariants, validation, and domain services            |
| Backend application    | `src/cli/`, `src/web/`, `src/agent/`, `src/orchestrator/`, `src/scheduler/` | Use-case coordination and runtime adapters                              |
| Backend infrastructure | `src/infrastructure/`                                                       | SQLite, repositories, keyring, encryption, and external adapters        |
| Backend interfaces     | `src/interfaces/`                                                           | HTTP/gRPC request, response, and transport contracts                    |
| Frontend domains       | `frontend/src/domains/<domain>/`                                            | Domain model, application state, infrastructure ports, and presentation |
| Route composition      | `frontend/src/pages/`                                                       | Route-level page assembly and lazy loading only                         |
| Shared frontend UI     | `frontend/src/components/`, `frontend/src/lib/components/`                  | Cross-domain components and shadcn-svelte primitives                    |
| API client             | `frontend/src/api/client.ts`                                                | Typed HTTP client operations                                            |
| Database migrations    | `migrations/`                                                               | Ordered SQLite schema migrations embedded by SQLx                       |
| Generated web assets   | `static/`                                                                   | Vite output embedded by the Rust binary; never edit manually            |
| Architecture reference | `docs/architecture.md`                                                      | Backend ownership and dependency direction                              |

## General Rules

- Read the surrounding implementation and tests before changing behavior.
- Keep changes scoped. Do not refactor unrelated modules or rewrite user work.
- Preserve backward compatibility for persisted data, CLI arguments, HTTP/gRPC
  contracts, templates, and configuration unless a breaking change is explicit.
- Prefer existing project patterns and domain APIs over new generic helpers.
- Do not access, migrate, delete, or overwrite the user's `~/.rauto` data unless
  the user explicitly requests that operation. Tests must use isolated temporary
  data.
- Never log credentials, passwords, private keys, API tokens, or decrypted
  secret material.
- Do not commit, tag, publish, or push unless explicitly requested.

## Backend Architecture

Follow the module ownership and dependency rules in `docs/architecture.md`.

### Domain

- Put transport- and storage-independent business concepts in `src/domain/`.
- Domain code owns invariants and validation. Do not duplicate those rules in
  CLI handlers, HTTP handlers, or repositories.
- Domain modules must not depend on `src/infrastructure/`, `src/interfaces/`,
  `src/web/`, `src/cli/`, or the process entry point.
- Cross-domain imports must point to the domain that owns the concept. Do not
  create duplicate request-shaped domain models to avoid an import.
- Keep existing `rneter`-backed device and execution concepts in their owning
  domain modules; wrap transport or persistence concerns outside the domain.

### Application And Interfaces

- Application modules coordinate use cases and translate between domain,
  persistence, live `rneter` sessions, and transport concerns.
- Keep Axum and gRPC DTOs in `src/interfaces/api/` or the relevant transport
  adapter. Match Serde field names, defaults, and nullability explicitly.
- Keep CLI parsing and terminal presentation in `src/cli/`. Shared behavior used
  by CLI and Web belongs in a domain or application service, not one handler.
- For a new first-class capability, assess CLI, HTTP/gRPC, and Web access. Add
  the applicable entry points or document why a surface is intentionally absent.
- Map errors at adapter boundaries and retain actionable context. Do not expose
  secrets or low-level database internals in user-facing errors.

### Infrastructure And Database

- Keep SQLx, SQLite, keyring, encryption, filesystem persistence, and repository
  implementations under `src/infrastructure/`.
- Use parameterized SQL and existing repository helpers. Preserve foreign-key,
  transaction, and concurrency behavior.
- Add a new timestamped migration for a schema change. Do not edit an existing
  migration that may have been applied unless the user explicitly requests
  squashing an unpublished migration.
- Update explicit migration embedding in `src/infrastructure/db/mod.rs` when the
  existing pattern requires it.
- Test migrations and repositories against isolated temporary databases,
  including upgrade behavior and important uniqueness or ordering constraints.

### Rust Style

- Use Rust 2024 idioms and `rustfmt`; avoid `unsafe` outside an unavoidable,
  reviewed build-time boundary.
- Prefer concrete domain types and enums over strings and unstructured
  `serde_json::Value` once data has crossed a dynamic boundary.
- Keep functions focused and make invalid states difficult to represent.
- Add comments only for non-obvious invariants or protocol constraints.
- Use `rneter` and its `testkit` for session behavior; do not implement a second
  SSH/session engine.

## Frontend Architecture

### Domain Placement

Organize each feature under `frontend/src/domains/<domain>/`:

| Layer             | Responsibility                                                          |
| ----------------- | ----------------------------------------------------------------------- |
| `model/`          | Types, pure transformations, validation, and domain presentation models |
| `application/`    | Stores, workspaces, use-case state, and typed ports                     |
| `infrastructure/` | API, browser, storage, and other side-effect adapters                   |
| `presentation/`   | Display-state derivation and domain-owned Svelte components             |
| `index.ts`        | Deliberate public exports for cross-domain consumers                    |

- Put domain-specific components in
  `domains/<domain>/presentation/components/`, grouped by feature where useful.
- Keep `frontend/src/pages/` thin: route composition, page lifecycle, and lazy
  imports only. Do not accumulate feature editors or support components there.
- Put a component in `frontend/src/components/` only when multiple domains own
  no better home and actually reuse it.
- Import another domain through `$domains/<domain>/index.js` when practical.
  Use relative imports inside the same domain and avoid deep cross-domain paths.
- Keep dependency direction toward model and typed ports. Model code must not
  depend on Svelte components, DOM APIs, or HTTP clients.

### TypeScript And Contracts

- New and migrated frontend logic must be TypeScript. Do not add new `.js`
  application modules when a `.ts` module is appropriate.
- Keep `.js` extensions in TypeScript ESM imports. TypeScript resolves these to
  source `.ts` files and emitted browser imports remain valid ESM.
- Use the configured aliases: `$api`, `$components`, `$config`, `$domains`, and
  `$lib`.
- Treat Rust request/response DTOs as the source of truth. Mirror exact field
  names, optionality, nullability, enums, and nested shapes in frontend types.
- Prefer concrete types. Use `unknown` only at genuinely dynamic boundaries such
  as `JSON.parse`, caught errors, untyped third-party values, or external input;
  validate and narrow it immediately. Do not propagate `unknown` through
  application or presentation layers when the backend contract is known.
- Represent arbitrary JSON with an explicit recursive JSON value type. Do not
  use `Record<string, unknown>` as a substitute for a known DTO.
- Avoid string-based reflection and generic dependency maps when a typed port or
  interface can describe the dependency.
- Keep API calls typed in `frontend/src/api/client.ts`; domain infrastructure
  modules may wrap them to expose narrower domain ports.

### Svelte And UI

- Follow existing Svelte 5 patterns (`$props`, `$derived`, stores, and workspace
  factories) rather than introducing a second state-management style.
- Use existing shadcn-svelte primitives and Lucide icons. Preserve current
  responsive, accessibility, localization, and keyboard behavior.
- Put all user-visible strings in both `frontend/src/i18n/en.ts` and
  `frontend/src/i18n/zh.ts`; do not hard-code interface copy in components.
- Preserve lazy component boundaries and update `vite.config.js` chunk rules
  when moving components that have explicit chunk ownership.
- Do not edit files under `static/`. Run the frontend build to regenerate them.

## Testing

- Scale tests to behavior and risk. Add Rust unit tests near the owning module
  and integration tests at the relevant adapter boundary.
- Frontend tests live under `frontend/tests/` and should test behavior, contracts,
  race handling, serialization, and user-visible wiring.
- Do not add tests that only assert a file exists at a particular location.
  Source-reading tests are acceptable only when they protect a meaningful
  architecture, accessibility, lazy-loading, or public wiring contract.
- Test stale-response and cancellation behavior for async workspaces that can
  overlap requests.
- Validate both success and important failure paths for execution, persistence,
  migration, and import/export changes.
- Never require access to a real network device in automated tests.

## Commands

Install dependencies with `npm ci` when `node_modules/` is unavailable.

| Purpose                   | Command                                                             |
| ------------------------- | ------------------------------------------------------------------- |
| Frontend dev server       | `npm run frontend:dev`                                              |
| Frontend type check       | `npm run frontend:typecheck`                                        |
| Frontend tests            | `npm run frontend:test`                                             |
| Frontend production build | `npm run frontend:build`                                            |
| Repository format check   | `npm run format:check`                                              |
| Rust lint                 | `cargo clippy --locked --all-targets --all-features -- -D warnings` |
| Rust tests                | `cargo test --locked --all-targets`                                 |

Before finishing a frontend-only change, run type checking, relevant tests, the
full frontend test suite when feasible, the production build, format checking,
and `git diff --check`. Before finishing a backend or cross-stack change, also
run the Rust lint and test commands above. Report any command that could not be
run and why.

## Generated And Release Files

- `static/` is generated by Vite and ignored by Git. Build it; do not patch it.
- `build.rs` compiles files under `proto/` into Cargo's output directory. Update
  proto rerun declarations when adding a new proto input.
- Keep `Cargo.lock` synchronized because this repository ships an application
  binary.
- Do not change package versions, changelogs, release tags, or registry state as
  part of an ordinary feature or refactor.

## Change Checklist

- Placement follows the backend or frontend ownership table.
- Domain rules are not duplicated across adapters.
- Rust and TypeScript contracts agree on names, defaults, and nullability.
- Dynamic data is validated at the boundary and converted to concrete types.
- User data, credentials, and unrelated worktree changes are preserved.
- Tests cover the changed behavior rather than only implementation layout.
- Required format, type, test, lint, and build checks pass.

## Scoped AGENTS.md

<!-- AGENTS-GENERATED:START scope-index -->

There are currently no scoped `AGENTS.md` files. This root file governs both
backend and frontend changes.

<!-- AGENTS-GENERATED:END scope-index -->
