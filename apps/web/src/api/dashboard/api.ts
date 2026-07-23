import { apiRequest } from "@/api/request";

export const dashboardAPI = {
    stats: () => {
        return apiRequest<Dashboard.Stats>({ url: "/api/dashboard/stats" });
    },
    modules: () => apiRequest<Dashboard.ModuleHealth[]>({ url: "/api/dashboard/modules" }),
};
