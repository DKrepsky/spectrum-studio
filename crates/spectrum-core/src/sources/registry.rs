use std::sync::Arc;

use super::files::{IqFileDriver, TraceFileDriver};
use super::planned::planned_drivers;
use super::simulator::SimulatorDriver;
use super::{SourceDriver, SourceError};
use crate::model::{DeviceDescriptor, DriverInfo, DriverStatus};

/// The set of integrations known to the application.
#[derive(Clone, Default)]
pub struct DriverRegistry {
    drivers: Vec<Arc<dyn SourceDriver>>,
}

impl DriverRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// The integrations that live in this crate (simulator, file readers) plus the planned ones.
    /// Hardware drivers live in their own crates and are registered by the application.
    pub fn with_core_drivers() -> Self {
        let mut registry = Self::new();
        registry.register(SimulatorDriver::new());
        registry.register(IqFileDriver::new());
        registry.register(TraceFileDriver);
        for driver in planned_drivers() {
            registry.register(driver);
        }
        registry
    }

    pub fn register(&mut self, driver: impl SourceDriver + 'static) {
        self.drivers.push(Arc::new(driver));
    }

    pub fn infos(&self) -> Vec<DriverInfo> {
        self.drivers.iter().map(|d| d.info()).collect()
    }

    pub fn get(&self, id: &str) -> Result<Arc<dyn SourceDriver>, SourceError> {
        self.drivers
            .iter()
            .find(|d| d.info().id == id)
            .cloned()
            .ok_or_else(|| SourceError::unsupported(format!("Unknown source type \"{id}\".")))
    }

    pub fn discover(&self, id: &str) -> Result<Vec<DeviceDescriptor>, SourceError> {
        let driver = self.get(id)?;
        let info = driver.info();
        if info.status != DriverStatus::Available {
            return Err(SourceError::unsupported(format!(
                "{} support is not implemented yet.",
                info.name
            )));
        }
        driver.discover()
    }

    /// Asks a driver for the stable id of a stored entry; `None` for unknown drivers.
    pub fn normalize_device_id(
        &self,
        driver_id: &str,
        device_id: Option<&str>,
        label: &str,
    ) -> Option<String> {
        self.get(driver_id)
            .ok()?
            .normalize_device_id(device_id, label)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builtin_registry_has_simulator_and_planned_drivers() {
        let registry = DriverRegistry::with_core_drivers();
        let infos = registry.infos();
        let sim = infos.iter().find(|i| i.id == "simulator").unwrap();
        assert_eq!(sim.status, DriverStatus::Available);
        assert!(infos.iter().any(|i| i.status == DriverStatus::Planned));
        let ids: std::collections::HashSet<_> = infos.iter().map(|i| i.id.as_str()).collect();
        assert_eq!(ids.len(), infos.len(), "driver ids must be unique");
    }

    #[test]
    fn planned_drivers_refuse_discovery_and_unknown_ids_error() {
        let registry = DriverRegistry::with_core_drivers();
        assert!(registry.discover("soapysdr").is_err());
        assert!(registry.get("nope").is_err());
        assert_eq!(registry.discover("simulator").unwrap().len(), 1);
    }

    #[test]
    fn normalize_device_id_asks_the_driver_and_ignores_unknown_ids() {
        struct Normalizing;
        impl SourceDriver for Normalizing {
            fn info(&self) -> DriverInfo {
                DriverInfo {
                    id: "norm".into(),
                    ..crate::sources::simulator::SimulatorDriver::unpaced().info()
                }
            }
            fn open(
                &self,
                _config: &crate::model::SourceConfig,
            ) -> Result<crate::sources::OpenedSource, SourceError> {
                Err(SourceError::unavailable("no"))
            }
            fn normalize_device_id(&self, id: Option<&str>, label: &str) -> Option<String> {
                Some(format!("{}:{label}", id.unwrap_or("-")))
            }
        }
        let mut registry = DriverRegistry::with_core_drivers();
        registry.register(Normalizing);
        assert_eq!(
            registry.normalize_device_id("norm", Some("a"), "L"),
            Some("a:L".into())
        );
        assert_eq!(registry.normalize_device_id("simulator", None, "L"), None);
        assert_eq!(registry.normalize_device_id("nope", None, "L"), None);
    }
}
