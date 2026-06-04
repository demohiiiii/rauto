use crate::config::textfsm_export::{self, ParsedOutputSheet};
use crate::web::error::ApiError;
use axum::Json;
use axum::http::{HeaderMap, HeaderValue, header};
use axum::response::{IntoResponse, Response};
use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct TextfsmExcelExportRequest {
    #[serde(default)]
    pub filename: Option<String>,
    #[serde(default)]
    pub sheet_name: Option<String>,
    #[serde(default)]
    pub parsed_output: Option<Value>,
    #[serde(default)]
    pub sheets: Vec<TextfsmExcelExportSheet>,
}

#[derive(Debug, Deserialize)]
pub struct TextfsmExcelExportSheet {
    pub name: Option<String>,
    pub parsed_output: Value,
}

pub async fn export_textfsm_excel(
    Json(req): Json<TextfsmExcelExportRequest>,
) -> Result<Response, ApiError> {
    let filename_hint = req.filename.clone();
    let sheets = export_sheets(req)?;
    let bytes = textfsm_export::parsed_outputs_xlsx_bytes(&sheets).map_err(ApiError::from)?;
    let filename = safe_export_filename(filename_hint.as_deref().unwrap_or_else(|| {
        sheets
            .first()
            .map(|sheet| sheet.name.as_str())
            .unwrap_or("textfsm")
    }));

    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
    );
    let disposition = format!("attachment; filename=\"{}\"", filename);
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&disposition).map_err(ApiError::from)?,
    );
    Ok((headers, bytes).into_response())
}

fn export_sheets(req: TextfsmExcelExportRequest) -> Result<Vec<ParsedOutputSheet>, ApiError> {
    if !req.sheets.is_empty() {
        return Ok(req
            .sheets
            .into_iter()
            .enumerate()
            .map(|(index, sheet)| ParsedOutputSheet {
                name: sheet
                    .name
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or_else(|| format!("parsed_output_{}", index + 1)),
                parsed_output: sheet.parsed_output,
            })
            .collect());
    }

    let parsed_output = req
        .parsed_output
        .ok_or_else(|| ApiError::bad_request("parsed_output or sheets is required"))?;
    Ok(vec![ParsedOutputSheet {
        name: req
            .sheet_name
            .filter(|value| !value.trim().is_empty())
            .or(req.filename)
            .unwrap_or_else(|| "parsed_output".to_string()),
        parsed_output,
    }])
}

fn safe_export_filename(raw: &str) -> String {
    let base = raw
        .trim()
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' || ch == '.' {
                ch
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim_matches('_')
        .to_string();
    let base = if base.is_empty() {
        "textfsm".to_string()
    } else {
        base
    };
    if base.ends_with(".xlsx") {
        base
    } else {
        format!("{base}.xlsx")
    }
}
