import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ActivityIcon, ClockAlertIcon, ServerIcon, ShieldAlertIcon } from "lucide-react";

import { monitorAPI } from "@/api";
import { DataState } from "@/components/feedback/data-state";
import { MetricCard } from "@/components/page/metric-card";
import { PageCard } from "@/components/page/page-card";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/monitoring/overview")({ component: MonitoringOverviewPage });

function MonitoringOverviewPage() {
    const { data, error, isPending, refetch } = useQuery({
        queryKey: ["monitor", "overview"],
        queryFn: monitorAPI.overview,
        refetchInterval: 30_000,
    });

    if (isPending) {
        return (
            <PageCard
                title={t("监控概览", "Monitoring overview")}
                description={t(
                    "查看当前节点可用性和最新基础设施心跳。",
                    "View current node availability and the latest infrastructure heartbeats.",
                )}
            >
                <DataState kind="loading" title={t("正在加载监控概览", "Loading overview")} />
            </PageCard>
        );
    }

    if (!data) {
        return (
            <PageCard
                title={t("监控概览", "Monitoring overview")}
                description={t(
                    "查看当前节点可用性和最新基础设施心跳。",
                    "View current node availability and the latest infrastructure heartbeats.",
                )}
            >
                <DataState
                    kind="error"
                    title={
                        error
                            ? t("监控概览加载失败", "Failed to load monitoring overview")
                            : t("监控概览暂不可用", "Monitoring overview is unavailable")
                    }
                    description={t(
                        "无法读取节点和服务状态，请检查 Monitor 服务后重试。",
                        "Unable to read node and service status. Check the Monitor service and try again.",
                    )}
                    action={
                        <Button onClick={() => void refetch()}>{t("重新加载", "Reload")}</Button>
                    }
                />
            </PageCard>
        );
    }

    return (
        <PageCard
            title={t("监控概览", "Monitoring overview")}
            description={t(
                "查看当前节点可用性和最新基础设施心跳。",
                "View current node availability and the latest infrastructure heartbeats.",
            )}
        >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <MetricCard
                    label={t("已注册节点", "Registered nodes")}
                    value={data.registeredNodes}
                    icon={<ServerIcon />}
                />
                <MetricCard
                    label={t("在线节点", "Online nodes")}
                    value={data.onlineNodes}
                    icon={<ActivityIcon />}
                />
                <MetricCard
                    label={t("离线节点", "Offline nodes")}
                    value={data.offlineNodes}
                    icon={<ClockAlertIcon />}
                />
                <MetricCard
                    label={t("异常检查", "Unhealthy checks")}
                    value={data.unhealthyChecks}
                    icon={<ActivityIcon />}
                />
                <MetricCard
                    label={t("活动事件", "Active incidents")}
                    value={data.activeIncidents}
                    icon={<ShieldAlertIcon />}
                />
            </div>
            {data.registeredNodes === 0 ? (
                <DataState
                    kind="empty"
                    title={t("暂无监控节点", "No monitored nodes")}
                    description={t(
                        "启动节点上的 rz-monitor agent，首次心跳通过后会自动出现在这里。",
                        "Start the rz-monitor agent on a node. It will appear here after its first heartbeat.",
                    )}
                />
            ) : null}
        </PageCard>
    );
}
