# Backend architecture

The backend is a single Cargo package that produces the `rauto` binary. DDD
boundaries are represented by Rust modules rather than separately published
crates.

## Module ownership

| Layer | Path | Owns |
| --- | --- | --- |
| Domain | `src/domain/connection` | Saved connections, inventory, SSH security and normalization rules |
| Domain | `src/domain/credential` | Credential types, authentication choices and validation |
| Domain | `src/domain/device` | Device profiles, discovery, facts and command catalogs |
| Domain | `src/domain/execution` | Transaction construction, command policy and history models |
| Domain | `src/domain/orchestration` | Plans, stages, jobs, actions, events and structural validation |
| Domain | `src/domain/task` | Task lifecycle, events, result envelopes and summaries |
| Domain | `src/domain/template` | Jinja rendering, command-flow templates and content models |
| Infrastructure | `src/infrastructure/db` | SQLite, migrations, repositories, encryption and keyring integration |
| Interfaces | `src/interfaces/api` | HTTP DTOs and generated manager/agent gRPC contracts |
| Application | `src/cli`, `src/web`, `src/agent`, `src/orchestrator` | Use-case coordination and runtime adapters |

## Dependency rules

- Domain modules do not depend on infrastructure, transport handlers or the
  process entry point.
- `interfaces::api` may depend on domain types required by transport contracts.
- `infrastructure::db` may depend on domain types required by persistence.
- Application modules may coordinate all layers and adapt domain errors to CLI,
  HTTP, gRPC and persistence errors.
- Cross-domain dependencies point toward the module that owns the reused
  concept. `domain::execution` currently reuses task result concepts from
  `domain::task`; the other domain modules remain independent.
- Compatibility re-exports in application modules are adapter surfaces, not
  alternate model definitions.

## Placement test

Put data and rules in `src/domain/` when they remain meaningful without a
specific transport or storage technology. Put SQLx, keyring and persistence in
`src/infrastructure/`. Put request/response and gRPC contracts in
`src/interfaces/`. Keep code in the application layer when it coordinates use
cases or directly depends on CLI flags, local files or live rneter sessions.

The backend gate is:

```bash
cargo fmt --all --check
cargo check --all-targets --all-features
cargo test --all-targets
```
