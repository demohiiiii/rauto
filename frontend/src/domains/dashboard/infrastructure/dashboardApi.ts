import {
  getAgentApiToken,
  getAgentInfo,
  logoutWeb,
  setAgentApiToken,
} from "../../../api/client.js";

export interface DashboardAgentInfo {
  managed?: boolean;
}

export const dashboardApi = {
  getAgentApiToken(): string {
    return getAgentApiToken();
  },
  async getAgentInfo(): Promise<DashboardAgentInfo> {
    const payload: unknown = await getAgentInfo();
    return payload && typeof payload === "object"
      ? (payload as DashboardAgentInfo)
      : {};
  },
  logoutWeb(): Promise<unknown> {
    return logoutWeb();
  },
  setAgentApiToken(token: string): void {
    setAgentApiToken(token);
  },
};
