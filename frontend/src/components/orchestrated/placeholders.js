export const txWorkflowVarsPlaceholder =
  'workflow vars JSON (optional), e.g. {"peer_host":"edge94.host"}';

export const txWorkflowJsonPlaceholder =
  '{"name":"linux-safe-deploy-demo","fail_fast":true,"blocks":[{"name":"precheck","rollback_policy":"none","fail_fast":true,"steps":[{"run":{"kind":"command","mode":"User","command":"uname -a","timeout":30},"rollback":null,"rollback_on_failure":false},{"run":{"kind":"command","mode":"User","command":"date","timeout":30},"rollback":null,"rollback_on_failure":false}]},{"name":"apply-change","rollback_policy":"per_step","fail_fast":true,"steps":[{"run":{"kind":"command","mode":"User","command":"mkdir -p /tmp/rauto-demo","timeout":30},"rollback":{"kind":"command","mode":"User","command":"rm -rf /tmp/rauto-demo","timeout":30},"rollback_on_failure":false},{"run":{"kind":"command","mode":"User","command":"echo version=2026.04.17 > /tmp/rauto-demo/release.txt","timeout":30},"rollback":{"kind":"command","mode":"User","command":"rm -f /tmp/rauto-demo/release.txt","timeout":30},"rollback_on_failure":true}]},{"name":"verify","rollback_policy":{"whole_resource":{"rollback":{"kind":"command","mode":"User","command":"rm -rf /tmp/rauto-demo","timeout":30},"trigger_step_index":0}},"fail_fast":false,"steps":[{"run":{"kind":"command","mode":"User","command":"ls -lah /tmp/rauto-demo","timeout":30},"rollback":null,"rollback_on_failure":false}]}]}';

export const txWorkflowTemplateVarsPlaceholder =
  'workflow template vars JSON (optional), e.g. {"peer_host":"edge94.host"}';

export const txBlockVarsPlaceholder =
  'tx block vars JSON (optional), e.g. {"peer_host":"edge94.host"}';

export const txBlockTemplateVarsPlaceholder =
  'tx block template vars JSON (optional), e.g. {"peer_host":"edge94.host"}';

export const txBlockJsonPlaceholder =
  '{"name":"tx-block","rollback_policy":"none","steps":[{"run":{"kind":"command","mode":"User","command":"show version","timeout":30},"rollback":null,"rollback_on_failure":false}],"fail_fast":true}';

export const orchestrationVarsPlaceholder =
  'plan vars JSON (optional), e.g. {"peer_host":"edge94.host"}';

export const orchestrationTemplateVarsPlaceholder =
  'plan template vars JSON (optional), e.g. {"peer_host":"edge94.host"}';

export const orchestrationJsonPlaceholder =
  '{"name":"campus-rollout","stages":[{"name":"phase-1","strategy":"parallel","jobs":[]}]}';
