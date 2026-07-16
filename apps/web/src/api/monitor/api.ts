import { apiRequest } from "@/api/request";

export const monitorAPI = {
    overview: () => apiRequest<Monitor.Overview>({ url: "/api/monitor/overview" }),
    nodes: () => apiRequest<Monitor.Node[]>({ url: "/api/monitor/nodes" }),
    node: (nodeId: string) => apiRequest<Monitor.Node>({ url: `/api/monitor/nodes/${nodeId}` }),
    metrics: (nodeId: string, params: Monitor.MetricsQuery = {}) =>
        apiRequest<Monitor.MetricPoint[], Monitor.MetricsQuery>({
            url: `/api/monitor/nodes/${nodeId}/metrics`,
            params,
        }),
    checks: (params: Monitor.CheckQuery = {}) =>
        apiRequest<Monitor.Page<Monitor.Check>, Monitor.CheckQuery>({
            url: "/api/monitor/checks",
            params,
        }),
    check: (id: string) => apiRequest<Monitor.Check>({ url: `/api/monitor/checks/${id}` }),
    createCheck: (params: Monitor.SaveCheck) =>
        apiRequest<Monitor.Check, Monitor.SaveCheck>({
            url: "/api/monitor/checks",
            method: "POST",
            params,
        }),
    updateCheck: (id: string, params: Monitor.SaveCheck) =>
        apiRequest<Monitor.Check, Monitor.SaveCheck>({
            url: `/api/monitor/checks/${id}`,
            method: "PUT",
            params,
        }),
    deleteCheck: (id: string) =>
        apiRequest<void>({ url: `/api/monitor/checks/${id}`, method: "DELETE" }),
    setCheckEnabled: (id: string, enabled: boolean) =>
        apiRequest<Monitor.Check, { enabled: boolean }>({
            url: `/api/monitor/checks/${id}/enabled`,
            method: "PUT",
            params: { enabled },
        }),
    testCheck: (params: Pick<Monitor.SaveCheck, "host" | "port" | "timeoutMs">) =>
        apiRequest<Monitor.ProbeResult, Pick<Monitor.SaveCheck, "host" | "port" | "timeoutMs">>({
            url: "/api/monitor/checks/test",
            method: "POST",
            params,
        }),
    checkResults: (id: string, params: Pick<Monitor.CheckQuery, "current" | "pageSize"> = {}) =>
        apiRequest<Monitor.Page<Monitor.CheckResult>, typeof params>({
            url: `/api/monitor/checks/${id}/results`,
            params,
        }),
    incidents: (params: Monitor.IncidentQuery = {}) =>
        apiRequest<Monitor.Page<Monitor.Incident>, Monitor.IncidentQuery>({
            url: "/api/monitor/incidents",
            params,
        }),
    incident: (id: string) => apiRequest<Monitor.Incident>({ url: `/api/monitor/incidents/${id}` }),
    acknowledgeIncident: (id: string) =>
        apiRequest<Monitor.Incident>({
            url: `/api/monitor/incidents/${id}/acknowledge`,
            method: "POST",
        }),
    settings: () => apiRequest<Monitor.Settings>({ url: "/api/monitor/settings" }),
    updateSettings: (params: Monitor.UpdateSettings) =>
        apiRequest<Monitor.Settings, Monitor.UpdateSettings>({
            url: "/api/monitor/settings",
            method: "PUT",
            params,
        }),
};
