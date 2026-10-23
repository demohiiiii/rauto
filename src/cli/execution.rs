use super::*;
use crate::interfaces::api::models::*;
use anyhow::{Context, Result, bail};
use serde_json::{Value, json};
use std::io::Read;
use std::path::{Path, PathBuf};

const MAX_CLI_UPLOAD_BYTES: u64 = 32 * 1024 * 1024;

#[derive(Default)]
pub struct Presentation {
    pub json: bool,
    pub view: bool,
    pub record_file: Option<PathBuf>,
    pub excel: Option<PathBuf>,
    pub config_output: Option<PathBuf>,
    pub config_dir: Option<PathBuf>,
    pub normalized: bool,
    pub print_command: bool,
}

pub struct PreparedExecution {
    pub request: ExecutionRequest,
    pub presentation: Presentation,
}

fn execution_options(opts: &GlobalOpts) -> ExecutionOptions {
    ExecutionOptions {
        connection: ConnectionRequest {
            connection_name: opts.connection.clone(),
            host: opts.host.clone(),
            port: opts.port,
            device_profile: opts.device_profile.clone(),
            linux_shell_flavor: opts.linux_shell_flavor,
            ssh_security: opts.ssh_security,
            ..Default::default()
        },
        credential: opts.credential.clone(),
        force_autodetect: opts.force_autodetect,
        retry: SessionRetryOptions {
            max_retries: Some(opts.session_retries),
            initial_backoff_ms: Some(opts.retry_initial_backoff_ms),
            max_backoff_ms: Some(opts.retry_max_backoff_ms),
            retry_authentication_errors: Some(opts.retry_authentication_errors),
        },
        save_device: opts.save_connection.clone(),
        json_input_mode: JsonInputMode::Template,
        template_error_policy: CommandErrorPolicy::Continue,
    }
}

fn read(path: &Path) -> Result<String> {
    std::fs::read_to_string(path).with_context(|| format!("read {}", path.display()))
}

fn read_upload(reader: impl Read) -> Result<Vec<u8>> {
    let mut content = Vec::new();
    reader
        .take(MAX_CLI_UPLOAD_BYTES + 1)
        .read_to_end(&mut content)?;
    if content.len() as u64 > MAX_CLI_UPLOAD_BYTES {
        bail!("CLI service uploads are limited to 32 MiB per task");
    }
    Ok(content)
}

fn vars(file: Option<&Path>, inline: Option<&str>) -> Result<Value> {
    super::json_templates::read_json_vars(file, inline)
}

fn input_source(path: Option<&Path>, name: Option<&str>, kind: &str) -> Result<Option<String>> {
    match (path, name) {
        (Some(path), None) => read(path).map(Some),
        (None, Some(_)) => Ok(None),
        _ => bail!("{kind} requires either a file or --template"),
    }
}

fn target(level: RecordLevelOpt) -> Value {
    json!({ "record_level": match level { RecordLevelOpt::Full => "full", RecordLevelOpt::KeyEventsOnly => "key-events-only" } })
}

fn with_targets(
    mut request: Value,
    targets: &[String],
    groups: &[String],
    labels: &[String],
    parallel: Option<usize>,
    opts: &GlobalOpts,
) -> Result<(bool, Value)> {
    let batch = !targets.is_empty() || !groups.is_empty() || !labels.is_empty();
    if batch {
        if opts.host.is_some() {
            bail!("--host cannot be combined with multiple saved device targets");
        }
        let mut targets = targets.to_vec();
        if let Some(name) = &opts.connection {
            targets.push(name.clone());
        }
        request["targets"] = json!(targets);
        request["groups"] = json!(groups);
        request["labels"] = json!(labels);
        request["max_parallel"] = json!(parallel);
    }
    Ok((batch, request))
}

