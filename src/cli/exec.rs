use crate::cli::{
    ShowArgs, ShowObjectCommands, TemplateCommands, TextfsmCommands, TextfsmMappingCommands,
    TextfsmTemplateCommands,
};
use crate::config::{
    connection_store, content_store, custom_show_object_store, custom_textfsm_store, show_catalog,
    textfsm_export,
};
use anyhow::Result;
use serde_json::{Map, Value};
use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;

pub(crate) struct MultiShowParsedOutput {
    pub(crate) object: String,
    pub(crate) rows: Vec<Value>,
}

pub(crate) async fn run_show(args: ShowArgs, opts: &crate::cli::GlobalOpts) -> Result<()> {
    if !args.list {
        anyhow::bail!("show object required, or use --list");
    }
    let explicit_profile = opts
        .device_profile
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    let device_profile = match explicit_profile {
        Some(profile) => Some(profile),
        None => opts
            .connection
            .as_deref()
            .map(connection_store::load_connection_raw)
            .transpose()?
            .and_then(|connection| connection.device_profile),
    };
    let platform = show_catalog::platform_for_show(device_profile.as_deref().unwrap_or_default());
    print_show_objects(device_profile.as_deref(), platform.as_deref())?;
    Ok(())
}

pub(crate) fn add_multi_target_metadata(
    device: &str,
    profile: &str,
    command: &str,
    parsed_output: Value,
) -> Result<Vec<Value>> {
    let rows = parsed_output
        .as_array()
        .ok_or_else(|| anyhow::anyhow!("TextFSM parsed output must be a JSON array"))?;
    let mut enriched_rows = Vec::with_capacity(rows.len());
    for row in rows {
        let source = row
            .as_object()
            .ok_or_else(|| anyhow::anyhow!("TextFSM parsed output rows must be JSON objects"))?;
        let mut enriched = source.clone();
        insert_multi_show_metadata(&mut enriched, "device", Value::String(device.to_string()));
        insert_multi_show_metadata(&mut enriched, "profile", Value::String(profile.to_string()));
        insert_multi_show_metadata(&mut enriched, "command", Value::String(command.to_string()));
        enriched_rows.push(Value::Object(enriched));
    }
    Ok(enriched_rows)
}

fn insert_multi_show_metadata(object: &mut Map<String, Value>, key: &str, value: Value) {
    if let Some(existing) = object.remove(key) {
        object.insert(format!("parsed_{key}"), existing);
    }
    object.insert(key.to_string(), value);
}

pub(crate) fn merge_multi_show_parsed_outputs(
    outputs: Vec<MultiShowParsedOutput>,
) -> Vec<textfsm_export::ParsedOutputSheet> {
    let mut object_order = Vec::new();
    let mut grouped: BTreeMap<String, Vec<Value>> = BTreeMap::new();
    for output in outputs {
        if !grouped.contains_key(&output.object) {
            object_order.push(output.object.clone());
        }
        grouped
            .entry(output.object)
            .or_default()
            .extend(output.rows);
    }
    object_order
        .into_iter()
        .map(|object| textfsm_export::ParsedOutputSheet {
            parsed_output: Value::Array(grouped.remove(&object).unwrap_or_default()),
            name: object,
        })
        .collect()
}

fn print_show_objects(device_profile: Option<&str>, platform: Option<&str>) -> Result<()> {
    if let Some(platform) = platform.filter(|value| !value.trim().is_empty()) {
        let commands =
            show_catalog::list_show_commands_for_profile(device_profile, Some(platform))?;
        if commands.is_empty() {
            println!("# platform: {}", platform);
            println!("-");
            return Ok(());
        }
        println!("# platform: {}", platform);
        for command in commands {
            let source = match command.source {
                show_catalog::ShowCommandSource::Builtin => "builtin",
                show_catalog::ShowCommandSource::Custom => "custom",
            };
            let mut suffixes = vec![format!("source: {source}")];
            if let Some(mode) = command.mode.as_deref() {
                suffixes.push(format!("mode: {mode}"));
            }
            if let Some(template_name) = command.textfsm_template_name.as_deref() {
                suffixes.push(format!("textfsm: {template_name}"));
            }
            println!("- {} ({})", command.object, suffixes.join(", "));
        }
    } else if let Some(device_profile) = device_profile
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        let commands = show_catalog::list_show_commands_for_profile(Some(device_profile), None)?;
        if commands.is_empty() {
            println!("-");
            return Ok(());
        }
        println!("# profile: {}", device_profile);
        for command in commands {
            let source = match command.source {
                show_catalog::ShowCommandSource::Builtin => "builtin",
                show_catalog::ShowCommandSource::Custom => "custom",
            };
            let mut suffixes = vec![format!("source: {source}")];
            if let Some(mode) = command.mode.as_deref() {
                suffixes.push(format!("mode: {mode}"));
            }
            if let Some(template_name) = command.textfsm_template_name.as_deref() {
                suffixes.push(format!("textfsm: {template_name}"));
            }
            println!("- {} ({})", command.object, suffixes.join(", "));
        }
    } else {
        for object in show_catalog::list_all_show_objects() {
            println!("- {}", object);
        }
    }
    Ok(())
}

