import { insightsAPIContract as contract } from "@/api/insights/contract";
import { apiRequest } from "@/api/request";

export const insightsAPI = {
    overview: (params: Insights.OverviewQuery) =>
        apiRequest<Insights.Overview, Insights.OverviewQuery>({
            url: contract.overview.path,
            params,
        }),
    events: (params: Insights.EventQuery) =>
        apiRequest<Insights.Page<Insights.Event>, Insights.EventQuery>({
            url: contract.events.path,
            params,
        }),
};
