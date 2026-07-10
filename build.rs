use std::fs;
use std::path::Path;

fn emit_rerun_if_changed(path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    if path.is_dir() {
        for entry in fs::read_dir(path)? {
            let entry = entry?;
            emit_rerun_if_changed(&entry.path())?;
        }
        return Ok(());
    }

    if path.is_file() {
        println!("cargo:rerun-if-changed={}", path.display());
    }

    Ok(())
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let protoc = protoc_bin_vendored::protoc_bin_path()?;
    unsafe {
        std::env::set_var("PROTOC", protoc);
    }

    tonic_prost_build::configure()
        .build_server(false)
        .compile_protos(
            &["proto/rauto/manager/v1/agent_reporting.proto"],
            &["proto"],
        )?;

    tonic_prost_build::configure()
        .compile_protos(&["proto/rauto/agent/v1/task_service.proto"], &["proto"])?;

    println!("cargo:rerun-if-changed=proto/rauto/manager/v1/agent_reporting.proto");
    println!("cargo:rerun-if-changed=proto/rauto/agent/v1/task_service.proto");
    emit_rerun_if_changed(Path::new("static"))?;
    Ok(())
}
