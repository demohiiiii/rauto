# Inventory, History, and Operations

Beyond command execution and transactions, `rauto` also provides a set of operational capabilities around asset organization, audit, and governance.

## Inventory

Inventory solves two main problems:

- how to organize saved connections into higher-level logical groups
- how to reuse default variables and connection data in orchestration and execution

### Inventory groups

On the CLI side, the main managed object is the group:

```bash
rauto inventory group list
rauto inventory group show core
rauto inventory group upsert core --file ./core-group.json
rauto inventory group delete core
```

These groups can then be reused by orchestration plans.

### Variable resolution preview

`resolve-vars` lets you preview the merged result of “connection + group + runtime variables”:

```bash
rauto inventory resolve-vars \
  --host core-01 \
  --group core \
  --vars-json '{"tenant":"campus"}' \
  --json
```

This is especially helpful when debugging where orchestration variables come from.

### Labels in the Web UI

The Web UI also supports labels, which are useful for lightweight grouping and filtering.

## History and recording

All important execution paths can leave behind recordings and history entries.

### Inspect history

```bash
rauto history list lab1 --limit 20
rauto history show lab1 <history-id>
rauto history delete lab1 <history-id>
```

History is useful for:

- troubleshooting and replay analysis
- audit trails
- verifying the commands and output of a past execution

### Replay recordings

If you already have a JSONL recording file, you can do:

```bash
rauto replay ./session.jsonl --list
```

Or replay by command:

```bash
rauto replay ./session.jsonl --command "show version"
```

## Blacklist

The blacklist stops commands before they are actually sent to the device.

### Common commands

```bash
rauto blacklist list
rauto blacklist add "write erase"
rauto blacklist add "reload*"
rauto blacklist check "reload in 5"
rauto blacklist delete "reload*"
```

### Good use cases

- preventing dangerous commands from being sent by mistake
- enforcing the same guardrail across CLI and Web execution
- reducing operational risk in collaborative environments

## Backup and restore

`rauto` runtime data can be backed up as a whole:

```bash
rauto backup create
rauto backup create --output ./rauto-backup.tar.gz
rauto backup list
rauto backup restore ./rauto-backup.tar.gz
rauto backup restore ./rauto-backup.tar.gz --replace
```

Backup content typically includes:

- the database
- templates
- runtime storage files

This is useful for migration, pre-upgrade snapshots, and disaster recovery.

## Recommended adoption path

For a team, a practical rollout order is usually:

1. start with saved connections
2. introduce Inventory groups
3. add blacklist rules for critical commands
4. enable recording for production execution
5. back up `~/.rauto` regularly

## Summary

When you use these capabilities together, `rauto` becomes more than a command runner. It becomes a network automation workspace with:

- connection assets
- reusable execution templates
- transaction models
- platform integration capability
- audit and recovery support