pub fn prepare(cli: &Cli) -> Result<Option<PreparedExecution>> {
    let mut presentation = Presentation::default();
    let mut templates = Vec::new();
    let mut strict = false;
    let mut json_input_mode = JsonInputMode::Template;
    // JSON is built only at this CLI adapter boundary and immediately decoded
    // into the same concrete request enum used by the service.
    let (kind, request) = match &cli.command {
        Commands::Exec(command) if command.command.is_none() => {
            let a = &command.run;
            templates = a
                .textfsm_template
                .iter()
                .map(|p| read(p))
                .collect::<Result<_>>()?;
            strict = a.textfsm_strict_errors;
            presentation.record_file = a.record_file.clone();
            presentation.excel = a.textfsm_excel.clone();
            let mut req = target(a.record_level);
            req["parse_textfsm"] =
                json!(templates.is_empty() && (a.parse_textfsm || a.textfsm_excel.is_some()));
            req["textfsm_strict_errors"] = json!(strict);
            req["mode"] = json!(a.mode);
            if let Some(name) = &a.template {
                req["template"] = json!(name);
                req["vars"] = vars(a.vars.as_deref(), None)?;
                req["dry_run"] = json!(a.dry_run);
                ("template", req)
            } else {
                req["command"] = json!(a.command.as_deref().context("exec requires a command")?);
                let (batch, req) = with_targets(
                    req,
                    &a.targets,
                    &a.groups,
                    &a.labels,
                    a.max_parallel,
                    &cli.global_opts,
                )?;
                (if batch { "exec_batch" } else { "exec" }, req)
            }
        }
        Commands::Show(command)
            if command.command.is_none() && !command.run.list && command.run.object.is_some() =>
        {
            let a = &command.run;
            if a.no_parse && a.textfsm_excel.is_some() {
                bail!("--textfsm-excel requires TextFSM parsing; remove --no-parse");
            }
            presentation.record_file = a.record_file.clone();
            presentation.excel = a.textfsm_excel.clone();
            presentation.print_command = a.print_command;
            let mut req = target(a.record_level);
            req["object"] = json!(a.object);
            req["mode"] = json!(a.mode);
            req["no_parse"] = json!(a.no_parse);
            req["textfsm_strict_errors"] = json!(a.textfsm_strict_errors);
            let (batch, req) = with_targets(
                req,
                &a.targets,
                &a.groups,
                &a.labels,
                a.max_parallel,
                &cli.global_opts,
            )?;
            (if batch { "show_batch" } else { "show" }, req)
        }
        Commands::Interactive(command) if command.command.is_none() => {
            let a = &command.run;
            templates = a
                .textfsm_template
                .iter()
                .map(|p| read(p))
                .collect::<Result<_>>()?;
            strict = a.textfsm_strict_errors;
            presentation.record_file = a.record_file.clone();
            presentation.excel = a.textfsm_excel.clone();
            let content = input_source(a.file.as_deref(), a.template.as_deref(), "interactive")?;
            let mut req = target(a.record_level);
            req["template_name"] = json!(a.template);
            req["content"] = json!(content);
            req["vars"] = vars(a.vars.as_deref(), a.vars_json.as_deref())?;
            req["parse_textfsm"] =
                json!(templates.is_empty() && (a.parse_textfsm || a.textfsm_excel.is_some()));
            req["textfsm_strict_errors"] = json!(strict);
            let (batch, req) = with_targets(
                req,
                &a.targets,
                &a.groups,
                &a.labels,
                a.max_parallel,
                &cli.global_opts,
            )?;
            (
                if batch {
                    "interactive_batch"
                } else {
                    "interactive"
                },
                req,
            )
        }
        Commands::TxWorkflow(command) if command.command.is_none() => {
            let a = &command.run;
            let content = input_source(
                a.workflow_file.as_deref(),
                a.template.as_deref(),
                "tx-workflow",
            )?;
            if let Some(content) = &content
                && !crate::domain::execution::workflow_template::has_workflow_controls(
                    &serde_json::from_str(content)?,
                )
            {
                json_input_mode = JsonInputMode::Literal;
            }
            presentation.json = a.json;
            presentation.view = a.view || a.dry_run;
            presentation.record_file = a.record_file.clone();
            (
                "workflow",
                json!({"workflow": null, "workflow_template_name": a.template, "workflow_template_content": content,
                "workflow_vars": vars(a.vars.as_deref(), a.vars_json.as_deref())?, "dry_run": a.view || a.dry_run,
                "record_level": target(a.record_level)["record_level"]}),
            )
        }
        Commands::Orchestrate(command) if command.command.is_none() => {
            let a = &command.run;
            let content =
                input_source(a.plan_file.as_deref(), a.template.as_deref(), "orchestrate")?;
            if content.is_some() {
                json_input_mode = JsonInputMode::Literal;
            }
            presentation.json = a.json;
            presentation.view = a.view || a.dry_run;
            (
                "orchestration",
                json!({"plan": null, "plan_template_name": a.template, "plan_template_content": content,
                "plan_vars": vars(a.vars.as_deref(), a.vars_json.as_deref())?, "dry_run": a.view || a.dry_run,
                "record_level": target(a.record_level)["record_level"]}),
            )
        }
        Commands::Config(ConfigCmd {
            command: ConfigCommands::Fetch(a),
        }) => {
            presentation.config_output = a.output.clone();
            presentation.config_dir = a.output_dir.clone();
            presentation.normalized = a.normalized;
            let mut req = target(a.record_level);
            req["kind"] = json!(a.kind);
            req["include_normalized"] = json!(a.normalized);
            let (batch, req) = with_targets(
                req,
                &a.targets,
                &a.groups,
                &a.labels,
                a.max_parallel,
                &cli.global_opts,
            )?;
            (if batch { "config_batch" } else { "config" }, req)
        }
        Commands::Upload(a) => {
            use base64::Engine;
            let file = std::fs::File::open(&a.local_path)
                .with_context(|| format!("read {}", a.local_path.display()))?;
            let content =
                read_upload(file).with_context(|| format!("read {}", a.local_path.display()))?;
            presentation.record_file = a.record_file.clone();
            let mut req = target(a.record_level);
            req["local_path"] = json!(
                a.local_path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
            );
            req["remote_path"] = json!(a.remote_path);
            req["timeout_secs"] = json!(a.timeout_secs);
            req["buffer_size"] = json!(a.buffer_size);
            req["show_progress"] = json!(a.show_progress);
            (
                "upload",
                json!({ "request": req, "content_base64": base64::engine::general_purpose::STANDARD.encode(content) }),
            )
        }
        _ => return Ok(None),
    };
    if presentation.record_file.is_some()
        && matches!(kind, "exec_batch" | "show_batch" | "interactive_batch")
    {
        bail!(
            "--record-file is not supported for multiple targets; session history is saved per device"
        );
    }
    let action: ExecutionAction =
        serde_json::from_value(json!({ "kind": kind, "request": request }))
            .context("build execution request")?;
    Ok(Some(PreparedExecution {
        request: ExecutionRequest {
            options: ExecutionOptions {
                json_input_mode,
                ..execution_options(&cli.global_opts)
            },
            action,
            textfsm_templates: templates,
            textfsm_strict_errors: strict,
        },
        presentation,
    }))
}

