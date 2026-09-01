import { t } from "../../../lib/i18n.js";
import {
  booleanPillPresentation,
  borderedPillClass,
  displayText,
  workflowChipClass,
} from "../../../lib/ui.js";

interface StatusDisplay {
  statusBadgeClass: string;
  statusLabel: string;
}

interface StatusDisplayDefinition {
  badgeClass: string;
  labelKey: string;
}

interface DetailEntry {
  detail: Record<string, unknown>;
  titleKey: string;
  titleText: string;
}

interface ExecutionDetailIndex {
  stageDetails: DetailEntry[];
  targetDetails: DetailEntry[][][];
}

interface CountChipOptions {
  failedText?: unknown;
  jobsText?: unknown | null;
  skippedText?: unknown;
  succeededText?: unknown;
}

interface StageBasicFieldOptions {
  detail?: unknown;
  jobsFailed?: unknown;
  jobsSkipped?: unknown;
  jobsSucceeded?: unknown;
  planName?: unknown;
  stage?: unknown;
  stageStatusDisplay?: StatusDisplay;
  stageStrategyLabel?: unknown;
}

interface TargetBasicFieldOptions {
  detail?: unknown;
  planName?: unknown;
  target?: unknown;
  targetStatusDisplay?: StatusDisplay;
}

const orchestrationDisplayText = displayText as (value: unknown) => string;
const orchestrationBorderedPillClass = borderedPillClass as (
  toneClass?: string,
) => string;
const orchestrationWorkflowChipClass = workflowChipClass as (
  ...toneClasses: string[]
) => string;
const orchestrationBooleanPillPresentation = booleanPillPresentation as (
  value: unknown,
) => { pillClassName: string; text: string };

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function orchestrationText(displaySource: unknown): string {
  return orchestrationDisplayText(displaySource);
}

const orchestrationSummaryCard = (key: string, summaryValue: unknown) => ({
  label: t(key),
  summaryValue,
});

function orchestrationExecutionDetailSource(
  detailIndex: unknown = {},
  stageIndex = 0,
  jobIndex: number | null = null,
): unknown {
  const index = objectValue(detailIndex);
  if (jobIndex == null) return index.stageDetails;
  const targetDetails = Array.isArray(index.targetDetails)
    ? index.targetDetails
    : [];
  const stageDetails = Array.isArray(targetDetails[stageIndex])
    ? targetDetails[stageIndex]
    : [];
  return stageDetails[jobIndex];
}

const ORCHESTRATION_STATUS_DISPLAY: Readonly<
  Record<string, StatusDisplayDefinition>
> = Object.freeze({
  failed: {
    badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
    labelKey: "orchestrationStatusFailed",
  },
  skipped: {
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
    labelKey: "orchestrationStatusSkipped",
  },
  success: {
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    labelKey: "orchestrationStatusSuccess",
  },
});

function orchestrationStatusDisplay(status: unknown): StatusDisplay {
  const normalized = orchestrationText(status || "-").toLowerCase();
  const statusDisplay = ORCHESTRATION_STATUS_DISPLAY[normalized];
  const badgeClass =
    statusDisplay?.badgeClass || "border-slate-200 bg-slate-50 text-slate-700";
  return {
    statusBadgeClass: orchestrationBorderedPillClass(badgeClass),
    statusLabel: statusDisplay?.labelKey
      ? t(statusDisplay.labelKey)
      : orchestrationText(status || "-"),
  };
}

function orchestrationCountChipRows({
  failedText = "0",
  jobsText = null,
  skippedText = "0",
  succeededText = "0",
}: CountChipOptions = {}) {
  const chips: Array<[string, unknown]> = [
    ["orchestrationStatusSuccess", succeededText],
    ["orchestrationStatusFailed", failedText],
    ["orchestrationStatusSkipped", skippedText],
  ];
  if (jobsText != null) chips.push(["orchestrationStageJobs", jobsText]);
  return chips.map(([labelKey, valueText]) => ({
    chipClass: orchestrationWorkflowChipClass(),
    labelText: t(labelKey),
    valueText: orchestrationText(valueText),
  }));
}

