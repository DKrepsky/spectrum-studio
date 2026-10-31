//! Checks against a real SA430, gated by `SPECTRUM_E2E_SA430=1` (same flag as the e2e spec):
//! `SPECTRUM_E2E_SA430=1 cargo test -p spectrum-driver-sa430 --test hardware -- --ignored --nocapture`.
//! The serial port is exclusive: stop the app first.
#![allow(clippy::unwrap_used)]

use spectrum_core::sources::SourceDriver;
use spectrum_driver_sa430::Sa430Driver;

fn enabled() -> bool {
    std::env::var("SPECTRUM_E2E_SA430").is_ok_and(|v| v == "1")
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
