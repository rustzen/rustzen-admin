import { apiRequest } from "@/api/request";

export const statusAPI = {
    overview: () => {
        return apiRequest<SystemStatus.Overview>({
            url: "/api/system/status",
        });
    },
};
