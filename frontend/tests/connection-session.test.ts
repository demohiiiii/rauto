import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";
import { createConnectionSessionWorkspace } from "../src/domains/connections/application/createConnectionSessionWorkspace.js";
import { savedConnectionSessionKey } from "../src/domains/connections/model/connectionSession.js";
import type {
  ConnectionKeepAlive,
  ConnectionRequestPayload,
  ConnectionSessionIdentity,
  ConnectionTestResponse,
} from "../src/domains/connections/model/types.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function response(host = "192.0.2.1"): ConnectionTestResponse {
  return {
    ok: true,
    host,
    port: 22,
    username: "test",
    device_profile: "linux",
    linux_shell_flavor: "bash",
    output_encoding: "utf8",
    ssh_security: "secure",
  };
}

function fixture() {
  const connections: ConnectionRequestPayload[] = [];
  const releases: ConnectionSessionIdentity[] = [];
  const preferences: ConnectionKeepAlive[] = [];
  const errors: string[] = [];
  const port = {
    async connect(connection: ConnectionRequestPayload) {
      connections.push(connection);
      return response();
    },
    async disconnect(target: ConnectionSessionIdentity) {
      releases.push(target);
      return { closed_connections: 1 };
    },
    savePreferences(value: ConnectionKeepAlive) {
      preferences.push({ ...value });
    },
    notifyError(message: string) {
      errors.push(message);
    },
  };
  return { port, connections, releases, preferences, errors };
}

test("selecting a target connects with default keepalive and ignores repeated refreshes", async () => {
  const f = fixture();
  const workspace = createConnectionSessionWorkspace(f.port);
  await workspace.selectConnection({ connection_name: "edge" });
  assert.deepEqual(f.connections, [
    {
      connection_name: "edge",
      keep_alive: { enabled: true, interval_secs: 30 },
    },
  ]);
  assert.equal(get(workspace.state).status, "connected");
  assert.equal(get(workspace.state).connectionName, "edge");
  await workspace.selectConnection({
    connection_name: "edge",
    keep_alive: workspace.keepAliveOptions(),
  });
  assert.equal(f.connections.length, 1);
});

test("settings release old sessions, reconnect and persist; invalid intervals never reach the API", async () => {
  const f = fixture();
  const workspace = createConnectionSessionWorkspace(f.port);
  await workspace.selectConnection({
    host: "192.0.2.1",
    credential_id: "credential",
  });
  assert.equal(await workspace.setHeartbeatInterval(90), true);
  await workspace.setKeepAlive(false);
  assert.deepEqual(workspace.keepAliveOptions(), {
    enabled: false,
    interval_secs: 90,
  });
  assert.deepEqual(
    f.connections.map((connection) => connection.keep_alive),
    [
      { enabled: true, interval_secs: 30 },
      { enabled: true, interval_secs: 90 },
    ],
  );
  assert.equal(f.releases.length, 2);
  assert.equal(get(workspace.state).status, "idle");
  assert.deepEqual(f.preferences.at(-1), { enabled: false, interval_secs: 90 });
  for (const value of [0, 3601, 1.5, Number.NaN])
    assert.equal(await workspace.setHeartbeatInterval(value), false);
  assert.equal(f.connections.length, 2);
  await workspace.selectConnection(null);
  assert.equal(f.releases.length, 2);
  assert.equal(get(workspace.state).status, "idle");
});

test("disabled keepalive retains saved and temporary targets without connecting until enabled", async () => {
  const f = fixture();
  const workspace = createConnectionSessionWorkspace(f.port, {
    enabled: false,
    interval_secs: 60,
  });
  const statuses: string[] = [];
  const unsubscribe = workspace.state.subscribe((value) => {
    statuses.push(value.status);
  });
  await workspace.selectConnection({ connection_name: "restored" });
  await workspace.selectConnection({ connection_name: "another" });
  const temporaryTarget = {
    host: "192.0.2.2",
    credential_id: "credential",
  };
  await workspace.selectConnection(temporaryTarget);
  assert.equal(await workspace.setHeartbeatInterval(90), true);
  await workspace.reconnect();
  assert.deepEqual(f.connections, []);
  assert.deepEqual(f.releases, []);
  assert.ok(statuses.every((status) => status === "idle"));
  assert.deepEqual(workspace.keepAliveOptions(), {
    enabled: false,
    interval_secs: 90,
  });

  await workspace.setKeepAlive(true);
  assert.deepEqual(f.connections, [
    {
      ...temporaryTarget,
      keep_alive: { enabled: true, interval_secs: 90 },
    },
  ]);
  assert.equal(get(workspace.state).status, "connected");
  assert.equal(get(workspace.state).connectionName, null);
  unsubscribe();
});

