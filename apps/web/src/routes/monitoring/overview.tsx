import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ActivityIcon, ClockAlertIcon, ServerIcon, ShieldAlertIcon } from "lucide-react";

import { monitorAPI } from "@/api";
import { DataState } from "@/components/feedback/data-state";
import { MetricCard } from "@/components/page/metric-card";
import { PageCard } from "@/components/page/page-card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/monitoring/overview")({ component: MonitoringOverviewPage });

function MonitoringOverviewPage() {
    const { data, error, isPending, refetch } = useQuery({
        queryKey: ["monitor", "overview"],
        queryFn: monitorAPI.overview,
        refetchInterval: 30_000,
    });

    if (isPending) {
        return (
            <PageCard title="监控概览" description="查看当前节点可用性和最新基础设施心跳。">
                <DataState kind="loading" title="正在加载监控概览" />
            </PageCard>
        );
    }

    if (!data) {
        return (
            <PageCard title="监控概览" description="查看当前节点可用性和最新基础设施心跳。">
                <DataState
                    kind="error"
                    title={error ? "监控概览加载失败" : "监控概览暂不可用"}
                    description="无法读取节点和服务状态，请检查 Monitor 服务后重试。"
                    action={<Button onClick={() => void refetch()}>重新加载</Button>}
                />
            </PageCard>
        );
    }

    return (
        <PageCard title="监控概览" description="查看当前节点可用性和最新基础设施心跳。">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <MetricCard label="已注册节点" value={data.registeredNodes} icon={<ServerIcon />} />
                <MetricCard label="在线节点" value={data.onlineNodes} icon={<ActivityIcon />} />
                <MetricCard label="离线节点" value={data.offlineNodes} icon={<ClockAlertIcon />} />
                <MetricCard label="异常检查" value={data.unhealthyChecks} icon={<ActivityIcon />} />
                <MetricCard
                    label="活动事件"
                    value={data.activeIncidents}
                    icon={<ShieldAlertIcon />}
                />
            </div>
            {data.registeredNodes === 0 ? (
                <DataState
                    kind="empty"
                    title="暂无监控节点"
                    description="启动节点上的 rz-monitor agent，首次心跳通过后会自动出现在这里。"
                />
            ) : null}
        </PageCard>
    );
}
