import { tick } from "svelte";
import { initDashboardRouter } from "../router/dashboardRouter.js";
import { installGlobalStateRuntime } from "./globalStateRuntime.js";
import { installI18nRuntime } from "./i18nRuntime.js";
import { installDashboardViewRuntime } from "./dashboardViewRuntime.js";
import {
  applyDashboardBodyShell,
  applyInitialTheme,
  isDashboardRuntimeBootstrapped,
  markDashboardRuntimeBootstrapped,
} from "./dashboardRuntime.js";

async function installDashboardRuntimeAdapters() {
  const [
    { installApiRuntime },
    { installRuntimeUtils },
    { installRenderCommonRuntime },
    { installRenderRuntime },
    { installRenderOrchestrationRuntime },
    { installUiSharedRuntime },
    { installUiLayoutRuntime },
    { installUiInteractionRuntime },
    { installI18nApplyRuntime },
    { installConnectionsRuntime },
    { installProfilesRuntime },
    { bootstrapDashboardRuntime },
  ] = await Promise.all([
    import("./apiRuntime.js"),
    import("./runtimeUtils.js"),
    import("./renderCommonRuntime.js"),
    import("./renderRuntime.js"),
    import("./renderOrchestrationRuntime.js"),
    import("./uiSharedRuntime.js"),
    import("./uiLayoutRuntime.js"),
    import("./uiInteractionRuntime.js"),
    import("./i18nApplyRuntime.js"),
    import("./connectionsRuntime.js"),
    import("./profilesRuntime.js"),
    import("./bootstrapDashboardRuntime.js"),
  ]);

  installApiRuntime();
  installRuntimeUtils();
  installRenderCommonRuntime();
  installRenderRuntime();
  installRenderOrchestrationRuntime();
  installUiSharedRuntime();
  installUiLayoutRuntime();
  installUiInteractionRuntime();
  installI18nApplyRuntime();
  installConnectionsRuntime();
  installProfilesRuntime();
  return bootstrapDashboardRuntime;
}

export async function bootstrapDashboardApp() {
  if (isDashboardRuntimeBootstrapped()) {
    return null;
  }

  document.documentElement.lang = "en";
  document.title = "rauto web";
  applyDashboardBodyShell();
  applyInitialTheme();
  installGlobalStateRuntime();
  installI18nRuntime();
  installDashboardViewRuntime();
  await tick();

  const bootstrapDashboardRuntime = await installDashboardRuntimeAdapters();
  bootstrapDashboardRuntime();
  const destroyDashboardRouter = initDashboardRouter();
  markDashboardRuntimeBootstrapped();
  return destroyDashboardRouter;
}
