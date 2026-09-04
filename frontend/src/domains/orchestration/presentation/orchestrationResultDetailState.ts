import { t } from "../../../lib/i18n.js";
import {
  booleanPillPresentation,
  borderedPillClass,
  displayText,
  workflowChipClass,
} from "../../../lib/ui.js";
import type {
  OrchestrationExecutionDetail,
  OrchestrationExecutionDetailEntry,
  OrchestrationExecutionDetailIndex,
  OrchestrationExecutionResult,
  OrchestrationExecutionStatus,
  OrchestrationJsonValue,
  OrchestrationJobExecutionResult,
  OrchestrationStageExecutionDetail,
  OrchestrationStageExecutionResult,
  OrchestrationStrategy,
  OrchestrationTargetExecutionDetail,
  OrchestrationTargetExecutionResult,
} from "../model/types.js";

type DisplayValue = boolean | number | string | null | undefined;

interface StatusDisplay {
  statusBadgeClass: string;
  statusLabel: string;
}

interface StatusDisplayDefinition {
  badgeClass: string;
  labelKey: string;
}

interface CountChipOptions {
  failedText?: DisplayValue;
  jobsText?: DisplayValue;
  skippedText?: DisplayValue;
  succeededText?: DisplayValue;
}

interface StageBasicFieldOptions {
  detail: OrchestrationStageExecutionDetail;
  jobsFailed: number;
  jobsSkipped: number;
  jobsSucceeded: number;
  planName: string;
  stage: OrchestrationStageExecutionResult;
  stageStatusDisplay: StatusDisplay;
  stageStrategyLabel: string;
}

interface TargetBasicFieldOptions {
  detail: OrchestrationTargetExecutionDetail;
  planName: string;
  target: OrchestrationTargetExecutionResult;
  targetStatusDisplay: StatusDisplay;
}

function orchestrationText(displaySource: DisplayValue): string {
  return displayText(displaySource);
}

const orchestrationSummaryCard = (key: string, summaryValue: DisplayValue) => ({
  label: t(key),
  summaryValue,
});

