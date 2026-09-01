export type OverlayToastTone = "error" | "info" | "success" | "warning";

export type OverlayTranslate = (key: string, fallback?: string) => string;

export type RecordDrawerMode = "list" | "raw";
export type RecordLevel = "full" | "key-events-only";
export type SessionRecordsView = "history" | "recent";

export interface OverlayDrawerState {
  recordDrawerOpen: boolean;
  recordFabCount: number;
}

export interface RecordDrawerPreferences {
  displayMode: RecordDrawerMode;
  eventKind: string;
  failedOnly: boolean;
  searchQuery: string;
}

export interface RecordDrawerRecordingState {
  jsonl: string;
  version: number;
}

export interface ReplayStatusTextState {
  text: string;
  version: number;
}

export interface OverlayDrawerRuntime {
  loadPreferences(): RecordDrawerPreferences;
  navigateToReplay(): boolean;
  savePreferences(preferences: RecordDrawerPreferences): void;
  writeClipboardText(text: string): Promise<void>;
}

export interface OverlayToastRuntime {
  canShowToast(): boolean;
  loadToast(): Promise<(typeof import("svelte-sonner"))["toast"]>;
  setBodyLocked(locked: boolean): void;
}

export type OverlayData = Record<string, unknown>;

export interface OverlayEventEntry extends OverlayData {
  device_addr?: unknown;
  event?: OverlayData;
  record_level?: unknown;
  timestamp_ms?: unknown;
  ts_ms?: unknown;
}

export interface OverlayHistoryItem extends OverlayData {
  command_label?: unknown;
  connection_name?: unknown;
  device_profile?: unknown;
  host?: unknown;
  id?: unknown;
  mode?: unknown;
  operation?: unknown;
  port?: unknown;
  record_level?: unknown;
  ts_ms?: unknown;
  username?: unknown;
}

export interface OverlayDetailModalState {
  content: unknown;
  detailPayload: OverlayData | null;
  kind: string;
  open: boolean;
  title: string;
}

export interface OverlayDetailConfig {
  detailPayload?: OverlayData | null;
  kind?: string;
  title?: string;
}

export interface OverlayEntryDrawerState {
  eventEntry: OverlayEventEntry | null;
  open: boolean;
}

export interface OverlayDetailRendererModule {
  default: unknown;
}

export type OverlayDetailRendererDefinitions = Record<
  string,
  () => Promise<OverlayDetailRendererModule>
>;

export interface OverlayDetailRendererRegistry {
  components: import("svelte/store").Readable<Record<string, unknown>>;
  ensure(id: string): void;
  errors: import("svelte/store").Readable<Record<string, string>>;
}

export type OverlayOrchestrationDetailDisplay = (
  detail: OverlayData,
) => OverlayData;
