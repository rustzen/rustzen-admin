import { apiRequest } from "@/api/request";

export const insightsAPI = {
    overview: (params: Insights.OverviewQuery) =>
        apiRequest<Insights.Overview, Insights.OverviewQuery>({
            url: "/api/insights/overview",
            params,
        }),
    events: (params: Insights.EventQuery) =>
        apiRequest<Insights.Page<Insights.Event>, Insights.EventQuery>({
            url: "/api/insights/events",
            params,
        }),
};
