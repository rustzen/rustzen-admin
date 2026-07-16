import { apiRequest } from "@/api/request";

export const moduleAPI = {
    list: () => {
        return apiRequest<SystemModule.Item[]>({
            url: "/api/system/modules",
        });
    },
    navigation: () => {
        return apiRequest<SystemModule.NavigationItem[]>({
            url: "/api/system/modules/navigation",
        });
    },
    updateEnabled: (id: SystemModule.Id, enabled: boolean) => {
        return apiRequest<SystemModule.Item[], SystemModule.UpdateRequest>({
            url: `/api/system/modules/${id}/enabled`,
            method: "PUT",
            params: { enabled },
        });
    },
};
