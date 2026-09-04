import type { Readable, Writable } from "svelte/store";
import type {
  ConnectionTargetState,
  TemporaryConnectionFormState,
} from "$domains/connections/index.js";

export type UnknownRecord = Record<string, unknown>;

export type ProfileStatusTone =
  | "error"
  | "info"
  | "running"
  | "success"
  | "warning";

export interface BuiltinProfileMeta {
  aliases: string[];
  name: string;
  summary: string;
}

export interface CustomProfileMeta {
  name: string;
  path: string;
}

export interface DeviceProfilesOverview {
  builtins: BuiltinProfileMeta[];
  custom: CustomProfileMeta[];
}

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

export interface CustomProfileDetail {
  content: string;
  name: string;
  path: string;
}

export interface CustomProfileDeleteResponse {
  ok: boolean;
}

export interface CustomProfileEditorRuntime {
  deleteCustomProfile(name: string): Promise<CustomProfileDeleteResponse>;
  getCustomProfileForm(name: string): Promise<CustomProfileForm>;
  promptForResourceName(message: string): string | null;
  publishStatus(message: string, tone: string): CustomProfileStatusState;
  saveCustomProfileForm(
    name: string,
    profile: CustomProfileForm,
  ): Promise<CustomProfileDetail>;
}

export interface ProfilePromptConfig {
  patterns: string[];
  state: string;
}

export interface ProfileSysPromptConfig {
  pattern: string;
  state: string;
  sys_name_group: string;
}

export interface ProfileInteractionConfig {
  input: string;
  is_dynamic: boolean;
  patterns: string[];
  record_input: boolean;
  state: string;
}

export interface ProfileTransitionConfig {
  command: string;
  format_sys: boolean;
  from: string;
  is_exit: boolean;
  to: string;
}

export type ProfileListKind =
  | "interactions"
  | "prompts"
  | "simple"
  | "sys_prompts"
  | "transitions";

export type ProfileStructuredRow =
  | ProfileInteractionConfig
  | ProfilePromptConfig
  | ProfileSysPromptConfig
  | ProfileTransitionConfig;

export type ProfileListRow = string | ProfileStructuredRow;

export type ProfileListRowPatch =
  | Partial<ProfileInteractionConfig>
  | Partial<ProfilePromptConfig>
  | Partial<ProfileSysPromptConfig>
  | Partial<ProfileTransitionConfig>;

export interface ProfilePromptResponseRule {
  patterns: string[];
  record_input: boolean;
  response: string;
}

export interface ProfilePromptResponseRuleInput {
  patterns: string[];
  record_input?: boolean;
  response: string;
}

export interface ProfileCommandInteraction {
  prompts: ProfilePromptResponseRule[];
}

export interface ProfileCommandInteractionInput {
  prompts: ProfilePromptResponseRuleInput[];
}

export type ProfileHookKind = "command" | "flow";

export interface ProfileHookCommandDraft {
  command: string;
  interaction: ProfileCommandInteraction;
  mode: string;
  timeout: string;
}

export interface ProfileHookFlowDraft {
  max_steps: string;
  steps: ProfileHookCommandDraft[];
  stop_on_error: boolean;
}

export interface ProfileHookRowDraft {
  command: ProfileHookCommandDraft;
  failure_policy: "best_effort" | "required";
  flow: ProfileHookFlowDraft;
  kind: ProfileHookKind;
  name: string;
  record_output: boolean;
  state: string;
}

export type ProfileHookCommandPatch = Partial<ProfileHookCommandDraft>;
export type ProfileHookFlowPatch = Partial<ProfileHookFlowDraft>;
export type ProfileHookRowPatch = Partial<
  Pick<
    ProfileHookRowDraft,
    "failure_policy" | "name" | "record_output" | "state"
  >
>;

export interface ProfileCommandConfig {
  command: string;
  interaction?: ProfileCommandInteraction;
  mode: string;
  timeout?: number | null;
}

export interface ProfileHookCommand extends ProfileCommandConfig {
  kind: "command";
}

export interface ProfileHookFlow {
  kind: "flow";
  max_steps?: number | null;
  steps: ProfileCommandConfig[];
  stop_on_error: boolean;
}

export type ProfileHookOperation = ProfileHookCommand | ProfileHookFlow;

export interface ProfileHookAction {
  failure_policy: "best_effort" | "required";
  name: string;
  operation: ProfileHookOperation;
  record_output: boolean;
}

export interface ProfileHooks {
  after_connect: ProfileHookAction[];
  after_enter_state: Record<string, ProfileHookAction[]>;
  before_disconnect: ProfileHookAction[];
  before_exit_state: Record<string, ProfileHookAction[]>;
}

export interface ProfileDetectRule {
  pattern: string;
  weight: number;
}

export interface ProfileDetectProbe {
  command: string;
  error_patterns: string[];
  rules: ProfileDetectRule[];
}

export interface ProfileDetectConfig {
  initial_rules: ProfileDetectRule[];
  probes: ProfileDetectProbe[];
}

export interface ProfileStateMachineDiagnostics {
  dead_end_states: string[];
  duplicate_prompt_patterns: string[];
  entry_states: string[];
  graph_states: string[];
  missing_edge_sources: string[];
  missing_edge_targets: string[];
  potentially_ambiguous_prompt_states: string[];
  self_loop_only_states: string[];
  total_states: number;
  unreachable_states: string[];
}

export interface ProfileDiagnoseResponse {
  diagnostics: ProfileStateMachineDiagnostics;
  name: string;
}

export type ProfileCommandExecution =
  | "prompt_driven"
  | {
      shell_exit_status: {
        marker: string;
        shell_flavor?: "fish" | "posix";
      };
    };

export interface CustomProfileForm {
  command_execution: ProfileCommandExecution;
  detect_profile?: ProfileDetectConfig | null;
  error_patterns: string[];
  hooks: ProfileHooks;
  ignore_errors: string[];
  interactions: ProfileInteractionConfig[];
  more_patterns: string[];
  name: string;
  prompt_prefix: string[];
  prompts: ProfilePromptConfig[];
  sys_prompts: ProfileSysPromptConfig[];
  transitions: ProfileTransitionConfig[];
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
  setValue(value?: string): void;
  state: Writable<T>;
}

export interface ProfileExecutionRuntime {
  connectionTargetState: Readable<ConnectionTargetState>;
  currentExecutionConnectionProfile(): string;
  getCachedDeviceProfiles(): string[];
  getProfileModes(profileName: string): Promise<ProfileModes>;
  temporaryConnectionFormStateStore: Readable<TemporaryConnectionFormState>;
}

export interface ProfileModeOverrides {
  batchExecMode?: string;
  batchShowMode?: string;
  execMode?: string;
  flowMode?: string;
  showMode?: string;
  templateMode?: string;
}
