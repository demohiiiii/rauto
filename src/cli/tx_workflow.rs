use crate::cli::{JsonTemplateCommands, TxWorkflowArgs};
use crate::config::{command_blacklist, content_store, template_loader};
use crate::tx_operation::command_timeout_secs;
use anyhow::Result;
use rneter::session::{MANAGER, RollbackPolicy, SessionOperation, TxBlock, TxWorkflowResult};
use std::fmt::Write as _;
use std::fs;
use std::path::PathBuf;

pub(crate) async fn run_tx_workflow(
    args: TxWorkflowArgs,
    opts: &crate::cli::GlobalOpts,
) -> Result<()> {
    let (workflow, source) = load_tx_workflow_from_args(&args, opts).await?;

    if args.view {
        print_tx_workflow_plan(&workflow, source.as_ref());
        return Ok(());
    }

    if args.dry_run {
        if args.json {
            println!("{}", serde_json::to_string_pretty(&workflow)?);
        } else {
            print_tx_workflow_plan(&workflow, source.as_ref());
        }
        return Ok(());
    }

    command_blacklist::ensure_tx_workflow_allowed(
        &workflow,
        &format!("tx workflow '{}'", workflow.name),
    )?;

    let conn =
        crate::resolve_autodetect_connection(crate::resolve_effective_connection(opts)?).await?;
    let handler = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let request = crate::manager_connection_request(
        conn.username.clone(),
        conn.host.clone(),
        conn.port,
        conn.password.clone(),
        conn.enable_password.clone(),
        handler,
    );
    let (_sender, recorder) = MANAGER
        .get_with_recording_level_and_context(
            request,
            crate::manager_execution_context_with_security(
                None,
                conn.ssh_security,
                conn.connect_timeout_secs,
            ),
            crate::to_record_level(args.record_level),
        )
        .await?;
    let handler_for_tx = template_loader::load_device_profile_for_connection(
        &conn.device_profile,
        conn.linux_shell_flavor,
    )?;
    let request = crate::manager_connection_request(
        conn.username.clone(),
        conn.host.clone(),
        conn.port,
        conn.password.clone(),
        conn.enable_password.clone(),
        handler_for_tx,
    );
    let workflow_result = MANAGER
        .execute_tx_workflow_with_context(
            request,
            workflow.clone(),
            crate::manager_execution_context_with_security(
                None,
                conn.ssh_security,
                conn.connect_timeout_secs,
            ),
        )
        .await?;
    let recording_jsonl = recorder.to_jsonl()?;
    crate::write_recording_text_if_requested(
        args.record_file.as_ref(),
        &recording_jsonl,
        args.record_level,
    )?;
    crate::persist_auto_recording_history_jsonl(
        &recording_jsonl,
        &conn,
        "tx_workflow",
        &workflow.name,
        None,
        args.record_level,
    )?;

    if args.json {
        println!("{}", serde_json::to_string_pretty(&workflow_result)?);
    } else {
        print_tx_workflow_result(&workflow_result);
    }
    crate::maybe_save_connection_profile(opts, &conn)?;
    Ok(())
}

pub(crate) fn run_tx_workflow_template_command(cmd: JsonTemplateCommands) -> Result<()> {
    run_json_template_command(crate::cli_json_templates::JsonTemplateKind::TxWorkflow, cmd)
}