function orchestrationIndexedLabel(
  prefix: string,
  index: unknown,
  displayName: unknown,
): string {
  const safeIndex = typeof index === "number" ? index : 0;
  return `${prefix}[${safeIndex}] ${orchestrationText(displayName)}`;
}

function orchestrationTargetPayloadSections(target: unknown) {
  const targetValue = objectValue(target);
  const sections: Array<[string, unknown]> = [
    ["orchestrationPayloadTxResult", targetValue.tx_result],
    ["orchestrationPayloadWorkflowResult", targetValue.workflow_result],
    ["orchestrationPayloadCompensation", targetValue.compensation],
  ];
  return sections
    .filter(([, jsonValue]) => jsonValue != null)
    .map(([labelKey, jsonValue]) => ({
      jsonValue,
      labelKey,
      titleText: t(labelKey),
    }));
}

const orchestrationDetailTextField = (
  labelKey: string,
  valueText: unknown,
  { mono = false }: { mono?: boolean } = {},
) => ({
  badgeClass: "",
  detailValue: valueText,
  kind: "text",
  labelText: t(labelKey),
  mono,
  valueText,
});

const orchestrationDetailStatusField = (
  labelKey: string,
  statusLabel: string,
  statusBadgeClass: string,
) => ({
  badgeClass: statusBadgeClass,
  detailValue: statusLabel,
  kind: "status",
  labelText: t(labelKey),
  statusBadgeClass,
  statusLabel,
});

const orchestrationDetailPillField = (
  labelKey: string,
  pillDisplay: { pillClassName: string; text: string },
) => ({
  badgeClass: pillDisplay.pillClassName,
  detailValue: pillDisplay.text,
  labelText: t(labelKey),
});

function orchestrationStageStrategyLabel(strategy: unknown): string {
  return orchestrationText(strategy || "serial") === "parallel"
    ? t("orchestrationStrategyParallel")
    : t("orchestrationStrategySerial");
}

function orchestrationActionField(
  label: string,
  detailValue: unknown,
  { mono = false }: { mono?: boolean } = {},
) {
  return {
    detailValue: orchestrationText(detailValue || "-"),
    label,
    mono,
  };
}

function orchestrationStageBasicFieldRows({
  detail = {},
  jobsFailed = 0,
  jobsSkipped = 0,
  jobsSucceeded = 0,
  planName = "-",
  stage = {},
  stageStatusDisplay = orchestrationStatusDisplay(""),
  stageStrategyLabel = "",
}: StageBasicFieldOptions = {}) {
  const detailValue = objectValue(detail);
  const stageValue = objectValue(stage);
  return [
    orchestrationDetailTextField("orchestrationVisualName", planName),
    orchestrationDetailTextField(
      "orchestrationDetailLabelStage",
      orchestrationIndexedLabel(
        "stage",
        detailValue.stageIndex,
        stageValue.name || "-",
      ),
    ),
    orchestrationDetailStatusField(
      "orchestrationDetailLabelStatus",
      stageStatusDisplay.statusLabel,
      stageStatusDisplay.statusBadgeClass,
    ),
    orchestrationDetailTextField(
      "orchestrationStageStrategy",
      stageStrategyLabel,
    ),
    orchestrationDetailPillField(
      "orchestrationVisualFailFast",
      orchestrationBooleanPillPresentation(stageValue.fail_fast),
    ),
    orchestrationDetailTextField("orchestrationStatusSuccess", jobsSucceeded),
    orchestrationDetailTextField("orchestrationStatusFailed", jobsFailed),
    orchestrationDetailTextField("orchestrationStatusSkipped", jobsSkipped),
  ];
}

