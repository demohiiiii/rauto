use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ConnectionImportFailure {
    pub row: usize,
    pub name: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ConnectionImportReport {
    pub file_name: String,
    pub total_rows: usize,
    pub imported: usize,
    pub created: usize,
    pub updated: usize,
    pub failed: usize,
    pub failures: Vec<ConnectionImportFailure>,
}
