# Backend architecture

The backend is a single Cargo package that produces the `rauto` binary. DDD
boundaries are represented by Rust modules rather than separately published
crates.

## Database baseline

`migrations/202609220001_initial.sql` is the consolidated initial schema. It
creates the current tables, indexes, defaults, and foreign keys directly,
including `interactive_templates`. Task and history operation values use
`interactive`. Add subsequent schema changes as new timestamped migrations.

This baseline replaces the 22 unpublished migrations through
`202608260001_connection_output_encoding.sql`. An existing development database
must be backed up and explicitly rebased before running this version: verify its
applied migrations and final schema, rename the interactive template table, and
replace its SQLx migration history with the new initial version and SHA-384
checksum in one transaction. Preserve all business rows and validate foreign keys
and database integrity. Databases containing old operation tags also need those
tags converted in history, tasks, and structured task results. Application
startup retains SQLx checksum validation; it never silently resets migration
history or reruns the initial schema over an existing database.

## Module ownership

| Layer | Path | Owns |
| --- | --- | --- |
| Domain | `src/domain/connection` | Saved connections, inventory, SSH security and normalization rules |
| Domain | `src/domain/credential` | Credential types, authentication choices and validation |
| Domain | `src/domain/device` | Device profiles, discovery, facts and command catalogs |
| Domain | `src/domain/execution` | Transaction construction, command policy and history models |
| Domain | `src/domain/orchestration` | Plans, stages, jobs, actions, events and structural validation |
| Domain | `src/domain/task` | Task lifecycle, events, result envelopes and summaries |
| Domain | `src/domain/template` | Jinja rendering, interactive templates and content models |
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
