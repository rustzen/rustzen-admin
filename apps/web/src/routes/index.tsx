import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
    ActivityIcon,
    ClockIcon,
    DownloadIcon,
    HardDriveIcon,
    ServerIcon,
    ShieldAlertIcon,
    UserCheckIcon,
    UserPlusIcon,
    UsersIcon,
} from "lucide-react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { dashboardAPI } from "@/api";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculatePercent, convertUnit } from "@/util";

export const Route = createFileRoute("/")({
    component: DashboardPage,
});

function DashboardPage() {
    return (
        <div className="operations-ledger mx-auto flex h-full min-h-0 min-w-0 w-full flex-col gap-5 overflow-y-auto pr-1">
            <PageHeader
                title="Dashboard"
                description="Operational overview for users, runtime health, and activity trends."
                actions={
                    <Button>
                        <DownloadIcon data-icon="inline-start" />
                        Download
                    </Button>
                }
            />

            <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col gap-4">
                <div className="w-full overflow-x-auto pb-1">
                    <TabsList>
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="analytics">Analytics</TabsTrigger>
                        <TabsTrigger value="reports" disabled>
                            Reports
                        </TabsTrigger>
                        <TabsTrigger value="notifications" disabled>
                            Notifications
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="overview" className="mt-0 flex flex-col gap-5">
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
                        <ModuleHealthCards />
                        <StatsCards />
                    </div>
                    <div className="grid gap-4 lg:grid-cols-7">
                        <ActivityTrendCard />
                        <HealthCard />
                    </div>
                    <MetricsCard />
                </TabsContent>

                <TabsContent value="analytics" className="mt-0">
                    <div className="grid gap-4 lg:grid-cols-2">
                        <HealthCard />
                        <MetricsCard />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

const ModuleHealthCards = () => {
    const { data = [] } = useQuery({
        queryKey: ["dashboard", "modules"],
        queryFn: dashboardAPI.modules,
        refetchInterval: 15_000,
    });
    return (
        <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="border-b py-4">
                <CardTitle>Module availability</CardTitle>
                <CardDescription>Current release and reachability for each runtime module.</CardDescription>
            </CardHeader>
            <CardContent className="divide-y p-0">
            {(["monitor", "insights", "reports"] as const).map((module) => {
                const health = data.find((item) => item.module === module);
                return (
                    <div key={module} className="grid grid-cols-[1fr_auto] items-center gap-4 px-6 py-4">
                        <div className="min-w-0">
                            <div className="font-medium capitalize">{module}</div>
                            <div className="mt-1 text-xs text-muted-foreground">Release {health?.releaseVersion ?? "-"}</div>
                        </div>
                            <Badge variant={health?.available ? "default" : "destructive"}>
                                {health?.available ? "Available" : "Unavailable"}
                            </Badge>
                    </div>
                );
            })}
            </CardContent>
        </Card>
    );
};

const StatsCards = () => {
    const { data: stats } = useQuery({
        queryKey: ["dashboard", "stats"],
        queryFn: dashboardAPI.stats,
    });

    const cards = [
        {
            title: "Total Users",
            value: stats?.totalUsers ?? 0,
            description: "All registered accounts",
            icon: UsersIcon,
        },
        {
            title: "Active Users",
            value: stats?.activeUsers ?? 0,
            description: "Accounts currently enabled",
            icon: UserCheckIcon,
        },
        {
            title: "Today Logins",
            value: stats?.todayLogins ?? 0,
            description: "Successful sessions today",
            icon: ClockIcon,
        },
        {
            title: "Pending Users",
            value: stats?.pendingUsers ?? 0,
            description: "Waiting for approval",
            icon: UserPlusIcon,
        },
    ];

    return (
        <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="border-b py-4">
                <CardTitle>Account ledger</CardTitle>
                <CardDescription>Registered, active, recent, and pending access.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 p-0">
            {cards.map((item) => (
                <div key={item.title} className="border-b border-e p-4 even:border-e-0 [&:nth-last-child(-n+2)]:border-b-0">
                    <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
                        <span>{item.title}</span>
                        <item.icon className="size-4" />
                    </div>
                    <div className="tabular-nums mt-2 text-2xl font-semibold tracking-tight">{item.value}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                </div>
            ))}
            </CardContent>
        </Card>
    );
};

const HealthCard = () => {
    const { data: health } = useQuery({
        queryKey: ["dashboard", "health"],
        queryFn: dashboardAPI.health,
    });
    const memoryUsage = calculatePercent(health?.memoryUsed, health?.memoryTotal);
    const cpuUsage = formatProgressPercent(health?.cpuUsed);
    const diskUsage = calculatePercent(health?.diskUsed, health?.diskTotal);

    return (
        <Card className="lg:col-span-3">
            <CardHeader>
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <CardTitle>System Health</CardTitle>
                        <CardDescription>
                            Runtime pressure across memory, CPU, and disk.
                        </CardDescription>
                    </div>
                    <ShieldAlertIcon className="text-muted-foreground" />
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                <ProgressRow
                    icon={ServerIcon}
                    label="Memory usage"
                    value={memoryUsage}
                    detail={`${convertUnit(health?.memoryUsed)} / ${convertUnit(health?.memoryTotal)}`}
                    warning={memoryUsage > 80}
                />
                <ProgressRow
                    icon={ActivityIcon}
                    label="CPU usage"
                    value={cpuUsage}
                    detail={`${cpuUsage.toFixed(1)}% / ${health?.cpuTotal ?? 0}`}
                    warning={cpuUsage > 80}
                />
                <ProgressRow
                    icon={HardDriveIcon}
                    label="Disk usage"
                    value={diskUsage}
                    detail={`${convertUnit(health?.diskUsed)} / ${convertUnit(health?.diskTotal)}`}
                    warning={diskUsage > 90}
                />
            </CardContent>
        </Card>
    );
};

const MetricsCard = () => {
    const { data: metrics } = useQuery({
        queryKey: ["dashboard", "metrics"],
        queryFn: dashboardAPI.metrics,
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Seven-day request performance summary.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
                <MetricBlock
                    label="Average response"
                    value={`${metrics?.avgResponseTime ?? 0}ms`}
                />
                <MetricBlock
                    label="Error rate"
                    value={`${(metrics?.errorRate ?? 0).toFixed(1)}%`}
                />
                <MetricBlock label="Total requests" value={`${metrics?.totalRequests ?? 0}`} />
            </CardContent>
        </Card>
    );
};

const ActivityTrendCard = () => {
    const { data } = useQuery({
        queryKey: ["dashboard", "trends"],
        queryFn: dashboardAPI.trends,
    });
    const dailyLogins = normalizeTrendItems(data?.dailyLogins);
    const hourlyActive = normalizeTrendItems(data?.hourlyActive);

    return (
        <Card className="lg:col-span-4">
            <CardHeader>
                <CardTitle>Overview</CardTitle>
                <CardDescription>User login trend and active-user pulse.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 xl:grid-cols-2">
                <div className="h-60 min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dailyLogins}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} />
                            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                            <Tooltip />
                            <Line
                                type="monotone"
                                dataKey="count"
                                stroke="var(--chart-1)"
                                strokeWidth={2}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <div className="h-60 min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={hourlyActive}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} />
                            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                            <Tooltip />
                            <Bar dataKey="count" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
};

const ProgressRow = ({
    icon: Icon,
    label,
    value,
    detail,
    warning,
}: {
    icon: typeof ServerIcon;
    label: string;
    value: number;
    detail: string;
    warning: boolean;
}) => (
    <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 font-medium">
                <Icon className="text-muted-foreground" />
                <span>{label}</span>
            </div>
            <span className="text-muted-foreground">{detail}</span>
        </div>
        <div className="h-2 rounded-full bg-secondary">
            <div
                className="h-2 rounded-full bg-primary transition-all data-[warning=true]:bg-destructive"
                data-warning={warning}
                style={{ width: `${value}%` }}
            />
        </div>
    </div>
);

const MetricBlock = ({ label, value }: { label: string; value: string }) => (
    <div className="border-s-2 border-primary/25 ps-4">
        <div className="tabular-nums text-2xl font-semibold tracking-tight">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
    </div>
);

const normalizeTrendItems = (items?: Dashboard.TrendItem[]) => {
    return (items ?? [])
        .filter((item) => item.date)
        .map((item) => ({
            date: item.date ?? "",
            count: item.count ?? 0,
        }));
};

const formatProgressPercent = (value?: number | null) => {
    if (!value) return 0;
    return Number(Math.max(0, Math.min(100, value)).toFixed(1));
};
