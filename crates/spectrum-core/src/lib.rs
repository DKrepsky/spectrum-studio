//! Spectrum Studio core: domain model, signal processing, signal sources and the acquisition
//! session. Independent of the GUI toolkit so it can be tested and reused on its own.

pub mod display;
pub mod dsp;
pub mod formats;
pub mod model;
pub mod session;
pub mod sources;
pub mod store;

pub use session::{EncodedFrame, NullSink, SessionError, SessionManager, SessionSink};
pub use sources::DriverRegistry;