test("reenabling keepalive reconnects the selected target after releasing its session", async () => {
  const f = fixture();
  const workspace = createConnectionSessionWorkspace(f.port);
  await workspace.selectConnection({ connection_name: "edge" });
  await workspace.setKeepAlive(false);
  assert.equal(get(workspace.state).status, "idle");
  assert.equal(f.connections.length, 1);
  assert.equal(f.releases.length, 1);

  await workspace.setKeepAlive(true);
  assert.equal(get(workspace.state).status, "connected");
  assert.equal(f.connections.length, 2);
  assert.equal(f.connections[1].connection_name, "edge");
});

test("disabling keepalive during connection ignores stale failures and releases late successes", async (t) => {
  for (const outcome of ["success", "failure"] as const) {
    await t.test(outcome, async () => {
      const f = fixture();
      const first = deferred<ConnectionTestResponse>();
      const started = deferred<void>();
      f.port.connect = async (connection) => {
        f.connections.push(connection);
        started.resolve();
        return first.promise;
      };
      const workspace = createConnectionSessionWorkspace(f.port);
      const pending = workspace.selectConnection({ connection_name: "edge" });
      await started.promise;
      const disabled = workspace.setKeepAlive(false);
      assert.equal(get(workspace.state).status, "idle");
      if (outcome === "success") first.resolve(response());
      else first.reject(new Error("Stale timeout"));
      await Promise.all([pending, disabled]);

      assert.equal(get(workspace.state).status, "idle");
      assert.equal(f.connections.length, 1);
      assert.equal(f.releases.length, outcome === "success" ? 1 : 0);
      assert.deepEqual(f.errors, []);
    });
  }
});

test("a late connection is released before connecting the latest target", async () => {
  const f = fixture();
  const first = deferred<ConnectionTestResponse>();
  const started = deferred<void>();
  f.port.connect = async (connection) => {
    f.connections.push(connection);
    if (f.connections.length === 1) {
      started.resolve();
      return first.promise;
    }
    return response("192.0.2.2");
  };
  const workspace = createConnectionSessionWorkspace(f.port);
  const pending = workspace.selectConnection({ connection_name: "first" });
  await started.promise;
  void workspace.selectConnection({ connection_name: "skipped" });
  void workspace.selectConnection({ connection_name: "latest" });
  first.resolve(response());
  await pending;
  assert.deepEqual(
    f.connections.map((value) => value.connection_name),
    ["first", "latest"],
  );
  assert.deepEqual(f.releases, [
    { host: "192.0.2.1", port: 22, username: "test" },
  ]);
  assert.equal(get(workspace.state).status, "connected");
  assert.equal(get(workspace.state).connectionName, "latest");
});

test("stale failures cannot overwrite a new selection; current failures can be retried", async () => {
  const f = fixture();
  const first = deferred<ConnectionTestResponse>();
  const started = deferred<void>();
  f.port.connect = async (connection) => {
    f.connections.push(connection);
    if (f.connections.length === 1) {
      started.resolve();
      return first.promise;
    }
    if (f.connections.length === 2) throw new Error("Authentication failed");
    return response();
  };
  const workspace = createConnectionSessionWorkspace(f.port);
  const pending = workspace.selectConnection({ connection_name: "first" });
  await started.promise;
  void workspace.selectConnection({ connection_name: "second" });
  first.reject(new Error("Old timeout"));
  await pending;
  assert.deepEqual(f.errors, ["Authentication failed"]);
  assert.equal(get(workspace.state).error, "Authentication failed");
  assert.equal(get(workspace.state).connectionName, "second");
  await workspace.reconnect();
  assert.equal(get(workspace.state).status, "connected");
  assert.equal(get(workspace.state).error, "");
});

