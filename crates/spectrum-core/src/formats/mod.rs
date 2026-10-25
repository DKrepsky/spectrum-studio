//! File formats: spectrum CSV export/import and IQ recordings. Every reader validates its input
//! and reports problems as [`FormatError`] with a message suitable for the user.

pub mod csv;
pub mod iq;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum FormatError {
    #[error("{0}")]
    Invalid(String),
    #[error("{0}")]
    Unsupported(String),
    #[error("Could not access the file: {0}")]
    Io(#[from] std::io::Error),
}