fn run_json_template_command(
    kind: crate::cli_json_templates::JsonTemplateKind,
    cmd: JsonTemplateCommands,
) -> Result<()> {
    match cmd {
        JsonTemplateCommands::List => {
            let items = content_store::list_tx_workflow_templates()?;
            if items.is_empty() {
                println!("-");
            } else {
                for item in items {
                    println!("- {}", item.name);
                }
            }
        }
        JsonTemplateCommands::Show { name } => {
            let safe_name = crate::cli_json_templates::safe_json_template_name(&name)?;
            let stored = content_store::load_tx_workflow_template(&safe_name)?
                .ok_or_else(|| anyhow::anyhow!("tx workflow template '{}' not found", safe_name))?;
            println!("{}", stored.content);
        }
        JsonTemplateCommands::Create {
            name,
            file,
            content,
        } => {
            let safe_name = crate::cli_json_templates::safe_json_template_name(&name)?;
            let body = crate::cli_json_templates::read_json_template_body(kind, file, content)?;
            let created = content_store::create_tx_workflow_template(&safe_name, &body)?;
            if !created {
                return Err(anyhow::anyhow!(
                    "tx workflow template '{}' already exists",
                    safe_name
                ));
            }
            println!("Created tx workflow template '{}'", safe_name);
        }
        JsonTemplateCommands::Update {
            name,
            file,
            content,
        } => {
            let safe_name = crate::cli_json_templates::safe_json_template_name(&name)?;
            let body = crate::cli_json_templates::read_json_template_body(kind, file, content)?;
            let updated = content_store::update_tx_workflow_template(&safe_name, &body)?;
            if !updated {
                return Err(anyhow::anyhow!(
                    "tx workflow template '{}' not found",
                    safe_name
                ));
            }
            println!("Updated tx workflow template '{}'", safe_name);
        }
        JsonTemplateCommands::Delete { name } => {
            let safe_name = crate::cli_json_templates::safe_json_template_name(&name)?;
            let deleted = content_store::delete_tx_workflow_template(&safe_name)?;
            if !deleted {
                return Err(anyhow::anyhow!(
                    "tx workflow template '{}' not found",
                    safe_name
                ));
            }
            println!("Deleted tx workflow template '{}'", safe_name);
        }
    }
    Ok(())
}

async fn load_tx_workflow_from_args(
    args: &TxWorkflowArgs,
    opts: &crate::cli::GlobalOpts,
) -> Result<(rneter::session::TxWorkflow, Option<PathBuf>)> {
    match (&args.workflow_file, &args.template) {
        (Some(_), Some(_)) => Err(anyhow::anyhow!(
            "use either workflow_file or --template, not both"
        )),
        (None, None) => Err(anyhow::anyhow!(
            "tx-workflow requires workflow_file or --template <name>"
        )),
        (Some(path), None) => {
            let workflow_text = fs::read_to_string(path)?;
            let workflow = serde_json::from_str(&workflow_text)?;
            Ok((workflow, Some(path.clone())))
        }
        (None, Some(name)) => {
            let content = crate::cli_json_templates::load_json_template_content(
                crate::cli_json_templates::JsonTemplateKind::TxWorkflow,
                name,
            )?;
            let source: serde_json::Value = serde_json::from_str(&content)?;
            let vars = crate::cli_json_templates::read_json_vars(
                args.vars.as_deref(),
                args.vars_json.as_deref(),
            )?;
            let conn = crate::resolve_effective_connection(opts).ok();
            let mut context = crate::cli_json_templates::template_context(vars, conn.as_ref());
            let rendered =
                crate::cli_json_templates::render_json_template_value(&source, &mut context)?;
            let workflow = serde_json::from_value(rendered)?;
            Ok((workflow, None))
        }
    }
}

fn print_tx_workflow_plan(workflow: &rneter::session::TxWorkflow, source: Option<&PathBuf>) {
    println!("{}", render_tx_workflow_plan(workflow, source));
}

