# Web Runbook

Use this file when starting or operating the current Svelte 5 Web workbench.

## Start

```bash
rauto web --bind 127.0.0.1 --port 3000
```

Open `http://127.0.0.1:3000` and enter the Web password. On first startup, rauto generates the password, prints it once, and stores it as `web.password` in `~/.rauto/config.toml` with owner-only Unix permissions. Later startups reuse that password. Keep loopback binding unless network access is explicitly required. Released binaries embed the frontend assets.

## Current Workspaces

- **Show**: single and batch show-object queries with TextFSM output.
- **Config Fetch**: fetch current-device or batch-target running/startup configurations and download results.
- **Standard Delivery**: direct command/template and command-flow authoring for one target.
- **Batch Delivery**: command/template or command-flow execution across saved devices, groups, and labels.
- **Tx Block / Tx Workflow / Orchestrate**: direct and saved-template execution with form/JSON authoring and previews.
- **Session Replay**: inspect and replay persisted recordings.
- **Profile Management / Templates**: manage profiles, command and flow templates, transaction templates, config command mappings, TextFSM mappings, and custom show objects.
- **Inventory**: manage saved device connections, groups, and labels.
- **Auto Discovery**: scan, filter, select, and import SSH devices.
- **Credentials / SFTP Upload / Blacklist / Backup / Tasks**: dedicated management pages.

Web host-file access is confined to managed runtime directories: upload sources under `RAUTO_HOME/uploads`, private key files under `RAUTO_HOME/keys`, and backup create/list/download/restore under `RAUTO_HOME/backups`. Use saved TextFSM template names in Web execution requests; host template paths and custom template directories are rejected.

## Query And Modes

- Use Show before raw command delivery for device state reads.
- In batch Show, select devices first. The object selector must contain only the intersection supported by every selected device profile.
- Single/batch tabs live in the workspace header; single query uses the current connection.
- Execution mode controls are tag-style multi-selects. They serialize ordered candidates as a comma-separated mode expression; do not replace them with single-choice radios/selects.
- Explicit mode candidates override mapping mode; mapping mode overrides profile default.

## Connections And Inventory

- The connection workbench supports saved and temporary/new forms.
- Device autodetection and connection testing use the current unsaved form values, including the credential selected in the form.
- Place Test Connection beside automatic device detection in the form, not in the modal header.
- Deleting a saved connection requires confirmation.
- Inventory exposes Devices, Groups, and Labels; groups contain saved-device membership only.

## Auto Discovery

- Auto Discovery is a standalone menu item, not an Inventory subtab.
- Status summary cards are clickable filters. Default to newly `identified` devices.
- Keep `identified` and `existing` separate. Existing/imported rows cannot be selected or saved.
- Result-table status filters combine with the summary-card filter and search.
- Preserve failed selections and newly discovered importable rows after a partial import; remove only imported/existing rows from selection.
- Language changes must update visible discovery text immediately.

Load `device-discovery.md` for scan limits, statuses, persistence, progress phases, and import naming.

## Result And Retry Behavior

- Successful command/show results emphasize prompt-free command content; failures preserve complete diagnostic transcripts.
- Ordinary command/flow/show/config-fetch retries are opt-in and expose count/backoff controls. Keep them disabled for unsafe-to-repeat changes.
- TextFSM is default for Show; command and flow parsing remains opt-in unless a template/export requires it.
