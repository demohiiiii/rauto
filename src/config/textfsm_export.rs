use anyhow::{Context, Result, anyhow};
use rust_xlsxwriter::{Format, Workbook};
use serde_json::Value;
use std::path::Path;

#[derive(Debug, Clone)]
pub struct ParsedOutputSheet {
    pub name: String,
    pub parsed_output: Value,
}

pub fn write_parsed_output_xlsx(path: &Path, sheet: ParsedOutputSheet) -> Result<()> {
    write_parsed_outputs_xlsx(path, &[sheet])
}

pub fn write_parsed_outputs_xlsx(path: &Path, sheets: &[ParsedOutputSheet]) -> Result<()> {
    let bytes = parsed_outputs_xlsx_bytes(sheets)?;
    std::fs::write(path, bytes)
        .with_context(|| format!("failed to write Excel file '{}'", path.display()))
}

pub fn parsed_outputs_xlsx_bytes(sheets: &[ParsedOutputSheet]) -> Result<Vec<u8>> {
    if sheets.is_empty() {
        return Err(anyhow!("no TextFSM parsed output available to export"));
    }

    let mut workbook = Workbook::new();
    let header_format = Format::new().set_bold();
    let mut used_sheet_names = Vec::new();

    for (index, sheet) in sheets.iter().enumerate() {
        let rows = parsed_rows(&sheet.parsed_output)?;
        let columns = parsed_columns(rows);
        let worksheet = workbook.add_worksheet();
        let sheet_name = unique_sheet_name(&sheet.name, index, &mut used_sheet_names);
        worksheet
            .set_name(&sheet_name)
            .with_context(|| format!("failed to set Excel sheet name '{}'", sheet_name))?;

        for (column_index, column) in columns.iter().enumerate() {
            worksheet.write_string_with_format(0, column_index as u16, column, &header_format)?;
        }

        for (row_index, row) in rows.iter().enumerate() {
            let object = row
                .as_object()
                .ok_or_else(|| anyhow!("TextFSM parsed output rows must be JSON objects"))?;
            for (column_index, column) in columns.iter().enumerate() {
                let text = object.get(column).map(cell_text).unwrap_or_default();
                worksheet.write_string((row_index + 1) as u32, column_index as u16, &text)?;
            }
        }

        for (column_index, column) in columns.iter().enumerate() {
            let width = suggested_column_width(column, rows);
            worksheet.set_column_width(column_index as u16, width)?;
        }
    }

    workbook
        .save_to_buffer()
        .context("failed to build TextFSM Excel workbook")
}

fn parsed_rows(value: &Value) -> Result<&[Value]> {
    value
        .as_array()
        .map(Vec::as_slice)
        .ok_or_else(|| anyhow!("TextFSM parsed output must be a JSON array"))
}

fn parsed_columns(rows: &[Value]) -> Vec<String> {
    let mut columns = Vec::new();
    for preferred in ["device", "profile", "command"] {
        if rows.iter().any(|row| {
            row.as_object()
                .is_some_and(|object| object.contains_key(preferred))
        }) {
            columns.push(preferred.to_string());
        }
    }
    for row in rows {
        if let Some(object) = row.as_object() {
            for key in object.keys() {
                if !columns.iter().any(|column| column == key) {
                    columns.push(key.clone());
                }
            }
        }
    }
    columns
}

fn cell_text(value: &Value) -> String {
    let text = match value {
        Value::Null => String::new(),
        Value::Bool(value) => value.to_string(),
        Value::Number(value) => value.to_string(),
        Value::String(value) => value.clone(),
        Value::Array(values) => values.iter().map(cell_text).collect::<Vec<_>>().join(", "),
        Value::Object(_) => serde_json::to_string(value).unwrap_or_else(|_| value.to_string()),
    };
    truncate_excel_cell(text)
}

fn truncate_excel_cell(value: String) -> String {
    const EXCEL_CELL_CHAR_LIMIT: usize = 32_767;
    let mut chars = value.chars();
    let truncated = chars
        .by_ref()
        .take(EXCEL_CELL_CHAR_LIMIT)
        .collect::<String>();
    if chars.next().is_some() {
        truncated
    } else {
        value
    }
}

fn suggested_column_width(column: &str, rows: &[Value]) -> f64 {
    let mut width = column.chars().count();
    for row in rows {
        let Some(object) = row.as_object() else {
            continue;
        };
        let cell_width = object
            .get(column)
            .map(cell_text)
            .unwrap_or_default()
            .chars()
            .count();
        width = width.max(cell_width.min(60));
    }
    (width as f64 + 2.0).clamp(10.0, 64.0)
}

fn unique_sheet_name(raw: &str, index: usize, used: &mut Vec<String>) -> String {
    let base = sanitize_sheet_name(raw)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| format!("parsed_output_{}", index + 1));
    let mut candidate = truncate_sheet_name(&base, None);
    let mut suffix = 2usize;
    while used
        .iter()
        .any(|value| value.eq_ignore_ascii_case(&candidate))
    {
        candidate = truncate_sheet_name(&base, Some(suffix));
        suffix += 1;
    }
    used.push(candidate.clone());
    candidate
}

fn sanitize_sheet_name(raw: &str) -> Option<String> {
    let value = raw
        .trim()
        .chars()
        .map(|ch| match ch {
            ':' | '\\' | '/' | '?' | '*' | '[' | ']' => '_',
            _ => ch,
        })
        .collect::<String>();
    let trimmed = value.trim_matches('\'').trim().to_string();
    (!trimmed.is_empty()).then_some(trimmed)
}

fn truncate_sheet_name(base: &str, suffix: Option<usize>) -> String {
    let suffix_text = suffix.map(|value| format!("_{value}")).unwrap_or_default();
    let max_base_len = 31usize.saturating_sub(suffix_text.chars().count());
    let mut value = base.chars().take(max_base_len).collect::<String>();
    value.push_str(&suffix_text);
    value
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parsed_columns_prefers_multi_show_metadata_and_merges_fields() {
        let rows = vec![
            json!({"device": "sw1", "profile": "cisco_ios", "command": "show version", "version": "17"}),
            json!({"device": "sw2", "profile": "huawei_vrp", "command": "display version", "uptime": "1 day"}),
        ];

        assert_eq!(
            parsed_columns(&rows),
            vec!["device", "profile", "command", "version", "uptime"]
        );
    }
}
