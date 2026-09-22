#![forbid(unsafe_code)]

//! Template and profile domain crate.

pub mod content;
pub mod interactive;
pub mod renderer;
mod variables;

pub use content::{
    CustomTextfsmMapping, CustomTextfsmTemplate, ParsedOutputSheet, ResolvedCustomTextfsmTemplate,
    StoredContent,
};
