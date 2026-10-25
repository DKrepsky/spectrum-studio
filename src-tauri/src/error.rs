use serde::Serialize;

/// Error returned to the UI by every command: a single user-facing message.
#[derive(Debug, Serialize)]
pub struct CommandError {
    pub message: String,
}

impl CommandError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

impl<E: std::fmt::Display> From<E> for CommandError {
    fn from(error: E) -> Self {
        Self::new(error.to_string())
    }
}

pub type CommandResult<T> = Result<T, CommandError>;
