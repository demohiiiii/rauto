import type { Readable, Writable } from "svelte/store";

export type UnknownRecord = Record<string, unknown>;

export type ProfileStatusTone =
  | "error"
  | "info"
  | "running"
  | "success"
  | "warning";

export interface CommandExecutionConfig {
  marker: string;
  mode: string;
  showShellExitMarker: boolean;
}

export interface CustomProfileBaseForm {
  commandExecution: CommandExecutionConfig;
  name: string;
}

export interface CustomProfileOptionsState {
  names: string[];
  selected: string;
}

export interface CustomProfileStatusState {
  message: string;
  tone: string;
}

export interface CustomProfileEditorRuntime {
  deleteCustomProfile(name: string): Promise<unknown>;
  getCustomProfileForm(name: string): Promise<unknown>;
  promptForResourceName(message: string): string | null;
  publishStatus(message: string, tone: string): CustomProfileStatusState;
  saveCustomProfileForm(name: string, profile: UnknownRecord): Promise<unknown>;
}

export interface CustomProfileForm extends UnknownRecord {
  command_execution: unknown;
  detect_profile: unknown;
  error_patterns: unknown[];
  hooks: UnknownRecord;
  ignore_errors: unknown[];
  interactions: unknown[];
  more_patterns: unknown[];
  name: string;
  prompt_prefix: unknown[];
  prompts: unknown[];
  sys_prompts: unknown[];
  transitions: unknown[];
}

export interface ModeSelectState {
  allowEmpty: boolean;
  emptyLabel: string;
  modes: string[];
  selected: string;
}

export interface TextfsmPlatformSelectState {
  placeholder: string;
  profiles: string[];
  selected: string;
}

export interface ProfileModes {
  default_mode: string;
  modes: string[];
  name: string;
}

export interface ModeSelectConfig {
  allowEmpty?: boolean;
  emptyLabel?: string;
}

export interface ModeSelection<T> {
  setValue(value?: unknown): void;
  state: Writable<T>;
}

export interface ProfileExecutionRuntime {
  connectionTargetState: Readable<unknown>;
  currentExecutionConnectionProfile(): string;
  getCachedDeviceProfiles(): unknown[];
  getProfileModes(profileName: string): Promise<unknown>;
  temporaryConnectionFormStateStore: Readable<unknown>;
}

export type ProfileModeOverrides = Record<string, unknown>;