function orchestrationTargetBasicFieldRows({
  detail = {},
  planName = "-",
  target = {},
  targetStatusDisplay = orchestrationStatusDisplay(""),
}: TargetBasicFieldOptions = {}) {
  const detailValue = objectValue(detail);
  const targetValue = objectValue(target);
  return [
    orchestrationDetailTextField("orchestrationVisualName", planName),
    orchestrationDetailTextField(
      "orchestrationDetailLabelStage",
      orchestrationIndexedLabel(
        "stage",
        detailValue.stageIndex,
        detailValue.stageName,
      ),
    ),
    orchestrationDetailTextField(
      "orchestrationDetailLabelJob",
      orchestrationIndexedLabel(
        "job",
        detailValue.jobIndex,
        detailValue.jobName,
      ),
    ),
    orchestrationDetailTextField(
      "orchestrationDetailLabelTarget",
      orchestrationIndexedLabel(
        "target",
        detailValue.targetIndex,
        targetValue.label || "",
      ),
    ),
    orchestrationDetailStatusField(
      "orchestrationDetailLabelStatus",
      targetStatusDisplay.statusLabel,
      targetStatusDisplay.statusBadgeClass,
    ),
    orchestrationDetailTextField(
      "orchestrationDetailLabelConnection",
      targetValue.connection_name || "-",
    ),
    orchestrationDetailTextField(
      "orchestrationDetailLabelHost",
      targetValue.host || "-",
      { mono: true },
    ),
    orchestrationDetailTextField(
      "orchestrationDetailLabelOperation",
      targetValue.operation || "-",
      { mono: true },
    ),
    orchestrationDetailTextField(
      "orchestrationDetailLabelDurationMs",
      targetValue.duration_ms ?? 0,
      { mono: true },
    ),
  ];
}

function orchestrationTargetDetailRow(target: unknown = {}) {
  const targetValue = objectValue(target);
  const durationText = orchestrationText(targetValue.duration_ms || 0);
  const errorText = orchestrationText(targetValue.error || "");
  const hostText = orchestrationText(targetValue.host || "-");
  const operationText = orchestrationText(targetValue.operation || "-");
  return {
    detailButtonLabel: t("orchestrationDetailBtn"),
    errorText,
    label: orchestrationText(targetValue.label || ""),
    metaFields: [
      orchestrationDetailTextField("orchestrationDetailLabelHost", hostText, {
        mono: true,
      }),
      orchestrationDetailTextField(
        "orchestrationDetailLabelOperation",
        operationText,
        { mono: true },
      ),
      orchestrationDetailTextField(
        "orchestrationDetailLabelDurationMs",
        durationText,
        { mono: true },
      ),
    ],
    ...orchestrationStatusDisplay(targetValue.status),
  };
}

function orchestrationJobDetailRow(job: unknown = {}, index = 0) {
  const jobValue = objectValue(job);
  const targets = Array.isArray(jobValue.results) ? jobValue.results : [];
  const targetsFailedText = orchestrationText(jobValue.targets_failed || 0);
  const targetsSkippedText = orchestrationText(jobValue.targets_skipped || 0);
  const targetsSucceededText = orchestrationText(
    jobValue.targets_succeeded || 0,
  );
  const actionSummaryText = orchestrationText(
    jobValue.action_summary || jobValue.action_kind || "-",
  );
  return {
    actionFields: [
      orchestrationActionField(
        t("orchestrationStageAction"),
        actionSummaryText,
      ),
    ],
    actionSummaryText,
    hasTargetRows: targets.length > 0,
    noTargetText: "-",
    targetRows: targets.map(orchestrationTargetDetailRow),
    targetSummaryChips: orchestrationCountChipRows({
      failedText: targetsFailedText,
      skippedText: targetsSkippedText,
      succeededText: targetsSucceededText,
    }),
    targetsFailedText,
    targetsSkippedText,
    targetsSucceededText,
    title: `job[${index}] ${orchestrationText(jobValue.name || "") || "-"}`,
    ...orchestrationStatusDisplay(jobValue.status),
  };
}

