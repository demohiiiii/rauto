import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const MODULE_CHUNKS = new Map([
  ["backup.js", "page-backuppage"],
  ["blacklist.js", "page-blacklistpage"],
  ["connectionFieldControls.js", "feature-connections"],
  ["connectionFieldState.js", "feature-connections"],
  ["connectionFieldStoreState.js", "feature-connections"],
  ["connectionFieldWorkspaces.js", "feature-connections"],
  ["connectionFields.js", "feature-connections"],
  ["connectionPanelFormState.js", "feature-connections"],
  ["connectionPanelState.js", "feature-connections"],
  ["connectionTargetDisplayState.js", "feature-connections"],
  ["connectionTargetRuntimeState.js", "feature-connections"],
  ["connectionTargetStoreState.js", "feature-connections"],
  ["connectionsEditor.js", "feature-connections"],
  ["connectionsHistory.js", "feature-connections"],
  ["inventoryCollectionStoreState.js", "page-inventorypage"],
  ["inventoryCollectionWorkspaces.js", "page-inventorypage"],
  ["inventoryCollectionState.js", "page-inventorypage"],
  ["inventory.js", "page-inventorypage"],
  ["inventoryPageWorkspace.js", "page-inventorypage"],
  ["inventoryCollections.js", "page-inventorypage"],
  ["orchestrationActionDisplays.js", "feature-orchestrated"],
  ["orchestrationActionDisplayState.js", "feature-orchestrated"],
  ["orchestrationEditors.js", "feature-orchestrated"],
  ["orchestrationEditorState.js", "feature-orchestrated"],
  ["orchestrationEditorSourceState.js", "feature-orchestrated"],
  ["orchestrationFormDisplays.js", "feature-orchestrated"],
  ["orchestrationFormDisplayState.js", "feature-orchestrated"],
  ["orchestrationFormFieldState.js", "feature-orchestrated"],
  ["orchestrationFormStructureState.js", "feature-orchestrated"],
  ["orchestrationPlanFormModels.js", "feature-orchestrated"],
  ["orchestrationFormState.js", "feature-orchestrated"],
  ["orchestrationTargetFormModels.js", "feature-orchestrated"],
  ["orchestrationInventory.js", "feature-orchestrated"],
  ["orchestrationInventoryDefaultsState.js", "feature-orchestrated"],
  ["orchestrationInventoryDisplayState.js", "feature-orchestrated"],
  ["orchestrationInventoryGroupsState.js", "feature-orchestrated"],
  ["orchestrationInventoryTargets.js", "feature-orchestrated"],
  ["orchestratedExecutionState.js", "feature-orchestrated"],
  ["orchestratedWorkspace.js", "feature-orchestrated"],
  ["orchestrationPanelWorkspaces.js", "feature-orchestrated"],
  ["orchestrationPanelState.js", "feature-orchestrated"],
  ["orchestrationResults.js", "feature-orchestrated"],
  ["orchestrationResultDetailState.js", "feature-orchestrated"],
  ["orchestrationResultDisplayState.js", "feature-orchestrated"],
  ["orchestrationResultPreviewState.js", "feature-orchestrated"],
  ["orchestrationResultState.js", "feature-orchestrated"],
  ["orchestrationStageEditorsState.js", "feature-orchestrated"],
  ["orchestrationStageMutations.js", "feature-orchestrated"],
  ["orchestrationStageTargetsState.js", "feature-orchestrated"],
  ["orchestrationStages.js", "feature-orchestrated"],
  ["orchestrationTxBlockActionEditors.js", "feature-orchestrated"],
  ["orchestrationTxBlockActionMutations.js", "feature-orchestrated"],
  ["orchestrationTxWorkflowActions.js", "feature-orchestrated"],
  ["profiles.js", "feature-prompts"],
  ["profilePanelChildWorkspaces.js", "feature-prompts"],
  ["profilePanelEditorState.js", "feature-prompts"],
  ["profilePanelState.js", "feature-prompts"],
  ["promptProfileExecutionState.js", "feature-prompts"],
  ["promptProfileState.js", "feature-prompts"],
  ["profilesCustomEditor.js", "feature-prompts"],
  ["profilesCustomFormState.js", "feature-prompts"],
  ["profilesCustomEditorState.js", "feature-prompts"],
  ["profilesListState.js", "feature-prompts"],
  ["profilesEditorState.js", "feature-prompts"],
  ["profilesDiagnostics.js", "feature-prompts"],
  ["profilesWorkspace.js", "feature-prompts"],
  ["replay.js", "page-replaypage"],
  ["results.js", "feature-results"],
  ["dashboardAppState.js", "feature-dashboard-shell"],
  ["show.js", "page-showpage"],
  ["showQueryState.js", "page-showpage"],
  ["showQueryWorkspaces.js", "page-showpage"],
  ["showQueries.js", "page-showpage"],
  ["standard.js", "feature-standard"],
  ["standardExecutionState.js", "feature-standard"],
  ["standardExecutionWorkspaces.js", "feature-standard"],
  ["tasksDisplayState.js", "page-taskspage"],
  ["tasks.js", "page-taskspage"],
  ["tasksState.js", "page-taskspage"],
  ["templates.js", "feature-templates"],
  ["templatesFlowDisplayState.js", "feature-templates"],
  ["templatesFlowRuntimeState.js", "feature-templates"],
  ["templateManagerState.js", "feature-templates"],
  ["templatesShowObjects.js", "feature-templates"],
  ["transactionBlockBindings.js", "feature-orchestrated"],
  ["transactionBlockMutations.js", "feature-orchestrated"],
  ["transactionBlockBindingState.js", "feature-orchestrated"],
  ["transactionBlockFormModels.js", "feature-orchestrated"],
  ["transactionBlockDisplayState.js", "feature-orchestrated"],
  ["transactionBlockDisplays.js", "feature-orchestrated"],
  ["transactionExecutionDisplays.js", "feature-orchestrated"],
  ["transactionInputWorkspaces.js", "feature-orchestrated"],
  ["transactionInputState.js", "feature-orchestrated"],
  ["transactionJsonEditorState.js", "feature-orchestrated"],
  ["transactionJsonTemplateState.js", "feature-orchestrated"],
  ["transactionBlockTemplateDisplayState.js", "feature-orchestrated"],
  ["transactionBlockTemplateDisplays.js", "feature-orchestrated"],
  ["transactionBlockTemplateBindings.js", "feature-orchestrated"],
  ["transactionBlockTemplateEditorState.js", "feature-orchestrated"],
  ["transactionBlockTemplateMutations.js", "feature-orchestrated"],
  ["transactionBlockTemplateState.js", "feature-orchestrated"],
  ["transactionMetadataFields.js", "feature-orchestrated"],
  ["transactionPanelState.js", "feature-orchestrated"],
  ["transactionStructure.js", "feature-orchestrated"],
  ["transactionVarsAssistant.js", "feature-orchestrated"],
  ["transactionWorkflowEditorState.js", "feature-orchestrated"],
  ["transactionWorkflowEditors.js", "feature-orchestrated"],
  ["transactionWorkflowFormModels.js", "feature-orchestrated"],
  ["transfer.js", "page-transferpage"],
]);