test("clearing a target while connecting releases a late success", async () => {
  const f = fixture();
  const first = deferred<ConnectionTestResponse>();
  const started = deferred<void>();
  f.port.connect = async () => {
    started.resolve();
    return first.promise;
  };
  const workspace = createConnectionSessionWorkspace(f.port, {
    enabled: true,
    interval_secs: 60,
  });
  const pending = workspace.selectConnection({ connection_name: "first" });
  await started.promise;
  void workspace.selectConnection(null);
  first.resolve(response());
  await pending;
  assert.equal(get(workspace.state).status, "idle");
  assert.equal(get(workspace.state).connectionName, null);
  assert.equal(f.releases.length, 1);
});

test("a failed release remains retryable instead of abandoning a kept-alive session", async () => {
  const f = fixture();
  let failRelease = true;
  f.port.disconnect = async (target) => {
    if (failRelease) throw new Error("Release failed");
    f.releases.push(target);
    return { closed_connections: 1 };
  };
  const workspace = createConnectionSessionWorkspace(f.port);
  await workspace.selectConnection({ connection_name: "first" });
  await workspace.selectConnection({ connection_name: "second" });
  assert.equal(get(workspace.state).status, "error");
  assert.equal(f.connections.length, 1);
  failRelease = false;
  await workspace.reconnect();
  assert.equal(get(workspace.state).status, "connected");
  assert.equal(f.connections.at(-1)?.connection_name, "second");
});

test("a target queued by a connection-status subscriber is reconciled before settling", async () => {
  const f = fixture();
  const workspace = createConnectionSessionWorkspace(f.port);
  let switched = false;
  const unsubscribe = workspace.state.subscribe((value) => {
    if (value.status === "connected" && !switched) {
      switched = true;
      queueMicrotask(() => {
        void workspace.selectConnection({ connection_name: "next" });
      });
    }
  });
  await workspace.selectConnection({ connection_name: "first" });
  assert.deepEqual(
    f.connections.map((connection) => connection.connection_name),
    ["first", "next"],
  );
  assert.equal(get(workspace.state).status, "connected");
  unsubscribe();
});

test("editing connection settings reconnects the same saved name while metadata refreshes do not", async () => {
  const f = fixture();
  const workspace = createConnectionSessionWorkspace(f.port);
  const settings = { host: "192.0.2.1", credential_id: "first", port: 22 };
  const payload = { connection_name: "edge" };
  await workspace.selectConnection(
    payload,
    savedConnectionSessionKey(settings),
  );
  await workspace.selectConnection(
    payload,
    savedConnectionSessionKey({
      ...settings,
      labels: ["updated"],
      port: "22",
    }),
  );
  assert.equal(f.connections.length, 1);
  for (const patch of [
    { host: "192.0.2.2" },
    { port: 2222 },
    { credential_id: "second" },
    { device_profile: "linux" },
    { ssh_security: "legacy" },
    { linux_shell_flavor: "fish" },
    { output_encoding: "gbk" },
    { connect_timeout_secs: 10 },
  ]) {
    await workspace.selectConnection(
      payload,
      savedConnectionSessionKey({ ...settings, ...patch }),
    );
  }
  assert.equal(f.connections.length, 9);
  assert.equal(f.releases.length, 8);
});

test("health checks reuse the target without disconnecting or flashing connecting status", async () => {
  const f = fixture();
  const workspace = createConnectionSessionWorkspace(f.port);
  await workspace.selectConnection({ connection_name: "edge" });
  const statuses: string[] = [];
  const unsubscribe = workspace.state.subscribe((value) =>
    statuses.push(value.status),
  );
  await workspace.checkConnection();
  assert.equal(f.connections.length, 2);
  assert.equal(f.releases.length, 0);
  assert.ok(statuses.every((status) => status === "connected"));
  unsubscribe();
});

