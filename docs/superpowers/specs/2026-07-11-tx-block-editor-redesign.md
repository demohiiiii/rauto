# Transaction Block Editor Redesign

Date: 2026-07-11

## Goal

Redesign the transaction block visual editor as an ergonomic, complete editor for the backend `TxBlock` model. The editor must support every known rneter transaction and session-operation parameter, preserve compatible extension fields, follow the visual language of the `demo` application, and provide reliable two-way synchronization between visual form and JSON views.

## Product Direction

The editor is an operational authoring tool rather than a generic JSON form. Its primary workflow is selecting an execution step, editing that step in a spacious inspector, and understanding the resulting execution and rollback sequence at a glance.

The approved layout uses:

- A compact execution timeline occupying approximately 34% of the desktop workspace.
- A primary property inspector occupying approximately 66% of the workspace.
- A compact summary row for transaction name, rollback policy, step count, and failure behavior.
- Form and JSON tabs at the editor level, with explicit synchronization status.
- The existing demo visual language: Geist typography, semantic green theme tokens, `rounded-xl` cards, low-contrast borders, compact badges, and restrained muted surfaces.

## Backend Model Coverage

The visual editor must round-trip all known fields from rneter 0.4.6.

### Transaction Block

- `name`
- `rollback_policy`: `none`, `per_step`, or `whole_resource`
- `rollback_policy.whole_resource.rollback`
- `rollback_policy.whole_resource.trigger_step_index`
- `steps[]`
- `fail_fast`

The summary row displays these values. An "Edit block settings" action selects the root inspector, where all values remain editable. Whole-resource rollback reveals the same complete operation editor used by regular steps.

### Transaction Step

- `run`
- optional `rollback`
- `rollback_on_failure`

Timeline entries summarize the run operation and whether rollback is configured. The inspector contains the complete run operation, step rollback controls, and rollback operation.

### Command Operation

- `kind: "command"`
- `mode`
- `command`
- optional `timeout`
- `dyn_params.enable_password`
- `dyn_params.sudo_password`
- flattened `dyn_params` string entries
- `interaction.prompts[].patterns`
- `interaction.prompts[].response`
- optional `interaction.prompts[].record_input`

Mode, command, and timeout are primary fields. Dynamic parameters and interaction prompts use dedicated collapsible editors with repeatable rows. Secret fields use password visibility controls and are never presented as ordinary metadata.

### Flow Operation

- `kind: "flow"`
- `steps[]`, with every command field listed above
- optional `stop_on_error`
- optional `max_steps`

Flow child commands use a compact ordered list inside the inspector. Selecting a child command opens its command fields without leaving the parent transaction step.

### Template Operation

- `kind: "template"`
- template `name`
- optional template `description`
- optional template `vars[]`
- optional template `stop_on_error`
- optional template `default_mode`
- optional template `steps[]`
- runtime `default_mode`
- runtime `connection_name`
- runtime `host`
- runtime `username`
- runtime `device_profile`
- runtime `vars`

Each template variable supports `name`, `label`, `description`, `type`, `required`, `placeholder`, `options`, and `default`. Each template step supports `command`, `mode`, `timeout_secs`, and prompt rules. Template prompt rules support `patterns`, `response`, `append_newline`, and `record_input`.

The existing `current_connection_alias` compatibility extension remains preserved and editable where currently supported by the application.

### Extension Fields

Unknown or compatibility fields at each object level remain in that model's `extra` object and are serialized back without loss. A scoped "Additional JSON fields" editor exposes these values near their owning object. The design does not combine unrelated extension fields into one root-level JSON area.

## Information Architecture

### Header And Summary

The header contains the editor title, Form/JSON segmented tabs, and synchronization status. The compact summary row shows transaction name, rollback policy, number of steps, and fail-fast behavior. Selecting the summary's edit action changes the right inspector from a step to root settings.

### Execution Timeline

The left timeline supports:

- Selecting root settings or a transaction step.
- Adding a step.
- Duplicating a step and immediately selecting the new copy.
- Deleting a step with confirmation.
- Reordering steps through explicit move controls and optional drag interaction.
- Showing operation kind, short operation summary, and rollback state without exposing the full form.

Selection remains valid after deletion or reordering. If the selected step is deleted, selection moves to the next step, previous step, or root settings in that order.

### Property Inspector

The right inspector is the main editing surface. It uses visible labels, inline helper text for complex behavior, and direct controls appropriate to each value type. Command, Flow, and Template are selected with a segmented control. Switching operation kind retains the in-memory draft for every kind so switching back does not discard prior input.

