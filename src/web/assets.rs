use axum::body::Body;
use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE, EXPIRES, HeaderValue, PRAGMA};
use axum::http::{Response, StatusCode};
use rust_embed::RustEmbed;
use std::fs;
use std::path::{Component, Path, PathBuf};

#[derive(RustEmbed)]
#[folder = "static/"]
struct StaticAssets;

pub fn svelte_index_response() -> Response<Body> {
    asset_response("index.html")
}

pub fn static_response(path: &str) -> Response<Body> {
    let normalized = path.trim_start_matches('/');
    asset_response(normalized)
}

fn asset_response(path: &str) -> Response<Body> {
    let Some((body, mime_path)) = runtime_asset(path).or_else(|| embedded_asset(path)) else {
        return not_found_response();
    };

    let mime = mime_guess::from_path(mime_path).first_or_octet_stream();
    let content_type = HeaderValue::from_str(mime.as_ref())
        .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream"));
    let mut builder = Response::builder()
        .status(StatusCode::OK)
        .header(CONTENT_TYPE, content_type);

    builder = builder
        .header(
            CACHE_CONTROL,
            HeaderValue::from_static("no-store, max-age=0, must-revalidate"),
        )
        .header(PRAGMA, HeaderValue::from_static("no-cache"))
        .header(EXPIRES, HeaderValue::from_static("0"));

    builder
        .body(Body::from(body))
        .expect("build asset response")
}

fn runtime_asset(path: &str) -> Option<(Vec<u8>, PathBuf)> {
    let asset_path = runtime_asset_path(path)?;
    let body = fs::read(&asset_path).ok()?;
    Some((body, asset_path))
}

fn embedded_asset(path: &str) -> Option<(Vec<u8>, PathBuf)> {
    let asset = StaticAssets::get(path)?;
    Some((asset.data.into_owned(), PathBuf::from(path)))
}

fn runtime_asset_path(path: &str) -> Option<PathBuf> {
    let normalized = normalize_static_asset_path(path)?;
    Some(static_root_path().join(normalized))
}

fn static_root_path() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("static")
}

fn normalize_static_asset_path(path: &str) -> Option<PathBuf> {
    let mut normalized = PathBuf::new();
    for component in Path::new(path.trim_start_matches('/')).components() {
        match component {
            Component::Normal(segment) => normalized.push(segment),
            Component::CurDir => continue,
            Component::Prefix(_) | Component::RootDir | Component::ParentDir => {
                return None;
            }
        }
    }
    if normalized.as_os_str().is_empty() {
        None
    } else {
        Some(normalized)
    }
}

fn not_found_response() -> Response<Body> {
    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .body(Body::from("Not Found"))
        .expect("build not found response")
}

#[cfg(test)]
mod tests {
    use super::{normalize_static_asset_path, static_response, svelte_index_response};
    use axum::body::to_bytes;
    use axum::http::StatusCode;
    use axum::http::header::{CACHE_CONTROL, EXPIRES, PRAGMA};
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_static_test_path() -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock before unix epoch")
            .as_nanos();
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("static")
            .join(format!("test-runtime-asset-{timestamp}.txt"))
    }

    #[tokio::test]
    async fn static_response_reads_runtime_static_files() {
        let test_path = unique_static_test_path();
        fs::write(&test_path, "runtime-static-asset")
            .expect("write temporary runtime static asset");

        let file_name = test_path
            .file_name()
            .and_then(|value| value.to_str())
            .expect("temporary file name");

        let response = static_response(file_name);
        let status = response.status();
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read response body");

        let _ = fs::remove_file(&test_path);

        assert_eq!(status, StatusCode::OK);
        assert_eq!(body, "runtime-static-asset");
    }

    #[test]
    fn static_response_disables_js_caching() {
        let test_path = unique_static_test_path().with_extension("js");
        fs::write(&test_path, "console.log('runtime-static-asset');")
            .expect("write temporary runtime static asset");

        let file_name = test_path
            .file_name()
            .and_then(|value| value.to_str())
            .expect("temporary file name");

        let response = static_response(file_name);
        let cache_control = response
            .headers()
            .get(CACHE_CONTROL)
            .and_then(|value| value.to_str().ok());

        let _ = fs::remove_file(&test_path);

        assert_eq!(cache_control, Some("no-store, max-age=0, must-revalidate"));
        assert_eq!(
            response
                .headers()
                .get(PRAGMA)
                .and_then(|value| value.to_str().ok()),
            Some("no-cache")
        );
        assert_eq!(
            response
                .headers()
                .get(EXPIRES)
                .and_then(|value| value.to_str().ok()),
            Some("0")
        );
    }

    #[test]
    fn normalize_static_asset_path_rejects_parent_dir_escape() {
        assert_eq!(normalize_static_asset_path("../Cargo.toml"), None);
        assert_eq!(normalize_static_asset_path("/../static/index.html"), None);
    }

    #[test]
    fn svelte_index_response_disables_html_caching() {
        let response = svelte_index_response();
        let cache_control = response
            .headers()
            .get(CACHE_CONTROL)
            .and_then(|value| value.to_str().ok());

        assert_eq!(cache_control, Some("no-store, max-age=0, must-revalidate"));
        assert_eq!(
            response
                .headers()
                .get(PRAGMA)
                .and_then(|value| value.to_str().ok()),
            Some("no-cache")
        );
        assert_eq!(
            response
                .headers()
                .get(EXPIRES)
                .and_then(|value| value.to_str().ok()),
            Some("0")
        );
    }
}
