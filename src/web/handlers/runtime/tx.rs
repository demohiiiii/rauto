use super::context::{
    build_json_template_context, load_json_template_from_input, render_json_template_value,
    resolve_runtime_vars_with_connection,
};
use super::*;

#[derive(Debug, serde::Deserialize)]
struct TxWorkflowBlockTemplateRefPayload {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    fail_fast: Option<bool>,
    #[serde(default)]
    tx_block_template_name: Option<String>,
    #[serde(default)]
    tx_block_template_content: Option<String>,
    #[serde(default)]
    tx_block_template_vars: Value,
}

pub(crate) fn resolve_tx_block_value_from_input(
    tx_block: Value,
    template_name: Option<&str>,
    template_content: Option<&str>,
    template_vars: Value,
    conn: Option<&ResolvedConnection>,
) -> Result<Value, ApiError> {
    let has_template_name = template_name
        .map(str::trim)
        .is_some_and(|value| !value.is_empty());
    let has_template_content = template_content
        .map(str::trim)
        .is_some_and(|value| !value.is_empty());

    if !has_template_name && !has_template_content {
        if tx_block.is_null() {
            return Err(ApiError::bad_request(
                "tx_block JSON is required when no tx block template is provided",
            ));
        }
        let renderer = Renderer::new();
        let resolved_template_vars = resolve_runtime_vars_with_connection(template_vars, conn)?;
        let mut context = build_json_template_context(resolved_template_vars, conn);
        enrich_context_with_connection_refs_from_value(&mut context, &tx_block)
            .map_err(ApiError::from)?;
        return render_json_template_value(&tx_block, &mut context, &renderer);
    }

    let source = load_json_template_from_input(
        template_name,
        template_content,
        &Value::Null,
        |name| {
            let safe_name = storage::safe_json_template_name(name)?;
            let content = content_store::load_tx_block_template(&safe_name)
                .map_err(ApiError::from)?
                .map(|item| item.content);
            Ok(content)
        },
        "tx block template not found",
    )?;
    let renderer = Renderer::new();
    let resolved_template_vars = resolve_runtime_vars_with_connection(template_vars, conn)?;
    let mut context = build_json_template_context(resolved_template_vars, conn);
    enrich_context_with_connection_refs_from_value(&mut context, &source)
        .map_err(ApiError::from)?;
    render_json_template_value(&source, &mut context, &renderer)
}

fn tx_block_primary_mode(tx_block: &TxBlock) -> String {
    tx_block
        .steps
        .first()
        .and_then(|step| step.run.summary().ok())
        .map(|summary| summary.mode)
        .unwrap_or_else(|| "-".to_string())
}

pub(crate) fn build_tx_block_from_request(
    req: ExecuteTxBlockRequest,
    conn: Option<&ResolvedConnection>,
) -> Result<(TxBlock, String, String), ApiError> {
    let tx_block_value = resolve_tx_block_value_from_input(
        req.tx_block,
        req.tx_block_template_name.as_deref(),
        req.tx_block_template_content.as_deref(),
        req.tx_block_template_vars,
        conn,
    )?;
    let tx_block: TxBlock = serde_json::from_value(tx_block_value).map_err(ApiError::from)?;
    tx_block.validate().map_err(ApiError::from)?;
    let block_name = if tx_block.name.trim().is_empty() {
        "tx-block".to_string()
    } else {
        tx_block.name.clone()
    };
    let effective_mode = tx_block_primary_mode(&tx_block);
    Ok((tx_block, effective_mode, block_name))
}

pub(crate) fn resolve_tx_workflow_blocks_from_templates(
    workflow: Value,
    conn: Option<&ResolvedConnection>,
) -> Result<Value, ApiError> {
    let mut root = match workflow {
        Value::Object(map) => map,
        other => return Ok(other),
    };
    let blocks = root
        .get("blocks")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if blocks.is_empty() {
        return Ok(Value::Object(root));
    }

    let mut resolved_blocks = Vec::with_capacity(blocks.len());
    for block in blocks {
        let Some(block_obj) = block.as_object() else {
            resolved_blocks.push(block);
            continue;
        };
        let has_template_name = block_obj
            .get("tx_block_template_name")
            .and_then(Value::as_str)
            .map(str::trim)
            .is_some_and(|value| !value.is_empty());
        let has_template_content = block_obj
            .get("tx_block_template_content")
            .and_then(Value::as_str)
            .map(str::trim)
            .is_some_and(|value| !value.is_empty());
        if !has_template_name && !has_template_content {
            resolved_blocks.push(block);
            continue;
        }

        let block_ref: TxWorkflowBlockTemplateRefPayload =
            serde_json::from_value(Value::Object(block_obj.clone())).map_err(ApiError::from)?;
        let rendered_value = resolve_tx_block_value_from_input(
            Value::Null,
            block_ref.tx_block_template_name.as_deref(),
            block_ref.tx_block_template_content.as_deref(),
            block_ref.tx_block_template_vars,
            conn,
        )?;
        let mut tx_block: TxBlock =
            serde_json::from_value(rendered_value).map_err(ApiError::from)?;
        if let Some(name) = block_ref.name.filter(|value| !value.trim().is_empty()) {
            tx_block.name = name;
        }
        if let Some(fail_fast) = block_ref.fail_fast {
            tx_block.fail_fast = fail_fast;
        }
        tx_block.validate().map_err(ApiError::from)?;
        resolved_blocks.push(serde_json::to_value(&tx_block).map_err(ApiError::from)?);
    }

    root.insert("blocks".to_string(), Value::Array(resolved_blocks));
    Ok(Value::Object(root))
}

pub(crate) fn resolve_tx_block_request_from_template(
    req: ExecuteTxBlockRequest,
    defaults: &crate::cli::GlobalOpts,
) -> Result<ExecuteTxBlockRequest, ApiError> {
    let connection_for_context =
        merge_connection_options(defaults, req.target.connection.clone()).ok();
    let rendered_value = resolve_tx_block_value_from_input(
        req.tx_block,
        req.tx_block_template_name.as_deref(),
        req.tx_block_template_content.as_deref(),
        req.tx_block_template_vars.clone(),
        connection_for_context.as_ref(),
    )?;
    Ok(ExecuteTxBlockRequest {
        tx_block_template_name: None,
        tx_block_template_content: None,
        tx_block_template_vars: Value::Null,
        tx_block: rendered_value,
        run: req.run,
        target: req.target,
        task: req.task,
    })
}