pub(crate) fn run_template_command(cmd: TemplateCommands) -> Result<()> {
    match cmd {
        TemplateCommands::List => {
            let names = content_store::list_command_template_names()?;
            if names.is_empty() {
                println!("-");
                return Ok(());
            }
            for name in names {
                println!("- {}", name);
            }
        }
        TemplateCommands::Show { name } => {
            let safe_name = safe_template_name(&name)?;
            let template = content_store::load_command_template(&safe_name)?
                .ok_or_else(|| anyhow::anyhow!("template '{}' not found", safe_name))?;
            println!("{}", template.content);
        }
        TemplateCommands::Create {
            name,
            file,
            content,
        } => {
            let safe_name = safe_template_name(&name)?;
            let body = read_template_body(file, content)?;
            let created = content_store::create_command_template(&safe_name, &body)?;
            if !created {
                return Err(anyhow::anyhow!("template '{}' already exists", safe_name));
            }
            println!("Created template '{}'", safe_name);
        }
        TemplateCommands::Update {
            name,
            file,
            content,
        } => {
            let safe_name = safe_template_name(&name)?;
            let body = read_template_body(file, content)?;
            let updated = content_store::update_command_template(&safe_name, &body)?;
            if !updated {
                return Err(anyhow::anyhow!("template '{}' not found", safe_name));
            }
            println!("Updated template '{}'", safe_name);
        }
        TemplateCommands::Delete { name } => {
            let safe_name = safe_template_name(&name)?;
            let deleted = content_store::delete_command_template(&safe_name)?;
            if !deleted {
                return Err(anyhow::anyhow!("template '{}' not found", safe_name));
            }
            println!("Deleted template '{}'", safe_name);
        }
    }
    Ok(())
}

pub(crate) fn run_textfsm_command(cmd: TextfsmCommands) -> Result<()> {
    match cmd {
        TextfsmCommands::Template { command } => run_textfsm_template_command(command),
        TextfsmCommands::Mapping { command } => run_textfsm_mapping_command(command),
    }
}

pub(crate) fn run_show_object_command(cmd: ShowObjectCommands) -> Result<()> {
    match cmd {
        ShowObjectCommands::List { profile } => {
            let items = custom_show_object_store::list(profile.as_deref())?;
            if items.is_empty() {
                println!("-");
                return Ok(());
            }
            for item in items {
                let mode = item.mode.as_deref().unwrap_or("-");
                let mapping = item.textfsm_mapping_command.as_deref().unwrap_or("-");
                let template = item.textfsm_template_name.as_deref().unwrap_or("-");
                println!(
                    "- profile={} object={} command={} mode={} textfsm_mapping_command={} textfsm_template={} enabled={} created_at_ms={} updated_at_ms={}",
                    item.device_profile,
                    item.object,
                    item.command,
                    mode,
                    mapping,
                    template,
                    item.enabled,
                    item.created_at_ms,
                    item.updated_at_ms
                );
            }
        }
        ShowObjectCommands::Set {
            profile,
            object,
            command,
            mode,
            textfsm_template,
            textfsm_mapping_command,
            disabled,
        } => {
            custom_show_object_store::upsert(
                &profile,
                &object,
                &command,
                mode.as_deref(),
                textfsm_mapping_command.as_deref(),
                textfsm_template.as_deref(),
                !disabled,
            )?;
            println!(
                "Saved show object '{}' for profile='{}' command='{}'",
                object, profile, command
            );
        }
        ShowObjectCommands::Delete { profile, object } => {
            let deleted = custom_show_object_store::delete(&profile, &object)?;
            if !deleted {
                return Err(anyhow::anyhow!(
                    "show object '{}' not found for profile='{}'",
                    object,
                    profile
                ));
            }
            println!("Deleted show object '{}' for profile='{}'", object, profile);
        }
    }
    Ok(())
}

