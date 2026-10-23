//! A permit spans a complete device operation, including its rollback.
use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock, Weak};
use tokio::sync::{OwnedMutexGuard, OwnedSemaphorePermit, Semaphore};

type DeviceLocks = HashMap<(String, u16), Weak<tokio::sync::Mutex<()>>>;

struct Limits {
    slots: Arc<Semaphore>,
    devices: Mutex<DeviceLocks>,
}

pub struct ExecutionLease {
    _slot: OwnedSemaphorePermit,
    _device: OwnedMutexGuard<()>,
}

impl ExecutionLease {
    pub async fn acquire(host: &str, port: u16) -> Self {
        static LIMITS: OnceLock<Limits> = OnceLock::new();
        let limits = LIMITS.get_or_init(|| Limits {
            slots: Arc::new(Semaphore::new(4)),
            devices: Mutex::new(HashMap::new()),
        });
        let device = {
            let mut devices = limits.devices.lock().expect("device limits lock poisoned");
            devices.retain(|_, value| value.strong_count() > 0);
            let key = (host.trim().to_ascii_lowercase(), port);
            match devices.get(&key).and_then(Weak::upgrade) {
                Some(device) => device,
                None => {
                    let device = Arc::new(tokio::sync::Mutex::new(()));
                    devices.insert(key, Arc::downgrade(&device));
                    device
                }
            }
        };
        // Wait for a busy device before taking capacity from unrelated devices.
        let device = device.lock_owned().await;
        let slot = limits
            .slots
            .clone()
            .acquire_owned()
            .await
            .expect("execution semaphore closed");
        Self {
            _slot: slot,
            _device: device,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[tokio::test]
    async fn same_device_is_exclusive_and_wait_cancellation_releases_ownership() {
        let host = format!("test-{}", crate::infrastructure::runtime::new_id());
        let first = ExecutionLease::acquire(&host, 22).await;
        assert!(
            tokio::time::timeout(
                Duration::from_millis(25),
                ExecutionLease::acquire(&host, 22)
            )
            .await
            .is_err()
        );
        let other =
            tokio::time::timeout(Duration::from_secs(1), ExecutionLease::acquire(&host, 23))
                .await
                .unwrap();
        drop(first);
        let next = tokio::time::timeout(Duration::from_secs(1), ExecutionLease::acquire(&host, 22))
            .await
            .unwrap();
        drop((next, other));
    }
}
