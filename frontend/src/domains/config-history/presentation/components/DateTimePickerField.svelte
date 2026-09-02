<script lang="ts">
  import { CalendarDate } from "@internationalized/date";
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import { Button } from "$lib/components/ui/button";
  import { Calendar } from "$lib/components/ui/calendar";
  import { Input } from "$lib/components/ui/input";
  import * as Popover from "$lib/components/ui/popover";
  import { cn } from "$lib/utils.js";
  import { currentLanguageState, tr } from "$lib/i18n.js";

  interface DateTimeDraft {
    date: CalendarDate;
    time: string;
  }

  interface Props {
    "aria-label"?: string;
    defaultTime?: string;
    onValueChange?: (value: string) => void;
    placeholderText?: string;
    value?: string;
  }

  let {
    value = "",
    defaultTime = "00:00:00",
    placeholderText = "YYYY-MM-DD HH:mm:ss",
    "aria-label": ariaLabel = "",
    onValueChange,
  }: Props = $props();

  let open = $state(false);
  let selectedDate = $state<CalendarDate | undefined>(undefined);
  let timeValue = $state("");
  let i18nCurrentLanguage = $derived($currentLanguageState);
  let calendarLocale = $derived(
    i18nCurrentLanguage === "zh" ? "zh-CN" : "en-US",
  );
  let displayValue = $derived(formatDateTimeDisplay(value));

  function pad(value: number): string {
    return String(value).padStart(2, "0");
  }

  function parseLocalDateTime(localDateTime: string): DateTimeDraft | null {
    const match = String(localDateTime || "")
      .trim()
      .match(/^(\d{4})-(\d{2})-(\d{2})(?:T| )(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return null;
    const [, year, month, day, hour, minute, second = "00"] = match;
    try {
      return {
        date: new CalendarDate(Number(year), Number(month), Number(day)),
        time: `${hour}:${minute}:${second}`,
      };
    } catch {
      return null;
    }
  }

  function formatDateTimeDisplay(localDateTime: string): string {
    const parsed = parseLocalDateTime(localDateTime);
    if (!parsed) return "";
    return `${parsed.date.year}-${pad(parsed.date.month)}-${pad(parsed.date.day)} ${parsed.time}`;
  }

  function resetDraft(): void {
    const parsed = parseLocalDateTime(value);
    selectedDate = parsed?.date;
    timeValue = parsed?.time || defaultTime;
  }

  function handleOpenChange(nextOpen: boolean): void {
    if (nextOpen) resetDraft();
  }

  function handleTimeInput(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    timeValue = input.value || defaultTime;
  }

  function applyDateTime(): void {
    if (!selectedDate) return;
    const normalizedTime = /^\d{2}:\d{2}:\d{2}$/.test(timeValue)
      ? timeValue
      : defaultTime;
    const nextValue = `${selectedDate.year}-${pad(selectedDate.month)}-${pad(selectedDate.day)}T${normalizedTime}`;
    onValueChange?.(nextValue);
    open = false;
  }
</script>

<Popover.Root bind:open onOpenChange={handleOpenChange}>
  <Popover.Trigger class={undefined}>
    {#snippet child({ props }: { props: Record<string, unknown> })}
      <Button
        {...props}
        variant="outline"
        class={cn(
          "h-9 w-full min-w-0 justify-start font-mono font-normal",
          !displayValue && "text-muted-foreground",
        )}
        type="button"
        aria-label={ariaLabel}
      >
        <CalendarIcon data-icon="inline-start" aria-hidden="true" />
        <span class="truncate">{displayValue || placeholderText}</span>
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content
    class="w-auto overflow-hidden p-0"
    align="start"
    portalProps={undefined}
  >
    <Calendar
      type="single"
      value={selectedDate}
      class={undefined}
      locale={calendarLocale}
      captionLayout="dropdown"
      months={undefined}
      years={undefined}
      monthFormat={undefined}
      day={undefined}
      onValueChange={(nextDate: CalendarDate | undefined) => {
        selectedDate = nextDate;
      }}
    />
    <div class="grid gap-3 border-t border-border p-3">
      <label class="grid gap-1.5 text-xs font-medium">
        <span>{tr("dateTimePickerTime", "Time")}</span>
        <Input
          type="time"
          step="1"
          value={timeValue}
          aria-label={tr("dateTimePickerTime", "Time")}
          oninput={handleTimeInput}
        />
      </label>
      <Button
        size="sm"
        type="button"
        disabled={!selectedDate}
        onclick={applyDateTime}
      >
        {tr("dateTimePickerDone", "Done")}
      </Button>
    </div>
  </Popover.Content>
</Popover.Root>
