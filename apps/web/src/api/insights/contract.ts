import type { ModuleApiRoute } from "@/api/module-contract";

export const insightsAPIContract = {
    overview: { method: "GET", path: "/api/insights/overview" },
    events: { method: "GET", path: "/api/insights/events" },
} as const satisfies Record<string, ModuleApiRoute>;
