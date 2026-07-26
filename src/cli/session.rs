use crate::cli::{GlobalOpts, SessionArgs, SessionCommands, SessionReplayArgs};
use crate::config::history_store::{self, HistoryEntry};
use anyhow::{Result, anyhow};
use rneter::session::{SessionEvent, SessionRecorder, SessionReplayer};
use std::fs;

pub(crate) fn run_session_command(args: SessionArgs, opts: &GlobalOpts) -> Result<()> {
    match args.command {
        None => show_latest_record(opts.connection.as_deref()),
        Some(SessionCommands::List {
            connection,
            limit,
            json,
        }) => list_records(
            connection.as_deref().or(opts.connection.as_deref()),
            limit,
            json,
        ),
        Some(SessionCommands::Show { id, json, raw }) => {
            show_record(id.as_deref(), opts.connection.as_deref(), json, raw)
        }
        Some(SessionCommands::Delete { id }) => delete_record(&id, opts.connection.as_deref()),
        Some(SessionCommands::Replay(args)) => replay_record(args, opts.connection.as_deref()),
    }
}

fn show_latest_record(connection: Option<&str>) -> Result<()> {
    let Some(record) = history_store::find_history(connection, None)? else {
        println!("# session records");
        println!("-");
        return Ok(());
    };
    show_record(Some(&record.id), connection, false, false)
}

fn list_records(connection: Option<&str>, limit: usize, json: bool) -> Result<()> {
    let records = match connection {
        Some(name) => history_store::list_history_by_connection_name(name, limit)?,
        None => history_store::list_history(limit)?,
    };
    if json {
        println!("{}", serde_json::to_string_pretty(&records)?);
        return Ok(());
    }

    println!("# session records");
    if records.is_empty() {
        println!("-");
        return Ok(());
    }
    for record in records {
        println!(
            "- id={} ts_ms={} connection={} operation={} mode={} level={} command={}",
            record.id,
            record.ts_ms,
            connection_label(&record),
            record.operation,
            record.mode.as_deref().unwrap_or("-"),
            record.record_level,
            record.command_label
        );
    }
    Ok(())
}

fn show_record(id: Option<&str>, connection: Option<&str>, json: bool, raw: bool) -> Result<()> {
    let (record, jsonl) = load_record(id, connection)?;
    if raw {
        print!("{jsonl}");
        if !jsonl.ends_with('\n') {
            println!();
        }
        return Ok(());
    }

    let recorder = SessionRecorder::from_jsonl(&jsonl)?;
    let entries = recorder.entries()?;
    if json {
        println!(
            "{}",
            serde_json::to_string_pretty(&serde_json::json!({
                "meta": record,
                "entries": entries,
            }))?
        );
        return Ok(());
    }

    print_record_metadata(&record, entries.len());
    print_command_outputs(entries, true);
    Ok(())
}

fn delete_record(id: &str, connection: Option<&str>) -> Result<()> {
    let deleted = match connection {
        Some(name) => history_store::delete_history_by_connection_name(name, id)?,
        None => history_store::delete_history(id)?,
    };
    if deleted {
        println!("Deleted session record '{id}'");
    } else {
        println!("Session record '{id}' not found");
    }
    Ok(())
}

fn replay_record(args: SessionReplayArgs, connection: Option<&str>) -> Result<()> {
    let jsonl = match args.record_file.as_ref() {
        Some(path) => fs::read_to_string(path)?,
        None => {
            let (record, jsonl) = load_record(args.id.as_deref(), connection)?;
            println!(
                "# record: id={} connection={}",
                record.id,
                connection_label(&record)
            );
            jsonl
        }
    };
    let mut replayer = SessionReplayer::from_jsonl(&jsonl)?;

    if let Some(ctx) = replayer.initial_context() {
        println!(
            "# context: device={} prompt={} fsm_prompt={}",
            ctx.device_addr, ctx.prompt, ctx.fsm_prompt
        );
    }

    if args.list || args.command.is_none() {
        let recorder = SessionRecorder::from_jsonl(&jsonl)?;
        print_command_outputs(recorder.entries()?, false);
    }

    if let Some(command) = args.command {
        let output = if let Some(mode) = args.mode.as_deref() {
            replayer.replay_next_in_mode(&command, mode)?
        } else {
            replayer.replay_next(&command)?
        };
        println!("{}", output.content);
    }

    Ok(())
}

fn load_record(id: Option<&str>, connection: Option<&str>) -> Result<(HistoryEntry, String)> {
    let record = history_store::find_history(connection, id)?.ok_or_else(|| match id {
        Some(id) => anyhow!("session record '{id}' not found"),
        None => anyhow!("no session records found"),
    })?;
    let jsonl = history_store::load_recording_jsonl(&record.id)?
        .ok_or_else(|| anyhow!("session record '{}' has no recording data", record.id))?;
    Ok((record, jsonl))
}

fn print_record_metadata(record: &HistoryEntry, entry_count: usize) {
    println!("id: {}", record.id);
    println!("ts_ms: {}", record.ts_ms);
    println!("connection: {}", connection_label(record));
    println!("host: {}", record.host);
    println!("port: {}", record.port);
    println!("username: {}", record.username);
    println!("device_profile: {}", record.device_profile);
    println!("operation: {}", record.operation);
    println!("command_label: {}", record.command_label);
    println!("mode: {}", record.mode.as_deref().unwrap_or("-"));
    println!("record_level: {}", record.record_level);
    println!("record_path: {}", record.record_path);
    println!("entries: {entry_count}");
}

fn print_command_outputs(entries: Vec<rneter::session::SessionRecordEntry>, show_content: bool) {
    println!("# command outputs");
    let mut index = 0usize;
    for entry in entries {
        if let SessionEvent::CommandOutput {
            command,
            mode,
            success,
            exit_code,
            content,
            all,
            ..
        } = entry.event
        {
            index += 1;
            let exit_code = exit_code
                .map(|value| format!(" exit_code={value}"))
                .unwrap_or_default();
            println!("{index}. mode={mode} success={success}{exit_code} command={command}");
            if show_content {
                let output = if all.is_empty() { &content } else { &all };
                if !output.is_empty() {
                    println!("{}", output.trim_end());
                }
            }
        }
    }
    if index == 0 {
        println!("-");
    }
}

fn connection_label(record: &HistoryEntry) -> &str {
    record
        .connection_name
        .as_deref()
        .unwrap_or(&record.connection_key)
}
