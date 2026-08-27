#![forbid(unsafe_code)]

//! Device domain crate.
//!
//! Device facts, platform/profile concepts, and device capability rules belong
//! here. Session transport should stay outside the domain.

pub mod catalog;
pub mod configuration;
pub mod discovery;
pub mod encoding;
pub mod facts;
pub mod profile;
pub mod shell;

pub use catalog::{
    CatalogSource, ConfigCommandOverride, ConfigCommandSource, ConfigFetchCommand,
    CustomShowObject, ShowCommand, ShowCommandSource, VolatilePatternEntry,
    VolatilePatternOverride, normalize_show_object,
};
pub use configuration::{
    DeviceConfigSnapshot, DeviceConfigSnapshotSortOrder, DeviceConfigSnapshotSummary,
    NewDeviceConfigSnapshot, normalize_config, sha256_hex,
};
pub use discovery::{DiscoveryResultRecord, DiscoveryRunRecord};
pub use encoding::DeviceEncoding;
pub use facts::{DeviceFacts, extract_device_facts};
pub use profile::{
    DeviceProfile, InteractionConfig, PromptConfig, SysPromptConfig, TransitionConfig,
    canonical_builtin_profile_name,
};
pub use shell::LinuxShellFlavor;
