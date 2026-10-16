<script lang="ts">
  import type { ComponentProps } from "svelte";
  import ActivityIcon from "@lucide/svelte/icons/activity";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import RotateCwIcon from "@lucide/svelte/icons/rotate-cw";
  import TimerIcon from "@lucide/svelte/icons/timer";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import { cn } from "$lib/utils.js";
  import { connectionSession } from "../../application/connectionSessionState.js";
  import { validHeartbeatInterval } from "../../model/connectionSession.js";

  const { state: sessionState } = connectionSession;
  const presets = [15, 30, 60, 120];
  let interval = $state<string | number | undefined>(30);
  let settingsOpen = $state(false);
  let invalid = $derived(!validHeartbeatInterval(Number(interval)));
  let enabled = $derived($sessionState.keepAlive.enabled);
  let labels = $derived.by(() => {
    $currentLanguageState;
    return {
      keepAlive: t("connectionKeepAlive"),
      heartbeat: t("connectionHeartbeat"),
      heartbeatShort: t("connectionHeartbeatShort"),
      seconds: t("connectionHeartbeatSeconds"),
      hint: t("connectionKeepAliveHint"),
      invalid: t("connectionHeartbeatInvalid"),
      custom: t("connectionHeartbeatCustom"),
      apply: t("connectionHeartbeatApply"),
      reconnect: t("connectionReconnect"),
    };
  });

  function openSettings(open: boolean) {
    settingsOpen = open;
    if (open) interval = $sessionState.keepAlive.interval_secs;
  }

  function saveInterval(value = Number(interval)) {
    if (!enabled || !validHeartbeatInterval(value)) return;
    void connectionSession.setHeartbeatInterval(value);
    settingsOpen = false;
  }
</script>

