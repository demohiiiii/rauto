use axum::body::Body;
use axum::http::header::{CONTENT_TYPE, HeaderValue};
use axum::http::{Response, StatusCode};
use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "static/"]
struct StaticAssets;

pub fn index_response() -> Response<Body> {
    asset_response("index.html")
}

pub fn static_response(path: &str) -> Response<Body> {
    let normalized = path.trim_start_matches('/');
    asset_response(normalized)
}

fn asset_response(path: &str) -> Response<Body> {
    let Some(asset) = StaticAssets::get(path) else {
        return Response::builder()
            .status(StatusCode::NOT_FOUND)
            .body(Body::from("Not Found"))
            .expect("build not found response");
    };

    let mime = mime_guess::from_path(path).first_or_octet_stream();
    let content_type = HeaderValue::from_str(mime.as_ref())
        .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream"));

    Response::builder()
        .status(StatusCode::OK)
        .header(CONTENT_TYPE, content_type)
        .body(Body::from(asset.data.into_owned()))
        .expect("build asset response")
}
