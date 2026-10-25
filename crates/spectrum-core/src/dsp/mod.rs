//! Pure, deterministic signal processing. No I/O, threads or knowledge of sources.

pub mod estimator;
pub mod peaks;
pub mod trace;
pub mod window;

pub use estimator::SpectrumEstimator;
pub use peaks::{find_peaks, noise_floor};
pub use trace::{ProcessedTrace, TraceProcessor};
pub use window::Window;
