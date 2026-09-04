import type { Component } from "svelte";
import type { Readable } from "svelte/store";

export type DashboardThemeMode = "system" | "light" | "dark";
export type ResolvedDashboardThemeMode = Exclude<DashboardThemeMode, "system">;

export interface DashboardThemeSettings {
  mode: DashboardThemeMode;
  preset: "emerald" | "violet";
  radius: "md";
}

export interface DashboardThemeSettingsInput {
  mode?: unknown;
  preset?: unknown;
  radius?: unknown;
}

export interface DashboardThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface DashboardThemeDomAdapter {
  setAttribute(name: string, value: string): void;
  setDarkMode(enabled: boolean): void;
}

export interface DashboardRoute {
  id: string;
  path: string;
  tab: string;
  txStage?: string;
}

export interface DashboardNavigationItem {
  activeWhen: string;
  group: string;
  label: string;
  labelKey: string;
  navLabelKey?: string;
  routeId: string;
  txStage?: string;
}

export interface DashboardPageDefinition {
  id: string;
  load: () => Promise<DashboardComponentModule<DashboardPageComponent>>;
}

export interface DashboardComponentModule<TComponent = Component> {
  default: TComponent;
}

export type DashboardPageComponent = Component<{ active: boolean }>;
export type DashboardOverlayComponent = Component;

export type DashboardOverlayId =
  | "connectionModal"
  | "detailModal"
  | "entryDrawer"
  | "recordDrawer"
  | "savedConnectionEditModal";

export type DashboardComponentDefinitions<
  TId extends string,
  TComponent = DashboardOverlayComponent,
> = Record<TId, () => Promise<DashboardComponentModule<TComponent>>>;

export interface DashboardConnectionOverlayState {
  modalOpen: boolean;
  savedEditorOpen: boolean;
}

export interface DashboardDetailOverlayState {
  open: boolean;
}

export interface DashboardEntryOverlayState {
  open: boolean;
}

export interface DashboardDrawerOverlayState {
  recordFabCount?: number;
  recordDrawerOpen: boolean;
}

export interface DashboardRecordToolsDisplay {
  levelHintText: string;
  levelLabelText: string;
  recordFabBadgeText: string;
  recordFabHasCount: boolean;
  recordFabTitle: string;
  recordLevelLabel: string;
}

export interface DashboardNavigationItemDisplay extends DashboardNavigationItem {
  active: boolean;
  labelText: string;
  visible: boolean;
}

export interface DashboardBodyDisplay {
  breadcrumbAria: string;
  breadcrumbRootText: string;
  currentTheme: ResolvedDashboardThemeMode;
  loadingStatus: { message: string; variant: "alert" };
  pageErrorStatus: { tone: "error"; variant: "alert" };
  pageLabelText: string;
  pageTitle: string;
  requestFailedMessage: string;
  sidebarOpenAria: string;
}

export interface DashboardPageOutletRow {
  active: true;
  errorMessage: string;
  id: string;
  PageComponent?: DashboardPageComponent;
}

export interface DashboardPageRegistry {
  components: Readable<Record<string, DashboardPageComponent>>;
  ensure(pageDefinition: DashboardPageDefinition): void;
  errors: Readable<Record<string, string>>;
}

export interface DashboardOverlayHostDisplay {
  bodyLocked: boolean;
  connectionModalOpen: boolean;
  detailModalOpen: boolean;
  entryDrawerOpen: boolean;
  recordDrawerOpen: boolean;
  savedConnectionEditorOpen: boolean;
}

export type DashboardOverlayComponents = Record<
  DashboardOverlayId,
  DashboardOverlayComponent | null
>;

export interface DashboardOverlayHostWorkspace {
  applyHostDisplay(display?: Partial<DashboardOverlayHostDisplay>): () => void;
  hostDisplayStateStore: Readable<DashboardOverlayHostDisplay>;
  overlayComponentsStateStore: Readable<DashboardOverlayComponents>;
}

export interface DashboardState {
  currentTab: string;
  currentTheme: ResolvedDashboardThemeMode;
  currentThemePreference: DashboardThemeMode;
  currentThemeSettings: DashboardThemeSettings;
  currentTxStage: string;
  managedAgentMode: boolean;
  tasksVisible: boolean;
}

export interface DashboardStatusState {
  message: string;
  tone: string;
}

export interface DashboardBootstrapState {
  error: string;
  status: "error" | "loading" | "ready";
}

export interface DashboardBootstrapDisplay {
  busy: boolean;
  errorMessage: string;
  loadFailedTitle: string;
  reloadButtonLabel: string;
  showError: boolean;
}

export interface DashboardThemeOptionRow {
  active: boolean;
  label: string;
  value: DashboardThemeMode;
}

export interface DashboardPreferenceDisplay {
  closeLabel: string;
  languageMenuLabel: string;
  languageOptionChineseLabel: string;
  languageOptionEnglishLabel: string;
  languageShortLabel: string;
  logoutLabel: string;
  showWebLogout: boolean;
  themeModeLabel: string;
  themeModeRows: DashboardThemeOptionRow[];
  themePreferenceLabel: string;
  themeSettings: DashboardThemeSettings;
  themeToggleTitle: string;
}

export interface DashboardAgentAuthDisplay {
  clearButtonLabel: string;
  hidden: boolean;
  hint: string;
  inputAriaLabel: string;
  inputPlaceholder: string;
  managedAgentMode: boolean;
  saveButtonLabel: string;
  showStatus: boolean;
  statusMessage: string;
  statusTone: "error" | "info" | "running" | "success" | "warning";
  title: string;
}
