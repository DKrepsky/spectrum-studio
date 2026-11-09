//! Checks against a real SA430, gated by `SPECTRUM_E2E_SA430=1` (same flag as the e2e spec):
//! `SPECTRUM_E2E_SA430=1 cargo test -p spectrum-driver-sa430 --test hardware -- --ignored --nocapture`.
//! The serial port is exclusive: stop the app first.
#![allow(clippy::unwrap_used)]

use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use sa430::port::Port;
use spectrum_core::model::{ParamValue, SourceConfig};
use spectrum_core::sources::{SourceData, SourceDriver};
use spectrum_driver_sa430::{ConnectPolicy, DRIVER_ID, Sa430Backend, Sa430Driver, SerialBackend};

fn enabled() -> bool {
    std::env::var("SPECTRUM_E2E_SA430").is_ok_and(|v| v == "1")
}

/// The tests share one serial port, so they run one at a time.
static PORT_LOCK: Mutex<()> = Mutex::new(());

fn lock_port() -> std::sync::MutexGuard<'static, ()> {
    PORT_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// The real serial backend, counting the ports it opens: one per connect attempt.
#[derive(Default)]
struct Counting {
    opens: AtomicUsize,
}

impl Counting {
    fn opens(&self) -> usize {
        self.opens.load(Ordering::SeqCst)
    }
}

impl Sa430Backend for Counting {
    fn scan(&self) -> Result<Vec<Port>, sa430::Error> {
        SerialBackend.scan()
    }

    fn open(
        &self,
        port_name: &str,
        policy: &ConnectPolicy,
        deadline: Instant,
        sweeping: Arc<AtomicBool>,
    ) -> Result<sa430::Sa430, sa430::Error> {
        self.opens.fetch_add(1, Ordering::SeqCst);
        SerialBackend.open(port_name, policy, deadline, sweeping)
    }
}

fn first_port() -> String {
    let ports = sa430::create_scanner().scan().unwrap();
    ports.first().expect("no SA430 detected").name().to_string()
}

fn config(port: &str) -> SourceConfig {
    let mut c = SourceConfig::new(DRIVER_ID);
    c.connection
        .insert("port".into(), ParamValue::Text(port.into()));
    c
}

/// Waits (at most 5 s) until the port node exists, or no longer exists; returns the time taken.
fn wait_for_port(port: &str, present: bool) -> Duration {
    let started = Instant::now();
    while Path::new(port).exists() != present {
        assert!(
            started.elapsed() < Duration::from_secs(5),
            "{port} did not {} within 5 s",
            if present { "come back" } else { "disappear" }
        );
        thread::sleep(Duration::from_millis(5));
    }
    started.elapsed()
}

/// Resets the analyzer, so it re-enumerates the way a plug-in does. Returns how long the port
/// node took to vanish and to come back.
fn reboot(port: &str) -> (Duration, Duration) {
    let deadline = Instant::now() + Duration::from_secs(6);
    let mut device = SerialBackend
        .open(
            port,
            &ConnectPolicy::default(),
            deadline,
            Arc::new(AtomicBool::new(false)),
        )
        .expect("open for reboot");
    // The reset can cut the reply short, so the result is only reported.
    println!("reboot reply: {:?}", device.reboot());
    drop(device);
    let gone = wait_for_port(port, false);
    let back = wait_for_port(port, true);
    (gone, back)
}

/// The identity `discover` derives from USB must equal the calibration serial `open` reads,
/// otherwise remembered records would look "Not detected" (ADR 0010).
#[test]
#[ignore = "requires a connected SA430 and SPECTRUM_E2E_SA430=1"]
fn usb_serial_equals_calibration_serial() {
    if !enabled() {
        return;
    }
    let ports = sa430::create_scanner().scan().unwrap();
    let port = ports.first().expect("no SA430 detected");
    let usb = port.serial_number().map(|s| s.trim().to_string());
    let mut device = sa430::Sa430::open(port.name()).unwrap();
    let cal = device.calibration().unwrap();
    let cal_serial = String::from_utf8_lossy(&cal.serial_number)
        .trim_matches('\0')
        .trim()
        .to_string();
    println!(
        "port={} usb_serial={usb:?} calibration_serial={cal_serial:?}",
        port.name()
    );
    assert_eq!(usb.as_deref(), Some(cal_serial.as_str()));
}

#[test]
#[ignore = "requires a connected SA430 and SPECTRUM_E2E_SA430=1"]
fn discovery_is_stable() {
    if !enabled() {
        return;
    }
    let driver = Sa430Driver::new();
    let a = driver.discover().unwrap();
    let b = driver.discover().unwrap();
    println!("{a:?}");
    assert!(!a.is_empty());
    assert_eq!(a, b);
}

