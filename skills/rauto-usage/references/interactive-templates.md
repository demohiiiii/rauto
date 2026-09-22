# Interactive Templates

Use this file when creating or debugging interactive templates (`rauto interactive-template` / `rauto interactive`).

## Core Model

- Template format: TOML.
- Runtime rendering: inline `{{var}}`.
- Each template defines one top-level `command`, explicit multiline mode, optional single/candidate mode expression, timeout, and `[[prompts]]` response rules. Compose multiple operations with workflows. Legacy `steps`, `default_mode`, and `stop_on_error` fields are rejected.
- Template inputs are inferred from inline references instead of declared in a vars schema.
- Current target fields are flat values such as `{{host}}` and `{{username}}`.
- Saved connections can be referenced through runtime aliases such as `{{peer.host}}`.
- TextFSM parsing can be enabled for interactive output; repeated `--textfsm-template` values match command order and the last template is reused for remaining commands.

## Usage Boundary

- Use `interactive` for reusable prompt/response interactions, device-side copy wizards, installers, and a single command with multiple prompt/response exchanges.
- Do not use `interactive` as the first choice for simple state retrieval; prefer `show`.
- Do not use `interactive` as the first choice for config changes that need rollback; compose command operations in `tx`/`tx-workflow` when rollback-aware execution is needed.

## Built-In Cisco-Like Copy Command

Run the rauto-owned built-in directly:

```bash
rauto interactive \
  --template builtin:cisco_like_copy \
  --connection core-01 \
  --vars-json '{"command":"copy scp: flash:/new.bin"}'
```

The `builtin:` prefix selects immutable built-in content. Built-ins are not
saved template records, so do not expect `rauto interactive-template list` or
`rauto interactive-template show` to return them. Save a custom copy only when the
user needs editable content.

## Practical Pattern: Current + Peer Connection

```toml
name = "linux_scp_with_current_and_peer"
mode = "Root,User"

command = "scp {{local_path}} {{peer.username}}@{{peer.host}}:{{remote_path}}"
multiline_mode = "split_lines"
```

Run example:

```bash
rauto interactive \
  --template linux_scp_with_current_and_peer \
  --connection edge92 \
  --vars-json '{"peer":"edge94","local_path":"/tmp/app.tar","remote_path":"/tmp/app.tar"}'
```

## Mode Resolution

- Runtime mode overrides template `mode`; if neither is set, use the device profile default.
- `mode` accepts ordered comma/pipe-separated candidates such as `Root,User` or `Enable|Config`.
- rauto canonicalizes candidates against the profile case-insensitively and rejects the whole expression when any candidate is unknown.

## Multiline Submission

- `multiline_mode = "split_lines"` executes every non-empty trimmed line as a separate command.
- `multiline_mode = "whole"` preserves newline characters and submits the complete text once, which is useful for heredocs and shell blocks.
- `split_lines` stops after the first concrete command failure; later lines are not executed.
- The default is `split_lines`; visual and TOML editors write the normalized field explicitly.

```toml
name = "configure-interface"
mode = "Config"
command = "interface Gi0/1\nno shutdown"
multiline_mode = "split_lines"
```

```toml
name = "write-file"
mode = "Root,User"
command = "cat <<'EOF'\nline one\nline two\nEOF"
multiline_mode = "whole"
```
