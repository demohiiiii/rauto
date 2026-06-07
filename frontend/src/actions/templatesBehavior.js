import { getDeviceProfilesOverview } from "../api/client.js";
import { createCustomShowObjectManager } from "../services/customShowObjectManager.js";
import { createFlowTemplateManager } from "../services/flowTemplateManager.js";
import { createTemplateManager } from "../services/templateManager.js";
import { createTextfsmMappingManager } from "../services/textfsmMappingManager.js";
import { createTextfsmTemplateManager } from "../services/textfsmTemplateManager.js";

export function templatesBehavior(node) {
  let cachedDeviceProfileNames = [];

  function getDeviceProfileNames() {
    return cachedDeviceProfileNames.length
      ? cachedDeviceProfileNames
      : Array.isArray(window.cachedDeviceProfiles)
        ? window.cachedDeviceProfiles
        : [];
  }

  function renderDeviceProfileOptions() {
    textfsmMappingManager.renderProfileOptions();
    customShowObjectManager.renderProfileOptions();
  }

  async function loadDeviceProfileOptionsFromWeb() {
    try {
      const data = await getDeviceProfilesOverview();
      cachedDeviceProfileNames = [
        ...(Array.isArray(data?.builtins) ? data.builtins : []).map(
          (item) => item.name,
        ),
        ...(Array.isArray(data?.custom) ? data.custom : []).map(
          (item) => item.name,
        ),
      ].filter(
        (name, index, values) => !!name && values.indexOf(name) === index,
      );
      window.cachedDeviceProfiles = cachedDeviceProfileNames;
    } catch (_) {
      cachedDeviceProfileNames = Array.isArray(window.cachedDeviceProfiles)
        ? window.cachedDeviceProfiles
        : [];
    }

    renderDeviceProfileOptions();
    customShowObjectManager.loadModes();
    window.renderTextfsmPlatformOptions?.();
  }

  const templateManager = createTemplateManager(node);
  const flowTemplateManager = createFlowTemplateManager(node);
  const customShowObjectManager = createCustomShowObjectManager(node, {
    getDeviceProfiles: getDeviceProfileNames,
    onCustomObjectsChanged: () => window.loadShowObjects?.(),
  });
  const textfsmMappingManager = createTextfsmMappingManager(node, {
    getDeviceProfiles: getDeviceProfileNames,
    onMappingsChanged: (profile) =>
      customShowObjectManager.loadMappings(profile),
  });
  const textfsmTemplateManager = createTextfsmTemplateManager(node, {
    onTemplateDeleted: () => textfsmMappingManager.load(),
    onTemplateSaved: () => textfsmMappingManager.render(),
  });

  templateManager.init();
  flowTemplateManager.init();
  customShowObjectManager.init();
  textfsmMappingManager.init();
  textfsmTemplateManager.init();

  window.loadTemplateProfileOptions = loadDeviceProfileOptionsFromWeb;
  renderDeviceProfileOptions();
  loadDeviceProfileOptionsFromWeb();

  return {
    destroy() {
      templateManager.destroy();
      flowTemplateManager.destroy();
      customShowObjectManager.destroy();
      textfsmMappingManager.destroy();
      textfsmTemplateManager.destroy();
    },
  };
}
