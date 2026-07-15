# Flow Templates

Use this file when creating or debugging command-flow templates (`rauto flow-template` / `rauto flow`).

## Core Model

- Template format: TOML.
- Runtime rendering: inline `{{var}}`.
- Step execution: each step can define command, explicit multiline mode, optional mode, timeout, and prompt-response rules.
- Template inputs are inferred from inline references instead of declared in a vars schema.
- Current target fields are flat values such as `{{host}}` and `{{username}}`.
- Saved connections can be referenced through runtime aliases such as `{{peer.host}}`.
- TextFSM parsing can be enabled for flow output; repeated `--textfsm-template` values match command order and the last template is reused for remaining commands.

## Usage Boundary

- Use `flow` for reusable prompt/response interactions, device-side copy wizards, installers, and guided multi-step CLI operations.
- Do not use `flow` as the first choice for simple state retrieval; prefer `show`.
- Do not use `flow` as the first choice for config changes that need rollback; wrap flow steps in `tx`/`tx-workflow` when rollback-aware execution is needed.

## Practical Pattern: Current + Peer Connection

```toml
name = "linux_scp_with_current_and_peer"
default_mode = "User"

[[steps]]
command = "scp {{local_path}} {{peer.username}}@{{peer.host}}:{{remote_path}}"
multiline_mode = "split_lines"
```

Run example:

```bash
rauto flow \
  --template linux_scp_with_current_and_peer \
  --connection edge92 \
  --vars-json '{"peer":"edge94","local_path":"/tmp/app.tar","remote_path":"/tmp/app.tar"}'
```

## Mode Resolution

- If step `mode` is omitted, `rauto` uses template/runtime default first.
- If still omitted, `rauto` falls back to the first mode of the active device profile.

## Multiline Submission

- `multiline_mode = "split_lines"` executes every non-empty trimmed line as a separate command.
- `multiline_mode = "whole"` preserves newline characters and submits the complete text once, which is useful for heredocs and shell blocks.
- `split_lines` stops after the first concrete command failure; later lines are not executed.
- Legacy content without the field loads as `split_lines`; visual and TOML editors write the normalized field explicitly.

```toml
[[steps]]
mode = "Config"
command = "interface Gi0/1\nno shutdown"
multiline_mode = "split_lines"

[[steps]]
mode = "Shell"
command = "cat <<'EOF'\nline one\nline two\nEOF"
multiline_mode = "whole"
```
