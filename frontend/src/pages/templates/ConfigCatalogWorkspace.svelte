<script>
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { RefreshCwIcon, Trash2Icon } from "@lucide/svelte";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import PlainSelectField from "../../components/fragments/PlainSelectField.svelte";
  import {
    addConfigVolatilePattern,
    deleteConfigCommand,
    getDeviceProfilesOverview,
    getProfileModes,
    listConfigCommands,
    listConfigVolatilePatterns,
    removeConfigVolatilePattern,
    upsertConfigCommand,
  } from "../../api/client.js";
  import { browserConfirm } from "../../lib/browser.js";
  import { currentLanguageState, t } from "../../lib/i18n.js";
  import { showToast } from "../../modules/overlays/overlays.js";
  import {
    configCatalogKindNames,
    profileModeNames,
    profileNamesFromOverview,
  } from "../../modules/templates/templateManagerState.js";

  const PROFILE_DEFAULT_MODE = "__profile_default__";

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
      modeDefault: t("templateManagerModeDefault"),
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
  let profiles = $state([]);
  let profileModes = $state([]);
  let loading = $state(false);
  let loadingModes = $state(false);
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
  let modeRequestSequence = 0;
  let profileOptions = $derived(
    profiles.map((profile) => ({
      optionValue: profile,
      optionLabel: profile,
    })),
  );
  let kindOptions = $derived(
    configCatalogKindNames(commands).map((kind) => ({
      optionValue: kind,
      optionLabel: kind,
    })),
  );
  let modeOptions = $derived([
    {
      optionValue: PROFILE_DEFAULT_MODE,
      optionLabel: labels.modeDefault,
    },
    ...profileModes.map((mode) => ({
      optionValue: mode,
      optionLabel: mode,
    })),
  ]);

  async function loadCommandProfileModes(profile) {
    const normalizedProfile = profile.trim();
    const requestSequence = ++modeRequestSequence;
    profileModes = [];
    if (!normalizedProfile) {
      loadingModes = false;
      return;
    }
    loadingModes = true;
    try {
      const payload = await getProfileModes(normalizedProfile);
      if (requestSequence !== modeRequestSequence) return;
      profileModes = profileModeNames(payload);
      if (commandForm.mode && !profileModes.includes(commandForm.mode)) {
        commandForm.mode = "";
      }
    } catch (error) {
      if (requestSequence !== modeRequestSequence) return;
      showToast(`${labels.requestFailed}: ${error.message}`, "error");
    } finally {
      if (requestSequence === modeRequestSequence) loadingModes = false;
    }
  }

  function selectCommandProfile(profile) {
    commandForm.profile = profile;
    commandForm.mode = "";
    void loadCommandProfileModes(profile);
  }

  export async function load() {
    loading = true;
    try {
      const [commandRows, patternRows, profilePayload] = await Promise.all([
        listConfigCommands(profileFilter.trim()),
        listConfigVolatilePatterns(profileFilter.trim()),
        getDeviceProfilesOverview(),
      ]);
      commands = Array.isArray(commandRows) ? commandRows : [];
      patterns = Array.isArray(patternRows) ? patternRows : [];
      profiles = profileNamesFromOverview(profilePayload);
      if (!profiles.includes(commandForm.profile)) {
        commandForm.profile = profiles[0] || "";
        commandForm.mode = "";
      }
      await loadCommandProfileModes(commandForm.profile);
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
      commandForm.command = "";
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
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div class="flex min-w-0 flex-col gap-2">
          <Label>{labels.profile}</Label>
          <PlainSelectField
            value={commandForm.profile}
            optionRows={profileOptions}
            title={labels.profile}
            aria-label={labels.profile}
            disabled={loading || !profileOptions.length}
            onValueChange={selectCommandProfile}
          />
        </div>
        <div class="flex min-w-0 flex-col gap-2">
          <Label>{labels.kind}</Label>
          <PlainSelectField
            value={commandForm.kind}
            optionRows={kindOptions}
            title={labels.kind}
            aria-label={labels.kind}
            disabled={loading || !kindOptions.length}
            onValueChange={(kind) => (commandForm.kind = kind)}
          />
        </div>
        <div class="flex min-w-0 flex-col gap-2">
          <Label>{labels.mode}</Label>
          <PlainSelectField
            value={commandForm.mode || PROFILE_DEFAULT_MODE}
            optionRows={modeOptions}
            title={labels.mode}
            aria-label={labels.mode}
            disabled={loadingModes || !commandForm.profile}
            onValueChange={(mode) =>
              (commandForm.mode = mode === PROFILE_DEFAULT_MODE ? "" : mode)}
          />
        </div>
        <div class="flex min-w-0 flex-col gap-2 md:col-span-2 xl:col-span-1">
          <Label for="config-catalog-command">{labels.command}</Label>
          <Input
            id="config-catalog-command"
            class="font-mono"
            placeholder={labels.command}
            value={commandForm.command}
            oninput={(event) =>
              (commandForm.command = event.currentTarget.value)}
          />
        </div>
        <div class="flex justify-end md:col-span-2 xl:col-span-4">
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
