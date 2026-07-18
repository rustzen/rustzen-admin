import { createFileRoute } from "@tanstack/react-router";

import { RouteStatusPage } from "@/components/page/route-status-page";

export const Route = createFileRoute("/403")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <RouteStatusPage code="403" title="禁止访问" description="你没有查看此资源所需的权限。" />
    );
}
