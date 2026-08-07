export function parseDiscoveryPorts(expression = "") {
  const values = new Set();
  for (const token of String(expression).split(/[\s,]+/)) {
    if (!token) continue;
    if (token.includes("-")) {
      const [startText, endText, ...rest] = token.split("-");
      const start = Number(startText);
      const end = Number(endText);
      if (
        rest.length ||
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 1 ||
        end > 65535 ||
        start > end
      ) {
        throw new Error("invalid_port_range");
      }
      for (let port = start; port <= end; port += 1) values.add(port);
    } else {
      const port = Number(token);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("invalid_port");
      }
      values.add(port);
    }
    if (values.size > 16) throw new Error("too_many_ports");
  }
  if (!values.size) throw new Error("ports_required");
  return Array.from(values).sort((left, right) => left - right);
}

export function discoveryResultKey(result = {}) {
  return `${result.host || ""}:${Number(result.port || 0)}`;
}

export function defaultDiscoveryConnectionName(result = {}) {
  if (result.existing_connection_name) return result.existing_connection_name;
  const platform =
    String(result.device_profile || "device")
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "-")
      .replace(/^-+|-+$/g, "") || "device";
  const host = String(result.host || "device")
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const portSuffix = Number(result.port || 22) === 22 ? "" : `-${result.port}`;
  const endpoint = `${host || "device"}${portSuffix}`;
  const maxPlatformLength = Math.max(0, 96 - endpoint.length - 1);
  return `${platform.slice(0, maxPlatformLength)}-${endpoint}`;
}

export function discoveryRunIsActive(run = {}) {
  return ["queued", "running", "cancelling"].includes(run.status);
}

export function discoveryResultStatus(result = {}) {
  if (result.imported_connection_name) return "imported";
  if (result.existing_connection_name) return "existing";
  return result.status || "unreachable";
}

export function discoveryResultCanImport(result = {}) {
  return discoveryResultStatus(result) === "identified";
}

export function retainImportableDiscoveryResultKeys(
  selectedKeys = [],
  results = [],
) {
  const importableKeys = new Set(
    (Array.isArray(results) ? results : [])
      .filter(discoveryResultCanImport)
      .map(discoveryResultKey),
  );
  return Array.from(
    new Set(
      (Array.isArray(selectedKeys) ? selectedKeys : []).filter((key) =>
        importableKeys.has(key),
      ),
    ),
  );
}

export function filterDiscoveryResults(
  results = [],
  filter = "all",
  query = "",
  statusFilter = "all",
) {
  const normalizedQuery = String(query).trim().toLowerCase();
  return (Array.isArray(results) ? results : []).filter((result) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "reachable" &&
        ["reachable", "identified", "probe_failed"].includes(result.status)) ||
      (filter === "identified" &&
        discoveryResultStatus(result) === "identified") ||
      (filter === "ready" &&
        discoveryResultCanImport(result) &&
        !result.existing_connection_name) ||
      (filter === "existing" && !!result.existing_connection_name) ||
      (filter === "failed" &&
        ["unreachable", "not_ssh", "probe_failed"].includes(result.status)) ||
      (filter === "imported" && !!result.imported_connection_name);
    if (!matchesFilter) return false;
    const matchesStatus =
      statusFilter === "all" || discoveryResultStatus(result) === statusFilter;
    if (!matchesStatus) return false;
    if (!normalizedQuery) return true;
    return [
      result.host,
      result.port,
      result.device_profile,
      result.device_model,
      result.software_version,
      result.existing_connection_name,
      result.error,
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
}
