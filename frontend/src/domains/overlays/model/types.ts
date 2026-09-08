export type OverlayToastTone = "error" | "info" | "success" | "warning";

export type OverlayTranslate = (key: string, fallback?: string) => string;

export type RecordLevel = "full" | "key-events-only";

export interface OverlayDrawerState {
  recordDrawerOpen: boolean;
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

export interface OverlayHistoryItem {
  command_label?: string;
  connection_key?: string;
  connection_name?: string | null;
  device_profile?: string;
  host?: string;
  id?: string;
  mode?: string | null;
  operation?: string;
  port?: number;
  record_level?: string;
  ts_ms?: number;
  username?: string;
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
