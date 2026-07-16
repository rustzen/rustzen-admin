import { apiRequest } from "@/api/request";

export const insightsAPI = {
    projects: () => apiRequest<Insights.Project[]>({ url: "/api/insights/projects" }),
    project: (id: string) => apiRequest<Insights.Project>({ url: `/api/insights/projects/${id}` }),
    createProject: (params: Insights.SaveProjectInput) =>
        apiRequest<Insights.CreatedProject, Insights.SaveProjectInput>({
            url: "/api/insights/projects",
            method: "POST",
            params,
        }),
    updateProject: (id: string, params: Insights.SaveProjectInput) =>
        apiRequest<Insights.Project, Insights.SaveProjectInput>({
            url: `/api/insights/projects/${id}`,
            method: "PATCH",
            params,
        }),
    archiveProject: (id: string) =>
        apiRequest<void>({ url: `/api/insights/projects/${id}`, method: "DELETE" }),
    rotateKey: (id: string) =>
        apiRequest<Insights.ProjectKey>({
            url: `/api/insights/projects/${id}/rotate-key`,
            method: "POST",
        }),
    overview: (params: Insights.OverviewQuery) =>
        apiRequest<Insights.Overview, Insights.OverviewQuery>({
            url: "/api/insights/overview",
            params,
        }),
    pages: (params: Insights.PageQuery) =>
        apiRequest<Insights.Page<Insights.PageStat>, Insights.PageQuery>({
            url: "/api/insights/pages",
            params,
        }),
    apis: (params: Insights.ApiQuery) =>
        apiRequest<Insights.Page<Insights.ApiStat>, Insights.ApiQuery>({
            url: "/api/insights/apis",
            params,
        }),
    events: (params: Insights.EventQuery) =>
        apiRequest<Insights.Page<Insights.Event>, Insights.EventQuery>({
            url: "/api/insights/events",
            params,
        }),
    users: (params: Insights.UserQuery) =>
        apiRequest<Insights.Page<Insights.UserStat>, Insights.UserQuery>({
            url: "/api/insights/users",
            params,
        }),
    userEvents: (visitorId: string, params: Insights.ListQuery) =>
        apiRequest<Insights.Page<Insights.Event>, Insights.ListQuery>({
            url: `/api/insights/users/${encodeURIComponent(visitorId)}/events`,
            params,
        }),
    settings: () => apiRequest<Insights.Settings>({ url: "/api/insights/settings" }),
    updateSettings: (params: Insights.UpdateSettings) =>
        apiRequest<Insights.Settings, Insights.UpdateSettings>({
            url: "/api/insights/settings",
            method: "PUT",
            params,
        }),
};