test("a failed health check shows an error, stops automatic retries, and supports explicit reconnect", async () => {
  const f = fixture();
  const workspace = createConnectionSessionWorkspace(f.port);
  await workspace.selectConnection({ connection_name: "edge" });
  f.port.connect = async () => {
    throw new Error("Connection lost");
  };
  await workspace.checkConnection();
  assert.equal(get(workspace.state).status, "error");
  assert.equal(get(workspace.state).connectionName, "edge");
  assert.deepEqual(f.errors, ["Connection lost"]);
  await workspace.checkConnection();
  assert.equal(f.errors.length, 1);
  f.port.connect = async () => response();
  await workspace.reconnect();
  assert.equal(get(workspace.state).status, "connected");
  assert.equal(get(workspace.state).error, "");
  assert.equal(f.releases.length, 1);
  await workspace.setKeepAlive(false);
  await workspace.checkConnection();
  assert.equal(get(workspace.state).status, "idle");
  assert.equal(f.releases.length, 2);
});

test("health checks release the previous identity when saved settings resolve to another device", async () => {
  const f = fixture();
  const workspace = createConnectionSessionWorkspace(f.port);
  await workspace.selectConnection({ connection_name: "edge" });
  f.port.connect = async () => response("192.0.2.2");
  let failRelease = true;
  f.port.disconnect = async (target) => {
    if (failRelease) throw new Error("Release failed");
    f.releases.push(target);
    return { closed_connections: 1 };
  };
  await workspace.checkConnection();
  assert.equal(get(workspace.state).status, "error");
  failRelease = false;
  await workspace.setKeepAlive(false);
  assert.deepEqual(f.releases, [
    { host: "192.0.2.1", port: 22, username: "test" },
    { host: "192.0.2.2", port: 22, username: "test" },
  ]);
  assert.equal(get(workspace.state).status, "idle");
});

test("target changes and disabling keepalive take precedence over in-flight health checks", async (t) => {
  for (const change of ["target", "disable"] as const) {
    for (const outcome of ["success", "failure"] as const) {
      await t.test(`${change}: ${outcome}`, async () => {
        const f = fixture();
        const workspace = createConnectionSessionWorkspace(f.port);
        await workspace.selectConnection({ connection_name: "first" });
        const check = deferred<ConnectionTestResponse>();
        const started = deferred<void>();
        f.port.connect = async (connection) => {
          f.connections.push(connection);
          if (f.connections.length === 2) {
            started.resolve();
            return check.promise;
          }
          return response("192.0.2.2");
        };
        const pending = workspace.checkConnection();
        await started.promise;
        const next =
          change === "target"
            ? workspace.selectConnection({ connection_name: "second" })
            : workspace.setKeepAlive(false);
        if (outcome === "success") check.resolve(response());
        else check.reject(new Error("Stale timeout"));
        await Promise.all([pending, next]);
        assert.deepEqual(f.errors, []);
        assert.equal(f.releases.length, 1);
        assert.equal(
          get(workspace.state).status,
          change === "target" ? "connected" : "idle",
        );
        if (change === "target") {
          assert.equal(f.connections.at(-1)?.connection_name, "second");
          assert.equal(get(workspace.state).connectionName, "second");
        } else assert.equal(f.connections.length, 2);
      });
    }
  }
});

test("status monitoring follows subscribers and never opens disabled targets", async () => {
  const f = fixture();
  let check: (() => void) | undefined;
  let stops = 0;
  const workspace = createConnectionSessionWorkspace(
    {
      ...f.port,
      subscribeStatusChecks(next) {
        check = next;
        return () => {
          stops += 1;
        };
      },
    },
    { enabled: false, interval_secs: 30 },
  );
  const unsubscribe = workspace.state.subscribe(() => {});
  await workspace.selectConnection({ connection_name: "edge" });
  assert.ok(check);
  check();
  await workspace.checkConnection();
  assert.equal(f.connections.length, 0);
  await workspace.setKeepAlive(true);
  check();
  await workspace.checkConnection();
  assert.equal(f.connections.length, 2);
  unsubscribe();
  assert.equal(stops, 1);
});
