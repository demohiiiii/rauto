import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dashboardNavigationItems } from "../src/domains/dashboard/index.js";
import { sidebarConnectionPresentation } from "../src/domains/connections/presentation/connectionTargetDisplayState.js";

test("SFTP upload is grouped with dashboard operations", () => {
  assert.equal(
    dashboardNavigationItems.find((item) => item.routeId === "transfer")?.group,
    "operations",
  );
});

test("long page titles use compact sidebar labels", () => {
  const navigation = readFileSync(
    "frontend/src/domains/dashboard/model/navigation.ts",
    "utf8",
  );
  const shell = readFileSync(
    "frontend/src/domains/dashboard/application/createDashboardShellWorkspaces.ts",
    "utf8",
  );
  const en = readFileSync("frontend/src/i18n/en.ts", "utf8");

  for (const labelKey of [
    "navStandard",
    "navBatch",
    "navReplay",
    "navDiscovery",
    "navProfiles",
    "navDevices",
    "navBlacklist",
    "navConfigHistory",
  ]) {
    assert.match(navigation, new RegExp(`navLabelKey: "${labelKey}"`));
  }
  assert.match(
    shell,
    /navigationItem\.navLabelKey \|\| navigationItem\.labelKey/,
  );
  assert.match(en, /navProfiles: "Profiles"/);
  assert.match(en, /navDevices: "Devices"/);
  assert.match(en, /navConfigHistory: "Config History"/);
});

test("the connection target card opens the connection workspace directly", () => {
  const sidebarSource = readFileSync(
    "frontend/src/components/layout/DashboardSidebar.svelte",
    "utf8",
  );
  const displaySource = readFileSync(
    "frontend/src/domains/connections/presentation/connectionTargetDisplayState.ts",
    "utf8",
  );

  assert.match(
    sidebarSource,
    /<Button[\s\S]*aria-label=\{sidebarConnection\.helpLabel\}[\s\S]*onclick=\{openConnectionEditorAction\}/,
  );
  assert.equal(
    (sidebarSource.match(/onclick=\{openConnectionEditorAction\}/g) || [])
      .length,
    2,
  );
  assert.doesNotMatch(sidebarSource, /sidebarConnection\.openButtonLabel/);
  assert.doesNotMatch(sidebarSource, /ChevronsUpDownIcon/);
  assert.doesNotMatch(displaySource, /openButtonLabel/);
});

test("the connection target card and compact tooltip show current details", () => {
  const sidebarSource = readFileSync(
    "frontend/src/components/layout/DashboardSidebar.svelte",
    "utf8",
  );
  const display = sidebarConnectionPresentation({
    card: {
      host: "192.0.2.1",
      credentialName: "network-admin",
      kind: "saved",
      name: "Edge-Core-1",
      port: 22,
      profile: "cisco_ios",
    },
  });

  assert.equal(display.profileLabel, "cisco_ios");
  assert.equal(display.endpointLabel, "192.0.2.1:22");
  assert.equal(display.contextLabel, "Edge-Core-1");
  assert.equal(
    display.connectionSummaryLabel,
    "Edge-Core-1 · 192.0.2.1:22 · cisco_ios",
  );
  assert.equal("summary" in display, false);
  assert.equal("profile" in display, false);
  assert.equal("statusLabel" in display, false);
  assert.equal("badgeLabel" in display, false);
  assert.equal("showSavedIcon" in display, false);
  assert.equal(
    (sidebarSource.match(/sidebarConnection\.profileLabel/g) || []).length,
    2,
  );
  assert.doesNotMatch(sidebarSource, /sidebarConnection\.statusLabel/);
  assert.doesNotMatch(sidebarSource, /sidebarConnection\.profile\b/);
  assert.doesNotMatch(sidebarSource, /BookmarkIcon|sidebarConnection\.title/);
  assert.match(sidebarSource, /EthernetPortIcon/);
  assert.equal((sidebarSource.match(/EthernetPortIcon/g) || []).length, 2);
  assert.match(
    sidebarSource,
    /aria-label=\{sidebarConnection\.connectionSummaryLabel\}/,
  );
  assert.match(
    sidebarSource,
    /\{sidebarConnection\.endpointLabel\} · \{sidebarConnection\.profileLabel\}/,
  );
  assert.match(
    sidebarSource,
    /\{sidebarConnection\.contextLabel\}[\s\S]*?class="mt-1 inline-flex max-w-full truncate rounded-md bg-accent px-1\.5 py-0\.5 text-\[9px\] font-semibold text-accent-foreground"[\s\S]*?\{sidebarConnection\.profileLabel\}/,
  );
  assert.doesNotMatch(
    sidebarSource.match(
      /\{:else if sidebarConnection\.hasCard\}[\s\S]*?\{:else\}/,
    )?.[0] || "",
    /uppercase/,
  );
});

test("the empty connection target uses compact menu copy", () => {
  const zh = readFileSync("frontend/src/i18n/zh.ts", "utf8");
  const en = readFileSync("frontend/src/i18n/en.ts", "utf8");

  assert.match(zh, /sidebarConnectionHint: "选择连接目标"/);
  assert.match(zh, /sidebarConnectionOptionNone: "未选择连接"/);
  assert.match(zh, /sidebarConnectionNoneHint: "点击选择连接目标"/);
  assert.match(en, /sidebarConnectionHint: "Choose connection target"/);
  assert.match(en, /sidebarConnectionOptionNone: "No connection selected"/);
  assert.match(en, /sidebarConnectionNoneHint: "Click to choose a target"/);
});

