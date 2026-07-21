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
import type { ReactNode } from "react";
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
import { DataState } from "@/components/feedback/data-state";
import { PageHeader } from "@/components/page/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { t } from "@/lib/i18n";
import { calculatePercent, convertUnit } from "@/util";

export const Route = createFileRoute("/")({
    component: DashboardPage,
});

function DashboardPage() {
    return (
        <div className="operations-ledger mx-auto flex h-full min-h-0 min-w-0 w-full flex-col gap-5 overflow-y-auto pr-1">
            <PageHeader
                title={t("仪表盘", "Dashboard")}
                description={t(
                    "用户、运行健康和活动趋势的运维概览。",
                    "An operational overview of users, runtime health, and activity trends.",
                )}
            />

            <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col gap-4">
                <div className="w-full overflow-x-auto pb-1">
                    <TabsList>
                        <TabsTrigger value="overview">{t("概览", "Overview")}</TabsTrigger>
                        <TabsTrigger value="analytics">{t("分析", "Analytics")}</TabsTrigger>
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
    const { data, error, isPending, refetch } = useQuery({
        queryKey: ["dashboard", "modules"],
        queryFn: dashboardAPI.modules,
        refetchInterval: 15_000,
    });
    return (
        <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="border-b py-4">
                <CardTitle>{t("模块可用性", "Module availability")}</CardTitle>
                <CardDescription>
                    {t(
                        "当前各运行模块的版本与连通状态。",
                        "Versions and connectivity status of the active modules.",
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent className="divide-y p-0">
                <DashboardQueryBoundary
                    isPending={isPending}
                    error={error}
                    hasData={data !== undefined}
                    loadingTitle={t("正在加载模块状态", "Loading module status")}
                    errorTitle={t("模块状态加载失败", "Failed to load module status")}
                    onRetry={() => void refetch()}
                >
                    {(["monitor", "insights", "reports"] as const).map((module) => {
                        const health = data?.find((item) => item.module === module);
                        const moduleLabel = {
                            monitor: t("监控", "Monitor"),
                            insights: t("分析", "Insights"),
                            reports: t("报表", "Reports"),
                        }[module];
                        return (
                            <div
                                key={module}
                                className="grid grid-cols-[1fr_auto] items-center gap-4 px-6 py-4"
                            >
                                <div className="min-w-0">
                                    <div className="font-medium">{moduleLabel}</div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        {t("版本", "Version")} {health?.releaseVersion ?? "-"}
                                    </div>
                                </div>
                                <Badge variant={health?.available ? "default" : "destructive"}>
                                    {health?.available
                                        ? t("可用", "Available")
                                        : t("不可用", "Unavailable")}
                                </Badge>
                            </div>
                        );
                    })}
                </DashboardQueryBoundary>
            </CardContent>
        </Card>
    );
};

const StatsCards = () => {
    const {
        data: stats,
        error,
        isPending,
        refetch,
    } = useQuery({
        queryKey: ["dashboard", "stats"],
        queryFn: dashboardAPI.stats,
    });

    const cards = [
        {
            title: t("用户总数", "Total users"),
            value: stats?.totalUsers ?? 0,
            description: t("全部已注册账号", "All registered accounts"),
            icon: UsersIcon,
        },
        {
            title: t("活跃用户", "Active users"),
            value: stats?.activeUsers ?? 0,
            description: t("当前已启用账号", "Currently enabled accounts"),
            icon: UserCheckIcon,
        },
        {
            title: t("今日登录", "Today's logins"),
            value: stats?.todayLogins ?? 0,
            description: t("今日成功会话", "Successful sessions today"),
            icon: ClockIcon,
        },
        {
            title: t("待审核用户", "Pending users"),
            value: stats?.pendingUsers ?? 0,
            description: t("等待审核", "Awaiting review"),
            icon: UserPlusIcon,
        },
    ];

    return (
        <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="border-b py-4">
                <CardTitle>{t("账号台账", "Account overview")}</CardTitle>
                <CardDescription>
                    {t(
                        "注册、活跃、近期和待审核访问情况。",
                        "Registration, activity, recent access, and pending reviews.",
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 p-0">
                <DashboardQueryBoundary
                    isPending={isPending}
                    error={error}
                    hasData={stats !== undefined}
                    loadingTitle={t("正在加载账号统计", "Loading account statistics")}
                    errorTitle={t("账号统计加载失败", "Failed to load account statistics")}
                    onRetry={() => void refetch()}
                >
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
                </DashboardQueryBoundary>
            </CardContent>
        </Card>
    );
};

const HealthCard = () => {
    const {
        data: health,
        error,
        isPending,
        refetch,
    } = useQuery({
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
                        <CardTitle>{t("系统健康", "System health")}</CardTitle>
                        <CardDescription>
                            {t(
                                "当前内存、CPU 与磁盘资源压力。",
                                "Current memory, CPU, and disk utilization.",
                            )}
                        </CardDescription>
                    </div>
                    <ShieldAlertIcon className="text-muted-foreground" />
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                <DashboardQueryBoundary
                    isPending={isPending}
                    error={error}
                    hasData={health !== undefined}
                    loadingTitle={t("正在加载系统健康状态", "Loading system health")}
                    errorTitle={t("系统健康状态加载失败", "Failed to load system health")}
                    onRetry={() => void refetch()}
                >
                    <ProgressRow
                        icon={ServerIcon}
                        label={t("内存使用率", "Memory usage")}
                        value={memoryUsage}
                        detail={`${convertUnit(health?.memoryUsed)} / ${convertUnit(health?.memoryTotal)}`}
                        warning={memoryUsage > 80}
                    />
                    <ProgressRow
                        icon={ActivityIcon}
                        label={t("CPU 使用率", "CPU usage")}
                        value={cpuUsage}
                        detail={`${cpuUsage.toFixed(1)}% / ${health?.cpuTotal ?? 0}`}
                        warning={cpuUsage > 80}
                    />
                    <ProgressRow
                        icon={HardDriveIcon}
                        label={t("磁盘使用率", "Disk usage")}
                        value={diskUsage}
                        detail={`${convertUnit(health?.diskUsed)} / ${convertUnit(health?.diskTotal)}`}
                        warning={diskUsage > 90}
                    />
                </DashboardQueryBoundary>
            </CardContent>
        </Card>
    );
};

const MetricsCard = () => {
    const {
        data: metrics,
        error,
        isPending,
        refetch,
    } = useQuery({
        queryKey: ["dashboard", "metrics"],
        queryFn: dashboardAPI.metrics,
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("性能指标", "Performance metrics")}</CardTitle>
                <CardDescription>
                    {t("近七天请求性能摘要。", "Request performance over the past seven days.")}
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
                <DashboardQueryBoundary
                    isPending={isPending}
                    error={error}
                    hasData={metrics !== undefined}
                    loadingTitle={t("正在加载性能指标", "Loading performance metrics")}
                    errorTitle={t("性能指标加载失败", "Failed to load performance metrics")}
                    onRetry={() => void refetch()}
                >
                    <MetricBlock
                        label={t("平均响应", "Average response time")}
                        value={`${metrics?.avgResponseTime ?? 0}ms`}
                    />
                    <MetricBlock
                        label={t("错误率", "Error rate")}
                        value={`${(metrics?.errorRate ?? 0).toFixed(1)}%`}
                    />
                    <MetricBlock
                        label={t("请求总数", "Total requests")}
                        value={`${metrics?.totalRequests ?? 0}`}
                    />
                </DashboardQueryBoundary>
            </CardContent>
        </Card>
    );
};

const ActivityTrendCard = () => {
    const { data, error, isPending, refetch } = useQuery({
        queryKey: ["dashboard", "trends"],
        queryFn: dashboardAPI.trends,
    });
    const dailyLogins = normalizeTrendItems(data?.dailyLogins);
    const hourlyActive = normalizeTrendItems(data?.hourlyActive);

    return (
        <Card className="lg:col-span-4">
            <CardHeader>
                <CardTitle>{t("概览", "Overview")}</CardTitle>
                <CardDescription>
                    {t(
                        "用户登录趋势和活跃用户动态。",
                        "User login trends and active-user activity.",
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 xl:grid-cols-2">
                <DashboardQueryBoundary
                    isPending={isPending}
                    error={error}
                    hasData={data !== undefined}
                    loadingTitle={t("正在加载活动趋势", "Loading activity trends")}
                    errorTitle={t("活动趋势加载失败", "Failed to load activity trends")}
                    onRetry={() => void refetch()}
                >
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
                </DashboardQueryBoundary>
            </CardContent>
        </Card>
    );
};

function DashboardQueryBoundary({
    isPending,
    error,
    hasData,
    loadingTitle,
    errorTitle,
    onRetry,
    children,
}: {
    isPending: boolean;
    error: Error | null;
    hasData: boolean;
    loadingTitle: string;
    errorTitle: string;
    onRetry: () => void;
    children: ReactNode;
}) {
    if (isPending && !hasData) {
        return <DataState kind="loading" title={loadingTitle} compact className="col-span-full" />;
    }
    if (error && !hasData) {
        return (
            <DataState
                kind="error"
                title={errorTitle}
                description={t(
                    "无法读取当前数据，请检查 Admin 服务后重试。",
                    "Unable to read the current data. Check the Admin service and try again.",
                )}
                action={<Button onClick={onRetry}>{t("重新加载", "Reload")}</Button>}
                compact
                className="col-span-full"
            />
        );
    }
    return (
        <>
            {children}
            {error ? (
                <div
                    className="col-span-full flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-xs text-destructive"
                    role="alert"
                >
                    <span>
                        {t(
                            "后台刷新失败，当前继续显示上次成功数据。",
                            "Background refresh failed. The last successfully loaded data remains visible.",
                        )}
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                        {t("重试", "Retry")}
                    </Button>
                </div>
            ) : null}
        </>
    );
}

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