<div class="min-w-0 w-full sm:w-auto">
  <div class="flex items-center gap-2">
    <div
      class={cn(
        "flex h-10 min-w-0 flex-1 items-center rounded-xl border bg-background p-1 shadow-xs transition-colors duration-200 motion-reduce:transition-none sm:flex-none",
        enabled ? "border-primary/20" : "border-border",
      )}
    >
      <div
        class={cn(
          "flex h-8 shrink-0 items-center gap-2 rounded-lg px-2.5 transition-colors duration-200 motion-reduce:transition-none",
          enabled ? "bg-primary/7" : "bg-muted/40",
        )}
        title={labels.hint}
      >
        <ActivityIcon
          class={cn(
            "size-3.5 transition-colors duration-200 motion-reduce:transition-none",
            enabled ? "text-primary" : "text-muted-foreground",
          )}
          aria-hidden="true"
        />
        <Label
          for="connection-keep-alive"
          class="cursor-pointer text-xs font-medium"
        >
          {labels.keepAlive}
        </Label>
        <Switch
          id="connection-keep-alive"
          size="sm"
          class="ml-1 motion-reduce:transition-none [&_[data-slot=switch-thumb]]:motion-reduce:transition-none"
          checked={enabled}
          onCheckedChange={(checked) => {
            if (!checked) settingsOpen = false;
            void connectionSession.setKeepAlive(checked);
          }}
        />
      </div>

      <div class="mx-1 h-4 w-px shrink-0 bg-border/70" aria-hidden="true"></div>

      <Popover.Root open={settingsOpen} onOpenChange={openSettings}>
        <Popover.Trigger>
          {#snippet child({ props }: { props: ComponentProps<typeof Button> })}
            <Button
              {...props}
              id="connection-heartbeat-trigger"
              type="button"
              variant="ghost"
              class="h-8 min-w-0 flex-1 gap-2 rounded-lg px-2 text-xs transition-colors duration-150 motion-reduce:transition-none sm:flex-none"
              disabled={!enabled}
              aria-label={`${labels.heartbeat}: ${$sessionState.keepAlive.interval_secs} ${labels.seconds}`}
            >
              <TimerIcon
                class="size-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              <span class="hidden text-muted-foreground min-[400px]:inline"
                >{labels.heartbeatShort}</span
              >
              <span class="ml-1 inline-flex items-baseline gap-1">
                <span class="font-mono text-[13px] font-semibold tabular-nums"
                  >{$sessionState.keepAlive.interval_secs}</span
                >
                <span class="text-[10px] text-muted-foreground"
                  >{labels.seconds}</span
                >
              </span>
              <ChevronDownIcon
                class={cn(
                  "ml-1 size-3 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
                  settingsOpen && "rotate-180",
                )}
                aria-hidden="true"
              />
            </Button>
          {/snippet}
        </Popover.Trigger>
        <Popover.Content
          align="end"
          sideOffset={10}
          class="w-72 max-w-[calc(100vw-2rem)] gap-4 rounded-2xl border border-border bg-popover p-4 shadow-xl ring-0 motion-reduce:animate-none"
          aria-label={labels.heartbeat}
          onkeydown={(event) => {
            if (event.key !== "Escape") return;
            // Consume Escape before the dashboard's global overlay handler.
            event.preventDefault();
            event.stopPropagation();
            settingsOpen = false;
          }}
        >
          <div class="flex items-center gap-2.5">
            <span
              class="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary"
            >
              <TimerIcon class="size-4" aria-hidden="true" />
            </span>
            <span class="text-sm font-semibold">{labels.heartbeat}</span>
          </div>

          <div
            class="grid grid-cols-4 gap-1.5"
            role="group"
            aria-label={labels.heartbeat}
          >
            {#each presets as preset}
              <Button
                type="button"
                variant="ghost"
                class={cn(
                  "h-10 gap-1 rounded-xl border px-1 transition-colors duration-150 motion-reduce:transition-none",
                  $sessionState.keepAlive.interval_secs === preset
                    ? "border-primary/25 bg-primary/8 text-primary hover:bg-primary/12 hover:text-primary"
                    : "border-border/70 bg-muted/20 text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={$sessionState.keepAlive.interval_secs === preset}
                onclick={() => saveInterval(preset)}
              >
                <span class="font-mono text-sm font-medium tabular-nums"
                  >{preset}</span
                >
                <span class="text-[10px]">{labels.seconds}</span>
              </Button>
            {/each}
          </div>

          <div class="space-y-2 border-t border-border/70 pt-3">
            <Label
              for="connection-heartbeat"
              class="text-xs text-muted-foreground">{labels.custom}</Label
            >
            <div class="flex items-center gap-2">
              <div class="relative min-w-0 flex-1">
                <Input
                  id="connection-heartbeat"
                  class="h-9 rounded-xl border-border bg-muted/25 pr-10 font-mono text-sm tabular-nums shadow-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  type="number"
                  min={1}
                  max={3600}
                  step={1}
                  bind:value={interval}
                  aria-label={labels.heartbeat}
                  aria-invalid={invalid}
                  aria-describedby={invalid
                    ? "connection-heartbeat-error"
                    : undefined}
                  onkeydown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      saveInterval();
                    }
                  }}
                />
                <span
                  class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground"
                  >{labels.seconds}</span
                >
              </div>
              <Button
                type="button"
                size="icon"
                class="size-9 rounded-xl"
                aria-label={labels.apply}
                title={labels.apply}
                disabled={invalid}
                onclick={() => saveInterval()}
              >
                <CheckIcon class="size-4" aria-hidden="true" />
              </Button>
            </div>
            {#if invalid}
              <p
                id="connection-heartbeat-error"
                class="text-xs text-destructive"
                role="alert"
              >
                {labels.invalid}
              </p>
            {/if}
          </div>
        </Popover.Content>
      </Popover.Root>
    </div>
  </div>
  {#if $sessionState.status === "error"}
    <div
      class="mt-2 flex max-w-sm items-start gap-2 rounded-xl bg-destructive/5 p-2"
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        class="size-7 shrink-0 rounded-lg border-destructive/20 text-destructive hover:bg-destructive/5 hover:text-destructive"
        aria-label={labels.reconnect}
        title={labels.reconnect}
        onclick={() => {
          void connectionSession.reconnect();
        }}
      >
        <RotateCwIcon class="size-4" aria-hidden="true" />
      </Button>
      <p class="min-w-0 break-words py-1 text-xs text-destructive" role="alert">
        {$sessionState.error}
      </p>
    </div>
  {/if}
</div>
