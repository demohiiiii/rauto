import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultDashboardRoute,
  routeById,
  routeByPath,
} from "../src/domains/dashboard/index.js";

test("dashboard routes normalize paths and ids through the domain model", () => {
  assert.equal(routeById("schedules")?.path, "/app/schedules");
  assert.equal(routeById("missing"), null);
  assert.equal(routeByPath("/app/templates").id, "templates");
  assert.equal(routeByPath("/missing"), defaultDashboardRoute);
});
