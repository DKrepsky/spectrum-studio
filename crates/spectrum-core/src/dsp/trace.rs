//! Trace post-processing shared by IQ and trace sources: power averaging and hold traces.

use crate::model::units::{db_to_power, power_to_db};

#[derive(Debug, Clone, PartialEq)]
pub struct ProcessedTrace {
    pub live: Vec<f32>,
    pub max_hold: Option<Vec<f32>>,
    pub min_hold: Option<Vec<f32>>,
    /// Number of traces currently contributing to the average (≤ averaging length).
    pub averaged_count: u32,
}

/// Averages traces in the linear power domain and maintains max/min hold of the averaged trace.
///
/// Averaging uses a cumulative mean until `averaging` traces have been seen, then an exponential
/// moving average with `α = 1/averaging`: fast settling after a reset, bounded memory afterwards.
#[derive(Debug, Default)]
pub struct TraceProcessor {
    averaging: u32,
    max_hold: bool,
    min_hold: bool,
    avg_power: Vec<f32>,
    count: u32,
    max: Option<Vec<f32>>,
    min: Option<Vec<f32>>,
}

impl TraceProcessor {
    pub fn new(averaging: u32, max_hold: bool, min_hold: bool) -> Self {
        let mut p = Self::default();
        p.configure(averaging, max_hold, min_hold);
        p
    }

    pub fn configure(&mut self, averaging: u32, max_hold: bool, min_hold: bool) {
        let averaging = averaging.max(1);
        if averaging != self.averaging {
            self.averaging = averaging;
            self.count = 0;
        }
        self.max_hold = max_hold;
        self.min_hold = min_hold;
        if !max_hold {
            self.max = None;
        }
        if !min_hold {
            self.min = None;
        }
    }

    /// Clears the average and both holds (e.g. after the frequency axis changed).
    pub fn reset(&mut self) {
        self.count = 0;
        self.reset_holds();
    }

    pub fn reset_holds(&mut self) {
        self.max = None;
        self.min = None;
    }

    pub fn process(&mut self, trace_db: &[f32]) -> ProcessedTrace {
        if self.avg_power.len() != trace_db.len() {
            self.avg_power = vec![0.0; trace_db.len()];
            self.reset();
        }
        let live: Vec<f32> = if self.averaging <= 1 {
            self.count = 1;
            trace_db.to_vec()
        } else {
            self.count = (self.count + 1).min(self.averaging);
            let alpha = 1.0 / self.count as f32;
            for (avg, &db) in self.avg_power.iter_mut().zip(trace_db) {
                let p = db_to_power(db);
                *avg = if self.count == 1 {
                    p
                } else {
                    *avg + alpha * (p - *avg)
                };
            }
            self.avg_power.iter().map(|&p| power_to_db(p)).collect()
        };

        if self.max_hold {
            update_hold(&mut self.max, &live, f32::max);
        }
        if self.min_hold {
            update_hold(&mut self.min, &live, f32::min);
        }
        ProcessedTrace {
            max_hold: self.max.clone(),
            min_hold: self.min.clone(),
            averaged_count: self.count,
            live,
        }
    }
}

fn update_hold(hold: &mut Option<Vec<f32>>, live: &[f32], pick: fn(f32, f32) -> f32) {
    match hold {
        Some(h) if h.len() == live.len() => {
            for (h, &v) in h.iter_mut().zip(live) {
                *h = pick(*h, v);
            }
        }
        _ => *hold = Some(live.to_vec()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_averaging_passes_trace_through() {
        let mut p = TraceProcessor::new(1, false, false);
        let out = p.process(&[-10.0, -20.0]);
        assert_eq!(out.live, vec![-10.0, -20.0]);
        assert_eq!(out.averaged_count, 1);
        assert!(out.max_hold.is_none() && out.min_hold.is_none());
    }

    #[test]
    fn averages_in_power_domain() {
        let mut p = TraceProcessor::new(2, false, false);
        p.process(&[0.0]); // 1.0 mW-equivalent
        let out = p.process(&[-100.0]); // ~0
        // mean of 1 and ~0 is 0.5 → -3.01 dB (a dB-domain mean would give -50 dB)
        assert!((out.live[0] + 3.0103).abs() < 1e-3, "{}", out.live[0]);
        assert_eq!(out.averaged_count, 2);
    }

    #[test]
    fn exponential_average_converges_and_count_saturates() {
        let mut p = TraceProcessor::new(4, false, false);
        let mut last = Vec::new();
        for _ in 0..200 {
            last = p.process(&[-40.0]).live;
        }
        assert!((last[0] + 40.0).abs() < 1e-3);
        assert_eq!(p.process(&[-40.0]).averaged_count, 4);
    }

    #[test]
    fn holds_track_extremes_and_reset() {
        let mut p = TraceProcessor::new(1, true, true);
        p.process(&[-50.0, -60.0]);
        let out = p.process(&[-40.0, -70.0]);
        assert_eq!(out.max_hold.unwrap(), vec![-40.0, -60.0]);
        assert_eq!(out.min_hold.unwrap(), vec![-50.0, -70.0]);
        p.reset_holds();
        let out = p.process(&[-45.0, -65.0]);
        assert_eq!(out.max_hold.unwrap(), vec![-45.0, -65.0]);
    }

    #[test]
    fn length_change_resets_state() {
        let mut p = TraceProcessor::new(3, true, false);
        p.process(&[-10.0, -10.0]);
        let out = p.process(&[-30.0, -30.0, -30.0]);
        assert_eq!(out.averaged_count, 1);
        assert_eq!(out.max_hold.unwrap(), vec![-30.0; 3]);
    }

    #[test]
    fn changing_averaging_restarts_average_but_disabling_hold_drops_it() {
        let mut p = TraceProcessor::new(4, true, false);
        p.process(&[-10.0]);
        p.process(&[-10.0]);
        p.configure(8, false, false);
        let out = p.process(&[-20.0]);
        assert_eq!(out.averaged_count, 1);
        assert!(out.max_hold.is_none());
    }
}
