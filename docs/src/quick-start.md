# Quick Start

This chapter is designed to get you through your first successful `rauto` run as quickly as possible.

## Installation

You can install from crates.io directly:

```bash
cargo install rauto
```

Or build from source:

```bash
git clone https://github.com/demohiiiii/rauto.git
cd rauto
cargo build --release
```

The compiled binary will be available at:

```text
target/release/rauto
```

## Run your first command

The default device profile is `linux`, so you can validate the workflow quickly against a Linux host:

```bash
rauto exec "uname -a" \
  --host 192.168.1.10 \
  --username root \
  --password '******'
```

If the target is a network device, you will usually want to specify the profile explicitly:

```bash
rauto exec "show version" \
  --host 192.168.1.1 \
  --username admin \
  --password '******' \
  --device-profile cisco
```

## Start the Web console

```bash
rauto web --bind 127.0.0.1 --port 3000
```

Then open:

```text
http://127.0.0.1:3000
```

Web mode is a good fit for local self-service usage:

- manage connections, templates, command flows, and inventory
- execute commands, transactions, and orchestration plans
- inspect recordings and replay data
- manage blacklists, backups, and restore operations

## Which command should you choose?

| Scenario                              | Recommended command | Notes                                     |
| ------------------------------------- | ------------------- | ----------------------------------------- |
| Run one temporary command             | `rauto exec`        | Best for ad-hoc validation                |
| Command content comes from a template | `rauto template`    | Good for parameterized command generation |
| Interactive workflow                  | `rauto flow`        | Good for prompt/response automation       |
| One rollback-aware change block       | `rauto tx`          | Best for single-target transactions       |
| Multi-block transaction workflow      | `rauto tx-workflow` | Best for structured workflows             |
| Multi-device rollout                  | `rauto orchestrate` | Best for staged multi-target execution    |
| Browser-based management UI           | `rauto web`         | Local console                             |
| Connect to a manager platform         | `rauto agent`       | Managed agent mode                        |

## Next steps

Continue with:

- [Connections and Device Profiles](./connections-and-profiles.md)
- [Templates and Direct Execution](./templates-and-exec.md)
