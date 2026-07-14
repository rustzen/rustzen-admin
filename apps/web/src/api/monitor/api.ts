import { apiRequest } from "@/api/request";

export const monitorAPI = {
    nodes: () => apiRequest<Monitor.Node[]>({ url: "/api/monitor/nodes" }),
    node: (nodeId: string) => apiRequest<Monitor.Node>({ url: `/api/monitor/nodes/${nodeId}` }),
};
