use super::context::current_connection_param_context;
use super::*;

fn load_interactive_template_form(name: &str) -> Result<InteractiveTemplate, ApiError> {
    if let Some(builtin_name) = parse_builtin_interactive_template_token(name) {
        return builtin_interactive_template_by_name(&builtin_name).ok_or_else(|| {
            ApiError::bad_request("builtin interactive command template not found")
        });
    }
    let safe_name = storage::safe_interactive_template_name(name)?;
    let stored = content_store::load_interactive_template(&safe_name)
        .map_err(ApiError::from)?
        .ok_or_else(|| ApiError::bad_request("interactive command template not found"))?;
    parse_interactive_template(&stored.content, Some(&safe_name)).map_err(ApiError::from)
}

pub(crate) fn load_interactive_template_from_input(
    template_name: Option<&str>,
    builtin_template_name: Option<&str>,
    content: Option<&str>,
    inline_name: &str,
) -> Result<InteractiveTemplate, ApiError> {
    let template_name = template_name
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let builtin_template_name = builtin_template_name
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let content = content.map(str::trim).filter(|value| !value.is_empty());

    match (template_name, builtin_template_name, content) {
        (Some(_), Some(_), _) => Err(ApiError::bad_request(
            "use either template_name or builtin_template_name for interactive command execution",
        )),
        (Some(_), None, Some(_)) | (None, Some(_), Some(_)) => Err(ApiError::bad_request(
            "use either template_name/builtin_template_name or content for interactive command execution",
        )),
        (Some(name), None, None) => load_interactive_template_form(name),
        (None, Some(name), None) => builtin_interactive_template_by_name(name)
            .ok_or_else(|| ApiError::bad_request("builtin interactive command template not found")),
        (None, None, Some(content)) => {
            let mut template = parse_interactive_template(content, None)
                .map_err(|error| ApiError::bad_request(error.to_string()))?;
            if template.name.trim().is_empty() {
                template.name = inline_name.to_string();
            }
            Ok(template)
        }
        (None, None, None) => Err(ApiError::bad_request(
            "interactive command execution requires template_name, builtin_template_name, or content",
        )),
    }
}

pub(crate) fn resolve_interactive_connection_vars(
    template: &InteractiveTemplate,
    vars: Value,
    conn: &ResolvedConnection,
) -> Result<Value, ApiError> {
    resolve_interactive_runtime_vars(template, vars, Some(current_connection_param_context(conn)))
        .map_err(ApiError::from)
}
