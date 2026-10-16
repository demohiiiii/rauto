import { get, writable } from "svelte/store";
import {
  defaultConnectionKeepAlive,
  validHeartbeatInterval,
} from "../model/connectionSession.js";
import type {
  ConnectionKeepAlive,
  ConnectionDisconnectResponse,
  ConnectionRequestPayload,
  ConnectionSessionIdentity,
  ConnectionSessionState,
  ConnectionTestResponse,
} from "../model/types.js";

export interface ConnectionSessionPort {
  connect(
    connection: ConnectionRequestPayload,
  ): Promise<ConnectionTestResponse>;
  disconnect(
    target: ConnectionSessionIdentity,
  ): Promise<ConnectionDisconnectResponse>;
  savePreferences(preferences: ConnectionKeepAlive): void;
  notifyError(message: string): void;
  subscribeStatusChecks?(check: () => void): () => void;
}

export function createConnectionSessionWorkspace(
  port: ConnectionSessionPort,
  preferences: ConnectionKeepAlive = defaultConnectionKeepAlive,
) {
  let keepAlive = { ...preferences };
  let target: ConnectionRequestPayload | null = null;
  let targetConfigurationKey = "";
  let desiredKey = "";
  let revision = 0;
  let completedRevision = 0;
  let active: ConnectionSessionIdentity | null = null;
  let activeKey = "";
  const retired: ConnectionSessionIdentity[] = [];
  let pending: Promise<void> | null = null;
  const state = writable<ConnectionSessionState>(
    {
      connectionName: null,
      status: "idle",
      error: "",
      keepAlive,
    },
    () => port.subscribeStatusChecks?.(() => void checkConnection()),
  );

  function publish(status: ConnectionSessionState["status"], error = "") {
    state.set({
      connectionName: target?.connection_name || null,
      status,
      error,
      keepAlive: { ...keepAlive },
    });
  }

  async function releaseRetired(): Promise<void> {
    while (retired.length) {
      await port.disconnect(retired[0]);
      retired.shift();
    }
  }

  async function reconcile(): Promise<void> {
    let processed = -1;
    while (processed !== revision) {
      processed = revision;
      const connectionKey = desiredKey;
      const connection =
        target && keepAlive.enabled
          ? { ...target, keep_alive: { ...keepAlive } }
          : null;
      try {
        if (active && (activeKey !== connectionKey || !connection)) {
          retired.push(active);
          active = null;
        }
        await releaseRetired();
        if (processed !== revision) continue;
        if (!connection) {
          publish("idle");
          continue;
        }
        const result = await port.connect(connection);
        if (
          active &&
          (active.host !== result.host ||
            active.port !== result.port ||
            active.username !== result.username)
        ) {
          retired.push(active);
        }
        active = {
          host: result.host,
          port: result.port,
          username: result.username,
        };
        activeKey = connectionKey;
        await releaseRetired();
        if (processed === revision) publish("connected");
      } catch (error) {
        if (processed !== revision) continue;
        const message = error instanceof Error ? error.message : String(error);
        publish("error", message);
        port.notifyError(message);
      }
    }
    completedRevision = processed;
  }

  function schedule(force = false, checking = false): Promise<void> {
    const key = JSON.stringify([target, targetConfigurationKey, keepAlive]);
    if (!force && key === desiredKey) return pending ?? Promise.resolve();
    desiredKey = key;
    revision += 1;
    if (!checking) publish(target && keepAlive.enabled ? "connecting" : "idle");
    if (!pending) {
      // Coalesce synchronous target updates and finish old requests before
      // releasing them, so stale responses cannot close a newer connection.
      pending = Promise.resolve()
        .then(reconcile)
        .finally(() => {
          pending = null;
          // A store subscriber may queue another target between reconciliation
          // finishing and this promise settling.
          if (completedRevision !== revision) return schedule(true);
        });
    }
    return pending;
  }

  function updatePreferences(next: ConnectionKeepAlive): Promise<void> {
    keepAlive = { ...next };
    port.savePreferences(keepAlive);
    return schedule();
  }

  function checkConnection(): Promise<void> {
    if (pending) return pending;
    if (!active || !keepAlive.enabled || get(state).status !== "connected") {
      return Promise.resolve();
    }
    return schedule(true, true);
  }

  return {
    state: { subscribe: state.subscribe },
    keepAliveOptions: (): ConnectionKeepAlive => ({ ...keepAlive }),
    selectConnection(
      connection: ConnectionRequestPayload | null,
      configurationKey = "",
    ) {
      target = connection ? { ...connection } : null;
      targetConfigurationKey = configurationKey;
      if (target) delete target.keep_alive;
      return schedule();
    },
    setKeepAlive(enabled: boolean) {
      return updatePreferences({ ...keepAlive, enabled });
    },
    setHeartbeatInterval(interval_secs: number) {
      if (!validHeartbeatInterval(interval_secs)) return Promise.resolve(false);
      return updatePreferences({ ...keepAlive, interval_secs }).then(
        () => true,
      );
    },
    checkConnection,
    reconnect() {
      activeKey = "";
      return schedule(true);
    },
  };
}
