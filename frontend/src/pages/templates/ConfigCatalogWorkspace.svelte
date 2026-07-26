<script>
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { RefreshCwIcon, Trash2Icon } from "@lucide/svelte";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import {
    addConfigVolatilePattern,
    deleteConfigCommand,
    listConfigCommands,
    listConfigVolatilePatterns,
    removeConfigVolatilePattern,
    upsertConfigCommand,
  } from "../../api/client.js";
  import { browserConfirm } from "../../lib/browser.js";
  import { currentLanguageState, t } from "../../lib/i18n.js";
  import { showToast } from "../../modules/overlays/overlays.js";

  let { definition } = $props();
  let currentLanguage = $derived($currentLanguageState);
  let labels = $derived.by(() => {
    currentLanguage;
    return {
      title: t(definition.labelKey),
      description: t(definition.descriptionKey),
      profile: t("templateManagerProfileLabel"),
      kind: t("configCatalogKindLabel"),
      mode: t("templateManagerModeLabel"),
      command: t("fieldCommand"),
      source: t("configCatalogSourceLabel"),
      pattern: t("configCatalogPatternLabel"),
      commandsTitle: t("configCatalogCommandsTitle"),
      volatileTitle: t("configCatalogVolatileTitle"),
      volatileHint: t("configCatalogVolatileHint"),
      saveOverride: t("configCatalogAddOverrideBtn"),
      addPattern: t("configCatalogAddPatternBtn"),
      refresh: t("blacklistRefreshBtn"),
      delete: t("templateDeleteBtn"),
      deleteConfirm: t("configCatalogDeleteConfirm"),
      requestFailed: t("requestFailed"),
    };
  });

  let profileFilter = $state("");
  let commands = $state([]);
  let patterns = $state([]);
  let loading = $state(false);
  let savingCommand = $state(false);
  let savingPattern = $state(false);
  let commandForm = $state({
    profile: "",
    kind: "running",
    command: "",
    mode: "",
  });
  let patternForm = $state({ profile: "", pattern: "" });
  let loaded = false;

  export async function load() {
    loading = true;
    try {
      const [commandRows, patternRows] = await Promise.all([
        listConfigCommands(profileFilter.trim()),
        listConfigVolatilePatterns(profileFilter.trim()),
      ]);
      commands = Array.isArray(commandRows) ? commandRows : [];
      patterns = Array.isArray(patternRows) ? patternRows : [];
    } catch (error) {
      showToast(`${labels.requestFailed}: ${error.message}`, "error");
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (loaded) return;
    loaded = true;
    void load();
  });

  async function saveCommandOverride() {
    savingCommand = true;
    try {
      await upsertConfigCommand({
        device_profile: commandForm.profile.trim(),
        kind: commandForm.kind.trim(),
        command: commandForm.command.trim(),
        mode: commandForm.mode.trim() || null,
      });
      commandForm = { profile: "", kind: "running", command: "", mode: "" };
      await load();
    } catch (error) {
      showToast(`${labels.requestFailed}: ${error.message}`, "error");
    } finally {
      savingCommand = false;
    }
  }

  async function removeCommandOverride(row) {
    if (!browserConfirm(labels.deleteConfirm)) return;
    try {
      await deleteConfigCommand({
        device_profile: row.device_profile,
        kind: row.kind,
      });
      await load();
    } catch (error) {
      showToast(`${labels.requestFailed}: ${error.message}`, "error");
    }
  }

  async function savePattern() {
    savingPattern = true;
    try {
      await addConfigVolatilePattern({
        device_profile: patternForm.profile.trim(),
        pattern: patternForm.pattern,
      });
      patternForm = { profile: "", pattern: "" };
      await load();
    } catch (error) {
      showToast(`${labels.requestFailed}: ${error.message}`, "error");
    } finally {
      savingPattern = false;
    }
  }

  async function removePattern(row) {
    if (!browserConfirm(labels.deleteConfirm)) return;
    try {
      await removeConfigVolatilePattern({
        device_profile: row.device_profile,
        pattern: row.pattern,
      });
      await load();
    } catch (error) {
      showToast(`${labels.requestFailed}: ${error.message}`, "error");
    }
  }
</script>

