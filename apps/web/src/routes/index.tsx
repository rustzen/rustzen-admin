import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
    ActivityIcon,
    ClockIcon,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculatePercent, convertUnit } from "@/util";

export const Route = createFileRoute("/")({
    component: DashboardPage,
});

function DashboardPage() {
    return (
        <div className="operations-ledger mx-auto flex h-full min-h-0 min-w-0 w-full flex-col gap-5 overflow-y-auto pr-1">
            <PageHeader title="仪表盘" description="用户、运行健康和活动趋势的运维概览。" />

            <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col gap-4">
                <div className="w-full overflow-x-auto pb-1">
                    <TabsList>
                        <TabsTrigger value="overview">概览</TabsTrigger>
                        <TabsTrigger value="analytics">分析</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent
                    value="overview"
                    className="mt-0 grid gap-5 xl:grid-cols-[minmax(0,2.05fr)_minmax(320px,0.95fr)]"
                >
                    <div className="operations-ledger__main flex min-w-0 flex-col gap-5">
                        <ModuleHealthCards />
                        <ActivityTrendCard />
                        <MetricsCard />
                    </div>
                    <aside className="operations-ledger__rail flex min-w-0 flex-col gap-5">
                        <StatsCards />
                        <HealthCard />
                    </aside>
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
                <CardTitle>模块可用性</CardTitle>
                <CardDescription>
                    Current release and reachability for each runtime module.
                </CardDescription>
            </CardHeader>
            <CardContent className="divide-y p-0">
                {(["monitor", "insights", "reports"] as const).map((module) => {
                    const health = data.find((item) => item.module === module);
                    return (
                        <div
                            key={module}
                            className="grid grid-cols-[1fr_auto] items-center gap-4 px-6 py-4"
                        >
                            <div className="min-w-0">
                                <div className="font-medium capitalize">{module}</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    Release {health?.releaseVersion ?? "-"}
                                </div>
                            </div>
                            <Badge variant={health?.available ? "default" : "destructive"}>
                                {health?.available ? "可用" : "不可用"}
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
            title: "用户总数",
            value: stats?.totalUsers ?? 0,
            description: "全部已注册账号",
            icon: UsersIcon,
        },
        {
            title: "活跃用户",
            value: stats?.activeUsers ?? 0,
            description: "当前已启用账号",
            icon: UserCheckIcon,
        },
        {
            title: "今日登录",
            value: stats?.todayLogins ?? 0,
            description: "今日成功会话",
            icon: ClockIcon,
        },
        {
            title: "待审核用户",
            value: stats?.pendingUsers ?? 0,
            description: "等待审核",
            icon: UserPlusIcon,
        },
    ];

    return (
        <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="border-b py-4">
                <CardTitle>账号台账</CardTitle>
                <CardDescription>注册、活跃、近期和待审核访问情况。</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 p-0">
                {cards.map((item) => (
                    <div
                        key={item.title}
                        className="border-b border-e p-4 even:border-e-0 [&:nth-last-child(-n+2)]:border-b-0"
                    >
                        <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
                            <span>{item.title}</span>
                            <item.icon className="size-4" />
                        </div>
                        <div className="tabular-nums mt-2 text-2xl font-semibold tracking-tight">
                            {item.value}
                        </div>
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
                        <CardTitle>系统健康</CardTitle>
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
                    label="内存使用率"
                    value={memoryUsage}
                    detail={`${convertUnit(health?.memoryUsed)} / ${convertUnit(health?.memoryTotal)}`}
                    warning={memoryUsage > 80}
                />
                <ProgressRow
                    icon={ActivityIcon}
                    label="CPU 使用率"
                    value={cpuUsage}
                    detail={`${cpuUsage.toFixed(1)}% / ${health?.cpuTotal ?? 0}`}
                    warning={cpuUsage > 80}
                />
                <ProgressRow
                    icon={HardDriveIcon}
                    label="磁盘使用率"
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
                <CardTitle>性能指标</CardTitle>
                <CardDescription>近七天请求性能摘要。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
                <MetricBlock label="平均响应" value={`${metrics?.avgResponseTime ?? 0}ms`} />
                <MetricBlock label="错误率" value={`${(metrics?.errorRate ?? 0).toFixed(1)}%`} />
                <MetricBlock label="请求总数" value={`${metrics?.totalRequests ?? 0}`} />
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
                <CardTitle>概览</CardTitle>
                <CardDescription>用户登录趋势和活跃用户动态。</CardDescription>
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
