import type { ConnectionKeepAlive, SavedConnection } from "./types.js";

export const defaultConnectionKeepAlive: Readonly<ConnectionKeepAlive> = {
  enabled: true,
  interval_secs: 30,
};

export function validHeartbeatInterval(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 3600;
}

export function savedConnectionSessionKey(connection: SavedConnection): string {
  return JSON.stringify([
    connection.host ?? "",
    Number(connection.port || 22),
    connection.credential_id ?? "",
    connection.device_profile ?? "autodetect",
    connection.ssh_security ?? "",
    connection.linux_shell_flavor ?? "",
    connection.output_encoding ?? "utf8",
    Number(connection.connect_timeout_secs || 0),
  ]);
}
