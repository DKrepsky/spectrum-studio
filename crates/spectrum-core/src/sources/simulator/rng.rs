//! Fixed, documented pseudo-random generator so simulated signals are bit-for-bit repeatable
//! (see ADR 0005): xoshiro256++ seeded through SplitMix64, Gaussian values via Box–Muller.

#[derive(Debug, Clone)]
pub struct Rng {
    s: [u64; 4],
}

impl Rng {
    pub fn new(seed: u64) -> Self {
        let mut sm = seed;
        let mut next = || {
            sm = sm.wrapping_add(0x9E37_79B9_7F4A_7C15);
            let mut z = sm;
            z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
            z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
            z ^ (z >> 31)
        };
        Self {
            s: [next(), next(), next(), next()],
        }
    }

    pub fn next_u64(&mut self) -> u64 {
        let s = &mut self.s;
        let result = s[0].wrapping_add(s[3]).rotate_left(23).wrapping_add(s[0]);
        let t = s[1] << 17;
        s[2] ^= s[0];
        s[3] ^= s[1];
        s[1] ^= s[2];
        s[0] ^= s[3];
        s[2] ^= t;
        s[3] = s[3].rotate_left(45);
        result
    }

    /// Uniform in (0, 1]; never zero so it is safe for `ln`.
    pub fn uniform(&mut self) -> f64 {
        ((self.next_u64() >> 11) as f64 + 1.0) * (1.0 / (1u64 << 53) as f64)
    }

    /// Two independent standard normal values.
    pub fn gaussian_pair(&mut self) -> (f64, f64) {
        let r = (-2.0 * self.uniform().ln()).sqrt();
        let theta = 2.0 * std::f64::consts::PI * self.uniform();
        (r * theta.cos(), r * theta.sin())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_seed_same_stream_and_known_first_value() {
        let mut a = Rng::new(1);
        let mut b = Rng::new(1);
        let first = a.next_u64();
        assert_eq!(first, b.next_u64());
        // Pinned so an accidental algorithm change is caught.
        assert_eq!(first, 14_971_601_782_005_023_387);
        assert_ne!(Rng::new(2).next_u64(), first);
    }

    #[test]
    fn gaussian_has_unit_variance() {
        let mut rng = Rng::new(7);
        let n = 100_000;
        let (mut sum, mut sum_sq) = (0.0, 0.0);
        for _ in 0..n / 2 {
            let (a, b) = rng.gaussian_pair();
            sum += a + b;
            sum_sq += a * a + b * b;
        }
        let mean = sum / n as f64;
        let var = sum_sq / n as f64 - mean * mean;
        assert!(mean.abs() < 0.02, "{mean}");
        assert!((var - 1.0).abs() < 0.02, "{var}");
    }
}
