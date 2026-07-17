import { apiBlob, apiRequest } from "@/api/request";

export const reportsAPI = {
    systems: () => apiRequest<Reports.System[]>({ url: "/api/reports/systems" }),
    createSystem: (params: Reports.SaveSystem) =>
        apiRequest<Reports.System, Reports.SaveSystem>({
            url: "/api/reports/systems",
            method: "POST",
            params,
        }),
    updateSystem: (id: string, params: Reports.SaveSystem) =>
        apiRequest<Reports.System, Reports.SaveSystem>({
            url: `/api/reports/systems/${id}`,
            method: "PUT",
            params,
        }),
    deleteSystem: (id: string) =>
        apiRequest<void>({ url: `/api/reports/systems/${id}`, method: "DELETE" }),
    flows: (systemId?: string) =>
        apiRequest<Reports.Flow[]>({ url: "/api/reports/flows", params: { systemId } }),
    createFlow: (params: Reports.SaveFlow) =>
        apiRequest<Reports.Flow, Reports.SaveFlow>({
            url: "/api/reports/flows",
            method: "POST",
            params,
        }),
    updateFlow: (id: string, params: Reports.SaveFlow) =>
        apiRequest<Reports.Flow, Reports.SaveFlow>({
            url: `/api/reports/flows/${id}`,
            method: "PUT",
            params,
        }),
    deleteFlow: (id: string) =>
        apiRequest<void>({ url: `/api/reports/flows/${id}`, method: "DELETE" }),
    runs: (params: { current?: number; pageSize?: number; status?: string }) =>
        apiRequest<Reports.Page<Reports.Run>, typeof params>({ url: "/api/reports/runs", params }),
    run: (id: string) => apiRequest<Reports.Run>({ url: `/api/reports/runs/${id}` }),
    createRun: (params: Reports.CreateRun) =>
        apiRequest<Reports.Run, Reports.CreateRun>({
            url: "/api/reports/runs",
            method: "POST",
            params,
        }),
    cancelRun: (id: string) =>
        apiRequest<Reports.Run>({ url: `/api/reports/runs/${id}/cancel`, method: "POST" }),
    runSteps: (id: string) =>
        apiRequest<Reports.RunStep[]>({ url: `/api/reports/runs/${id}/steps` }),
    runArtifacts: (id: string) =>
        apiRequest<Reports.Artifact[]>({ url: `/api/reports/runs/${id}/artifacts` }),
    liveFrame: async (id: string, signal?: AbortSignal) => {
        const blob = await apiBlob({ url: `/api/reports/runs/${id}/live-frame`, signal });
        if (blob && (blob.type !== "image/png" || blob.size === 0)) {
            throw new Error("Invalid live frame response");
        }
        return blob;
    },
};