fn render_tx_workflow_plan(
    workflow: &rneter::session::TxWorkflow,
    source: Option<&PathBuf>,
) -> String {
    let ansi = AnsiTheme::detect();
    let mut out = String::new();
    let total_blocks = workflow.blocks.len();
    let total_steps = workflow
        .blocks
        .iter()
        .map(|block| block.steps.len())
        .sum::<usize>();
    let mut per_step_blocks = 0usize;
    let mut whole_resource_blocks = 0usize;
    let mut none_blocks = 0usize;
    for block in &workflow.blocks {
        match &block.rollback_policy {
            RollbackPolicy::PerStep => per_step_blocks += 1,
            RollbackPolicy::WholeResource { .. } => whole_resource_blocks += 1,
            RollbackPolicy::None => none_blocks += 1,
        }
    }

    let _ = writeln!(
        &mut out,
        "{}",
        ansi.header(&format!("# tx_workflow_plan: {}", workflow.name))
    );
    if let Some(path) = source {
        let _ = writeln!(
            &mut out,
            "{}",
            ansi.muted(&format!("file: {}", path.to_string_lossy()))
        );
    }
    let _ = writeln!(
        &mut out,
        "{}",
        ansi.overview(&format!(
            "overview: fail_fast={} blocks={} steps={} policies(per_step={}, whole_resource={}, none={})",
            workflow.fail_fast,
            total_blocks,
            total_steps,
            per_step_blocks,
            whole_resource_blocks,
            none_blocks
        ))
    );
    let _ = writeln!(&mut out);

    for (block_idx, block) in workflow.blocks.iter().enumerate() {
        const BLOCK_META_COLS: [usize; 4] = [11, 26, 11, 18];
        const STEP_INFO_COLS: [usize; 4] = [11, 14, 11, 14];
        let command_value_w = block_command_cell_width(block);
        let step_cmd_cols = [11, command_value_w, 11, command_value_w];

        let block_meta_sep = table_sep(&BLOCK_META_COLS);
        let step_info_sep = table_sep(&STEP_INFO_COLS);
        let step_cmd_sep = table_sep(&step_cmd_cols);

        let _ = writeln!(
            &mut out,
            "{}",
            ansi.block_title(&format!("[Block {}/{}]", block_idx + 1, total_blocks))
        );
        let _ = writeln!(&mut out, "{}", ansi.border(&block_meta_sep));
        let _ = writeln!(
            &mut out,
            "{}",
            table_row(
                &[
                    "name".to_string(),
                    block.name.clone(),
                    "steps".to_string(),
                    block.steps.len().to_string()
                ],
                &BLOCK_META_COLS,
                &[
                    CellStyle::Label,
                    CellStyle::Value,
                    CellStyle::Label,
                    CellStyle::Info,
                ],
                &ansi,
            )
        );
        let _ = writeln!(
            &mut out,
            "{}",
            table_row(
                &[
                    "fail_fast".to_string(),
                    block.fail_fast.to_string(),
                    "steps".to_string(),
                    block.steps.len().to_string()
                ],
                &BLOCK_META_COLS,
                &[
                    CellStyle::Label,
                    if block.fail_fast {
                        CellStyle::Warn
                    } else {
                        CellStyle::Muted
                    },
                    CellStyle::Label,
                    CellStyle::Info,
                ],
                &ansi,
            )
        );
        match &block.rollback_policy {
            RollbackPolicy::None => {
                let _ = writeln!(
                    &mut out,
                    "{}",
                    table_row(
                        &[
                            "policy".to_string(),
                            "none".to_string(),
                            "trigger".to_string(),
                            "-".to_string()
                        ],
                        &BLOCK_META_COLS,
                        &[
                            CellStyle::Label,
                            CellStyle::PolicyNone,
                            CellStyle::Label,
                            CellStyle::Muted,
                        ],
                        &ansi,
                    )
                );
            }
            RollbackPolicy::PerStep => {
                let _ = writeln!(
                    &mut out,
                    "{}",
                    table_row(
                        &[
                            "policy".to_string(),
                            "per_step".to_string(),
                            "trigger".to_string(),
                            "-".to_string()
                        ],
                        &BLOCK_META_COLS,
                        &[
                            CellStyle::Label,
                            CellStyle::PolicyPerStep,
                            CellStyle::Label,
                            CellStyle::Muted,
                        ],
                        &ansi,
                    )
                );
            }
            RollbackPolicy::WholeResource {
                rollback,
                trigger_step_index,
            } => {
                let (rollback_mode, rollback_summary) =
                    operation_mode_and_summary(rollback.as_ref());
                let _ = writeln!(
                    &mut out,
                    "{}",
                    table_row(
                        &[
                            "policy".to_string(),
                            "whole_resource".to_string(),
                            "trigger".to_string(),
                            trigger_step_index.to_string()
                        ],
                        &BLOCK_META_COLS,
                        &[
                            CellStyle::Label,
                            CellStyle::PolicyWhole,
                            CellStyle::Label,
                            CellStyle::Info,
                        ],
                        &ansi,
                    )
                );
                let _ = writeln!(
                    &mut out,
                    "{}",
                    table_row(
                        &[
                            "rb_mode".to_string(),
                            rollback_mode,
                            "rb_timeout".to_string(),
                            command_timeout_secs(rollback.as_ref())
                                .map(|sec| format!("{sec}s"))
                                .unwrap_or_else(|| "-".to_string())
                        ],
                        &BLOCK_META_COLS,
                        &[
                            CellStyle::Label,
                            CellStyle::Info,
                            CellStyle::Label,
                            CellStyle::Info,
                        ],
                        &ansi,
                    )
                );
                let _ = writeln!(&mut out, "{}", ansi.border(&step_cmd_sep));
                let _ = writeln!(
                    &mut out,
                    "{}",
                    table_row(
                        &[
                            "rollback".to_string(),
                            rollback_summary,
                            "-".to_string(),
                            "-".to_string()
                        ],
                        &step_cmd_cols,
                        &[
                            CellStyle::Label,
                            CellStyle::Rollback,
                            CellStyle::Muted,
                            CellStyle::Muted,
                        ],
                        &ansi,
                    )
                );
                let _ = writeln!(&mut out, "{}", ansi.border(&step_cmd_sep));
            }
        }
        let _ = writeln!(&mut out, "{}", ansi.border(&block_meta_sep));

        if block.steps.is_empty() {
            let _ = writeln!(&mut out, "{}", ansi.muted("  (no steps)"));
            let _ = writeln!(&mut out);
            continue;
        }

        for (step_idx, step) in block.steps.iter().enumerate() {
            let timeout = command_timeout_secs(&step.run)
                .map(|sec| format!("{sec}s"))
                .unwrap_or_else(|| "-".to_string());
            let (mode_value, command_value) = operation_mode_and_summary(&step.run);
            let rollback_cmd = step
                .rollback
                .as_ref()
                .map(|operation| operation_mode_and_summary(operation).1)
                .unwrap_or_else(|| "-".to_string());
            let _ = writeln!(
                &mut out,
                "{}",
                ansi.step_title(&format!("  Step {}/{}", step_idx + 1, block.steps.len()))
            );
            let _ = writeln!(&mut out, "  {}", ansi.border(&step_info_sep));
            let _ = writeln!(
                &mut out,
                "  {}",
                table_row(
                    &[
                        "step".to_string(),
                        format!("{}/{}", step_idx + 1, block.steps.len()),
                        "mode".to_string(),
                        mode_value
                    ],
                    &STEP_INFO_COLS,
                    &[
                        CellStyle::Label,
                        CellStyle::Info,
                        CellStyle::Label,
                        CellStyle::Info,
                    ],
                    &ansi,
                )
            );
            let _ = writeln!(
                &mut out,
                "  {}",
                table_row(
                    &[
                        "timeout".to_string(),
                        timeout,
                        "rb_fail".to_string(),
                        if step.rollback_on_failure {
                            "yes".to_string()
                        } else {
                            "no".to_string()
                        }
                    ],
                    &STEP_INFO_COLS,
                    &[
                        CellStyle::Label,
                        CellStyle::Value,
                        CellStyle::Label,
                        if step.rollback_on_failure {
                            CellStyle::Warn
                        } else {
                            CellStyle::Muted
                        },
                    ],
                    &ansi,
                )
            );
            let _ = writeln!(&mut out, "  {}", ansi.border(&step_info_sep));

            let _ = writeln!(&mut out, "  {}", ansi.border(&step_cmd_sep));
            let _ = writeln!(
                &mut out,
                "  {}",
                table_row(
                    &[
                        "command".to_string(),
                        command_value,
                        "rollback".to_string(),
                        rollback_cmd
                    ],
                    &step_cmd_cols,
                    &[
                        CellStyle::Label,
                        CellStyle::Command,
                        CellStyle::Label,
                        CellStyle::Rollback,
                    ],
                    &ansi,
                )
            );
            let _ = writeln!(&mut out, "  {}", ansi.border(&step_cmd_sep));
        }
        let _ = writeln!(&mut out);
    }

    out
}

