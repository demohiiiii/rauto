# Rauto Paths

Use this file for any "where is data stored?" question.

## Runtime root

```text
~/.rauto/
```

## Current persistent storage

Primary runtime data is stored in SQLite:

```text
~/.rauto/rauto.db
```

This includes:

- saved connections metadata
- encrypted saved passwords
- command blacklist patterns
- stored templates
- stored custom device profiles
- history metadata and history record bodies

## Secret material

Connection passwords are encrypted before being written to SQLite.
The local encryption key is stored separately:

```text
~/.rauto/master.key
```

Notes:

- `master.key` is required to decrypt saved connection passwords.
- moving only `rauto.db` without `master.key` will break saved-password reuse.
- on Unix-like systems, `master.key` should be file-permission restricted.

## Backup location

Backup archives are still file outputs:

```text
~/.rauto/backups/
```

Default backup file pattern:

```text
~/.rauto/backups/rauto-backup-<timestamp>.tar.gz
```

## Legacy path note

Older versions used file-based runtime stores such as per-feature directories under `~/.rauto/`.
For current behavior, answer with `rauto.db` first and treat those old paths as legacy, not the active source of truth.