pub fn present(reply: ExecutionReply, options: &Presentation) -> Result<()> {
    let output = match reply {
        ExecutionReply::Failed(error) => bail!("{}: {}", error.code, error.message),
        ExecutionReply::Completed(output) => *output,
    };
    let mut sheets = Vec::new();
    let print_command =
        |command: &CommandResult,
         sheets: &mut Vec<crate::config::textfsm_export::ParsedOutputSheet>| {
            if let Some(text) = &command.output {
                println!("{text}");
            }
            if let Some(error) = &command.error {
                eprintln!("{}: {error}", command.command);
            }
            if let Some(error) = &command.parse_error {
                eprintln!("Parse error: {error}");
            }
            if let Some(parsed) = &command.parsed_output {
                println!(
                    "{}",
                    crate::config::textfsm::format_parsed_output_table(parsed)
                );
                sheets.push(crate::config::textfsm_export::ParsedOutputSheet {
                    name: command.command.clone(),
                    parsed_output: parsed.clone(),
                });
            }
        };
    let mut recording = None;
    match &output {
        ExecutionOutput::Exec(r) => {
            for command in &r.outputs {
                print_command(command, &mut sheets);
            }
            recording = r.recording_jsonl.as_ref();
        }
        ExecutionOutput::Template(r) => {
            println!("{}", r.rendered_commands);
            for command in &r.executed {
                print_command(command, &mut sheets);
            }
            recording = r.recording_jsonl.as_ref();
        }
        ExecutionOutput::Interactive(r) => {
            for command in &r.outputs {
                print_command(command, &mut sheets);
            }
            recording = r.recording_jsonl.as_ref();
        }
        ExecutionOutput::ExecBatch(r) => {
            for target in &r.results {
                println!("=== {} ({}) ===", target.target, target.host);
                let first_sheet = sheets.len();
                for command in &target.outputs {
                    print_command(command, &mut sheets);
                }
                enrich_sheets(&mut sheets[first_sheet..], &target.target, &target.profile)?;
                if let Some(error) = &target.error {
                    eprintln!("{error}");
                }
            }
        }
        ExecutionOutput::InteractiveBatch(r) => {
            for target in &r.results {
                println!("=== {} ({}) ===", target.target, target.host);
                let first_sheet = sheets.len();
                for command in &target.outputs {
                    print_command(command, &mut sheets);
                }
                enrich_sheets(&mut sheets[first_sheet..], &target.target, &target.profile)?;
                if let Some(error) = &target.error {
                    eprintln!("{error}");
                }
            }
        }
        ExecutionOutput::Show(r) => {
            if options.print_command {
                println!("# command: {}", r.command);
            }
            println!("{}", r.output);
            print_parsed(
                &r.object,
                r.parsed_output.as_ref(),
                r.parse_error.as_deref(),
                &mut sheets,
            );
            recording = r.recording_jsonl.as_ref();
        }
        ExecutionOutput::ShowBatch(r) => {
            for target in &r.results {
                println!("=== {} ({}) ===", target.target, target.host);
                if options.print_command {
                    println!("# command: {}", target.command);
                }
                if let Some(text) = &target.output {
                    println!("{text}");
                }
                if let Some(error) = &target.error {
                    eprintln!("{error}");
                }
                let first_sheet = sheets.len();
                print_parsed(
                    &target.object,
                    target.parsed_output.as_ref(),
                    target.parse_error.as_deref(),
                    &mut sheets,
                );
                enrich_sheets(&mut sheets[first_sheet..], &target.target, &target.profile)?;
            }
        }
        ExecutionOutput::Workflow(r) => {
            if options.view {
                if options.json {
                    println!("{}", serde_json::to_string_pretty(&r.workflow)?);
                } else {
                    super::tx_workflow::print_tx_workflow_plan(
                        &serde_json::from_value(r.workflow.clone())?,
                        None,
                    );
                }
            } else if let Some(result) = &r.tx_workflow_result {
                if options.json {
                    println!("{}", serde_json::to_string_pretty(result)?);
                } else {
                    super::tx_workflow::print_tx_workflow_result(&serde_json::from_value(
                        result.clone(),
                    )?);
                }
            }
            recording = r.recording_jsonl.as_ref();
        }
        ExecutionOutput::Orchestration(r) => {
            if options.view {
                if options.json {
                    println!("{}", serde_json::to_string_pretty(&r.plan)?);
                } else {
                    println!(
                        "{}",
                        crate::orchestrator::render_plan(
                            &serde_json::from_value(r.plan.clone())?,
                            None
                        )?
                    );
                }
            } else if let Some(result) = &r.orchestration_result {
                if options.json {
                    println!("{}", serde_json::to_string_pretty(result)?);
                } else {
                    println!(
                        "{}",
                        crate::orchestrator::render_execution_result(&serde_json::from_value(
                            result.clone()
                        )?)
                    );
                }
            }
        }
        ExecutionOutput::Config(r) => print_config(&r.target, options)?,
        ExecutionOutput::ConfigBatch(r) => {
            for target in &r.results {
                print_config(target, options)?;
            }
        }
        ExecutionOutput::Upload(r) => {
            println!("Uploaded to {}", r.remote_path);
            recording = r.recording_jsonl.as_ref();
        }
    }
    if let Some(path) = &options.record_file
        && !matches!(
            output.summary().outcome,
            crate::domain::task::TaskResultOutcome::DryRun
        )
    {
        if let Some(parent) = path.parent()
            && !parent.as_os_str().is_empty()
        {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(
            path,
            recording.context("execution returned no session recording")?,
        )?;
    }
    if let Some(path) = &options.excel
        && !sheets.is_empty()
    {
        if matches!(
            output,
            ExecutionOutput::ExecBatch(_)
                | ExecutionOutput::InteractiveBatch(_)
                | ExecutionOutput::ShowBatch(_)
        ) {
            sheets = super::exec::merge_multi_show_parsed_outputs(
                sheets
                    .into_iter()
                    .map(|sheet| super::exec::MultiShowParsedOutput {
                        object: sheet.name,
                        rows: sheet.parsed_output.as_array().cloned().unwrap_or_default(),
                    })
                    .collect(),
            );
        }
        crate::config::textfsm_export::write_parsed_outputs_xlsx(path, &sheets)?;
    }
    if !output.summary().success {
        bail!("{}", output.summary().summary);
    }
    Ok(())
}

fn print_parsed(
    name: &str,
    parsed: Option<&Value>,
    error: Option<&str>,
    sheets: &mut Vec<crate::config::textfsm_export::ParsedOutputSheet>,
) {
    if let Some(error) = error {
        eprintln!("Parse error: {error}");
    }
    if let Some(parsed) = parsed {
        println!(
            "{}",
            crate::config::textfsm::format_parsed_output_table(parsed)
        );
        sheets.push(crate::config::textfsm_export::ParsedOutputSheet {
            name: name.into(),
            parsed_output: parsed.clone(),
        });
    }
}

fn print_config(target: &ConfigFetchTargetResponse, options: &Presentation) -> Result<()> {
    if let Some(error) = &target.error {
        eprintln!("{}: {error}", target.target);
        return Ok(());
    }
    let content = if options.normalized {
        target.normalized_content.as_ref()
    } else {
        target.content.as_ref()
    }
    .context("missing config content")?;
    let path = options.config_output.clone().or_else(|| {
        options.config_dir.as_ref().map(|dir| {
            let name: String = target
                .target
                .chars()
                .map(|c| {
                    if c.is_ascii_alphanumeric() || "-_.".contains(c) {
                        c
                    } else {
                        '_'
                    }
                })
                .collect();
            dir.join(format!(
                "{}_{}_{}.cfg",
                name,
                target.kind,
                chrono::Utc::now().format("%Y%m%dT%H%M%SZ")
            ))
        })
    });
    if let Some(path) = path {
        if let Some(parent) = path.parent()
            && !parent.as_os_str().is_empty()
        {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&path, content)?;
        println!("# saved: {}", path.display());
    } else {
        println!("{content}");
    }
    Ok(())
}

fn enrich_sheets(
    sheets: &mut [crate::config::textfsm_export::ParsedOutputSheet],
    target: &str,
    profile: &str,
) -> Result<()> {
    for sheet in sheets {
        sheet.parsed_output = Value::Array(super::exec::add_multi_target_metadata(
            target,
            profile,
            &sheet.name,
            sheet.parsed_output.clone(),
        )?);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::Parser;

    #[test]
    fn upload_accepts_content_at_the_size_limit() -> Result<()> {
        let content = read_upload(std::io::repeat(0x80).take(MAX_CLI_UPLOAD_BYTES))?;
        assert_eq!(content.len() as u64, MAX_CLI_UPLOAD_BYTES);
        assert!(content.iter().all(|&byte| byte == 0x80));
        Ok(())
    }

    #[test]
    fn oversized_upload_stops_reading_after_the_first_excess_byte() {
        let mut source = std::io::repeat(0x80).take(MAX_CLI_UPLOAD_BYTES + 1024);
        let error = read_upload(&mut source).unwrap_err();
        assert_eq!(
            error.to_string(),
            "CLI service uploads are limited to 32 MiB per task"
        );
        assert_eq!(source.limit(), 1023);
    }

    #[test]
    fn preparation_sends_file_content_and_keeps_exports_on_the_client() -> Result<()> {
        let root = std::env::temp_dir().join(format!(
            "rauto-inputs-{}",
            crate::infrastructure::runtime::new_id()
        ));
        std::fs::create_dir_all(&root)?;
        let workflow = root.join("plan.json");
        let export = root.join("output.jsonl");
        let content = r#"{"name":"test","blocks":[]}"#;
        std::fs::write(&workflow, content)?;
        let cli = Cli::try_parse_from([
            "rauto",
            "tx-workflow",
            workflow.to_str().unwrap(),
            "--record-file",
            export.to_str().unwrap(),
            "--dry-run",
        ])?;
        let prepared = prepare(&cli)?.unwrap();
        assert_eq!(prepared.presentation.record_file, Some(export));
        let serialized = serde_json::to_string(&prepared.request)?;
        assert!(!serialized.contains(root.to_str().unwrap()));
        let ExecutionAction::Workflow(request) = prepared.request.action else {
            panic!("workflow");
        };
        assert_eq!(request.workflow_template_content.as_deref(), Some(content));
        let upload = root.join("file.bin");
        std::fs::write(&upload, [0, 255, 128])?;
        let cli = Cli::try_parse_from([
            "rauto",
            "upload",
            "--local-path",
            upload.to_str().unwrap(),
            "--remote-path",
            "/tmp/file.bin",
        ])?;
        let prepared = prepare(&cli)?.unwrap();
        assert!(!serde_json::to_string(&prepared.request)?.contains(root.to_str().unwrap()));
        let ExecutionAction::Upload { content_base64, .. } = prepared.request.action else {
            panic!("upload");
        };
        use base64::Engine;
        assert_eq!(
            base64::engine::general_purpose::STANDARD.decode(content_base64)?,
            [0, 255, 128]
        );
        std::fs::remove_dir_all(root)?;
        Ok(())
    }

    #[test]
    fn batch_selectors_include_primary_device_and_reject_ambiguous_exports() -> Result<()> {
        let cli = Cli::try_parse_from([
            "rauto",
            "exec",
            "show version",
            "-d",
            "one",
            "--target",
            "two",
        ])?;
        let ExecutionAction::ExecBatch(batch) = prepare(&cli)?.unwrap().request.action else {
            panic!("batch");
        };
        assert_eq!(batch.targets, ["two", "one"]);
        let cli = Cli::try_parse_from([
            "rauto",
            "exec",
            "show version",
            "--target",
            "one",
            "--record-file",
            "record.jsonl",
        ])?;
        assert!(prepare(&cli).is_err());
        let cli = Cli::try_parse_from([
            "rauto",
            "show",
            "version",
            "--no-parse",
            "--textfsm-excel",
            "output.xlsx",
        ])?;
        assert!(prepare(&cli).is_err());
        Ok(())
    }
}
