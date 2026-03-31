/**
 * tx.js — tx
 */

function txPayload(dryRun) {
  const timeoutRaw = byId("tx-timeout-secs").value.trim();
  const timeout = timeoutRaw ? Number(timeoutRaw) : null;
  if (currentTxBlockRunKind === "flow") {
    return {
      name: byId("tx-name").value.trim() || null,
      run_kind: "command-flow",
      flow_template_name: byId("tx-flow-template-name").value.trim() || null,
      flow_vars: parseJsonById("tx-flow-vars"),
      rollback_flow_template_name:
        byId("tx-rollback-flow-template-name").value.trim() || null,
      rollback_flow_vars: parseJsonById("tx-rollback-flow-vars"),
      mode: byId("tx-flow-mode").value.trim() || null,
      timeout_secs: Number.isFinite(timeout) && timeout > 0 ? timeout : null,
      rollback_on_failure: byId("tx-flow-rollback-on-failure").checked,
      dry_run: dryRun,
      connection: connectionPayload(),
      record_level: recordLevelPayload(),
    };
  }
  const rollbackMode = byId("tx-rollback-mode").value || "per_step";
  return {
    name: byId("tx-name").value.trim() || null,
    run_kind: "commands",
    template: byId("tx-template").value.trim() || null,
    vars: parseJsonById("tx-vars"),
    commands: parseTxCommands(),
    mode: byId("tx-mode").value.trim() || null,
    timeout_secs: Number.isFinite(timeout) && timeout > 0 ? timeout : null,
    resource_rollback_command:
      rollbackMode === "whole_resource"
        ? byId("tx-resource-rollback").value.trim() || null
        : null,
    rollback_on_failure: byId("tx-rollback-on-failure").checked,
    rollback_trigger_step_index:
      rollbackMode === "whole_resource"
        ? Number(byId("tx-rollback-trigger-step").value || 0)
        : null,
    rollback_commands:
      rollbackMode === "per_step"
        ? parseRollbackLinesRaw(byId("tx-rollback-commands").value || "")
        : [],
    dry_run: dryRun,
    connection: connectionPayload(),
    record_level: recordLevelPayload(),
  };
}

function txWorkflowPayload(dryRun) {
  const raw = byId("tx-workflow-json").value.trim();
  if (!raw) {
    throw new Error(t("txWorkflowJsonRequired"));
  }
  return {
    workflow: JSON.parse(raw),
    dry_run: dryRun,
    connection: connectionPayload(),
    record_level: recordLevelPayload(),
  };
}

function orchestrationPayload(dryRun) {
  const raw = byId("orchestration-json").value.trim();
  if (!raw) {
    throw new Error(t("orchestrationJsonRequired"));
  }
  return {
    plan: JSON.parse(raw),
    base_dir: byId("orchestration-base-dir").value.trim() || null,
    dry_run: dryRun,
    record_level: recordLevelPayload(),
  };
}

function createTxWorkflowBlock(seed = {}) {
  txWorkflowBlockSeq += 1;
  return {
    id: `tx-block-${txWorkflowBlockSeq}`,
    name: seed.name || "",
    kind: seed.kind || "config",
    rollbackPolicy: seed.rollbackPolicy || "per_step",
    mode: seed.mode || "Config",
    timeoutSecs: seed.timeoutSecs != null ? String(seed.timeoutSecs) : "",
    undoCommand: seed.undoCommand || "",
    commandsText: seed.commandsText || "",
    rollbackCommandsText: seed.rollbackCommandsText || "",
    failFast: seed.failFast !== false,
    collapsed: seed.collapsed === true,
    rollbackInputMode: seed.rollbackInputMode || "text",
    rollbackRule: seed.rollbackRule || "no_prefix",
    rollbackRuleTemplate: seed.rollbackRuleTemplate || "",
    rollbackOnFailure: seed.rollbackOnFailure === true,
    triggerStepIndex:
      seed.triggerStepIndex != null && seed.triggerStepIndex !== ""
        ? String(seed.triggerStepIndex)
        : "",
  };
}

