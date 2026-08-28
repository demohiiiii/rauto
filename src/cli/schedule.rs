use crate::cli::{ScheduleCommands, ScheduleDefinitionArgs};
use crate::domain::scheduling::{
    ScheduleDefinition, ScheduleRun, ScheduleRunStatus, StoredSchedule, next_runs_after_ms,
    timestamp_ms_in_timezone,
};
use crate::infrastructure::db::schedule_store;
use crate::scheduler::validate_schedule_definition;
use anyhow::{Result, anyhow};
use chrono::Utc;

pub(crate) async fn run_schedule_command(command: ScheduleCommands) -> Result<()> {
    match command {
        ScheduleCommands::List { json } => {
            let schedules = schedule_store::list_schedules().await?;
            if json {
                print_json(&schedules)?;
            } else if schedules.is_empty() {
                println!("-");
            } else {
                for schedule in schedules {
                    println!(
                        "{}\t{}\t{}\t{}\t{}\t{}",
                        schedule.id,
                        if schedule.definition.enabled {
                            "enabled"
                        } else {
                            "disabled"
                        },
                        schedule.next_run_at.as_deref().unwrap_or("-"),
                        schedule.definition.action.action_type(),
                        schedule.definition.cron_expression,
                        schedule.definition.name
                    );
                }
            }
        }
        ScheduleCommands::Show { selector, json } => {
            let schedule = resolve_schedule(&selector).await?;
            if json {
                print_json(&schedule)?;
            } else {
                print_schedule(&schedule)?;
            }
        }
        ScheduleCommands::Create(args) => {
            let json = args.json;
            let definition = read_definition(args)?;
            validate_schedule_definition(&definition)?;
            let schedule = schedule_store::create_schedule(definition).await?;
            print_mutation("Created", &schedule, json)?;
        }
        ScheduleCommands::Update {
            selector,
            definition,
        } => {
            let existing = resolve_schedule(&selector).await?;
            let json = definition.json;
            let definition = read_definition(definition)?;
            validate_schedule_definition(&definition)?;
            let schedule = schedule_store::update_schedule(&existing.id, definition)
                .await?
                .ok_or_else(|| anyhow!("schedule '{}' not found", selector.trim()))?;
            print_mutation("Updated", &schedule, json)?;
        }
        ScheduleCommands::Delete { selector } => {
            let schedule = resolve_schedule(&selector).await?;
            if !schedule_store::delete_schedule(&schedule.id).await? {
                return Err(anyhow!("schedule '{}' not found", selector.trim()));
            }
            println!(
                "Deleted schedule '{}' ({})",
                schedule.definition.name, schedule.id
            );
        }
        ScheduleCommands::Enable { selector, json } => {
            set_enabled(&selector, true, json).await?;
        }
        ScheduleCommands::Disable { selector, json } => {
            set_enabled(&selector, false, json).await?;
        }
        ScheduleCommands::Run { selector, json } => {
            let schedule = resolve_schedule(&selector).await?;
            let run = schedule_store::enqueue_manual_run(&schedule.id)
                .await?
                .ok_or_else(|| anyhow!("schedule '{}' not found", selector.trim()))?;
            if json {
                print_json(&run)?;
            } else {
                println!("{}", manual_run_message(&run, &schedule.definition.name));
            }
        }
        ScheduleCommands::Runs {
            selector,
            limit,
            json,
        } => {
            let schedule = resolve_schedule(&selector).await?;
            let runs = schedule_store::list_schedule_runs(&schedule.id, limit).await?;
            if json {
                print_json(&runs)?;
            } else {
                print_runs(&runs);
            }
        }
        ScheduleCommands::Preview {
            cron_expression,
            timezone,
            count,
            json,
        } => {
            if !(1..=100).contains(&count) {
                return Err(anyhow!("--count must be between 1 and 100"));
            }
            let next_runs = next_runs_after_ms(
                &cron_expression,
                &timezone,
                Utc::now().timestamp_millis(),
                count,
            )?
            .into_iter()
            .map(|timestamp| timestamp_ms_in_timezone(timestamp, &timezone))
            .collect::<Result<Vec<_>, _>>()?;
            if json {
                print_json(&next_runs)?;
            } else {
                for next_run in next_runs {
                    println!("{next_run}");
                }
            }
        }
    }
    Ok(())
}

fn read_definition(args: ScheduleDefinitionArgs) -> Result<ScheduleDefinition> {
    let content = crate::cli::exec::read_text_body("schedule definition", args.file, args.content)?;
    serde_json::from_str(&content).map_err(Into::into)
}