const PAGE_SUPPORT_FOLDER_CHUNKS = new Map([
  ["inventory", "page-inventorypage"],
  ["orchestrated", "page-orchestratedpage"],
  ["prompts", "page-promptspage"],
  ["replay", "page-replaypage"],
  ["show", "page-showpage"],
  ["standard", "page-standardpage"],
  ["tasks", "page-taskspage"],
  ["templates", "page-templatespage"],
]);

function chunkNameFromPath(id, marker, prefix) {
  const [, tail = "index"] = id.split(marker);
  const name = tail
    .replace(/\.(js|svelte|css)$/, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `${prefix}-${name || "index"}`;
}

function matchesSourcePath(id, sourcePath) {
  return (
    id.includes(`/frontend/src/${sourcePath}`) ||
    id.includes(`/src/${sourcePath}`)
  );
}

function chunkNameFromSourcePath(id, sourcePath, prefix) {
  const marker = id.includes(`/frontend/src/${sourcePath}`)
    ? `/frontend/src/${sourcePath}`
    : `/src/${sourcePath}`;
  return chunkNameFromPath(id, marker, prefix);
}

function sourceFolderName(id, sourcePath) {
  const marker = id.includes(`/frontend/src/${sourcePath}`)
    ? `/frontend/src/${sourcePath}`
    : `/src/${sourcePath}`;
  const [, tail = ""] = id.split(marker);
  return tail.split("/").filter(Boolean)[0] || "";
}

function sourceFileName(id, sourcePath) {
  const marker = id.includes(`/frontend/src/${sourcePath}`)
    ? `/frontend/src/${sourcePath}`
    : `/src/${sourcePath}`;
  const [, tail = ""] = id.split(marker);
  return tail.split("/").filter(Boolean).pop() || "";
}

function pageChunkName(id) {
  const pageFile = sourceFileName(id, "pages/");
  const folder = sourceFolderName(id, "pages/");
  if (
    pageFile ===
    `${folder.charAt(0).toUpperCase()}${folder.slice(1)}Page.svelte`
  ) {
    return PAGE_SUPPORT_FOLDER_CHUNKS.get(folder);
  }
  if (
    PAGE_SUPPORT_FOLDER_CHUNKS.has(folder) &&
    pageFile === `${folder}.svelte`
  ) {
    return PAGE_SUPPORT_FOLDER_CHUNKS.get(folder);
  }
  return chunkNameFromSourcePath(id, "pages/", "page");
}

function dashboardChunk(id) {
  if (id.startsWith("\0")) {
    return "app-core";
  }
  if (id.includes("/node_modules/")) {
    if (id.includes("/node_modules/svelte/")) return "vendor-svelte";
    return undefined;
  }
  if (matchesSourcePath(id, "i18n/")) return "i18n";
  if (matchesSourcePath(id, "api/")) return "app-api";
  if (matchesSourcePath(id, "config/")) return "app-core";
  if (matchesSourcePath(id, "modules/")) {
    const file = sourceFileName(id, "modules/");
    if (file === "connections.js") return "dashboard-connections";
    if (file === "overlays.js") return "dashboard-overlays";
    if (file === "overlaysDetail.js") return "dashboard-overlays";
    if (file === "dashboardApp.js") return "dashboard-shell-core";
    if (file === "dashboardOverlays.js") return "dashboard-shell-core";
    if (file === "dashboardShell.js") return "dashboard-shell-core";
    return MODULE_CHUNKS.get(file) || "dashboard-shell";
  }
  if (matchesSourcePath(id, "components/")) {
    const folder = sourceFolderName(id, "components/");
    const file = sourceFileName(id, "components/");
    if (folder === "fragments" && file === "ParsedOutputBlock.svelte") {
      return "feature-results";
    }
    if (folder === "connections") return "dashboard-connections-ui";
    if (folder === "overlays") return "dashboard-overlays-ui";
    if (folder === "layout") return "dashboard-layout";
    if (folder === "fragments") return "dashboard-fragments";
    if (
      !folder ||
      folder.endsWith(".svelte") ||
      folder.endsWith(".js") ||
      ["connections", "fragments", "layout", "overlays"].includes(folder)
    ) {
      return "dashboard-shell";
    }
    return undefined;
  }
  if (matchesSourcePath(id, "pages/")) {
    return pageChunkName(id);
  }
  if (matchesSourcePath(id, "lib/")) return "lib";
  return undefined;
}

function dashboardModulePreloadDependencies(_, deps, context) {
  if (context.hostType !== "html") {
    return deps;
  }
  return deps.filter(
    (dep) => !dep.includes("/page-") && !dep.includes("/feature-"),
  );
}

export default defineConfig(({ command, isPreview }) => ({
  root: "frontend",
  base: command === "build" || isPreview ? "/static/" : "/",
  plugins: [tailwindcss(), svelte()],
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL("./frontend/src/lib", import.meta.url)),
    },
  },
  build: {
    modulePreload: {
      resolveDependencies: dashboardModulePreloadDependencies,
    },
    outDir: "../static",
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        manualChunks: dashboardChunk,
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
}));
