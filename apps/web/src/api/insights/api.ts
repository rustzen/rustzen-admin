import { apiRequest } from "@/api/request";

export const insightsAPI = {
    projects: () => apiRequest<Insights.Project[]>({ url: "/api/insights/projects" }),
    createProject: (params: Insights.CreateProjectInput) =>
        apiRequest<Insights.CreatedProject, Insights.CreateProjectInput>({
            url: "/api/insights/projects",
            method: "POST",
            params,
        }),
    overview: (params: Insights.OverviewQuery) =>
        apiRequest<Insights.Overview, Insights.OverviewQuery>({
            url: "/api/insights/overview",
            params,
        }),
};
