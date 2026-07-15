import { createFileRoute } from "@tanstack/react-router";

import { RouteStatusPage } from "@/components/app/route-status-page";

export const Route = createFileRoute("/403")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <RouteStatusPage
            code="403"
            title="Access Forbidden"
            description="You do not have the necessary permission to view this resource."
        />
    );
}
