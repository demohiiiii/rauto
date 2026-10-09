# Interactive Templates

## Current Model

An interactive template is one command and its prompt responses. Use a
transaction workflow to compose multiple operations. TOML accepts only `name`,
`command`, `mode`, `multiline_mode`, `timeout_secs`, and `prompts` at the root:

```toml
name = "confirm-command"
command = "{{command}}"
mode = "Enable"
multiline_mode = "split_lines"
timeout_secs = 30

[[prompts]]
patterns = ['(?i)continue\?\s*\[y/n\]']
response = "{{answer}}"
append_newline = true
record_input = false
```

`mode` and `timeout_secs` are optional. Omitted mode falls back to the active
profile through the runtime. Modes can be comma/pipe-separated candidates.
`multiline_mode` defaults to `split_lines`: trim and execute nonempty lines,
stopping on the first failure. `whole` submits the original text once, for
example a heredoc or a shell block.

`patterns` are regexes identifying a prompt that needs a response.
`append_newline` defaults to false and appends LF when enabled. `record_input`
defaults to false and controls retention of the matched prompt in captured
output; it does not mean that secret responses are safe to log.

The parser rejects root `steps`, `default_mode`, `stop_on_error`, `max_steps`,
and declared variable schemas. There is no conversion of old multi-step TOML.
Runtime `default_mode` is an internal/API context field, not a template field.

## Run And Save

```sh
rauto interactive-template create confirm-command --file ./confirm-command.toml
rauto interactive-template show confirm-command
rauto interactive --template confirm-command --connection core-01 \
  --vars-json '{"command":"example-command","answer":"y"}'
rauto interactive --file ./confirm-command.toml --target core-01 --target core-02
```

Choose either `--file` or `--template`. Runtime vars come from a JSON file
(`--vars`) or inline JSON (`--vars-json`). `interactive` executes; it has no
dry-run flag. The Web inspect endpoint parses TOML and returns inferred fields
without executing: `POST /api/interactive-templates/inspect` with
`{"content":"<TOML text>"}`. Parsing alone does not test prompt matching or
the remote command.

The immutable built-in copy interaction runs as:

```sh
rauto interactive --template builtin:cisco_like_copy --connection core-01 \
  --vars-json '{"command":"copy scp: flash:/new.bin"}'
```

Supply the other fields needed by the actual copy prompts. Built-ins do not
appear as saved records in `interactive-template list/show`. Web lists them
separately with a localized badge and allows copying, not editing the built-in.

## Runtime Variables

Rendering substitutes `{{name}}` tokens, not general Jinja expressions or
control flow. Implicit current-connection values include `host`, `port`,
`username`, `password`, `enable_password`, `device_profile`,
`linux_shell_flavor`, `ssh_security`, `connection_name`, and `name`.

Saved connections can be addressed as `{{edge94.host}}` or through a runtime
alias: `{"peer":"edge94"}` allows `{{peer.host}}` and `{{peer.username}}`.
For example:

```toml
name = "peer-copy"
command = "scp {{local_path}} {{peer.username}}@{{peer.host}}:{{remote_path}}"
mode = "Root,User"

[[prompts]]
patterns = ['(?i)password:\s*$']
response = "{{peer.password}}"
append_newline = true
```

Provide `peer`, `local_path`, and `remote_path` at runtime. Only use this pattern
when the device supports that transfer command and prompt. Runtime string
values that name connection fields can themselves resolve as aliases; avoid
using those reserved names when a literal string was intended.

Backend inspection scans template references to infer editable variables.
Implicit connection fields are excluded; referenced alias roots are exposed.
See `src/domain/template/interactive.rs` and `src/config/interactive_vars.rs`
for rendering/resolution, and `src/web/handlers/interactive_templates.rs` for
inspection. Native workflow prompt JSON differs: it uses
`interaction.prompts` and includes newlines directly in `response`; see
[JSON plans](json-templates.md).