fn run_textfsm_template_command(cmd: TextfsmTemplateCommands) -> Result<()> {
    match cmd {
        TextfsmTemplateCommands::List => {
            let items = custom_textfsm_store::list_templates()?;
            if items.is_empty() {
                println!("-");
                return Ok(());
            }
            for item in items {
                println!(
                    "- {} created_at_ms={} updated_at_ms={}",
                    item.name, item.created_at_ms, item.updated_at_ms
                );
            }
        }
        TextfsmTemplateCommands::Show { name } => {
            let item = custom_textfsm_store::load_template(&name)?
                .ok_or_else(|| anyhow::anyhow!("TextFSM template '{}' not found", name))?;
            println!("{}", item.content);
        }
        TextfsmTemplateCommands::Create {
            name,
            file,
            content,
        } => {
            let body = read_text_body("TextFSM template", file, content)?;
            let created = custom_textfsm_store::create_template(&name, &body)?;
            if !created {
                return Err(anyhow::anyhow!(
                    "TextFSM template '{}' already exists",
                    name
                ));
            }
            println!("Created TextFSM template '{}'", name);
        }
        TextfsmTemplateCommands::Update {
            name,
            file,
            content,
        } => {
            let body = read_text_body("TextFSM template", file, content)?;
            let updated = custom_textfsm_store::update_template(&name, &body)?;
            if !updated {
                return Err(anyhow::anyhow!("TextFSM template '{}' not found", name));
            }
            println!("Updated TextFSM template '{}'", name);
        }
        TextfsmTemplateCommands::Delete { name } => {
            let deleted = custom_textfsm_store::delete_template(&name)?;
            if !deleted {
                return Err(anyhow::anyhow!("TextFSM template '{}' not found", name));
            }
            println!("Deleted TextFSM template '{}'", name);
        }
    }
    Ok(())
}

fn run_textfsm_mapping_command(cmd: TextfsmMappingCommands) -> Result<()> {
    match cmd {
        TextfsmMappingCommands::List { profile } => {
            let items = custom_textfsm_store::list_mappings(profile.as_deref())?;
            if items.is_empty() {
                println!("-");
                return Ok(());
            }
            for item in items {
                println!(
                    "- profile={} command={} template={} created_at_ms={} updated_at_ms={}",
                    item.device_profile,
                    item.command,
                    item.template_name,
                    item.created_at_ms,
                    item.updated_at_ms
                );
            }
        }
        TextfsmMappingCommands::Set {
            profile,
            command,
            template,
        } => {
            custom_textfsm_store::upsert_mapping(&profile, &command, &template)?;
            println!(
                "Mapped profile='{}' command='{}' to TextFSM template '{}'",
                profile, command, template
            );
        }
        TextfsmMappingCommands::Delete { profile, command } => {
            let deleted = custom_textfsm_store::delete_mapping(&profile, &command)?;
            if !deleted {
                return Err(anyhow::anyhow!(
                    "TextFSM mapping not found for profile='{}' command='{}'",
                    profile,
                    command
                ));
            }
            println!(
                "Deleted TextFSM mapping for profile='{}' command='{}'",
                profile, command
            );
        }
    }
    Ok(())
}

pub(crate) fn read_text_body(
    kind: &str,
    file: Option<PathBuf>,
    content: Option<String>,
) -> Result<String> {
    if let Some(text) = content {
        if text.trim().is_empty() {
            return Err(anyhow::anyhow!("{kind} content must not be empty"));
        }
        return Ok(text);
    }
    if let Some(path) = file {
        let text = fs::read_to_string(&path)?;
        if text.trim().is_empty() {
            return Err(anyhow::anyhow!("{kind} file content is empty"));
        }
        return Ok(text);
    }
    Err(anyhow::anyhow!(
        "{kind} content required: use --content or --file"
    ))
}

fn safe_template_name(raw: &str) -> Result<String> {
    let normalized = raw.trim();
    if normalized.is_empty()
        || normalized.contains('/')
        || normalized.contains('\\')
        || normalized.contains("..")
        || !normalized
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' || ch == '.')
    {
        return Err(anyhow::anyhow!("invalid template name"));
    }
    Ok(normalized.to_string())
}

fn read_template_body(file: Option<PathBuf>, content: Option<String>) -> Result<String> {
    read_text_body("template", file, content)
}

#[cfg(test)]
mod tests {
    use super::*;

    use serde_json::json;

    #[test]
    fn multi_show_excel_sheets_are_grouped_by_object() {
        let sheets = merge_multi_show_parsed_outputs(vec![
            MultiShowParsedOutput {
                object: "route".to_string(),
                rows: vec![json!({"device": "sw1", "command": "show ip route"})],
            },
            MultiShowParsedOutput {
                object: "route".to_string(),
                rows: vec![json!({"device": "sw2", "command": "display ip routing-table"})],
            },
        ]);

        assert_eq!(sheets.len(), 1);
        assert_eq!(sheets[0].name, "route");
        assert_eq!(sheets[0].parsed_output.as_array().unwrap().len(), 2);
    }
}