export function orchestrationStageJobsPanelDisplay() {
  return {
    sectionTitle: t("orchestrationDetailSectionJobs"),
  };
}

export function orchestrationDetailDisplay(detail: unknown = {}) {
  const detailValue = objectValue(detail);
  const orchestrationBasicSectionTitle = t("detailSectionBasic");
  const orchestrationRawSectionTitle = t("detailSectionRaw");
  if (detailValue.kind === "stage") {
    const stage = objectValue(detailValue.stage);
    const jobs = Array.isArray(stage.jobs) ? stage.jobs : [];
    const statusDisplay = orchestrationStatusDisplay(stage.status);
    const planName = detailValue.planName || "-";
    const stageStrategyLabel = orchestrationStageStrategyLabel(stage.strategy);
    const jobsFailed = stage.jobs_failed ?? 0;
    const jobsSkipped = stage.jobs_skipped ?? 0;
    const jobsSucceeded = stage.jobs_succeeded ?? 0;
    return {
      hasStageJobRows: jobs.length > 0,
      jobsFailed,
      jobsSkipped,
      jobsSucceeded,
      orchestrationBasicSectionTitle,
      orchestrationRawSectionTitle,
      planName,
      stageBasicFieldRows: orchestrationStageBasicFieldRows({
        detail: detailValue,
        jobsFailed,
        jobsSkipped,
        jobsSucceeded,
        planName,
        stage,
        stageStatusDisplay: statusDisplay,
        stageStrategyLabel,
      }),
      stageFailFast: stage.fail_fast,
      stageIndex: detailValue.stageIndex,
      stageJobRows: jobs.map(orchestrationJobDetailRow),
      stageJsonValue: stage,
      stageName: stage.name || "-",
      stageStatusLabel: statusDisplay.statusLabel,
      stageStrategyLabel,
    };
  }
  const target = objectValue(detailValue.target);
  const statusDisplay = orchestrationStatusDisplay(target.status);
  const payloadSections = orchestrationTargetPayloadSections(target);
  const planName = detailValue.planName || "-";
  return {
    connectionName: target.connection_name || "-",
    durationMs: target.duration_ms ?? 0,
    error: orchestrationText(target.error || ""),
    hasPayloadSections: payloadSections.length > 0,
    host: target.host || "-",
    jobIndex: detailValue.jobIndex,
    jobName: detailValue.jobName || "-",
    operation: target.operation || "-",
    orchestrationBasicSectionTitle,
    orchestrationErrorSectionTitle: t("detailLabelError"),
    orchestrationRawSectionTitle,
    payloadSections,
    planName,
    stageIndex: detailValue.stageIndex,
    stageName: detailValue.stageName || "-",
    targetBasicFieldRows: orchestrationTargetBasicFieldRows({
      detail: detailValue,
      planName,
      target,
      targetStatusDisplay: statusDisplay,
    }),
    targetIndex: detailValue.targetIndex,
    targetJsonValue: target,
    targetLabel: target.label || "",
    targetNoPayloadMessage: t("orchestrationDetailNoPayload"),
    targetPayloadSectionTitle: t("orchestrationDetailSectionPayload"),
    targetStatusLabel: statusDisplay.statusLabel,
  };
}

function orchestrationExecutionStageRows(stages: unknown = []) {
  return (Array.isArray(stages) ? stages : []).map((stage, index) => {
    const stageValue = objectValue(stage);
    const jobs = Array.isArray(stageValue.jobs) ? stageValue.jobs : [];
    const jobsFailedText = orchestrationText(stageValue.jobs_failed || 0);
    const jobsSkippedText = orchestrationText(stageValue.jobs_skipped || 0);
    const jobsSucceededText = orchestrationText(stageValue.jobs_succeeded || 0);
    const jobsTotalText = orchestrationText(stageValue.jobs_total || 0);
    return {
      detailButtonLabel: t("orchestrationDetailBtn"),
      hasJobs: jobs.length > 0,
      jobs: jobs.map(orchestrationJobDetailRow),
      jobsFailedText,
      jobsSkippedText,
      jobsSucceededText,
      jobsTotalText,
      noJobsText: "-",
      stageSummaryChips: orchestrationCountChipRows({
        failedText: jobsFailedText,
        jobsText: jobsTotalText,
        skippedText: jobsSkippedText,
        succeededText: jobsSucceededText,
      }),
      title: `stage[${index}] ${orchestrationText(stageValue.name || "")}`,
      ...orchestrationStatusDisplay(stageValue.status),
    };
  });
}

