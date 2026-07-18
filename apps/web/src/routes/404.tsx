import { createFileRoute } from "@tanstack/react-router";

import { RouteStatusPage } from "@/components/page/route-status-page";

export const Route = createFileRoute("/404")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <RouteStatusPage
            code="404"
            title="页面不存在"
            description="你访问的页面不存在或已被移除。"
        />
    );
}
