import { executeUpload } from "../api/client.js";

function tr(key, fallback = key) {
  return typeof window.t === "function" ? window.t(key) : fallback;
}

function safeString(value) {
  return String(value ?? "");
}

function escapeHtml(value) {
  return safeString(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function statusCard(message, tone = "info") {
  if (typeof window.renderStatusMessageCard === "function") {
    return window.renderStatusMessageCard(message, tone);
  }
  const toneClass =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-50 text-slate-600";
  return `<div class="rounded-xl border ${toneClass} px-3 py-2 text-sm">${escapeHtml(message)}</div>`;
}

function renderUploadResult(data) {
  return statusCard(
    `${data?.ok ? "ok" : tr("orchestrationStatusFailed", "failed")} · ${safeString(
      data?.local_path,
    )} -> ${safeString(data?.remote_path)}`,
    data?.ok ? "success" : "error",
  );
}

export function uploadBehavior(node) {
  const byId = (id) => node.querySelector(`#${id}`);
  const button = byId("upload-exec-btn");
  const out = byId("upload-out");

  function buildPayload() {
    const timeoutRaw = Number(byId("upload-timeout-secs")?.value || 300);
    const bufferInput = (byId("upload-buffer-size")?.value || "").trim();
    const bufferRaw = bufferInput ? Number(bufferInput) : null;
    return {
      local_path: byId("upload-local-path")?.value.trim() || "",
      remote_path: byId("upload-remote-path")?.value.trim() || "",
      timeout_secs: Number.isFinite(timeoutRaw) ? timeoutRaw : 300,
      buffer_size:
        bufferRaw !== null && Number.isFinite(bufferRaw) ? bufferRaw : null,
      show_progress: !!byId("upload-show-progress")?.checked,
      connection:
        typeof window.connectionPayload === "function"
          ? window.connectionPayload()
          : {},
      record_level:
        typeof window.recordLevelPayload === "function"
          ? window.recordLevelPayload()
          : undefined,
    };
  }

  async function runUpload() {
    if (
      typeof window.ensureConnectionTargetSelected === "function" &&
      !window.ensureConnectionTargetSelected("upload-out", "upload-out")
    ) {
      return;
    }
    if (out) {
      out.innerHTML = statusCard(tr("running", "running"), "running");
    }
    try {
      const payload = buildPayload();
      if (!payload.local_path) {
        throw new Error(tr("localPathRequired", "local path is required"));
      }
      if (!payload.remote_path) {
        throw new Error(tr("remotePathRequired", "remote path is required"));
      }
      const data = await executeUpload(payload);
      if (out) {
        out.innerHTML = renderUploadResult(data);
      }
      if (typeof window.applyRecordingFromResponse === "function") {
        window.applyRecordingFromResponse(data);
      }
    } catch (error) {
      if (out) {
        out.innerHTML = statusCard(error.message, "error");
      }
    }
  }

  button?.addEventListener("click", runUpload);

  return {
    destroy() {
      button?.removeEventListener("click", runUpload);
    },
  };
}
