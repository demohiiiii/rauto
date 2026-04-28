# rauto Tutorial

Welcome to the `rauto` tutorial.

This book is designed to take you **from first use to practical rollout**, and is a good fit for:

- network engineers who want to validate command execution quickly
- developers who want to model SSH automation as templates, transactions, and orchestration
- users who want to connect `rauto` to a larger platform through Web or Agent mode

## What you will learn

After reading this tutorial, you should be able to:

- install `rauto` and launch the local Web console
- execute commands through either temporary or saved connections
- reuse execution logic with templates, variables, and command flows
- build rollback-aware changes with `tx` and `tx-workflow`
- run staged jobs across multiple devices with `orchestrate`
- understand the boundary between `web` mode and `agent` mode
- organize targets with Inventory groups and labels

## Recommended reading order

If this is your first time using `rauto`, read the chapters in this order:

1. [Quick Start](./quick-start.md)
2. [Connections and Device Profiles](./connections-and-profiles.md)
3. [Templates and Direct Execution](./templates-and-exec.md)
4. [Command Flows and Upload](./flows-and-upload.md)
5. [Transactions, Workflows, and Orchestration](./transactions-and-orchestration.md)
6. [Web and Agent Modes](./web-and-agent.md)
7. [Inventory, History, and Operations](./inventory-and-operations.md)

## Build the book locally

Install `mdbook` first:

```bash
cargo install mdbook
```

Then run from the repository root:

```bash
mdbook serve docs
```

Open the local address printed in the terminal.

If you only want static HTML output:

```bash
mdbook build docs
```

The generated site will be written to:

```text
docs/book/
```