async fn resolve_schedule(selector: &str) -> Result<StoredSchedule> {
    let selector = selector.trim();
    if selector.is_empty() {
        return Err(anyhow!("schedule ID or name must not be empty"));
    }
    if let Some(schedule) = schedule_store::get_schedule(selector).await? {
        return Ok(schedule);
    }
    schedule_store::list_schedules()
        .await?
        .into_iter()
        .find(|schedule| schedule.definition.name == selector)
        .ok_or_else(|| anyhow!("schedule '{}' not found", selector))
}

async fn set_enabled(selector: &str, enabled: bool, json: bool) -> Result<()> {
    let existing = resolve_schedule(selector).await?;
    let schedule = schedule_store::set_schedule_enabled(&existing.id, enabled)
        .await?
        .ok_or_else(|| anyhow!("schedule '{}' not found", selector.trim()))?;
    print_mutation(
        if enabled { "Enabled" } else { "Disabled" },
        &schedule,
        json,
    )
}

fn print_mutation(action: &str, schedule: &StoredSchedule, json: bool) -> Result<()> {
    if json {
        print_json(schedule)
    } else {
        println!(
            "{} schedule '{}' ({})",
            action, schedule.definition.name, schedule.id
        );
        Ok(())
    }
}

fn print_schedule(schedule: &StoredSchedule) -> Result<()> {
    println!("id: {}", schedule.id);
    println!("name: {}", schedule.definition.name);
    println!("enabled: {}", schedule.definition.enabled);
    println!("cron: {}", schedule.definition.cron_expression);
    println!("timezone: {}", schedule.definition.timezone);
    println!(
        "next_run_at: {}",
        schedule.next_run_at.as_deref().unwrap_or("-")
    );
    println!(
        "last_run_at: {}",
        schedule.last_run_at.as_deref().unwrap_or("-")
    );
    println!("action: {}", schedule.definition.action.action_type());
    println!(
        "action_definition: {}",
        serde_json::to_string(&schedule.definition.action)?
    );
    Ok(())
}

fn print_runs(runs: &[ScheduleRun]) {
    if runs.is_empty() {
        println!("-");
        return;
    }
    for run in runs {
        println!(
            "{}\t{}\t{}\t{}\t{}\t{}",
            run.id,
            run.status.as_str(),
            run.trigger_type,
            run.scheduled_for,
            run.completed_at.as_deref().unwrap_or("-"),
            run.error
                .as_deref()
                .or(run.skip_reason.as_deref())
                .unwrap_or("-")
        );
    }
}

fn manual_run_message(run: &ScheduleRun, schedule_name: &str) -> String {
    match run.status {
        ScheduleRunStatus::Skipped => format!(
            "Skipped run '{}' for schedule '{}': {}",
            run.id,
            schedule_name,
            run.skip_reason.as_deref().unwrap_or("overlap policy")
        ),
        _ => format!(
            "Queued run '{}' for schedule '{}'; a running 'rauto web' scheduler will execute it",
            run.id, schedule_name
        ),
    }
}

fn print_json(value: &impl serde::Serialize) -> Result<()> {
    println!("{}", serde_json::to_string_pretty(value)?);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::scheduling::ScheduledAction;

    #[test]
    fn inline_schedule_definition_uses_domain_defaults() {
        let definition = read_definition(ScheduleDefinitionArgs {
            file: None,
            content: Some(
                r#"{
                    "name": "nightly backup",
                    "cron_expression": "0 2 * * *",
                    "action": {
                        "type": "orchestrate",
                        "template_name": "backup"
                    }
                }"#
                .to_string(),
            ),
            json: false,
        })
        .expect("parse schedule definition");

        assert!(definition.enabled);
        assert_eq!(definition.timezone, "Asia/Shanghai");
        assert!(matches!(
            definition.action,
            ScheduledAction::Orchestrate { template_name, .. } if template_name == "backup"
        ));
    }

    #[test]
    fn manual_run_message_reports_skipped_runs() {
        let run = ScheduleRun {
            id: "run-1".to_string(),
            schedule_id: "schedule-1".to_string(),
            schedule_name: "nightly".to_string(),
            task_id: None,
            trigger_type: "manual".to_string(),
            scheduled_for: "2026-08-28T00:00:00Z".to_string(),
            status: ScheduleRunStatus::Skipped,
            skip_reason: Some("another run is already active".to_string()),
            error: None,
            started_at: None,
            completed_at: Some("2026-08-28T00:00:00Z".to_string()),
            created_at: "2026-08-28T00:00:00Z".to_string(),
        };

        assert_eq!(
            manual_run_message(&run, "nightly"),
            "Skipped run 'run-1' for schedule 'nightly': another run is already active"
        );
    }
}
