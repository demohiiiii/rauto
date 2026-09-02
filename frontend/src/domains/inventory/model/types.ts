import type { Readable, Writable } from "svelte/store";

export type InventoryKind = "groups" | "labels";
export type InventorySection = "devices" | InventoryKind;
export type InventoryStatusTone =
  | "error"
  | "info"
  | "running"
  | "success"
  | "warning";

export interface InventoryItem {
  description?: string | null;
  hosts: string[];
  name: string;
}

export interface SavedConnectionSummary {
  name: string;
  [key: string]: unknown;
}

export interface InventoryCollectionState {
  description: string;
  errorMessage: string;
  hostFilter: string;
  hostSelection: Set<string>;
  items: InventoryItem[];
  selectedName: string;
  statusMessage: string;
  statusTone: InventoryStatusTone;
}

export interface InventoryState {
  currentSection: InventorySection;
  groups: InventoryCollectionState;
  labels: InventoryCollectionState;
  savedConnections: SavedConnectionSummary[];
}

export interface InventoryGroupPayload {
  description: string | null;
  hosts: string[];
  name: string;
}

export interface InventoryApi {
  deleteGroup(name: string): Promise<unknown>;
  deleteLabel(name: string): Promise<unknown>;
  getGroup(name: string): Promise<InventoryItem>;
  getLabel(name: string): Promise<InventoryItem>;
  listConnections(): Promise<SavedConnectionSummary[]>;
  listGroups(): Promise<InventoryItem[]>;
  listLabels(): Promise<InventoryItem[]>;
  saveGroup(name: string, group: InventoryGroupPayload): Promise<InventoryItem>;
  saveLabel(name: string, hosts: string[]): Promise<InventoryItem>;
}

export interface InventoryRuntime {
  protectedResourcesRefreshState: Readable<number>;
  reloadSavedConnections(): Promise<unknown>;
  savedConnectionsRefreshState: Readable<number>;
  syncConnectionInventory(
    groups: InventoryItem[],
    labels: InventoryItem[],
  ): void;
}

export interface InventoryWorkspaceOptions {
  api?: Partial<InventoryApi>;
  runtime?: Partial<InventoryRuntime>;
}

export type InventoryValueHandler = (value: string) => void;
export type InventoryHostHandler = (name: string, checked: boolean) => void;

export interface InventoryCollectionActionOptions {
  onDescriptionInput?: InventoryValueHandler | null;
  onHostFilter?: InventoryValueHandler | null;
  onHostSelection?: InventoryHostHandler | null;
  onSelectCollection?: InventoryValueHandler | null;
}

export interface InventoryPageWorkspace<TDisplay> {
  clearGroupHosts(): void;
  clearLabelHosts(): void;
  createInventoryGroupDraft(name?: string): Promise<void>;
  createInventoryLabelDraft(name?: string): Promise<void>;
  currentInventorySectionState: Readable<InventorySection>;
  deleteInventoryGroupSelection(): Promise<void>;
  deleteInventoryLabelSelection(): Promise<void>;
  destroy(): void;
  inventoryStateStore: Writable<InventoryState>;
  openInventorySection(section?: string): void;
  pageDisplayStateStore: Readable<TDisplay>;
  saveInventoryGroupSelection(): Promise<void>;
  saveInventoryLabelSelection(): Promise<void>;
  selectAllGroupHosts(): void;
  selectAllLabelHosts(): void;
  selectInventoryGroupName(name?: string): void;
  selectInventoryLabelName(name?: string): void;
  setPageContext(context?: { active?: boolean }): void;
  updateGroupHostFilter(value?: string): void;
  updateGroupHostSelection(name?: string, checked?: boolean): void;
  updateInventoryGroupDescription(value?: string): void;
  updateLabelHostFilter(value?: string): void;
  updateLabelHostSelection(name?: string, checked?: boolean): void;
}
