import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("credential management is a standalone dashboard page", () => {
  const navigation = read("frontend/src/config/dashboardNavigation.js");
  const sidebar = read(
    "frontend/src/components/layout/DashboardSidebar.svelte",
  );
  const page = read("frontend/src/pages/CredentialsPage.svelte");
  const importDialog = read(
    "frontend/src/components/credentials/CredentialImportDialog.svelte",
  );
  const api = read("frontend/src/api/client.js");
  const zh = read("frontend/src/i18n/zh.js");
  const en = read("frontend/src/i18n/en.js");

  assert.match(navigation, /id: "credentials"/);
  assert.match(navigation, /path: "\/app\/credentials"/);
  assert.match(navigation, /CredentialsPage\.svelte/);
  assert.match(sidebar, /credentials: KeyRoundIcon/);
  assert.match(page, /WorkspaceActionHeader/);
  assert.match(page, /icon=\{KeyRoundIcon\}/);
  assert.match(page, /listCredentials/);
  assert.match(page, /createCredential/);
  assert.match(page, /updateCredential/);
  assert.match(page, /deleteCredential/);
  assert.match(page, /credentialEnableEnabled/);
  assert.match(page, /<Checkbox/);
  assert.match(page, /lg:grid-cols-\[17rem_minmax\(0,1fr\)\]/);
  assert.match(page, /h-9 rounded-lg pl-9 text-sm/);
  assert.match(page, /w-full rounded-lg border p-2 text-left/);
  assert.match(page, /t\("credentialSaveAction"\)/);
  assert.match(page, /t\("credentialSavingAction"\)/);
  assert.match(page, /credentialFormValidationMessage/);
  assert.match(page, /credentialErrorMessage/);
  assert.match(page, /CredentialImportDialog/);
  assert.match(page, /onImported=\{handleCredentialsImported\}/);
  assert.match(importDialog, /<Dialog\.Title>/);
  assert.match(importDialog, /importCredentials/);
  assert.match(importDialog, /downloadCredentialImportTemplateBlob/);
  assert.match(importDialog, /aria-live="polite"/);
  assert.match(importDialog, /<Spinner/);
  assert.match(api, /\/api\/credentials\/import/);
  assert.match(api, /\/api\/credentials\/import-template/);
  assert.doesNotMatch(page, /t\("save"\)/);
  assert.doesNotMatch(page, /t\("saving"\)/);
  assert.match(zh, /credentialSaveAction: "保存凭证"/);
  assert.match(zh, /credentialSavingAction: "保存中\.\.\."/);
  assert.match(zh, /credentialNameRequired: "请输入凭证名称"/);
  assert.match(zh, /credentialNameInvalid:/);
  assert.match(zh, /credentialUsernameRequired: "请输入用户名"/);
  assert.match(zh, /credentialPasswordRequired: "请输入登录密码"/);
  assert.match(en, /credentialSaveAction: "Save credential"/);
  assert.match(en, /credentialSavingAction: "Saving\.\.\."/);
  assert.match(en, /credentialNameRequired: "Credential name is required"/);
  assert.match(en, /credentialNameInvalid:/);
  assert.match(en, /credentialUsernameRequired: "Username is required"/);
  assert.match(en, /credentialPasswordRequired: "Login password is required"/);
  assert.match(zh, /credentialImportAction: "导入凭证"/);
  assert.match(en, /credentialImportAction: "Import credentials"/);
});

test("Enable password fields render only while the Enable stage is active", () => {
  const page = read("frontend/src/pages/CredentialsPage.svelte");
  const createDialog = read(
    "frontend/src/components/credentials/CredentialCreateDialog.svelte",
  );

  for (const source of [page, createDialog]) {
    assert.match(
      source,
      /\{#if form\.enableEnabled\}[\s\S]*credentialEnablePassword[\s\S]*\{\/if\}/,
    );
    assert.doesNotMatch(source, /disabled=\{!form\.enableEnabled\}/);
  }
  assert.match(createDialog, /onCheckedChange=\{setEnableEnabled\}/);
  assert.match(createDialog, /form\.enablePassword = ""/);
});
