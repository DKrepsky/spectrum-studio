//! Wall-clock pacing for sources that generate or replay data faster than real time.

use std::time::{Duration, Instant};

/// Sleeps so that block `n` is released no earlier than `origin + n · interval`.
#[derive(Debug)]
pub struct Pacer {
    interval: Duration,
    enabled: bool,
    origin: Option<(Instant, u64)>,
}

impl Pacer {
    pub fn new(blocks_per_second: f64, enabled: bool) -> Self {
        Self {
            interval: Duration::from_secs_f64(1.0 / blocks_per_second),
            enabled,
            origin: None,
        }
    }

    /// Restarts the schedule (after start, seek or settings changes).
    pub fn reset(&mut self) {
        self.origin = None;
    }

    pub fn wait(&mut self, block: u64) {
        if !self.enabled {
            return;
        }
        let now = Instant::now();
        let (origin, origin_block) = *self.origin.get_or_insert((now, block));
        let ahead = block.saturating_sub(origin_block);
        let due = origin
            + self
                .interval
                .saturating_mul(u32::try_from(ahead).unwrap_or(u32::MAX));
        if due > now {
            std::thread::sleep(due - now);
        } else if now - due > self.interval * 5 {
            // Far behind (e.g. the machine was suspended): restart the schedule instead of
            // producing a burst of catch-up blocks.
            self.origin = Some((now, block));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn paces_blocks_and_can_be_disabled() {
        let mut pacer = Pacer::new(100.0, true);
        let start = Instant::now();
        for block in 0..6 {
            pacer.wait(block);
        }
        let elapsed = start.elapsed().as_secs_f64();
        assert!((0.045..0.3).contains(&elapsed), "{elapsed}");

        let mut off = Pacer::new(1.0, false);
        let start = Instant::now();
        for block in 0..100 {
            off.wait(block);
        }
        assert!(start.elapsed().as_secs_f64() < 0.05);
    }
}
