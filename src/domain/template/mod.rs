#![forbid(unsafe_code)]

//! Template and profile domain crate.

pub mod command_flow;
pub mod content;
pub mod renderer;

pub use content::{
    CustomTextfsmMapping, CustomTextfsmTemplate, ParsedOutputSheet, ResolvedCustomTextfsmTemplate,
    StoredContent,
};