function orchestrationExecutionDetailSource(
  detailIndex: OrchestrationExecutionDetailIndex,
  stageIndex = 0,
  jobIndex: number | null = null,
): OrchestrationExecutionDetailEntry[] {
  if (jobIndex == null) return detailIndex.stageDetails;
  return detailIndex.targetDetails[stageIndex]?.[jobIndex] ?? [];
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

function orchestrationStatusDisplay(
  status: OrchestrationExecutionStatus | "",
): StatusDisplay {
  const normalized = orchestrationText(status || "-").toLowerCase();
  const statusDisplay = ORCHESTRATION_STATUS_DISPLAY[normalized];
  const badgeClass =
    statusDisplay?.badgeClass || "border-slate-200 bg-slate-50 text-slate-700";
  return {
    statusBadgeClass: borderedPillClass(badgeClass),
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
  const chips: Array<[string, DisplayValue]> = [
    ["orchestrationStatusSuccess", succeededText],
    ["orchestrationStatusFailed", failedText],
    ["orchestrationStatusSkipped", skippedText],
  ];
  if (jobsText != null) chips.push(["orchestrationStageJobs", jobsText]);
  return chips.map(([labelKey, valueText]) => ({
    chipClass: workflowChipClass(),
    labelText: t(labelKey),
    valueText: orchestrationText(valueText),
  }));
}

function orchestrationIndexedLabel(
  prefix: string,
  index: number,
  displayName: string,
): string {
  return `${prefix}[${index}] ${orchestrationText(displayName)}`;
}

function orchestrationTargetPayloadSections(
  target: OrchestrationTargetExecutionResult,
) {
  const sections: Array<[string, OrchestrationJsonValue | undefined]> = [
    ["orchestrationPayloadTxResult", target.tx_result],
    ["orchestrationPayloadWorkflowResult", target.workflow_result],
    ["orchestrationPayloadCompensation", target.compensation],
  ];
  return sections
    .filter(([, jsonValue]) => jsonValue != null)
    .map(([labelKey, jsonValue]) => ({
      jsonValue: jsonValue ?? null,
      labelKey,
      titleText: t(labelKey),
    }));
}

const orchestrationDetailTextField = (
  labelKey: string,
  valueText: DisplayValue,
  { mono = false }: { mono?: boolean } = {},
) => ({
  badgeClass: "",
  detailValue: orchestrationText(valueText),
  kind: "text",
  labelText: t(labelKey),
  mono,
  valueText: orchestrationText(valueText),
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
  mono: false,
  statusBadgeClass,
  statusLabel,
  valueText: statusLabel,
});

const orchestrationDetailPillField = (
  labelKey: string,
  pillDisplay: { pillClassName: string; text: string },
) => ({
  badgeClass: pillDisplay.pillClassName,
  detailValue: pillDisplay.text,
  kind: "pill",
  labelText: t(labelKey),
  mono: false,
  valueText: pillDisplay.text,
});

function orchestrationStageStrategyLabel(
  strategy: OrchestrationStrategy,
): string {
  return orchestrationText(strategy || "serial") === "parallel"
    ? t("orchestrationStrategyParallel")
    : t("orchestrationStrategySerial");
}

function orchestrationActionField(
  label: string,
  detailValue: DisplayValue,
  { mono = false }: { mono?: boolean } = {},
) {
  return {
    detailValue: orchestrationText(detailValue || "-"),
    label,
    mono,
  };
}

function orchestrationStageBasicFieldRows({
  detail,
  jobsFailed,
  jobsSkipped,
  jobsSucceeded,
  planName,
  stage,
  stageStatusDisplay,
  stageStrategyLabel,
}: StageBasicFieldOptions) {
  return [
    orchestrationDetailTextField("orchestrationVisualName", planName),
    orchestrationDetailTextField(
      "orchestrationDetailLabelStage",
      orchestrationIndexedLabel("stage", detail.stageIndex, stage.name || "-"),
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
      booleanPillPresentation(stage.fail_fast),
    ),
    orchestrationDetailTextField("orchestrationStatusSuccess", jobsSucceeded),
    orchestrationDetailTextField("orchestrationStatusFailed", jobsFailed),
    orchestrationDetailTextField("orchestrationStatusSkipped", jobsSkipped),
  ];
}

function orchestrationTargetBasicFieldRows({
  detail,
  planName,
  target,
  targetStatusDisplay,
}: TargetBasicFieldOptions) {
  return [
    orchestrationDetailTextField("orchestrationVisualName", planName),
    orchestrationDetailTextField(
      "orchestrationDetailLabelStage",
      orchestrationIndexedLabel("stage", detail.stageIndex, detail.stageName),
    ),
    orchestrationDetailTextField(
      "orchestrationDetailLabelJob",
      orchestrationIndexedLabel("job", detail.jobIndex, detail.jobName),
    ),
    orchestrationDetailTextField(
      "orchestrationDetailLabelTarget",
      orchestrationIndexedLabel(
        "target",
        detail.targetIndex,
        target.label || "",
      ),
    ),
    orchestrationDetailStatusField(
      "orchestrationDetailLabelStatus",
      targetStatusDisplay.statusLabel,
      targetStatusDisplay.statusBadgeClass,
    ),
    orchestrationDetailTextField(
      "orchestrationDetailLabelConnection",
      target.connection_name || "-",
    ),
    orchestrationDetailTextField(
      "orchestrationDetailLabelHost",
      target.host || "-",
      { mono: true },
    ),
    orchestrationDetailTextField(
      "orchestrationDetailLabelOperation",
      target.operation || "-",
      { mono: true },
    ),
    orchestrationDetailTextField(
      "orchestrationDetailLabelDurationMs",
      target.duration_ms,
      { mono: true },
    ),
  ];
}

function orchestrationTargetDetailRow(
  target: OrchestrationTargetExecutionResult,
) {
  const durationText = orchestrationText(target.duration_ms);
  const errorText = orchestrationText(target.error || "");
  const hostText = orchestrationText(target.host || "-");
  const operationText = orchestrationText(target.operation || "-");
  return {
    detailButtonLabel: t("orchestrationDetailBtn"),
    errorText,
    label: orchestrationText(target.label || ""),
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
    ...orchestrationStatusDisplay(target.status),
  };
}

function orchestrationJobDetailRow(
  job: OrchestrationJobExecutionResult,
  index = 0,
) {
  const targetsFailedText = orchestrationText(job.targets_failed);
  const targetsSkippedText = orchestrationText(job.targets_skipped);
  const targetsSucceededText = orchestrationText(job.targets_succeeded);
  const actionSummaryText = orchestrationText(
    job.action_summary || job.action_kind || "-",
  );
  return {
    actionFields: [
      orchestrationActionField(
        t("orchestrationStageAction"),
        actionSummaryText,
      ),
    ],
    actionSummaryText,
    hasTargetRows: job.results.length > 0,
    noTargetText: "-",
    targetRows: job.results.map(orchestrationTargetDetailRow),
    targetSummaryChips: orchestrationCountChipRows({
      failedText: targetsFailedText,
      skippedText: targetsSkippedText,
      succeededText: targetsSucceededText,
    }),
    targetsFailedText,
    targetsSkippedText,
    targetsSucceededText,
    title: `job[${index}] ${orchestrationText(job.name || "") || "-"}`,
    ...orchestrationStatusDisplay(job.status),
  };
}

export function orchestrationStageJobsPanelDisplay() {
  return {
    sectionTitle: t("orchestrationDetailSectionJobs"),
  };
}

export function orchestrationDetailDisplay(
  detail: OrchestrationExecutionDetail,
) {
  const orchestrationBasicSectionTitle = t("detailSectionBasic");
  const orchestrationRawSectionTitle = t("detailSectionRaw");
  if (detail.kind === "stage") {
    const stage = detail.stage;
    const statusDisplay = orchestrationStatusDisplay(stage.status);
    const planName = detail.planName || "-";
    const stageStrategyLabel = orchestrationStageStrategyLabel(stage.strategy);
    const jobsFailed = stage.jobs_failed ?? 0;
    const jobsSkipped = stage.jobs_skipped ?? 0;
    const jobsSucceeded = stage.jobs_succeeded ?? 0;
    return {
      hasStageJobRows: stage.jobs.length > 0,
      jobsFailed,
      jobsSkipped,
      jobsSucceeded,
      orchestrationBasicSectionTitle,
      orchestrationRawSectionTitle,
      planName,
      stageBasicFieldRows: orchestrationStageBasicFieldRows({
        detail,
        jobsFailed,
        jobsSkipped,
        jobsSucceeded,
        planName,
        stage,
        stageStatusDisplay: statusDisplay,
        stageStrategyLabel,
      }),
      stageFailFast: stage.fail_fast,
      stageIndex: detail.stageIndex,
      stageJobRows: stage.jobs.map(orchestrationJobDetailRow),
      stageJsonValue: stage,
      stageName: stage.name || "-",
      stageStatusLabel: statusDisplay.statusLabel,
      stageStrategyLabel,
    };
  }
  const target = detail.target;
  const statusDisplay = orchestrationStatusDisplay(target.status);
  const payloadSections = orchestrationTargetPayloadSections(target);
  const planName = detail.planName || "-";
  return {
    connectionName: target.connection_name || "-",
    durationMs: target.duration_ms ?? 0,
    error: orchestrationText(target.error || ""),
    hasPayloadSections: payloadSections.length > 0,
    host: target.host || "-",
    jobIndex: detail.jobIndex,
    jobName: detail.jobName || "-",
    operation: target.operation || "-",
    orchestrationBasicSectionTitle,
    orchestrationErrorSectionTitle: t("detailLabelError"),
    orchestrationRawSectionTitle,
    payloadSections,
    planName,
    stageIndex: detail.stageIndex,
    stageName: detail.stageName || "-",
    targetBasicFieldRows: orchestrationTargetBasicFieldRows({
      detail,
      planName,
      target,
      targetStatusDisplay: statusDisplay,
    }),
    targetIndex: detail.targetIndex,
    targetJsonValue: target,
    targetLabel: target.label || "",
    targetNoPayloadMessage: t("orchestrationDetailNoPayload"),
    targetPayloadSectionTitle: t("orchestrationDetailSectionPayload"),
    targetStatusLabel: statusDisplay.statusLabel,
  };
}

function orchestrationExecutionStageRows(
  stages: readonly OrchestrationStageExecutionResult[],
) {
  return stages.map((stage, index) => {
    const jobsFailedText = orchestrationText(stage.jobs_failed);
    const jobsSkippedText = orchestrationText(stage.jobs_skipped);
    const jobsSucceededText = orchestrationText(stage.jobs_succeeded);
    const jobsTotalText = orchestrationText(stage.jobs_total);
    return {
      detailButtonLabel: t("orchestrationDetailBtn"),
      hasJobs: stage.jobs.length > 0,
      jobs: stage.jobs.map(orchestrationJobDetailRow),
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
      title: `stage[${index}] ${orchestrationText(stage.name || "")}`,
      ...orchestrationStatusDisplay(stage.status),
    };
  });
}

function orchestrationExecutionDetailIndex(
  stages: readonly OrchestrationStageExecutionResult[],
  planName: string,
): OrchestrationExecutionDetailIndex {
  const stageDetails: OrchestrationExecutionDetailEntry[] = [];
  const targetDetails: OrchestrationExecutionDetailEntry[][][] = [];
  stages.forEach((stage, stageIndex) => {
    stageDetails.push({
      detail: {
        kind: "stage",
        planName,
        stage,
        stageIndex,
      },
      titleKey: "orchestrationStageDetailTitle",
      titleText: t("orchestrationStageDetailTitle"),
    });
    targetDetails.push(
      stage.jobs.map((job, jobIndex) => {
        return job.results.map((target, targetIndex) => ({
          detail: {
            jobIndex,
            jobName: job.name || `job-${jobIndex + 1}`,
            kind: "target",
            planName,
            stageIndex,
            stageName: stage.name || "-",
            target,
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
  detailIndex: OrchestrationExecutionDetailIndex,
  stageIndex = 0,
  jobIndex: number | null = null,
  targetIndex: number | null = null,
): OrchestrationExecutionDetailEntry | null {
  const source = orchestrationExecutionDetailSource(
    detailIndex,
    stageIndex,
    jobIndex,
  );
  const detail = source[targetIndex ?? stageIndex];
  return detail ?? null;
}

export function orchestrationExecutionPresentation(
  orchestrationRun: OrchestrationExecutionResult | null = null,
) {
  const stages = orchestrationRun?.stages ?? [];
  const planName = orchestrationRun?.plan_name || "-";
  const executedStages = orchestrationRun?.executed_stages ?? 0;
  const stageRows = orchestrationExecutionStageRows(stages);
  const success = orchestrationRun?.success ?? false;
  const totalStages = orchestrationRun?.total_stages ?? stages.length;
  const stageCountText = `${executedStages}/${totalStages}`;
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
        String(orchestrationRun?.fail_fast !== false),
      ),
    ],
  };
}
