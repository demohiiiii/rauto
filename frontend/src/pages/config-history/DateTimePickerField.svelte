<script>
  import { CalendarDate } from "@internationalized/date";
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import { Button } from "$lib/components/ui/button";
  import { Calendar } from "$lib/components/ui/calendar";
  import { Input } from "$lib/components/ui/input";
  import * as Popover from "$lib/components/ui/popover";
  import { cn } from "$lib/utils.js";
  import { currentLanguageState, tr } from "../../lib/i18n.js";

  let {
    value = "",
    defaultTime = "00:00:00",
    placeholderText = "YYYY-MM-DD HH:mm:ss",
    "aria-label": ariaLabel = "",
    onValueChange,
  } = $props();

  let open = $state(false);
  let selectedDate = $state(undefined);
  let timeValue = $state("");
  let i18nCurrentLanguage = $derived($currentLanguageState);
  let calendarLocale = $derived(
    i18nCurrentLanguage === "zh" ? "zh-CN" : "en-US",
  );
  let displayValue = $derived(formatDateTimeDisplay(value));

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function parseLocalDateTime(localDateTime) {
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

  function formatDateTimeDisplay(localDateTime) {
    const parsed = parseLocalDateTime(localDateTime);
    if (!parsed) return "";
    return `${parsed.date.year}-${pad(parsed.date.month)}-${pad(parsed.date.day)} ${parsed.time}`;
  }

  function resetDraft() {
    const parsed = parseLocalDateTime(value);
    selectedDate = parsed?.date;
    timeValue = parsed?.time || defaultTime;
  }

  function handleOpenChange(nextOpen) {
    if (nextOpen) resetDraft();
  }

  function handleTimeInput(event) {
    timeValue = event.currentTarget.value || defaultTime;
  }

  function applyDateTime() {
    if (!selectedDate) return;
    const normalizedTime = /^\d{2}:\d{2}:\d{2}$/.test(timeValue)
      ? timeValue
      : defaultTime;
    const nextValue = `${selectedDate.year}-${pad(selectedDate.month)}-${pad(selectedDate.day)}T${normalizedTime}`;
    if (typeof onValueChange === "function") onValueChange(nextValue);
    open = false;
  }
</script>

<Popover.Root bind:open onOpenChange={handleOpenChange}>
  <Popover.Trigger>
    {#snippet child({ props })}
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
  <Popover.Content class="w-auto overflow-hidden p-0" align="start">
    <Calendar
      type="single"
      value={selectedDate}
      locale={calendarLocale}
      captionLayout="dropdown"
      onValueChange={(nextDate) => (selectedDate = nextDate)}
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
