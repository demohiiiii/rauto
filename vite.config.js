import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const MODULE_CHUNKS = new Map([
  ["auth.js", "app-core"],
  ["authApi.js", "app-core"],
  ["authRuntime.js", "app-core"],
  ["backup.js", "page-backuppage"],
  ["connectionFieldControls.js", "feature-connections"],
  ["connectionFieldState.js", "feature-connections"],
  ["connectionFieldStoreState.js", "feature-connections"],
  ["connectionFieldWorkspaces.js", "feature-connections"],
  ["connectionFields.js", "feature-connections"],
  ["connectionPanelState.js", "feature-connections"],
  ["connectionTargetDisplayState.js", "feature-connections"],
  ["connectionTargetStoreState.js", "feature-connections"],
  ["connectionsHistory.js", "feature-connections"],
  ["createWebAuthWorkspace.js", "app-core"],
  ["createInventoryPageWorkspace.js", "page-inventorypage"],
  ["inventoryApi.js", "page-inventorypage"],
  ["inventoryPresentation.js", "page-inventorypage"],
  ["inventoryRuntime.js", "page-inventorypage"],
  ["inventory.js", "page-inventorypage"],
  ["orchestrationActionDisplays.js", "feature-orchestrated"],
  ["orchestrationEditors.js", "feature-orchestrated"],
  ["orchestrationFormDisplays.js", "feature-orchestrated"],
  ["orchestrationFormDisplayState.js", "feature-orchestrated"],
  ["orchestrationTargetDisplayState.js", "feature-orchestrated"],
  ["orchestrationPanelWorkspaces.js", "feature-orchestrated"],
  ["orchestrationResults.js", "feature-orchestrated"],
  ["orchestrationStages.js", "feature-orchestrated"],
  ["profilePanelEditorState.js", "feature-prompts"],
  ["profilePanelState.js", "feature-prompts"],
  ["profilesCustomEditor.js", "feature-prompts"],
  ["profilesWorkspace.js", "feature-prompts"],
  ["replay.js", "page-replaypage"],
  ["show.js", "page-showpage"],
  ["createShowWorkspaces.js", "page-showpage"],
  ["showApi.js", "page-showpage"],
  ["showExecutionState.js", "page-showpage"],
  ["showPresentation.js", "page-showpage"],
  ["showQueries.js", "page-showpage"],
  ["createTasksPageWorkspace.js", "page-taskspage"],
  ["tasksApi.js", "page-taskspage"],
  ["tasksPresentation.js", "page-taskspage"],
  ["tasks.js", "page-taskspage"],
  ["templates.js", "feature-templates"],
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
  ["webAuthPresentation.js", "app-core"],
]);

const PAGE_SUPPORT_FOLDER_CHUNKS = new Map([
  ["inventory", "page-inventorypage"],
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
    .replace(/\.(js|ts|svelte|css)$/, "")
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

function domainComponentChunkName(id, domain, prefix) {
  const sourcePath = `domains/${domain}/presentation/components/`;
  const group = sourceFolderName(id, sourcePath);
  return `${prefix}-${group || "shared"}`;
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
  if (matchesSourcePath(id, "domains/dashboard/")) {
    return "dashboard-shell-core";
  }
  if (matchesSourcePath(id, "domains/schedules/")) {
    return "page-schedulespage";
  }
  if (matchesSourcePath(id, "domains/auth/")) return "app-core";
  if (matchesSourcePath(id, "domains/command/")) return "feature-command";
  if (matchesSourcePath(id, "domains/connections/")) {
    return "dashboard-connections";
  }
  if (matchesSourcePath(id, "domains/execution/")) return "feature-results";
  if (matchesSourcePath(id, "domains/overlays/")) return "dashboard-overlays";
  if (matchesSourcePath(id, "domains/orchestration/presentation/components/")) {
    return domainComponentChunkName(
      id,
      "orchestration",
      "feature-orchestration",
    );
  }
  if (matchesSourcePath(id, "domains/orchestration/")) {
    return "feature-orchestrated";
  }
  if (matchesSourcePath(id, "domains/profiles/")) return "feature-prompts";
  if (matchesSourcePath(id, "domains/show/")) return "page-showpage";
  if (matchesSourcePath(id, "domains/standard/")) return "feature-standard";
  if (matchesSourcePath(id, "domains/templates/")) return "feature-templates";
  if (matchesSourcePath(id, "domains/transactions/presentation/components/")) {
    return domainComponentChunkName(id, "transactions", "feature-transactions");
  }
  if (matchesSourcePath(id, "domains/transactions/")) {
    return "feature-orchestrated";
  }
  if (matchesSourcePath(id, "modules/")) {
    const file = sourceFileName(id, "modules/");
    return MODULE_CHUNKS.get(file) || "dashboard-shell";
  }
  if (matchesSourcePath(id, "components/")) {
    const folder = sourceFolderName(id, "components/");
    const file = sourceFileName(id, "components/");
    if (folder === "fragments" && file === "ParsedOutputBlock.svelte") {
      return "feature-results";
    }
    if (folder === "connections") return "dashboard-connections-ui";
    if (folder === "command-flow") return "feature-command";
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
  plugins: [
    tailwindcss(),
    svelte({
      configFile: fileURLToPath(new URL("./svelte.config.js", import.meta.url)),
    }),
  ],
  resolve: {
    alias: {
      $api: fileURLToPath(new URL("./frontend/src/api", import.meta.url)),
      $components: fileURLToPath(
        new URL("./frontend/src/components", import.meta.url),
      ),
      $config: fileURLToPath(new URL("./frontend/src/config", import.meta.url)),
      $domains: fileURLToPath(
        new URL("./frontend/src/domains", import.meta.url),
      ),
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
