# Command Flows and Upload

When an operation is more than “send one command and wait for one output”, `rauto flow` becomes especially valuable.

## What is a command flow?

Command flows are a good fit for interactive processes such as:

- device-side `copy scp:` / `copy tftp:` commands
- installation wizards
- confirmation prompts
- multi-round prompt/response exchanges
- workflows that branch based on output

In simple terms:

- `exec` runs one command
- `template` generates multiple commands
- `flow` drives a conversational CLI process

## Execute a command flow

Run a saved command flow template:

```bash
rauto flow \
  --template cisco_like_copy \
  --vars-json '{"command":"copy scp: flash:/new.bin","server_addr":"192.168.1.50","remote_path":"/images/new.bin","transfer_username":"backup","transfer_password":"secret"}' \
  --connection core-01
```

You can also provide variables through a file.

## Manage command flow templates

```bash
rauto flow-template list
rauto flow-template show cisco_like_copy
rauto flow-template create cisco_like_copy --file ./templates/examples/cisco-like-command-flow.toml
rauto flow-template update cisco_like_copy --file ./my-flow-template.toml
rauto flow-template delete cisco_like_copy
```

## Why command flows are valuable

Compared with hardcoding interaction inside a script, command flow templates provide:

- reuse
- shared use between CLI and Web
- variable validation
- integration as the forward or rollback path of a `tx` operation

## File upload

Both `rauto upload` and `rauto flow` can be used for file-related tasks, but they serve different purposes.

### `rauto upload`

Use it when the target SSH service exposes an `sftp` subsystem:

```bash
rauto upload \
  --local-path ./configs/daemon.conf \
  --remote-path /tmp/daemon.conf \
  --host 192.168.1.20 \
  --username admin \
  --password secret
```

Common optional flags:

- `--timeout-secs`
- `--buffer-size`
- `--show-progress`
- `--record-level`
- `--record-file`

### `rauto flow`

Use it for device-side file transfer commands such as:

- `copy scp:`
- `copy ftp:`
- `copy tftp:`

These workflows often require the device to ask for:

- server address
- username
- password
- source path
- destination path
- overwrite confirmation

That makes them a better fit for a command flow template.

## How to choose

- if the local machine uploads directly to the remote host through SFTP -> use `upload`
- if the device itself initiates a copy/transfer exchange after login -> use `flow`

## Recommended practice

- save common interactive procedures as command flow templates
- inject sensitive values through variables instead of hardcoding them into the template body
- enable recording for important transfer workflows so replay and troubleshooting stay possible

## Next steps

Continue with:

- [Transactions, Workflows, and Orchestration](./transactions-and-orchestration.md)
