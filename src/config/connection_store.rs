pub use crate::infrastructure::db::connection_store::*;

pub fn load_connection(
    name: &str,
) -> anyhow::Result<crate::config::connection_resolver::ResolvedConnection> {
    crate::config::connection_resolver::resolve_saved_connection(name)
}
