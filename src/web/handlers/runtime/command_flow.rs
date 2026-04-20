use super::context::current_connection_param_context;
use super::*;

fn load_command_flow_template_form(name: &str) -> Result<ParsedCommandFlowTemplate, ApiError> {
    if let Some(builtin_name) = parse_builtin_command_flow_template_token(name) {
        return builtin_command_flow_template_by_name(&builtin_name)
            .map(|template| ParsedCommandFlowTemplate {
                template,
                current_connection_alias: None,
            })
            .ok_or_else(|| ApiError::bad_request("builtin command flow template not found"));
    }
    let safe_name = storage::safe_command_flow_template_name(name)?;
    let stored = content_store::load_command_flow_template(&safe_name)
        .map_err(ApiError::from)?
        .ok_or_else(|| ApiError::bad_request("command flow template not found"))?;
    parse_command_flow_template_with_extensions(&stored.content, Some(&safe_name))
        .map_err(ApiError::from)
}

pub(crate) fn load_command_flow_template_from_input(
    template_name: Option<&str>,
    builtin_template_name: Option<&str>,
    content: Option<&str>,
    inline_name: &str,
) -> Result<ParsedCommandFlowTemplate, ApiError> {
    let template_name = template_name
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let builtin_template_name = builtin_template_name
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let content = content.map(str::trim).filter(|value| !value.is_empty());

    match (template_name, builtin_template_name, content) {
        (Some(_), Some(_), _) => Err(ApiError::bad_request(
            "use either template_name or builtin_template_name for command flow execution",
        )),
        (Some(_), None, Some(_)) | (None, Some(_), Some(_)) => Err(ApiError::bad_request(
            "use either template_name/builtin_template_name or content for command flow execution",
        )),
        (Some(name), None, None) => load_command_flow_template_form(name),
        (None, Some(name), None) => builtin_command_flow_template_by_name(name)
            .map(|template| ParsedCommandFlowTemplate {
                template,
                current_connection_alias: None,
            })
            .ok_or_else(|| ApiError::bad_request("builtin command flow template not found")),
        (None, None, Some(content)) => {
            let mut parsed = parse_command_flow_template_with_extensions(content, None)
                .map_err(ApiError::from)?;
            if parsed.template.name.trim().is_empty() {
                parsed.template.name = inline_name.to_string();
            }
            Ok(parsed)
        }
        (None, None, None) => Err(ApiError::bad_request(
            "command flow execution requires template_name, builtin_template_name, or content",
        )),
    }
}

pub(crate) fn resolve_flow_runtime_vars(
    template: &CommandFlowTemplate,
    vars: Value,
    conn: &ResolvedConnection,
    current_connection_alias: Option<&str>,
) -> Result<Value, ApiError> {
    resolve_command_flow_runtime_vars(
        template,
        vars,
        Some(current_connection_param_context(conn)),
        current_connection_alias,
    )
    .map_err(ApiError::from)
}
