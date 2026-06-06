# Flow Templates

Use this file when creating or debugging command-flow templates (`rauto flow-template` / `rauto flow`).

## Core Model

- Template format: TOML.
- Runtime rendering: inline `{{var}}`.
- Step execution: each step can define command, optional mode, timeout, prompt-response rules.
- Output branching: support `next`, `jump`, `stop_success`, `stop_failure`.
- Vars schema: `name`, `type`, `required`, `default`, `options`, `label`, `description`.
- TextFSM parsing can be enabled for flow output; repeated `--textfsm-template` values match command order and the last template is reused for remaining commands.

## Usage Boundary

- Use `flow` for reusable prompt/response interactions, device-side copy wizards, installers, and guided multi-step CLI operations.
- Do not use `flow` as the first choice for simple state retrieval; prefer `show`.
- Do not use `flow` as the first choice for config changes that need rollback; wrap flow steps in `tx`/`tx-workflow` when rollback-aware execution is needed.

## Practical Pattern: Current + Peer Connection

```toml
name = "linux_scp_with_current_and_peer"
description = "Copy file from current target to peer target by SCP"
current_connection_alias = "current"

[[vars]]
name = "peer"
type = "string"
required = true
label = "Peer Connection Name"

[[vars]]
name = "local_path"
type = "string"
required = true

[[vars]]
name = "remote_path"
type = "string"
required = true

[runtime]
default_mode = "User"

[[steps]]
name = "scp-copy"
command = "scp {{local_path}} {{peer.username}}@{{peer.host}}:{{remote_path}}"
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
