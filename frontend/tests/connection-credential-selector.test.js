import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { savedConnectionLibraryPresentation } from "../src/modules/connections/connectionTargetDisplayState.js";

const read = (path) => readFileSync(path, "utf8");

test("connection forms use a credential selector instead of secret inputs", () => {
  const basicFields = read(
    "frontend/src/components/connections/ConnectionBasicFields.svelte",
  );
  const credentialField = read(
    "frontend/src/components/connections/ConnectionCredentialField.svelte",
  );
  const createDialog = read(
    "frontend/src/components/credentials/CredentialCreateDialog.svelte",
  );

  assert.match(basicFields, /ConnectionCredentialField/);
  assert.doesNotMatch(basicFields, /type="password"/);
  assert.match(credentialField, /listCredentials/);
  assert.match(credentialField, /credentialRequired/);
  assert.match(credentialField, /CredentialCreateDialog/);
  assert.match(createDialog, /createCredential/);
  assert.match(createDialog, /onCreated\?\.\(row\)/);
  assert.match(createDialog, /Dialog\.Title/);
  assert.match(createDialog, /credentialFormValidationMessage/);
  assert.match(createDialog, /credentialErrorMessage/);
  assert.match(createDialog, /novalidate/);
  assert.match(createDialog, /<Dialog\.Root bind:open/);
  assert.match(createDialog, /<Dialog\.Trigger>/);
  assert.match(createDialog, /#snippet child\(\{ props \}\)/);
  assert.doesNotMatch(createDialog, /onclick=\{\(\) => \(open = true\)\}/);
});

test("saved and temporary connection payloads send credential_id only", () => {
  const savedEditor = read(
    "frontend/src/modules/connections/connectionsEditor.js",
  );
  const targetRuntime = read(
    "frontend/src/modules/connections/connectionTargetRuntimeState.js",
  );

  assert.match(savedEditor, /credential_id: credentialId/);
  assert.doesNotMatch(
    savedEditor,
    /password:\s*savedConnectionEditorFormState/,
  );
  assert.match(targetRuntime, /credential_id: credentialId \|\| null/);
  assert.doesNotMatch(
    targetRuntime,
    /password:\s*temporaryConnectionFormState/,
  );
});

test("connection presentation and field workspaces contain no legacy auth inputs", () => {
  const runtimeState = read(
    "frontend/src/modules/connections/connectionTargetRuntimeState.js",
  );
  const connections = read("frontend/src/modules/connections/connections.js");

  assert.doesNotMatch(runtimeState, /temporaryConnectionFormState\.username/);
  assert.doesNotMatch(connections, /usernameInputHandler/);
  assert.doesNotMatch(connections, /passwordInputHandler/);
  assert.doesNotMatch(connections, /enablePasswordInputHandler/);
});

test("saved connection rows present credential names and an actionable missing state", () => {
  const display = savedConnectionLibraryPresentation({
    connections: [
      {
        name: "core-sw-01",
        host: "192.0.2.10",
        port: 22,
        credential_id: "credential-1",
        credential_name: "network-admin",
        credential_required: false,
      },
      {
        name: "legacy-sw-01",
        host: "192.0.2.11",
        port: 22,
        credential_id: null,
        credential_name: null,
        credential_required: true,
      },
    ],
    selected: "core-sw-01",
  });

  assert.equal(display.connectionRows[0].credentialName, "network-admin");
  assert.equal(
    display.connectionRows[0].summary,
    "network-admin · 192.0.2.10:22",
  );
  assert.equal(display.connectionRows[0].credentialRequired, false);
  assert.equal(display.connectionRows[1].credentialName, "未选择凭证");
  assert.equal(display.connectionRows[1].credentialRequired, true);
  assert.match(display.connectionRows[1].searchText, /未选择凭证/);
});
