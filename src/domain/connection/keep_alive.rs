use serde::{Deserialize, Serialize};

/// Runtime SSH heartbeat preferences; these are not saved device attributes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConnectionKeepAlive {
    pub enabled: bool,
    pub interval_secs: u64,
}

impl ConnectionKeepAlive {
    pub fn validate(self) -> Result<(), &'static str> {
        if !(1..=3600).contains(&self.interval_secs) {
            return Err("keep_alive.interval_secs must be between 1 and 3600 seconds");
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn heartbeat_interval_is_bounded_even_when_disabled() {
        for enabled in [false, true] {
            for interval_secs in [0, 3601, u64::MAX] {
                assert!(
                    ConnectionKeepAlive {
                        enabled,
                        interval_secs
                    }
                    .validate()
                    .is_err()
                );
            }
            for interval_secs in [1, 30, 3600] {
                assert!(
                    ConnectionKeepAlive {
                        enabled,
                        interval_secs
                    }
                    .validate()
                    .is_ok()
                );
            }
        }
    }
}