Common fields appear first. Rollback, dynamic parameters, prompt interaction, template details, runtime overrides, and extension fields use progressive disclosure. Expanded sections render real controls rather than raw JSON text except where the backend value itself is arbitrary JSON, such as runtime vars or extension fields.

## Component Boundaries

The redesign keeps each UI unit focused:

- `TxBlockVisualEditor.svelte`: editor composition and responsive two-column layout.
- A timeline component: root/step selection, summaries, add/copy/delete/reorder actions.
- A root inspector component: transaction identity, fail-fast behavior, and rollback policy.
- A step inspector component: run operation, rollback behavior, and step-level actions.
- Existing operation editors: Command, Flow, and Template field ownership, restyled and reorganized for the inspector.
- Existing focused list editors: command flow steps, dynamic parameters, prompt rules, template variables, and template steps.

Business conversion and mutation logic remains in JavaScript modules. Svelte components receive display state and semantic action handlers rather than manipulating JSON paths directly.

## Canonical Editor Session

The current editor has local form, local JSON text, and global editor text state that can diverge. The redesign introduces one editor-session workspace with these values:

- Current valid form model.
- Current JSON draft text, including invalid drafts.
- Last valid serialized JSON text.
- Current view: `form` or `json`.
- Parse or validation error details.
- Synchronization status.

### Form To JSON

Every form mutation updates the canonical form model, serializes it through `txBlockFormModelToJsonText`, updates the JSON draft and last-valid JSON, clears synchronization errors, and notifies the existing global editor host where required by execution and template flows.

### JSON To Form

Every JSON edit updates the raw JSON draft. Valid JSON is converted through `txBlockEditorFormStateFromJsonText` and replaces the canonical form model. Invalid JSON keeps the previous valid model but marks the session invalid.

Attempting to switch from invalid JSON to Form is rejected. Focus remains in the JSON editor, and the error identifies the JSON line and column when available. The editor never shows stale form data as if it matched invalid JSON.

### External Inputs

Template loading, file import, new draft creation, full example creation, and programmatic editor updates all pass through the same session replacement method. These paths must not write independently to only the global JSON editor or only the local form store.

## Validation And Feedback

- JSON syntax errors are shown near the editor with line and column information where available.
- Required or invalid known fields display inline errors below their controls.
- Numeric fields reject invalid ranges and non-numeric input before execution.
- Destructive step deletion requires confirmation.
- Synchronization status distinguishes `synced`, `invalid-json`, and `dirty` states.
- Form errors do not rely only on color; status text and accessible alert semantics are required.
- The first invalid field receives focus when a form action exposes validation errors.

## Responsive Behavior

At wide desktop sizes, the timeline and inspector use an approximately 34/66 split. The inspector may remain sticky within the editor viewport while its contents scroll normally. The timeline does not expand to consume unused space.

At narrower sizes, the layout becomes a single column with timeline above inspector. Selecting a step scrolls its inspector heading into view. The design does not use a modal or drawer for primary editing and must not create horizontal page scrolling.

## Testing Strategy

Model tests use representative fixtures for Command, Flow, Template, per-step rollback, whole-resource rollback, optional field presence, and extension fields. They assert JSON to form to JSON semantic equality and verify that unknown fields survive.

Session tests cover:

- Valid JSON immediately updating the form model.
- Form edits immediately updating JSON.
- Invalid JSON preserving the draft and blocking Form view selection.
- Repairing invalid JSON clearing the error and enabling Form view selection.
- Template load, file import, new draft, and full example paths replacing both views.

Workspace and component tests cover add, duplicate, delete, reorder, selection fallback, operation-kind draft retention, and responsive structure. The production frontend build and existing frontend regression suite remain required verification gates.

## Acceptance Criteria

- The transaction block form follows the approved demo-style 34/66 timeline and inspector layout.
- Every known `TxBlock`, `TxStep`, `SessionOperation`, Command, Flow, Template, and runtime field listed above is editable.
- Compatible unknown fields survive Form/JSON round trips.
- Valid JSON changes appear in Form view without data loss.
- Form changes appear in JSON view without stale content.
- Invalid JSON prevents switching to Form and shows an actionable error.
- Command, Flow, and Template drafts survive operation-kind switching.
- Desktop and narrow layouts remain usable without overlapping controls or page-level horizontal overflow.
- Frontend tests, production build, and formatting checks pass.

## Out Of Scope

- Backend API or rneter schema changes.
- Redesigning transaction workflow or orchestration plan editors beyond shared operation-editor improvements required by this work.
- Adding new transaction semantics not represented by the current backend models.
