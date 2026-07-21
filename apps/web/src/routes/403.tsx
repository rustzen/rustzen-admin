import { createFileRoute } from "@tanstack/react-router";

import { RouteStatusPage } from "@/components/page/route-status-page";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/403")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <RouteStatusPage
            code="403"
            title={t("禁止访问", "Access denied")}
            description={t(
                "你没有查看此资源所需的权限。",
                "You do not have permission to view this resource.",
            )}
        />
    );
}
