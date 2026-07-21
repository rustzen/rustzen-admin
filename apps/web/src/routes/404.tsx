import { createFileRoute } from "@tanstack/react-router";

import { RouteStatusPage } from "@/components/page/route-status-page";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/404")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <RouteStatusPage
            code="404"
            title={t("页面不存在", "Page not found")}
            description={t(
                "你访问的页面不存在或已被移除。",
                "The page you requested does not exist or has been removed.",
            )}
        />
    );
}
