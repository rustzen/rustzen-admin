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
import { PageCard } from "@/components/app/page-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/analytics/overview")({ component: AnalyticsOverviewPage });

function AnalyticsOverviewPage() {
    const { data: overview } = useQuery({
        queryKey: ["insights", "overview"],
        queryFn: () => insightsAPI.overview({}),
        refetchInterval: 30_000,
    });
    return (
        <PageCard title="分析概览" description="查看当前实例的页面、接口、事件和访客活动。">
            <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Metric label="页面浏览量" value={overview?.pv ?? 0} />
                    <Metric label="独立访客" value={overview?.uv ?? 0} />
                    <Metric label="全部事件" value={overview?.eventCount ?? 0} />
                    <Metric label="接口请求" value={overview?.requestCount ?? 0} />
                    <Metric label="错误数" value={overview?.errorCount ?? 0} />
                    <Metric
                        label="平均耗时"
                        value={`${Math.round(overview?.averageDurationMs ?? 0)} ms`}
                    />
                    <Metric label="P95 耗时" value={`${overview?.p95DurationMs ?? 0} ms`} />
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>每日活动</CardTitle>
                    </CardHeader>
                    <CardContent className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={overview?.trend ?? []}>
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

function Metric({ label, value }: { label: string; value: number | string }) {
    return (
        <Card className="gap-3 py-4">
            <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold tabular-nums">{value}</CardContent>
        </Card>
    );
}
