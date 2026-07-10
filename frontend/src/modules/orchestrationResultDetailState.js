import { t } from "../lib/i18n.js";
import {
  booleanPillPresentation,
  borderedPillClass,
  displayText,
  workflowChipClass,
} from "../lib/ui.js";

function orchestrationText(displaySource) {
  return displayText(displaySource);
}

const orchestrationSummaryCard = (key, summaryValue) => ({
  label: t(key),
  summaryValue,
});

function orchestrationExecutionDetailSource(
  detailIndex = {},
  stageIndex = 0,
  jobIndex = null,
) {
  return jobIndex == null
    ? detailIndex.stageDetails
    : detailIndex.targetDetails?.[stageIndex]?.[jobIndex];
}

const ORCHESTRATION_STATUS_DISPLAY = Object.freeze({
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

function orchestrationStatusDisplay(status) {
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
} = {}) {
  const chips = [
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

function orchestrationIndexedLabel(prefix, index, displayName) {
  const safeIndex = typeof index === "number" ? index : 0;
  return `${prefix}[${safeIndex}] ${orchestrationText(displayName)}`;
}

function orchestrationTargetPayloadSections(target) {
  return [
    ["orchestrationPayloadTxResult", target?.tx_result],
    ["orchestrationPayloadWorkflowResult", target?.workflow_result],
    ["orchestrationPayloadCompensation", target?.compensation],
  ]
    .filter(([, jsonValue]) => jsonValue != null)
    .map(([labelKey, jsonValue]) => ({
      jsonValue,
      labelKey,
      titleText: t(labelKey),
    }));
}

const orchestrationDetailTextField = (labelKey, valueText, fieldCfg = {}) => ({
  badgeClass: "",
  detailValue: valueText,
  kind: "text",
  labelText: t(labelKey),
  mono: !!fieldCfg.mono,
  valueText,
});

const orchestrationDetailStatusField = (
  labelKey,
  statusLabel,
  statusBadgeClass,
) => ({
  badgeClass: statusBadgeClass,
  detailValue: statusLabel,
  kind: "status",
  labelText: t(labelKey),
  statusBadgeClass,
  statusLabel,
});

const orchestrationDetailPillField = (labelKey, pillDisplay) => ({
  badgeClass: pillDisplay.pillClassName,
  detailValue: pillDisplay.text,
  labelText: t(labelKey),
});

function orchestrationStageStrategyLabel(strategy) {
  return orchestrationText(strategy || "serial") === "parallel"
    ? t("orchestrationStrategyParallel")
    : t("orchestrationStrategySerial");
}

function orchestrationActionField(label, detailValue, fieldCfg = {}) {
  return {
    detailValue: orchestrationText(detailValue || "-"),
    label,
    mono: !!fieldCfg.mono,
  };
}

function orchestrationStageBasicFieldRows({
  detail = {},
  jobsFailed = 0,
  jobsSkipped = 0,
  jobsSucceeded = 0,
  planName = "-",
  stage = {},
  stageStatusDisplay = {},
  stageStrategyLabel = "",
} = {}) {
  return [
    orchestrationDetailTextField("orchestrationVisualName", planName),
    orchestrationDetailTextField(
      "orchestrationDetailLabelStage",
      orchestrationIndexedLabel(
        "stage",
        detail?.stageIndex,
        stage?.name || "-",
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
      booleanPillPresentation(stage?.fail_fast),
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
  targetStatusDisplay = {},
} = {}) {
  return [
    orchestrationDetailTextField("orchestrationVisualName", planName),
    orchestrationDetailTextField(
      "orchestrationDetailLabelStage",
      orchestrationIndexedLabel("stage", detail?.stageIndex, detail?.stageName),
    ),
    orchestrationDetailTextField(
      "orchestrationDetailLabelJob",
      orchestrationIndexedLabel("job", detail?.jobIndex, detail?.jobName),
    ),
    orchestrationDetailTextField(
      "orchestrationDetailLabelTarget",
      orchestrationIndexedLabel(
        "target",
        detail?.targetIndex,
        target?.label || "",
      ),
    ),
    orchestrationDetailStatusField(
      "orchestrationDetailLabelStatus",
      targetStatusDisplay.statusLabel,
      targetStatusDisplay.statusBadgeClass,
    ),
    orchestrationDetailTextField(
      "orchestrationDetailLabelConnection",
      target?.connection_name || "-",
    ),
    orchestrationDetailTextField(
      "orchestrationDetailLabelHost",
      target?.host || "-",
      {
        mono: true,
      },
    ),
    orchestrationDetailTextField(
      "orchestrationDetailLabelOperation",
      target?.operation || "-",
      { mono: true },
    ),
    orchestrationDetailTextField(
      "orchestrationDetailLabelDurationMs",
      target?.duration_ms ?? 0,
      { mono: true },
    ),
  ];
}

function orchestrationTargetDetailRow(target = {}) {
  const durationText = orchestrationText(target?.duration_ms || 0);
  const errorText = orchestrationText(target?.error || "");
  const hostText = orchestrationText(target?.host || "-");
  const operationText = orchestrationText(target?.operation || "-");
  return {
    detailButtonLabel: t("orchestrationDetailBtn"),
    errorText,
    label: orchestrationText(target?.label || ""),
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
    ...orchestrationStatusDisplay(target?.status),
  };
}

function orchestrationJobDetailRow(job = {}, index = 0) {
  const targets = Array.isArray(job?.results) ? job.results : [];
  const targetsFailedText = orchestrationText(job?.targets_failed || 0);
  const targetsSkippedText = orchestrationText(job?.targets_skipped || 0);
  const targetsSucceededText = orchestrationText(job?.targets_succeeded || 0);
  const actionSummaryText = orchestrationText(
    job?.action_summary || job?.action_kind || "-",
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
    title: `job[${index}] ${orchestrationText(job?.name || "") || "-"}`,
    ...orchestrationStatusDisplay(job?.status),
  };
}

export function orchestrationStageJobsPanelDisplay() {
  return {
    sectionTitle: t("orchestrationDetailSectionJobs"),
  };
}

export function orchestrationDetailDisplay(detail = {}) {
  const orchestrationBasicSectionTitle = t("detailSectionBasic");
  const orchestrationRawSectionTitle = t("detailSectionRaw");
  if (detail?.kind === "stage") {
    const stage = detail?.stage || {};
    const jobs = Array.isArray(stage?.jobs) ? stage.jobs : [];
    const statusDisplay = orchestrationStatusDisplay(stage?.status);
    const planName = detail?.planName || "-";
    const stageStrategyLabel = orchestrationStageStrategyLabel(stage?.strategy);
    const jobsFailed = stage?.jobs_failed ?? 0;
    const jobsSkipped = stage?.jobs_skipped ?? 0;
    const jobsSucceeded = stage?.jobs_succeeded ?? 0;
    return {
      hasStageJobRows: jobs.length > 0,
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
      stageFailFast: stage?.fail_fast,
      stageIndex: detail?.stageIndex,
      stageJobRows: jobs.map(orchestrationJobDetailRow),
      stageJsonValue: stage,
      stageName: stage?.name || "-",
      stageStatusLabel: statusDisplay.statusLabel,
      stageStrategyLabel,
    };
  }
  const target = detail?.target || {};
  const statusDisplay = orchestrationStatusDisplay(target?.status);
  const payloadSections = orchestrationTargetPayloadSections(target);
  const planName = detail?.planName || "-";
  return {
    connectionName: target?.connection_name || "-",
    durationMs: target?.duration_ms ?? 0,
    error: orchestrationText(target?.error || ""),
    hasPayloadSections: payloadSections.length > 0,
    host: target?.host || "-",
    jobIndex: detail?.jobIndex,
    jobName: detail?.jobName || "-",
    operation: target?.operation || "-",
    orchestrationBasicSectionTitle,
    orchestrationErrorSectionTitle: t("detailLabelError"),
    orchestrationRawSectionTitle,
    payloadSections,
    planName,
    stageIndex: detail?.stageIndex,
    stageName: detail?.stageName || "-",
    targetBasicFieldRows: orchestrationTargetBasicFieldRows({
      detail,
      planName,
      target,
      targetStatusDisplay: statusDisplay,
    }),
    targetIndex: detail?.targetIndex,
    targetJsonValue: target,
    targetLabel: target?.label || "",
    targetNoPayloadMessage: t("orchestrationDetailNoPayload"),
    targetPayloadSectionTitle: t("orchestrationDetailSectionPayload"),
    targetStatusLabel: statusDisplay.statusLabel,
  };
}

function orchestrationExecutionStageRows(stages = []) {
  return (Array.isArray(stages) ? stages : []).map((stage, index) => {
    const jobs = Array.isArray(stage?.jobs) ? stage.jobs : [];
    const jobsFailedText = orchestrationText(stage?.jobs_failed || 0);
    const jobsSkippedText = orchestrationText(stage?.jobs_skipped || 0);
    const jobsSucceededText = orchestrationText(stage?.jobs_succeeded || 0);
    const jobsTotalText = orchestrationText(stage?.jobs_total || 0);
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
      title: `stage[${index}] ${orchestrationText(stage?.name || "")}`,
      ...orchestrationStatusDisplay(stage?.status),
    };
  });
}

function orchestrationExecutionDetailIndex(stages = [], planName = "-") {
  const stageDetails = [];
  const targetDetails = [];
  (Array.isArray(stages) ? stages : []).forEach((stage, stageIndex) => {
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
    const jobs = Array.isArray(stage?.jobs) ? stage.jobs : [];
    targetDetails.push(
      jobs.map((job, jobIndex) => {
        const targets = Array.isArray(job?.results) ? job.results : [];
        return targets.map((target, targetIndex) => ({
          detail: {
            jobIndex,
            jobName: job?.name || `job-${jobIndex + 1}`,
            kind: "target",
            planName,
            stageIndex,
            stageName: stage?.name || "-",
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
  detailIndex = {},
  stageIndex = 0,
  jobIndex = null,
  targetIndex = null,
) {
  const source = orchestrationExecutionDetailSource(
    detailIndex,
    stageIndex,
    jobIndex,
  );
  return Array.isArray(source)
    ? source[targetIndex ?? stageIndex] || null
    : null;
}

export function orchestrationExecutionPresentation(orchestrationRun = null) {
  const stages = Array.isArray(orchestrationRun?.stages)
    ? orchestrationRun.stages
    : [];
  const planName = orchestrationRun?.plan_name || "-";
  const executedStages = orchestrationRun?.executed_stages || 0;
  const stageRows = orchestrationExecutionStageRows(stages);
  const success = !!orchestrationRun?.success;
  const totalStages = orchestrationRun?.total_stages || stages.length;
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
        String(orchestrationRun?.fail_fast !== false),
      ),
    ],
  };
}
