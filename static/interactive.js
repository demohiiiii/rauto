/**
 * interactive.js — interactive
 */

async function startInteractive() {
  setInteractiveStatus(t("interactiveStatusRunning"));
  try {
    const data = await request("POST", "/api/interactive/start", {
      connection: connectionPayload(),
      record_level: recordLevelPayload(),
    });
    interactiveSessionId = data.session_id || null;
    if (interactiveSessionId) {
      setInteractiveStatus(`${t("interactiveStatusReady")} · ${interactiveSessionId}`);
    } else {
      setInteractiveStatus(t("interactiveStatusNoSession"));
    }
  } catch (e) {
    interactiveSessionId = null;
    setInteractiveStatus(e.message, "error");
  }
  updateInteractiveButtons();
}

async function sendInteractiveCommand() {
  const command = byId("interactive-command").value.trim();
  const mode = byId("interactive-mode").value.trim();
  if (!interactiveSessionId) {
    setInteractiveStatus(t("interactiveStatusNoSession"));
    updateInteractiveButtons();
    return;
  }
  if (!command) {
    setInteractiveStatus(t("commandRequired"));
    return;
  }
  setInteractiveStatus(t("running"));
  try {
    const data = await request("POST", "/api/interactive/command", {
      session_id: interactiveSessionId,
      command,
      mode: mode || null,
    });
    appendInteractiveLog(command, data.output || "");
    setInteractiveStatus(`${t("interactiveStatusReady")} · ${interactiveSessionId}`);
  } catch (e) {
    setInteractiveStatus(e.message, "error");
  }
}

async function stopInteractive() {
  if (!interactiveSessionId) {
    setInteractiveStatus(t("interactiveStatusNoSession"));
    updateInteractiveButtons();
    return;
  }
  const id = interactiveSessionId;
  setInteractiveStatus(t("running"));
  try {
    const data = await request(
      "DELETE",
      `/api/interactive/${encodeURIComponent(id)}`
    );
    if (data && data.recording_jsonl) {
      byId("record-jsonl").value = String(data.recording_jsonl);
      renderRecordingView();
    }
    setInteractiveStatus(t("interactiveStatusStopped"));
  } catch (e) {
    setInteractiveStatus(e.message, "error");
  } finally {
    interactiveSessionId = null;
    updateInteractiveButtons();
  }
}
