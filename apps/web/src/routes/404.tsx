import { createFileRoute } from "@tanstack/react-router";

import { RouteStatusPage } from "@/components/app/route-status-page";

export const Route = createFileRoute("/404")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <RouteStatusPage
            code="404"
            title="Page Not Found"
            description="The page you are looking for does not exist or might have been removed."
        />
    );
}
