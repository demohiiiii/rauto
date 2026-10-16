# Runtime Troubleshooting

## Binary And Runtime State

Check `rauto --version`, the executable path, and relevant `--help`. A source
checkout and installed release can differ even if their package version is
the same. Source Rust is pinned to 1.94.0; use `cargo build --locked` with the
checkout toolchain and its Cargo.lock-pinned rneter revision. Restart an old
running service before diagnosing behavior already fixed by a new binary.

`RAUTO_HOME` selects the data root; the default is `~/.rauto`. A missing device,
group, template, or history row can mean the CLI and Web use different roots.
Do not reset SQLx migration metadata, delete the database, or overwrite runtime
data as a diagnostic shortcut. Tests need isolated temporary runtime paths.

## Connections, Shells, And Modes

```sh
rauto device show core-01 --json
rauto profile show linux
rauto profile diagnose linux --json
rauto device test --device core-01
rauto profile autodetect --device core-01
```

Confirm the selected credential, saved endpoint, profile, SSH port, and security
policy. Default SSH security is `legacy-compatible`; stricter `balanced` or
`secure` profiles must match the device's capabilities.

Modes are profile-owned. Comma/pipe expressions are split, trimmed, and
canonicalized case-insensitively; any unknown candidate invalidates the
expression. Report the profile's available modes/default when this fails.
rneter can keep a currently acceptable candidate or transition to another;
do not describe `Root,User` as two successive command executions.

For Linux fish, check the connection's `linux_shell_flavor` is `fish`.
Discovery/import saves the value returned by rneter; explicit Linux connections
can use `--linux-shell-flavor fish`. `posix` is the CLI value for POSIX/bash.
Inspect prompt/command transcript failures before changing profile regexes.
Prompt identity can change after commands; use the pinned rneter behavior
rather than assuming the returned prompt must exactly equal the initial text.

## Show, TextFSM, And Templates

```sh
rauto show --list --device-profile linux
rauto show interfaces --device core-01 --print-command
rauto textfsm mapping list --profile cisco_ios
```

Show availability is platform-specific, and batch queries require a supported
object on every selected target. For missing objects, add a custom mapping with
`show object set` or use a raw read command. Inspect the real mapped command before blaming
the parser. TextFSM platform comes from the device profile, with custom
profile/command mappings or explicit templates for exceptions.
`--textfsm-strict-errors` retains fallback Error rules normally filtered out.

Interactive TOML has one root command plus `[[prompts]]`; old step-array
templates are rejected. Inline tokens are not Jinja control flow. Check vars,
connection aliases, regexes, newline submission, and timeout separately.
Command/JSON templates use Jinja; raw CLI workflow/plan files do not render
placeholders. See [Interactive](interactive-templates.md) and
[JSON validation](json-validation.md), including dry-run limitations.

## Execution, Recording, And Retry

A workflow's JSON result can report a failed transaction even when the CLI
process exits successfully. Inspect `committed`, block/step failures, and
rollback errors. Orchestration requires saved-name/group/label selectors and
only `tx_workflow` actions. Group variables and inline auth targets do not exist.

Retries have at-least-once semantics and default to zero. Do not enable them to
mask failures in unsafe-to-repeat commands. Preserve diagnostic transcripts
without credentials. Session replay reads recorded output, not live device
state. SFTP upload requires a remote SFTP subsystem and a valid destination.

## Storage And Encryption

Credential secret values are AES-256-GCM encrypted in SQLite. The master key
uses the OS credential store when available; without a default credential
store, current binaries fall back to `RAUTO_HOME/keys/master.key` with private
Unix permissions. The old "No default store has been set" failure should not
require installing a desktop keyring to use a headless Linux host.

If encryption still fails, check the current binary, runtime path, file
ownership/permissions, and whether the original master key is available. Do
not display, replace, or delete that key: existing credentials depend on it.
When moving/restoring data, retain the corresponding file or OS-store key;
the database alone cannot decrypt credentials. Errors are cached in-process,
so restart after correcting the external storage problem.

SQLite uses WAL and a busy timeout. For persistent lock errors, inspect running
processes and long-lived external transactions instead of deleting the store.
For schema errors such as missing `linux_shell_flavor`, use the current binary
and its migrations; do not silently default away the missing column.

## Discovery, History, Scheduler, And Agent

Discovery list/save require no probe credential and do not rescan. TCP scan
completion is separate from SSH identification. Active runs use leases;
current binaries recover expired leases after interruption. Existing/imported
endpoints are not eligible for reimport. See [Discovery](device-discovery.md).

Bottom Sheet history persists only in browser session storage; it is shared
across execution functions and filtered to the current one initially. Check
filters before treating another function's retained results as missing.
Backend session/configuration histories are separate persisted data.

Queued schedules require the matching runtime's Web scheduler. Agent failures
need manager endpoint/transport/token and callback reachability checks. Read
[Schedules](schedules.md) or [Agent](agent-runbook.md) for their actual settings.