function renderTxWorkflowBuilder() {
  const wrap = byId("tx-workflow-blocks");
  if (!wrap) return;
  const activeEl = document.activeElement;
  const active = activeEl
    ? {
        blockId: activeEl.getAttribute && activeEl.getAttribute("data-tx-block-id"),
        field: activeEl.getAttribute && activeEl.getAttribute("data-field"),
        cls: activeEl.classList ? Array.from(activeEl.classList) : [],
        index: activeEl.getAttribute && activeEl.getAttribute("data-index"),
        selStart:
          typeof activeEl.selectionStart === "number" ? activeEl.selectionStart : null,
        selEnd: typeof activeEl.selectionEnd === "number" ? activeEl.selectionEnd : null,
      }
    : null;
  if (!txWorkflowBlocks.length) {
    wrap.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("txWorkflowBuilderEmpty")
    )}</div>`;
    return;
  }
  const filteredBlocks = getFilteredTxWorkflowBlocks();
  if (!filteredBlocks.length) {
    wrap.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("txWorkflowFilterNoMatch")
    )}</div>`;
    return;
  }
  wrap.innerHTML = filteredBlocks
    .map(
      (block) => {
        const fullIdx = txWorkflowBlocks.findIndex((b) => b.id === block.id);
        const commandCount = txWorkflowLines(block.commandsText).length;
        const modeText = block.mode && block.mode.trim() ? block.mode.trim() : "Config";
        const kindText = block.kind === "show" ? "show" : "config";
        const rollbackText = block.rollbackPolicy || "per_step";
        const commandsList = txWorkflowLines(block.commandsText);
        const rollbackList = parseRollbackLinesRaw(block.rollbackCommandsText);
        const rollbackMode = block.rollbackInputMode || "text";
        const rollbackRule = block.rollbackRule || "no_prefix";
        const libraryName = block.rollbackLibraryName || "";
        return `
      <div class="group-card" data-tx-block-id="${escapeHtml(block.id)}">
        <div class="field-tools">
          <div class="grid gap-1">
            <span>#${fullIdx + 1}</span>
            <div class="inline-flex flex-wrap items-center gap-1">
              <span class="tx-workflow-chip">${escapeHtml(t("txWorkflowSummaryCommands"))}: ${commandCount}</span>
              <span class="tx-workflow-chip">${escapeHtml(t("txWorkflowSummaryKind"))}: ${escapeHtml(kindText)}</span>
              <span class="tx-workflow-chip">${escapeHtml(t("txWorkflowSummaryMode"))}: ${escapeHtml(modeText)}</span>
              <span class="tx-workflow-chip">${escapeHtml(t("txWorkflowSummaryRollback"))}: ${escapeHtml(rollbackText)}</span>
            </div>
          </div>
          <div class="inline-flex items-center gap-2">
            <button type="button" class="mini-btn js-tx-workflow-toggle-block" data-tx-block-id="${escapeHtml(
              block.id
            )}">${escapeHtml(block.collapsed ? t("expand") : t("collapse"))}</button>
            <button type="button" class="mini-btn js-tx-workflow-drag-block" data-tx-block-id="${escapeHtml(
              block.id
            )}" draggable="true">${escapeHtml(t("txWorkflowDragBtn"))}</button>
            <button type="button" class="mini-btn js-tx-workflow-move-up-block" data-tx-block-id="${escapeHtml(
              block.id
            )}" ${fullIdx === 0 ? "disabled" : ""}>${escapeHtml(t("txWorkflowMoveUpBtn"))}</button>
            <button type="button" class="mini-btn js-tx-workflow-move-down-block" data-tx-block-id="${escapeHtml(
              block.id
            )}" ${fullIdx === txWorkflowBlocks.length - 1 ? "disabled" : ""}>${escapeHtml(
        t("txWorkflowMoveDownBtn")
      )}</button>
            <button type="button" class="mini-btn js-tx-workflow-copy-block" data-tx-block-id="${escapeHtml(
              block.id
            )}">${escapeHtml(t("txWorkflowCopyBlockBtn"))}</button>
            <button type="button" class="mini-btn delete js-tx-workflow-delete-block" data-tx-block-id="${escapeHtml(
              block.id
            )}">${escapeHtml(t("txWorkflowDeleteBlockBtn"))}</button>
          </div>
        </div>
        <div class="group-body grid gap-2" ${block.collapsed ? "hidden" : ""}>
          <input class="input js-tx-workflow-field" data-field="name" data-tx-block-id="${escapeHtml(
            block.id
          )}" value="${escapeHtml(block.name)}" placeholder="${escapeHtml(
        t("txWorkflowBlockNamePlaceholder")
      )}" />
          <div class="grid gap-2 md:grid-cols-2">
            <input class="input js-tx-workflow-field" data-field="mode" data-tx-block-id="${escapeHtml(
              block.id
            )}" value="${escapeHtml(block.mode)}" placeholder="${escapeHtml(
        t("txWorkflowBlockModePlaceholder")
      )}" />
            <select class="input js-tx-workflow-field" data-field="kind" data-tx-block-id="${escapeHtml(
              block.id
            )}">
              <option value="config" ${block.kind === "config" ? "selected" : ""}>${escapeHtml(
        t("txWorkflowBlockKindConfig")
      )}</option>
              <option value="show" ${block.kind === "show" ? "selected" : ""}>${escapeHtml(
        t("txWorkflowBlockKindShow")
      )}</option>
            </select>
          </div>
          <div class="grid gap-2 md:grid-cols-2">
            <select class="input js-tx-workflow-field" data-field="rollbackPolicy" data-tx-block-id="${escapeHtml(
              block.id
            )}">
              <option value="none" ${block.rollbackPolicy === "none" ? "selected" : ""}>${escapeHtml(
        t("txWorkflowBlockRollbackNone")
      )}</option>
              <option value="per_step" ${block.rollbackPolicy === "per_step" ? "selected" : ""}>${escapeHtml(
        t("txWorkflowBlockRollbackPerStep")
      )}</option>
              <option value="whole_resource" ${
                block.rollbackPolicy === "whole_resource" ? "selected" : ""
              }>${escapeHtml(t("txWorkflowBlockRollbackWhole"))}</option>
            </select>
            <input class="input js-tx-workflow-field" data-field="timeoutSecs" data-tx-block-id="${escapeHtml(
              block.id
            )}" value="${escapeHtml(block.timeoutSecs)}" placeholder="${escapeHtml(
        t("txWorkflowBlockTimeoutPlaceholder")
      )}" />
          </div>
          ${
            block.rollbackPolicy === "whole_resource"
              ? `
          <div class="grid gap-2 md:grid-cols-2">
            <input class="input js-tx-workflow-field" data-field="undoCommand" data-tx-block-id="${escapeHtml(
              block.id
            )}" value="${escapeHtml(block.undoCommand)}" placeholder="${escapeHtml(
                  t("txWorkflowBlockUndoPlaceholder")
                )}" />
            <input class="input js-tx-workflow-field" data-field="triggerStepIndex" data-tx-block-id="${escapeHtml(
              block.id
            )}" value="${escapeHtml(block.triggerStepIndex || "")}" placeholder="${escapeHtml(
                  t("txWorkflowRollbackTriggerStepPlaceholder")
                )}" />
          </div>
          `
              : `
          <input class="input js-tx-workflow-field" data-field="undoCommand" data-tx-block-id="${escapeHtml(
            block.id
          )}" value="${escapeHtml(block.undoCommand)}" placeholder="${escapeHtml(
                  t("txWorkflowBlockUndoPlaceholder")
                )}" />
          `
          }
          ${
            block.rollbackPolicy === "per_step"
              ? `
          <label class="check-label">
            <input type="checkbox" class="check-input js-tx-workflow-field" data-field="rollbackOnFailure" data-tx-block-id="${escapeHtml(
              block.id
            )}" ${block.rollbackOnFailure ? "checked" : ""} />
            <span>${escapeHtml(t("txWorkflowRollbackOnFailureLabel"))}</span>
          </label>
          `
              : ""
          }
          <label class="check-label">
            <input type="checkbox" class="check-input js-tx-workflow-field" data-field="failFast" data-tx-block-id="${escapeHtml(
              block.id
            )}" ${block.failFast ? "checked" : ""} />
            <span>${escapeHtml(t("txWorkflowFailFastLabel"))}</span>
          </label>
          <textarea class="input min-h-24 font-mono js-tx-workflow-field" data-field="commandsText" data-tx-block-id="${escapeHtml(
            block.id
          )}" placeholder="${escapeHtml(t("txWorkflowBlockCommandsPlaceholder"))}">${escapeHtml(
        block.commandsText
      )}</textarea>
          ${
            block.rollbackPolicy === "per_step"
              ? `
          <div class="grid gap-2">
            <div class="inline-flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-600">
              <span>${escapeHtml(t("txWorkflowRollbackInputModeLabel"))}</span>
              <div class="tab-group">
                <button type="button" class="tab-btn ${rollbackMode === "text" ? "is-active" : ""} js-tx-workflow-rollback-mode" data-mode="text" data-tx-block-id="${escapeHtml(
                  block.id
                )}">${escapeHtml(t("txWorkflowRollbackInputText"))}</button>
                <button type="button" class="tab-btn ${rollbackMode === "pairs" ? "is-active" : ""} js-tx-workflow-rollback-mode" data-mode="pairs" data-tx-block-id="${escapeHtml(
                  block.id
                )}">${escapeHtml(t("txWorkflowRollbackInputPairs"))}</button>
              </div>
            </div>
            ${
              rollbackMode === "pairs"
                ? `
            <div class="grid gap-2">
              <div class="inline-flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <button type="button" class="mini-btn js-tx-workflow-rollback-auto" data-tx-block-id="${escapeHtml(
                  block.id
                )}">${escapeHtml(t("txWorkflowRollbackAutoBtn"))}</button>
                <span>${escapeHtml(t("txWorkflowRollbackAutoHint"))}</span>
                <span class="ml-2 text-slate-400">${escapeHtml(t("txWorkflowRollbackRuleLabel"))}</span>
                <select class="input js-tx-workflow-rollback-rule" data-tx-block-id="${escapeHtml(
                  block.id
                )}">
                  <option value="no_prefix" ${rollbackRule === "no_prefix" ? "selected" : ""}>${escapeHtml(
                    t("txWorkflowRollbackRuleNoPrefix")
                  )}</option>
                  <option value="set_delete" ${rollbackRule === "set_delete" ? "selected" : ""}>${escapeHtml(
                    t("txWorkflowRollbackRuleSetDelete")
                  )}</option>
                  <option value="add_remove" ${rollbackRule === "add_remove" ? "selected" : ""}>${escapeHtml(
                    t("txWorkflowRollbackRuleAddRemove")
                  )}</option>
                  <option value="custom" ${rollbackRule === "custom" ? "selected" : ""}>${escapeHtml(
                    t("txWorkflowRollbackRuleCustom")
                  )}</option>
                </select>
                ${
                  rollbackRule === "custom"
                    ? `<input class="input js-tx-workflow-rollback-template" data-tx-block-id="${escapeHtml(
                        block.id
                      )}" value="${escapeHtml(
                        block.rollbackRuleTemplate || ""
                      )}" placeholder="${escapeHtml(
                        t("txWorkflowRollbackTemplatePlaceholder")
                      )}" />`
                    : ""
                }
              </div>
              <div class="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
                <select class="input js-tx-workflow-rollback-template-pick" data-tx-block-id="${escapeHtml(
                  block.id
                )}">
                  ${rollbackTemplateOptionsHtml(libraryName)}
                </select>
                <input class="input js-tx-workflow-rollback-template-name" data-tx-block-id="${escapeHtml(
                  block.id
                )}" value="${escapeHtml(libraryName)}" placeholder="${escapeHtml(
                  t("txWorkflowRollbackLibraryName")
                )}" />
                <button type="button" class="mini-btn js-tx-workflow-rollback-template-save" data-tx-block-id="${escapeHtml(
                  block.id
                )}">${escapeHtml(t("txWorkflowRollbackLibrarySave"))}</button>
                <button type="button" class="mini-btn delete js-tx-workflow-rollback-template-delete" data-tx-block-id="${escapeHtml(
                  block.id
                )}">${escapeHtml(t("txWorkflowRollbackLibraryDelete"))}</button>
              </div>
              ${
                commandsList.length
                  ? commandsList
                      .map((cmd, cmdIdx) => {
                        const rollbackValue = rollbackList[cmdIdx] || "";
                        return `
                <div class="grid gap-2 md:grid-cols-[1fr_1fr] tx-workflow-pair-row">
                  <div class="input tx-workflow-pair-label">
                    <span class="tx-workflow-pair-index">#${cmdIdx + 1}</span>
                    <span class="tx-workflow-pair-command">${escapeHtml(cmd)}</span>
                  </div>
                  <input class="input js-tx-workflow-rollback-pair" data-tx-block-id="${escapeHtml(
                    block.id
                  )}" data-index="${cmdIdx}" value="${escapeHtml(
                          rollbackValue
                        )}" placeholder="${escapeHtml(
                          t("txWorkflowBlockRollbacksPlaceholder")
                        )}" />
                </div>
              `;
                      })
                      .join("")
                  : `<div class="text-xs text-slate-500">${escapeHtml(
                      t("txWorkflowRollbackEmptyHint")
                    )}</div>`
              }
            </div>
            `
                : `
            <textarea class="input min-h-24 font-mono js-tx-workflow-field" data-field="rollbackCommandsText" data-tx-block-id="${escapeHtml(
              block.id
            )}" placeholder="${escapeHtml(
                    t("txWorkflowBlockRollbacksPlaceholder")
                  )}">${escapeHtml(block.rollbackCommandsText)}</textarea>
            `
            }
          </div>
          `
              : `
          <textarea class="input min-h-24 font-mono js-tx-workflow-field" data-field="rollbackCommandsText" data-tx-block-id="${escapeHtml(
            block.id
          )}" placeholder="${escapeHtml(
                  t("txWorkflowBlockRollbacksPlaceholder")
                )}">${escapeHtml(block.rollbackCommandsText)}</textarea>
          `
          }
        </div>
      </div>
    `;
      }
    )
    .join("");

  if (active && active.blockId) {
    let target = null;
    if (active.cls && active.cls.includes("js-tx-workflow-rollback-pair")) {
      target = wrap.querySelector(
        `.js-tx-workflow-rollback-pair[data-tx-block-id="${active.blockId}"][data-index="${active.index}"]`
      );
    } else if (active.field) {
      target = wrap.querySelector(
        `.js-tx-workflow-field[data-tx-block-id="${active.blockId}"][data-field="${active.field}"]`
      );
    }
    if (target) {
      target.focus();
      if (active.selStart != null && active.selEnd != null && target.setSelectionRange) {
        try {
          target.setSelectionRange(active.selStart, active.selEnd);
        } catch (_) {}
      }
    }
  }
}

function txWorkflowLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => !!s);
}

function txStepRunOperation(step) {
  if (!step || typeof step !== "object") return null;
  return step.run && typeof step.run === "object" ? step.run : null;
}

function txStepRollbackOperation(step) {
  if (!step || typeof step !== "object") return null;
  return step.rollback && typeof step.rollback === "object" ? step.rollback : null;
}

function txWholeResourceRollbackOperation(rollbackPolicy) {
  if (!rollbackPolicy || typeof rollbackPolicy !== "object") return null;
  const wholeResource = rollbackPolicy.whole_resource;
  if (!wholeResource || typeof wholeResource !== "object") return null;
  return wholeResource.rollback && typeof wholeResource.rollback === "object"
    ? wholeResource.rollback
    : null;
}

function txOperationMode(operation) {
  if (!operation || typeof operation !== "object") return "";
  if (typeof operation.mode === "string") return operation.mode.trim();
  if (operation.kind === "flow") {
    const steps = Array.isArray(operation.steps) ? operation.steps : [];
    return safeString(steps[0] && steps[0].mode).trim();
  }
  if (operation.kind === "template") {
    return safeString(operation.runtime && operation.runtime.default_mode).trim();
  }
  return "";
}

function txOperationTimeoutSeconds(operation) {
  if (!operation || typeof operation !== "object") return null;
  if (operation.timeout != null && String(operation.timeout).trim()) {
    return Number(operation.timeout);
  }
  if (operation.kind === "flow") {
    const steps = Array.isArray(operation.steps) ? operation.steps : [];
    return steps[0] && steps[0].timeout != null ? Number(steps[0].timeout) : null;
  }
  return null;
}

function txOperationDescription(operation) {
  if (!operation || typeof operation !== "object") return "";
  if (operation.kind === "command" || operation.command != null) {
    return safeString(operation.command).trim();
  }
  if (operation.kind === "flow") {
    const steps = Array.isArray(operation.steps) ? operation.steps : [];
    const first = safeString(steps[0] && steps[0].command).trim();
    if (!steps.length) return "flow";
    if (steps.length === 1) return first || "flow";
    return first ? `${first} ... (${steps.length} steps)` : `${steps.length} steps`;
  }
  if (operation.kind === "template") {
    const templateName = safeString(operation.template && operation.template.name).trim();
    const runtimeMode = safeString(
      operation.runtime && operation.runtime.default_mode
    ).trim();
    if (templateName && runtimeMode) return `${templateName} (${runtimeMode})`;
    return templateName || "template";
  }
  return "";
}

function autoScrollDuringDrag(event, container) {
  const y = event.clientY;
  const threshold = 96;
  const step = 22;
  if (!Number.isFinite(y)) return;

  if (container && container.scrollHeight > container.clientHeight) {
    const rect = container.getBoundingClientRect();
    if (y < rect.top + threshold) {
      container.scrollTop -= step;
      return;
    }
    if (y > rect.bottom - threshold) {
      container.scrollTop += step;
      return;
    }
  }

  const vpHeight = window.innerHeight || document.documentElement.clientHeight;
  if (y < threshold) {
    window.scrollBy(0, -step);
  } else if (y > vpHeight - threshold) {
    window.scrollBy(0, step);
  }
}

function clearTxWorkflowDropMarkers(container) {
  if (!container) return;
  container
    .querySelectorAll(
      ".tx-workflow-drop-target, .tx-workflow-drop-before, .tx-workflow-drop-after"
    )
    .forEach((el) => {
      el.classList.remove("tx-workflow-drop-target");
      el.classList.remove("tx-workflow-drop-before");
      el.classList.remove("tx-workflow-drop-after");
    });
}

function buildRollbackCommand(rule, cmd, template) {
  const raw = String(cmd || "").trim();
  if (!raw) return "";
  if (rule === "set_delete") {
    if (raw.startsWith("set ")) return `delete ${raw.slice(4).trim()}`;
    if (raw.startsWith("delete ")) return raw;
    return `no ${raw}`;
  }
  if (rule === "add_remove") {
    if (raw.startsWith("add ")) return `remove ${raw.slice(4).trim()}`;
    if (raw.startsWith("remove ")) return raw;
    return `no ${raw}`;
  }
  if (rule === "custom") {
    const tpl = String(template || "").trim();
    if (!tpl) return "";
    return tpl.replaceAll("{{cmd}}", raw);
  }
  if (raw.startsWith("no ")) return raw;
  return `no ${raw}`;
}

function getFilteredTxWorkflowBlocks() {
  const query = txWorkflowFilterQuery.trim().toLowerCase();
  return txWorkflowBlocks.filter((block) => {
    const kindOk = txWorkflowFilterKind === "all" || block.kind === txWorkflowFilterKind;
    const rollbackOk =
      txWorkflowFilterRollback === "all" ||
      block.rollbackPolicy === txWorkflowFilterRollback;
    const queryOk =
      !query ||
      String(block.name || "").toLowerCase().includes(query) ||
      String(block.commandsText || "").toLowerCase().includes(query);
    return kindOk && rollbackOk && queryOk;
  });
}

function setAllTxWorkflowBlocksCollapsed(collapsed) {
  txWorkflowBlocks.forEach((block) => {
    block.collapsed = !!collapsed;
  });
  renderTxWorkflowBuilder();
}

function generateTxWorkflowJsonFromBuilder() {
  const name = byId("tx-workflow-name").value.trim() || "tx-workflow";
  const failFast = byId("tx-workflow-fail-fast").checked;
  const blocks = txWorkflowBlocks.map((block) => {
    const commands = txWorkflowLines(block.commandsText);
    const rollbacks = parseRollbackLinesRaw(block.rollbackCommandsText);
    const timeout = block.timeoutSecs ? Number(block.timeoutSecs) : null;
    const timeoutSecs = Number.isFinite(timeout) && timeout > 0 ? timeout : null;
    const mode = block.mode.trim() || "Config";
    const kind = block.kind === "show" ? "show" : "config";
    const triggerRaw =
      block.rollbackPolicy === "whole_resource" ? block.triggerStepIndex : "";
    const triggerStepIndex = Number.isFinite(Number(triggerRaw))
      ? Number(triggerRaw)
      : 0;

    const applyRollbackOnFailure =
      block.rollbackPolicy === "per_step" && block.rollbackOnFailure === true;
    const steps = commands.map((command, idx) => ({
      run: {
        kind: "command",
        mode,
        command,
        timeout: timeoutSecs,
      },
      rollback:
        block.rollbackPolicy === "per_step" &&
        rollbacks[idx] &&
        rollbacks[idx].trim()
          ? {
              kind: "command",
              mode,
              command: rollbacks[idx],
              timeout: timeoutSecs,
            }
          : null,
      rollback_on_failure: applyRollbackOnFailure,
    }));

    let rollbackPolicy;
    if (kind === "show" || block.rollbackPolicy === "none") {
      rollbackPolicy = "none";
    } else if (block.rollbackPolicy === "whole_resource") {
      rollbackPolicy = {
        whole_resource: {
          rollback: {
            kind: "command",
            mode,
            command: block.undoCommand.trim(),
            timeout: timeoutSecs,
          },
          trigger_step_index: triggerStepIndex,
        },
      };
    } else {
      rollbackPolicy = "per_step";
    }

    return {
      name: block.name.trim() || "tx-block",
      kind,
      rollback_policy: rollbackPolicy,
      steps,
      fail_fast: block.failFast,
    };
  });
  const workflow = {
    name,
    blocks,
    fail_fast: failFast,
  };
  byId("tx-workflow-json").value = JSON.stringify(workflow, null, 2);
  setTxWorkflowPreview(workflow);
}

function loadTxWorkflowBuilderFromJson() {
  const raw = byId("tx-workflow-json").value.trim();
  if (!raw) return;
  const workflow = JSON.parse(raw);
  byId("tx-workflow-name").value = workflow.name || "";
  byId("tx-workflow-fail-fast").checked = workflow.fail_fast !== false;
  const blocks = Array.isArray(workflow.blocks) ? workflow.blocks : [];
  txWorkflowBlocks = blocks.map((b) => {
    const steps = Array.isArray(b.steps) ? b.steps : [];
    const firstRun = txStepRunOperation(steps[0]);
    const mode = txOperationMode(firstRun) || "Config";
    const timeoutSecs = txOperationTimeoutSeconds(firstRun);
    const rollbackOnFailure = steps.some((s) => s && s.rollback_on_failure === true);
    let rollbackPolicy = "per_step";
    let undoCommand = "";
    let triggerStepIndex = 0;
    if (typeof b.rollback_policy === "string") {
      rollbackPolicy = b.rollback_policy;
    } else if (
      b.rollback_policy &&
      typeof b.rollback_policy === "object" &&
      b.rollback_policy.whole_resource
    ) {
      rollbackPolicy = "whole_resource";
      undoCommand =
        txOperationDescription(txWholeResourceRollbackOperation(b.rollback_policy)) || "";
      triggerStepIndex = b.rollback_policy.whole_resource.trigger_step_index || 0;
    }
    return createTxWorkflowBlock({
      name: b.name || "",
      kind: b.kind || "config",
      rollbackPolicy,
      mode,
      timeoutSecs,
      undoCommand,
      rollbackOnFailure,
      triggerStepIndex,
      commandsText: steps
        .map((s) => txOperationDescription(txStepRunOperation(s)))
        .join("\n"),
      rollbackCommandsText: steps
        .map((s) => txOperationDescription(txStepRollbackOperation(s)))
        .join("\n"),
      failFast: b.fail_fast !== false,
    });
  });
  renderTxWorkflowBuilder();
  renderTxWorkflowPreviewFromEditor();
}

function downloadTxWorkflowJsonFromBuilder() {
  generateTxWorkflowJsonFromBuilder();
  const content = byId("tx-workflow-json").value || "";
  const nameRaw = (byId("tx-workflow-name").value || "").trim() || "tx-workflow";
  const safeName = nameRaw.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const fileName = `${safeName}.json`;
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importTxWorkflowBuilderFromFile() {
  const input = byId("tx-workflow-import-file-input");
  const file = input && input.files && input.files[0] ? input.files[0] : null;
  if (!file) {
    throw new Error(t("txWorkflowImportFileInvalid"));
  }
  const text = await file.text();
  byId("tx-workflow-json").value = text;
  loadTxWorkflowBuilderFromJson();
  renderTxWorkflowPreviewFromEditor();
  setStatusMessage("tx-workflow-plan-out", t("txWorkflowImportFileDone"), "success");
  input.value = "";
}

function downloadOrchestrationJson() {
  const content = byId("orchestration-json").value || "";
  const raw = content.trim();
  let safeName = "orchestration";
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const nameRaw = (parsed && parsed.name ? String(parsed.name) : "").trim();
      if (nameRaw) {
        safeName = nameRaw.replace(/[^a-zA-Z0-9._-]+/g, "-");
      }
    } catch (_) {
      safeName = "orchestration";
    }
  }
  const fileName = `${safeName || "orchestration"}.json`;
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importOrchestrationFromFile() {
  const input = byId("orchestration-import-file-input");
  const file = input && input.files && input.files[0] ? input.files[0] : null;
  if (!file) {
    throw new Error(t("orchestrationImportFileInvalid"));
  }
  const text = await file.text();
  byId("orchestration-json").value = text;
  renderOrchestrationPreviewFromEditor();
  setStatusMessage(
    "orchestration-plan-out",
    t("orchestrationImportFileDone"),
    "success"
  );
  input.value = "";
}

function txBlockToBuilderSeed(block) {
  const steps = Array.isArray(block && block.steps) ? block.steps : [];
  const firstRun = txStepRunOperation(steps[0]);
  const mode = txOperationMode(firstRun) || "Config";
  const timeoutSecs = txOperationTimeoutSeconds(firstRun);
  let rollbackPolicy = "per_step";
  let triggerStepIndex = 0;
  let undoCommand = "";
  const rp = block && block.rollback_policy;
  if (typeof rp === "string") {
    rollbackPolicy = rp;
  } else if (rp && typeof rp === "object" && rp.whole_resource) {
    rollbackPolicy = "whole_resource";
    undoCommand = txOperationDescription(txWholeResourceRollbackOperation(rp)) || "";
    triggerStepIndex = rp.whole_resource.trigger_step_index || 0;
  }
  return {
    name: (block && block.name) || "",
    kind: (block && block.kind) || "config",
    rollbackPolicy,
    mode,
    timeoutSecs,
    undoCommand,
    rollbackOnFailure: steps.some((s) => s.rollback_on_failure === true),
    triggerStepIndex,
    commandsText: steps
      .map((s) => txOperationDescription(txStepRunOperation(s)))
      .join("\n"),
    rollbackCommandsText: steps
      .map((s) => txOperationDescription(txStepRollbackOperation(s)))
      .join("\n"),
    failFast: block && block.fail_fast !== false,
  };
}

async function importTxBlockIntoWorkflowBuilder() {
  if (currentTxBlockRunKind === "flow") {
    setStatusMessage(
      "tx-workflow-plan-out",
      "command flow tx block is not supported by the workflow builder yet",
      "error"
    );
    return;
  }
  setStatusMessage("tx-workflow-plan-out", t("running"), "running");
  try {
    const data = await request("POST", "/api/tx/block", txPayload(true));
    const block = data && data.tx_block ? data.tx_block : null;
    if (!block) {
      setStatusMessage("tx-workflow-plan-out", t("txWorkflowImportEmpty"), "error");
      return;
    }
    txWorkflowBlocks.push(createTxWorkflowBlock(txBlockToBuilderSeed(block)));
    renderTxWorkflowBuilder();
    setStatusMessage("tx-workflow-plan-out", t("txWorkflowImportDone"), "success");
  } catch (e) {
    setStatusMessage("tx-workflow-plan-out", e.message, "error");
  }
}