fn table_sep(widths: &[usize]) -> String {
    let mut line = String::new();
    line.push('+');
    for width in widths {
        line.push_str(&"-".repeat(width + 2));
        line.push('+');
    }
    line
}

fn table_row(
    values: &[String],
    widths: &[usize],
    styles: &[CellStyle],
    ansi: &AnsiTheme,
) -> String {
    let mut line = String::new();
    line.push('|');
    for (idx, (value, width)) in values.iter().zip(widths.iter()).enumerate() {
        line.push(' ');
        let fitted = fit_cell(value, *width);
        let style = styles.get(idx).copied().unwrap_or(CellStyle::Plain);
        line.push_str(&ansi.apply(style, &fitted));
        line.push(' ');
        line.push('|');
    }
    line
}

fn fit_cell(value: &str, width: usize) -> String {
    if width == 0 {
        return String::new();
    }
    let count = value.chars().count();
    let clipped = if count > width {
        if width <= 3 {
            ".".repeat(width)
        } else {
            let mut s = String::new();
            for ch in value.chars().take(width - 3) {
                s.push(ch);
            }
            s.push_str("...");
            s
        }
    } else {
        value.to_string()
    };
    let pad = width.saturating_sub(clipped.chars().count());
    if pad == 0 {
        clipped
    } else {
        format!("{clipped}{}", " ".repeat(pad))
    }
}

