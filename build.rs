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
    Ok(())
}