/// Ten connect and disconnect cycles, each identified on the first attempt, well within a second.
#[test]
#[ignore = "requires a connected SA430 and SPECTRUM_E2E_SA430=1"]
fn ten_connect_cycles_all_succeed_on_the_first_attempt() {
    if !enabled() {
        return;
    }
    let _lock = lock_port();
    let port = first_port();
    let backend = Arc::new(Counting::default());
    let driver = Sa430Driver::with_backend(backend.clone());
    for cycle in 1..=10 {
        let before = backend.opens();
        let started = Instant::now();
        let opened = driver
            .open(&config(&port))
            .unwrap_or_else(|e| panic!("cycle {cycle} failed: {e}"));
        let elapsed = started.elapsed();
        let attempts = backend.opens() - before;
        println!(
            "cycle {cycle}: {} in {elapsed:?}, {attempts} attempt(s)",
            opened.label
        );
        assert_eq!(attempts, 1, "cycle {cycle} needed a retry");
        assert!(
            elapsed < Duration::from_secs(1),
            "cycle {cycle} took {elapsed:?}"
        );
        drop(opened);
    }
}

/// Plug-in simulation: reset the analyzer, then connect with the default policy.
#[test]
#[ignore = "requires a connected SA430 and SPECTRUM_E2E_SA430=1"]
fn reboot_then_connect_succeeds_with_the_default_policy() {
    if !enabled() {
        return;
    }
    let _lock = lock_port();
    let port = first_port();
    let (gone, back) = reboot(&port);
    println!("port vanished after {gone:?}, came back after {back:?}");
    let backend = Arc::new(Counting::default());
    let driver = Sa430Driver::with_backend(backend.clone());
    let started = Instant::now();
    let opened = driver
        .open(&config(&port))
        .unwrap_or_else(|e| panic!("connect after reboot failed: {e}"));
    println!(
        "connected after reboot in {:?} with {} attempt(s)",
        started.elapsed(),
        backend.opens()
    );
    drop(opened);
}

/// The same plug-in simulation with no settle delay: the retry ladder has to recover the link.
#[test]
#[ignore = "requires a connected SA430 and SPECTRUM_E2E_SA430=1"]
fn reboot_then_connect_without_settle_recovers_within_the_policy() {
    if !enabled() {
        return;
    }
    let _lock = lock_port();
    let port = first_port();
    let (gone, back) = reboot(&port);
    println!("port vanished after {gone:?}, came back after {back:?}");
    let policy = ConnectPolicy {
        settle: Duration::ZERO,
        ..ConnectPolicy::default()
    };
    let backend = Arc::new(Counting::default());
    let driver = Sa430Driver::with_backend_and_policy(backend.clone(), policy);
    let started = Instant::now();
    let opened = driver
        .open(&config(&port))
        .unwrap_or_else(|e| panic!("connect without settle failed: {e}"));
    let attempts = backend.opens();
    println!(
        "connected without settle in {:?} with {attempts} attempt(s)",
        started.elapsed()
    );
    // Without settle the ladder may need every attempt (udev race, glitch, silent reply): the test
    // proves recovery inside the default policy, not a particular attempt count.
    let max = ConnectPolicy::default().attempts as usize;
    assert!(
        attempts <= max,
        "needed {attempts} attempts, policy allows {max}"
    );
    assert!(
        started.elapsed() <= ConnectPolicy::default().deadline,
        "connect exceeded the deadline"
    );
    drop(opened);
}

/// After a successful connect the sweep timeout applies: consecutive sweeps return calibrated
/// traces.
#[test]
#[ignore = "requires a connected SA430 and SPECTRUM_E2E_SA430=1"]
fn connect_then_sweeps_return_calibrated_traces() {
    if !enabled() {
        return;
    }
    let _lock = lock_port();
    let port = first_port();
    let driver = Sa430Driver::new();
    let mut opened = driver
        .open(&config(&port))
        .unwrap_or_else(|e| panic!("connect failed: {e}"));
    for sweep in 1..=3 {
        let started = Instant::now();
        let data = opened
            .source
            .read(0)
            .unwrap_or_else(|e| panic!("sweep {sweep} failed: {e}"));
        let SourceData::Trace(trace) = data else {
            panic!("the SA430 must return a trace");
        };
        let max = trace.values.iter().copied().fold(f32::MIN, f32::max);
        println!(
            "sweep {sweep}: {} points from {:.3} MHz, bin {:.1} kHz, max {max:.1} dBm, in {:?}",
            trace.values.len(),
            trace.start_hz / 1e6,
            trace.bin_hz / 1e3,
            started.elapsed()
        );
        assert!(trace.values.len() > 50);
    }
}