function orchestrationExecutionDetailIndex(
  stages: unknown = [],
  planName: unknown = "-",
): ExecutionDetailIndex {
  const stageDetails: DetailEntry[] = [];
  const targetDetails: DetailEntry[][][] = [];
  (Array.isArray(stages) ? stages : []).forEach((stage, stageIndex) => {
    const stageValue = objectValue(stage);
    stageDetails.push({
      detail: {
        kind: "stage",
        planName,
        stage: stageValue,
        stageIndex,
      },
      titleKey: "orchestrationStageDetailTitle",
      titleText: t("orchestrationStageDetailTitle"),
    });
    const jobs = Array.isArray(stageValue.jobs) ? stageValue.jobs : [];
    targetDetails.push(
      jobs.map((job, jobIndex) => {
        const jobValue = objectValue(job);
        const targets = Array.isArray(jobValue.results) ? jobValue.results : [];
        return targets.map((target, targetIndex) => ({
          detail: {
            jobIndex,
            jobName: jobValue.name || `job-${jobIndex + 1}`,
            kind: "target",
            planName,
            stageIndex,
            stageName: stageValue.name || "-",
            target: objectValue(target),
            targetIndex,
          },
          titleKey: "orchestrationTargetDetailTitle",
          titleText: t("orchestrationTargetDetailTitle"),
        }));
      }),
    );
  });
  return { stageDetails, targetDetails };
}

export function orchestrationExecutionDetailAt(
  detailIndex: unknown = {},
  stageIndex = 0,
  jobIndex: number | null = null,
  targetIndex: number | null = null,
): DetailEntry | null {
  const source = orchestrationExecutionDetailSource(
    detailIndex,
    stageIndex,
    jobIndex,
  );
  if (!Array.isArray(source)) return null;
  const detail = source[targetIndex ?? stageIndex];
  return detail && typeof detail === "object" ? (detail as DetailEntry) : null;
}

export function orchestrationExecutionPresentation(
  orchestrationRun: unknown = null,
) {
  const run = objectValue(orchestrationRun);
  const stages = Array.isArray(run.stages) ? run.stages : [];
  const planName = run.plan_name || "-";
  const executedStages = run.executed_stages || 0;
  const stageRows = orchestrationExecutionStageRows(stages);
  const success = !!run.success;
  const totalStages = run.total_stages || stages.length;
  const stageCountText = `${executedStages || 0}/${totalStages || stageRows.length}`;
  return {
    detailButtonLabel: t("orchestrationDetailBtn"),
    detailIndex: orchestrationExecutionDetailIndex(stages, planName),
    emptyMessage: t("orchestrationVisualEmpty"),
    hasResult: Boolean(orchestrationRun),
    hasStageRows: stageRows.length > 0,
    requestFailedMessage: t("requestFailed"),
    resultTitle: t("orchestrationResultTitle"),
    stageCountSummaryText: `${t("orchestrationVisualStages")}: ${stageCountText}`,
    stageCountText,
    stageRows,
    summaryCards: [
      orchestrationSummaryCard("orchestrationVisualName", planName || "-"),
      orchestrationSummaryCard("orchestrationResultSuccess", String(success)),
      orchestrationSummaryCard("orchestrationVisualStages", stageCountText),
      orchestrationSummaryCard(
        "orchestrationVisualFailFast",
        String(run.fail_fast !== false),
      ),
    ],
  };
}
