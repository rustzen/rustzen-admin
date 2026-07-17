import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ActivityIcon, ClockAlertIcon, ServerIcon, ShieldAlertIcon } from "lucide-react";
import type { ReactNode } from "react";

import { monitorAPI } from "@/api";
import { PageCard } from "@/components/app/page-card";

export const Route = createFileRoute("/monitoring/overview")({ component: MonitoringOverviewPage });

function MonitoringOverviewPage() {
    const { data, isFetching } = useQuery({
        queryKey: ["monitor", "overview"],
        queryFn: monitorAPI.overview,
        refetchInterval: 30_000,
    });

    return (
        <PageCard title="监控概览" description="查看当前节点可用性和最新基础设施心跳。">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <Metric
                    label="已注册节点"
                    value={data?.registeredNodes ?? 0}
                    icon={<ServerIcon />}
                />
                <Metric label="在线节点" value={data?.onlineNodes ?? 0} icon={<ActivityIcon />} />
                <Metric
                    label="离线节点"
                    value={data?.offlineNodes ?? 0}
                    icon={<ClockAlertIcon />}
                />
                <Metric
                    label="异常检查"
                    value={data?.unhealthyChecks ?? 0}
                    icon={<ActivityIcon />}
                />
                <Metric
                    label="活动事件"
                    value={data?.activeIncidents ?? 0}
                    icon={<ShieldAlertIcon />}
                />
            </div>
            {!isFetching && data?.registeredNodes === 0 ? (
                <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                    No monitor nodes registered.
                </div>
            ) : null}
        </PageCard>
    );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
    return (
        <div className="flex items-center justify-between rounded-lg border bg-card p-4">
            <div>
                <div className="text-sm text-muted-foreground">{label}</div>
                <div className="mt-1 text-2xl font-semibold">{value}</div>
            </div>
            <div className="text-muted-foreground">{icon}</div>
        </div>
    );
}