<div class="grid gap-4">
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <h3 class="text-base font-semibold text-foreground">{labels.title}</h3>
      <p class="text-sm text-muted-foreground">{labels.description}</p>
    </div>
    <div class="flex items-center gap-2">
      <Input
        class="h-9 w-48"
        placeholder={labels.profile}
        value={profileFilter}
        oninput={(event) => (profileFilter = event.currentTarget.value)}
      />
      <LoadingButton size="sm" variant="outline" {loading} onclick={load}>
        <RefreshCwIcon aria-hidden="true" />
        <span>{labels.refresh}</span>
      </LoadingButton>
    </div>
  </div>

  <Card.Root class="gap-0 overflow-hidden border-border/80 py-0">
    <Card.Content class="grid gap-3 p-4">
      <h4 class="text-sm font-medium text-foreground">
        {labels.commandsTitle}
      </h4>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[560px] text-left text-sm">
          <thead class="text-xs text-muted-foreground">
            <tr>
              <th class="py-1 pr-3">{labels.profile}</th>
              <th class="py-1 pr-3">{labels.kind}</th>
              <th class="py-1 pr-3">{labels.mode}</th>
              <th class="py-1 pr-3">{labels.source}</th>
              <th class="py-1 pr-3">{labels.command}</th>
              <th class="py-1"></th>
            </tr>
          </thead>
          <tbody>
            {#each commands as row (`${row.device_profile}|${row.kind}`)}
              <tr class="border-t border-border/60">
                <td class="py-1.5 pr-3">{row.device_profile}</td>
                <td class="py-1.5 pr-3">{row.kind}</td>
                <td class="py-1.5 pr-3">{row.mode || "-"}</td>
                <td class="py-1.5 pr-3">
                  <Badge
                    variant={row.source === "custom" ? "default" : "secondary"}
                  >
                    {row.source}
                  </Badge>
                </td>
                <td class="py-1.5 pr-3 font-mono text-xs">{row.command}</td>
                <td class="py-1.5 text-right">
                  {#if row.source === "custom"}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={labels.delete}
                      onclick={() => removeCommandOverride(row)}
                    >
                      <Trash2Icon aria-hidden="true" />
                    </Button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="grid gap-2 md:grid-cols-[1fr_120px_1fr_120px_auto]">
        <Input
          placeholder={labels.profile}
          value={commandForm.profile}
          oninput={(event) => (commandForm.profile = event.currentTarget.value)}
        />
        <Input
          placeholder={labels.kind}
          value={commandForm.kind}
          oninput={(event) => (commandForm.kind = event.currentTarget.value)}
        />
        <Input
          placeholder={labels.command}
          value={commandForm.command}
          oninput={(event) => (commandForm.command = event.currentTarget.value)}
        />
        <Input
          placeholder={labels.mode}
          value={commandForm.mode}
          oninput={(event) => (commandForm.mode = event.currentTarget.value)}
        />
        <LoadingButton
          loading={savingCommand}
          disabled={!commandForm.profile.trim() ||
            !commandForm.kind.trim() ||
            !commandForm.command.trim()}
          onclick={saveCommandOverride}
        >
          <span>{labels.saveOverride}</span>
        </LoadingButton>
      </div>
    </Card.Content>
  </Card.Root>

  <Card.Root class="gap-0 overflow-hidden border-border/80 py-0">
    <Card.Content class="grid gap-3 p-4">
      <div>
        <h4 class="text-sm font-medium text-foreground">
          {labels.volatileTitle}
        </h4>
        <p class="text-xs text-muted-foreground">{labels.volatileHint}</p>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[480px] text-left text-sm">
          <thead class="text-xs text-muted-foreground">
            <tr>
              <th class="py-1 pr-3">{labels.profile}</th>
              <th class="py-1 pr-3">{labels.source}</th>
              <th class="py-1 pr-3">{labels.pattern}</th>
              <th class="py-1"></th>
            </tr>
          </thead>
          <tbody>
            {#each patterns as row (`${row.device_profile}|${row.pattern}`)}
              <tr class="border-t border-border/60">
                <td class="py-1.5 pr-3">{row.device_profile}</td>
                <td class="py-1.5 pr-3">
                  <Badge
                    variant={row.source === "custom" ? "default" : "secondary"}
                  >
                    {row.source}
                  </Badge>
                </td>
                <td class="py-1.5 pr-3 font-mono text-xs">{row.pattern}</td>
                <td class="py-1.5 text-right">
                  {#if row.source === "custom"}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={labels.delete}
                      onclick={() => removePattern(row)}
                    >
                      <Trash2Icon aria-hidden="true" />
                    </Button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="grid gap-2 md:grid-cols-[220px_1fr_auto]">
        <Input
          placeholder={labels.profile}
          value={patternForm.profile}
          oninput={(event) => (patternForm.profile = event.currentTarget.value)}
        />
        <Input
          placeholder={labels.pattern}
          value={patternForm.pattern}
          oninput={(event) => (patternForm.pattern = event.currentTarget.value)}
        />
        <LoadingButton
          loading={savingPattern}
          disabled={!patternForm.profile.trim() || !patternForm.pattern.trim()}
          onclick={savePattern}
        >
          <span>{labels.addPattern}</span>
        </LoadingButton>
      </div>
    </Card.Content>
  </Card.Root>
</div>
