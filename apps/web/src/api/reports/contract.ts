import type { ModuleApiRoute } from "@/api/module-contract";

export const reportsAPIContract = {
    systems: { method: "GET", path: "/api/reports/systems" },
    createSystem: { method: "POST", path: "/api/reports/systems" },
    flows: { method: "GET", path: "/api/reports/flows" },
    createFlow: { method: "POST", path: "/api/reports/flows" },
    updateFlow: { method: "PUT", path: "/api/reports/flows/{id}" },
    deleteFlow: { method: "DELETE", path: "/api/reports/flows/{id}" },
    runs: { method: "GET", path: "/api/reports/runs" },
    run: { method: "GET", path: "/api/reports/runs/{id}" },
    createRun: { method: "POST", path: "/api/reports/runs" },
    cancelRun: { method: "POST", path: "/api/reports/runs/{id}/cancel" },
    runSteps: { method: "GET", path: "/api/reports/runs/{id}/steps" },
    runArtifacts: { method: "GET", path: "/api/reports/runs/{id}/artifacts" },
    artifact: {
        method: "GET",
        path: "/api/reports/runs/{run_id}/artifacts/{artifact_id}",
    },
    liveFrame: { method: "GET", path: "/api/reports/runs/{id}/live-frame" },
} as const satisfies Record<string, ModuleApiRoute>;
