import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { insightsAPI } from "@/api";
import { DataState } from "@/components/feedback/data-state";
import { MetricCard } from "@/components/page/metric-card";
import { PageCard } from "@/components/page/page-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/analytics/overview")({ component: AnalyticsOverviewPage });

function AnalyticsOverviewPage() {
    const {
        data: overview,
        error,
        isPending,
        refetch,
    } = useQuery({
        queryKey: ["insights", "overview"],
        queryFn: () => insightsAPI.overview({}),
        refetchInterval: 30_000,
    });
    if (isPending) {
        return (
            <PageCard title="分析概览" description="查看当前实例的页面、接口、事件和访客活动。">
                <DataState kind="loading" title="正在加载分析概览" />
            </PageCard>
        );
    }

    if (!overview) {
        return (
            <PageCard title="分析概览" description="查看当前实例的页面、接口、事件和访客活动。">
                <DataState
                    kind="error"
                    title={error ? "分析概览加载失败" : "分析概览暂不可用"}
                    description="无法读取分析数据，请检查 Insights 服务后重试。"
                    action={<Button onClick={() => void refetch()}>重新加载</Button>}
                />
            </PageCard>
        );
    }

    return (
        <PageCard title="分析概览" description="查看当前实例的页面、接口、事件和访客活动。">
            <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="页面浏览量" value={overview.pv} />
                    <MetricCard label="独立访客" value={overview.uv} />
                    <MetricCard label="全部事件" value={overview.eventCount} />
                    <MetricCard label="接口请求" value={overview.requestCount} />
                    <MetricCard label="错误数" value={overview.errorCount} />
                    <MetricCard
                        label="平均耗时"
                        value={`${Math.round(overview.averageDurationMs)} ms`}
                    />
                    <MetricCard label="P95 耗时" value={`${overview.p95DurationMs} ms`} />
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>每日活动</CardTitle>
                    </CardHeader>
                    <CardContent className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={overview.trend}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Line
                                    type="monotone"
                                    dataKey="pv"
                                    name="PV"
                                    stroke="var(--chart-1)"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="uv"
                                    name="UV"
                                    stroke="var(--chart-2)"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="requestCount"
                                    name="请求数"
                                    stroke="var(--chart-3)"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </>
        </PageCard>
    );
}