test("desktop sidebar collapses to icons and reveals expand over the logo", () => {
  const bodySource = readFileSync(
    "frontend/src/components/layout/DashboardBody.svelte",
    "utf8",
  );
  const sidebarSource = readFileSync(
    "frontend/src/components/layout/DashboardSidebar.svelte",
    "utf8",
  );
  const zhSource = readFileSync("frontend/src/i18n/zh.ts", "utf8");
  const enSource = readFileSync("frontend/src/i18n/en.ts", "utf8");

  assert.match(bodySource, /desktopSidebarCollapsed = \$state\(false\)/);
  assert.match(bodySource, /lg:grid-cols-\[4\.5rem_minmax\(0,1fr\)\]/);
  assert.match(bodySource, /lg:grid-cols-\[11rem_minmax\(0,1fr\)\]/);
  assert.match(bodySource, /class="w-44 p-0 sm:max-w-xs lg:hidden"/);
  assert.match(bodySource, /collapsed=\{desktopSidebarCollapsed\}/);
  assert.match(bodySource, /onCollapsedChange=\{setDesktopSidebarCollapsed\}/);
  assert.match(sidebarSource, /PanelLeftCloseIcon/);
  assert.match(sidebarSource, /PanelLeftOpenIcon/);
  assert.match(sidebarSource, /group-hover\/logo:opacity-0/);
  assert.match(sidebarSource, /group-hover\/logo:opacity-100/);
  assert.match(sidebarSource, /aria-expanded="false"/);
  assert.match(sidebarSource, /aria-expanded="true"/);
  assert.match(sidebarSource, /collapsed \? "w-\[4\.5rem\]/);
  assert.match(sidebarSource, /: "w-44 gap-3 p-3"/);
  assert.match(
    sidebarSource,
    /class="ml-auto shrink-0 border-sidebar-border bg-card shadow-none aria-expanded:bg-card hover:bg-sidebar-border hover:text-foreground hover:aria-expanded:bg-sidebar-border"[\s\S]*?variant="outline"[\s\S]*?size="icon-sm"/,
  );
  assert.match(sidebarSource, /rounded-lg py-1\.5 text-\[13px\]/);
  assert.match(sidebarSource, /"size-3\.5"/);
  assert.match(
    sidebarSource,
    /<Tooltip\.Provider delayDuration=\{100\} skipDelayDuration=\{0\}>/,
  );
  assert.match(sidebarSource, /<Tooltip\.Root disabled=\{!collapsed\}>/);
  assert.match(
    sidebarSource,
    /<Tooltip\.Content side="right" sideOffset=\{8\}>/,
  );
  assert.match(
    sidebarSource,
    /<Tooltip\.Content side="right" sideOffset=\{8\}>\s*\{sidebarExpandLabel\}/,
  );
  assert.match(
    sidebarSource,
    /<Tooltip\.Content side="right" sideOffset=\{8\}>\s*\{sidebarCollapseLabel\}/,
  );
  assert.doesNotMatch(
    sidebarSource,
    /title=\{sidebar(?:Expand|Collapse)Label\}/,
  );
  assert.doesNotMatch(sidebarSource, /title=\{collapsed/);
  assert.match(sidebarSource, /class="[^"]*text-sm font-bold/);
  assert.match(sidebarSource, />\s*Rauto\s*<\/span>/);
  assert.doesNotMatch(
    sidebarSource,
    /sidebarConsoleSubtitle|>RAUTO<|网络自动化控制台/,
  );
  assert.match(zhSource, /sidebarCollapseAria: "收起侧边栏"/);
  assert.match(zhSource, /sidebarExpandAria: "展开侧边栏"/);
  assert.match(enSource, /sidebarCollapseAria: "Collapse sidebar"/);
  assert.match(enSource, /sidebarExpandAria: "Expand sidebar"/);
});

test("desktop dashboard keeps sidebar fixed and scrolls main content", () => {
  const bodySource = readFileSync(
    "frontend/src/components/layout/DashboardBody.svelte",
    "utf8",
  );
  const cssSource = readFileSync("frontend/src/app.css", "utf8");

  assert.match(bodySource, /lg:h-dvh/);
  assert.match(bodySource, /lg:overflow-hidden/);
  assert.match(bodySource, /lg:h-dvh lg:min-h-0/);
  assert.match(bodySource, /lg:overflow-y-auto/);
  assert.match(bodySource, /lg:overscroll-contain/);
  assert.doesNotMatch(bodySource, /min-h-\[calc\(100dvh-6\.5rem\)\]/);
  assert.match(
    cssSource,
    /@media \(min-width: 64rem\)[\s\S]*body\.dashboard-body[\s\S]*height: 100dvh[\s\S]*overflow: hidden/,
  );
  assert.match(
    cssSource,
    /body\.dashboard-body > #app[\s\S]*height: 100%[\s\S]*overflow: hidden/,
  );
  assert.doesNotMatch(cssSource, /\.main-scroll\b/);
});

test("dashboard pages keep one shared breadcrumb without duplicate page titles", () => {
  const bodySource = readFileSync(
    "frontend/src/components/layout/DashboardBody.svelte",
    "utf8",
  );
  const panelSource = readFileSync(
    "frontend/src/components/layout/DashboardTabPanel.svelte",
    "utf8",
  );
  const showPageSource = readFileSync(
    "frontend/src/pages/ShowPage.svelte",
    "utf8",
  );
  assert.match(bodySource, /<nav[\s\S]*breadcrumbAria/);
  assert.match(bodySource, /breadcrumbRootText/);
  assert.match(bodySource, /pageLabelText/);
  assert.doesNotMatch(panelSource, /<h2/);
  assert.doesNotMatch(showPageSource, /控制台<\/span>|<h2/);
});
