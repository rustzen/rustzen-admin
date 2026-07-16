import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3Icon } from "lucide-react";
import { useState } from "react";
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
import { ProjectSelect } from "@/components/analytics/project-select";
import { PageCard } from "@/components/app/page-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/analytics/overview")({ component: AnalyticsOverviewPage });

function AnalyticsOverviewPage() {
    const [projectId, setProjectId] = useState("");
    const { data: overview } = useQuery({
        queryKey: ["insights", "overview", projectId],
        queryFn: () => insightsAPI.overview({ projectId }),
        enabled: Boolean(projectId),
        refetchInterval: 30_000,
    });
    return (
        <PageCard
            title="Analytics overview"
            description="Page, API, event, and visitor activity for the selected project."
        >
            <ProjectSelect value={projectId} onChange={setProjectId} />
            {projectId ? (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <Metric label="Page views" value={overview?.pv ?? 0} />
                        <Metric label="Unique visitors" value={overview?.uv ?? 0} />
                        <Metric label="All events" value={overview?.eventCount ?? 0} />
                        <Metric label="API requests" value={overview?.requestCount ?? 0} />
                        <Metric label="Errors" value={overview?.errorCount ?? 0} />
                        <Metric
                            label="Average duration"
                            value={`${Math.round(overview?.averageDurationMs ?? 0)} ms`}
                        />
                        <Metric label="P95 duration" value={`${overview?.p95DurationMs ?? 0} ms`} />
                    </div>
                    <Card>
                        <CardHeader>
                            <CardTitle>Daily activity</CardTitle>
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
                                        name="Requests"
                                        stroke="var(--chart-3)"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </>
            ) : (
                <div className="flex min-h-64 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center text-muted-foreground">
                    <BarChart3Icon className="mb-2 size-8" />
                    <p>Create a project to start collecting analytics events.</p>
                </div>
            )}
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
