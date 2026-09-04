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

export interface InventoryGroup extends InventoryItem {
  description: string | null;
}

export interface InventoryLabel extends InventoryItem {
  description?: never;
}

export interface SavedConnectionSummary {
  name: string;
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

export type InventoryGroupPayload = InventoryGroup;

export interface InventoryDeleteResponse {
  ok: boolean;
  deleted: boolean;
}

export interface InventoryApi {
  deleteGroup(name: string): Promise<InventoryDeleteResponse>;
  deleteLabel(name: string): Promise<InventoryDeleteResponse>;
  getGroup(name: string): Promise<InventoryGroup>;
  getLabel(name: string): Promise<InventoryLabel>;
  listConnections(): Promise<SavedConnectionSummary[]>;
  listGroups(): Promise<InventoryGroup[]>;
  listLabels(): Promise<InventoryLabel[]>;
  saveGroup(
    name: string,
    group: InventoryGroupPayload,
  ): Promise<InventoryGroup>;
  saveLabel(name: string, hosts: string[]): Promise<InventoryLabel>;
}

export interface InventoryRuntime {
  protectedResourcesRefreshState: Readable<number>;
  reloadSavedConnections(): Promise<void>;
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
