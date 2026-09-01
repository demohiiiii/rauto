import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  defaultDashboardRoute,
  routeById,
  routeByPath,
} from "../src/domains/dashboard/index.js";

const read = (path: string): string => readFileSync(path, "utf8");

test("dashboard routes normalize paths and ids through the domain model", () => {
  assert.equal(routeById("schedules")?.path, "/app/schedules");
  assert.equal(routeById("missing"), null);
  assert.equal(routeByPath("/app/templates").id, "templates");
  assert.equal(routeByPath("/missing"), defaultDashboardRoute);
});

test("dashboard application depends on typed infrastructure adapters", () => {
  const application = [
    read(
      "frontend/src/domains/dashboard/application/createDashboardAppWorkspace.ts",
    ),
    read("frontend/src/domains/dashboard/application/dashboardState.ts"),
    read(
      "frontend/src/domains/dashboard/application/createDashboardShellWorkspaces.ts",
    ),
  ].join("\n");
  const api = read(
    "frontend/src/domains/dashboard/infrastructure/dashboardApi.ts",
  );
  const resources = read(
    "frontend/src/domains/dashboard/infrastructure/dashboardResources.ts",
  );
  const runtime = read(
    "frontend/src/domains/dashboard/infrastructure/dashboardRuntime.ts",
  );

  assert.doesNotMatch(application, /api\/client\.js/);
  assert.doesNotMatch(application, /lib\/browser\.js/);
  assert.doesNotMatch(application, /modules\/(?:connections|overlays)/);
  assert.match(api, /api\/client\.js/);
  assert.match(resources, /\$domains\/connections\/index\.js/);
  assert.match(resources, /\$domains\/overlays\/index\.js/);
  assert.match(runtime, /lib\/browser\.js/);
  assert.doesNotMatch(application, /\bany\b|@ts-(?:ignore|nocheck)/);
});

test("legacy dashboard state modules stay removed", () => {
  for (const path of [
    "frontend/src/config/dashboardNavigation.js",
    "frontend/src/modules/dashboard/dashboardApp.js",
    "frontend/src/modules/dashboard/dashboardAppState.js",
    "frontend/src/modules/dashboard/dashboardOverlays.js",
    "frontend/src/modules/dashboard/themeSystem.js",
    "frontend/src/modules/dashboard/dashboardShell.js",
  ]) {
    assert.equal(existsSync(path), false, path);
  }
});