fn block_command_cell_width(block: &TxBlock) -> usize {
    let mut max_len = 24usize;
    if let RollbackPolicy::WholeResource { rollback, .. } = &block.rollback_policy {
        max_len = max_len.max(
            operation_mode_and_summary(rollback.as_ref())
                .1
                .chars()
                .count(),
        );
    }
    for step in &block.steps {
        max_len = max_len.max(operation_mode_and_summary(&step.run).1.chars().count());
        if let Some(rollback) = &step.rollback {
            max_len = max_len.max(operation_mode_and_summary(rollback).1.chars().count());
        }
    }
    max_len.clamp(24, 54)
}

fn operation_mode_and_summary(operation: &SessionOperation) -> (String, String) {
    match operation.summary() {
        Ok(summary) => (summary.mode, summary.description),
        Err(_) => ("-".to_string(), "<invalid operation>".to_string()),
    }
}

#[derive(Clone, Copy)]
enum CellStyle {
    Plain,
    Label,
    Value,
    Info,
    Warn,
    Muted,
    Command,
    Rollback,
    PolicyPerStep,
    PolicyWhole,
    PolicyNone,
}

#[derive(Clone, Copy)]
struct AnsiTheme {
    enabled: bool,
}

impl AnsiTheme {
    fn detect() -> Self {
        let no_color = std::env::var_os("NO_COLOR").is_some();
        let term_is_dumb = std::env::var("TERM")
            .map(|value| value.eq_ignore_ascii_case("dumb"))
            .unwrap_or(false);
        Self {
            enabled: !no_color && !term_is_dumb,
        }
    }

    fn paint(&self, code: &str, text: &str) -> String {
        if self.enabled {
            format!("\x1b[{code}m{text}\x1b[0m")
        } else {
            text.to_string()
        }
    }

    fn apply(&self, style: CellStyle, text: &str) -> String {
        match style {
            CellStyle::Plain => text.to_string(),
            CellStyle::Label => self.paint("1;36", text),
            CellStyle::Value => self.paint("97", text),
            CellStyle::Info => self.paint("1;94", text),
            CellStyle::Warn => self.paint("1;33", text),
            CellStyle::Muted => self.paint("90", text),
            CellStyle::Command => self.paint("1;92", text),
            CellStyle::Rollback => self.paint("1;95", text),
            CellStyle::PolicyPerStep => self.paint("1;34", text),
            CellStyle::PolicyWhole => self.paint("1;35", text),
            CellStyle::PolicyNone => self.paint("90", text),
        }
    }

    fn header(&self, text: &str) -> String {
        self.paint("1;96", text)
    }

    fn overview(&self, text: &str) -> String {
        self.paint("1;93", text)
    }

    fn block_title(&self, text: &str) -> String {
        self.paint("1;94", text)
    }

    fn step_title(&self, text: &str) -> String {
        self.paint("1;34", text)
    }

    fn muted(&self, text: &str) -> String {
        self.paint("90", text)
    }

    fn border(&self, text: &str) -> String {
        self.paint("2;37", text)
    }
}

fn print_tx_workflow_result(result: &TxWorkflowResult) {
    println!("# tx_workflow: {}", result.workflow_name);
    println!("committed: {}", result.committed);
    println!(
        "rollback: attempted={} succeeded={}",
        result.rollback_attempted, result.rollback_succeeded
    );
    if let Some(index) = result.failed_block {
        println!("failed_block: {}", index);
    }
    for (idx, block) in result.block_results.iter().enumerate() {
        println!(
            "- block[{idx}] name={} committed={} executed_steps={} rollback_ok={}",
            block.block_name, block.committed, block.executed_steps, block.rollback_succeeded
        );
        if let Some(reason) = &block.failure_reason {
            println!("  failure_reason: {}", reason);
        }
        if !block.rollback_errors.is_empty() {
            println!("  rollback_errors: {}", block.rollback_errors.join(" | "));
        }
    }
    if !result.rollback_errors.is_empty() {
        println!(
            "workflow_rollback_errors: {}",
            result.rollback_errors.join(" | ")
        );
    }
}
