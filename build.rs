fn main() -> Result<(), Box<dyn std::error::Error>> {
    let protoc = protoc_bin_vendored::protoc_bin_path()?;
    unsafe {
        std::env::set_var("PROTOC", protoc);
    }

    tonic_build::configure()
        .build_server(false)
        .compile_protos(
            &["proto/rauto/manager/v1/agent_reporting.proto"],
            &["proto"],
        )?;

    println!("cargo:rerun-if-changed=proto/rauto/manager/v1/agent_reporting.proto");
    Ok(())
}
