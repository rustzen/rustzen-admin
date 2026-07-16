import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
    AlertCircleIcon,
    CpuIcon,
    DatabaseIcon,
    HardDriveIcon,
    MemoryStickIcon,
} from "lucide-react";

import { systemAPI } from "@/api";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/system/status")({
    component: SystemStatusPage,
});

function SystemStatusPage() {
    const { data, isError, isLoading } = useQuery({
        queryKey: ["system", "status"],
        queryFn: systemAPI.status.overview,
        refetchInterval: 30 * 1000,
    });

    if (isLoading && !data) {
        return (
            <div className="flex h-full flex-col gap-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-80 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto">
            <PageHeader
                title="System Status"
                description="Storage and local resource telemetry refreshed every 30 seconds."
                actions={
                    <span className="text-sm text-muted-foreground">
                        Collected at: {data?.collectedAt ? formatDateTime(data.collectedAt) : "-"}
                    </span>
                }
            />

            {data ? (
                <>
                    <StorageCard storage={data.storage} />
                    <ResourceCard resource={data.resource} />
                </>
            ) : isError ? (
                <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertTitle>Failed to load system status</AlertTitle>
                    <AlertDescription>
                        Please retry later or check the server logs.
                    </AlertDescription>
                </Alert>
            ) : null}
        </div>
    );
}

function StorageCard({ storage }: { storage: SystemStatus.StorageStatus }) {
    const maxDirectoryBytes = Math.max(...storage.directories.map((item) => item.sizeBytes), 1);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Storage</CardTitle>
                <CardDescription>
                    SQLite storage and runtime directory distribution.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
                    <div className="rounded-lg border bg-muted/40 p-5">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <DatabaseIcon />
                            <span>SQLite total</span>
                        </div>
                        <div className="mt-3 text-4xl font-semibold">
                            {formatBytes(storage.database.totalBytes)}
                        </div>
                        <div className="mt-5 inline-flex rounded-md border bg-background px-3 py-1 text-sm text-muted-foreground">
                            SQLite database
                        </div>
                        <Progress className="mt-5" value={100} />
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                            <span>Main {formatBytes(storage.database.mainBytes)}</span>
                            <span className="text-right">
                                WAL {formatBytes(storage.database.walBytes)}
                            </span>
                        </div>
                    </div>

                    <div>
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <div className="text-base font-semibold">
                                    Directory Distribution
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground">
                                    Compared by current directory usage
                                </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {storage.directories.length} items
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2">
                            {storage.directories.map((item) => (
                                <div key={item.key}>
                                    <div className="mb-3 flex items-center justify-between gap-4">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <span className="truncate font-semibold">
                                                {item.label}
                                            </span>
                                            {item.errorMessage ? (
                                                <span className="shrink-0 text-xs text-destructive">
                                                    {item.errorMessage}
                                                </span>
                                            ) : null}
                                        </div>
                                        <div className="shrink-0 font-semibold">
                                            {formatBytes(item.sizeBytes)}
                                        </div>
                                    </div>
                                    <Progress
                                        value={Math.round(
                                            (item.sizeBytes / maxDirectoryBytes) * 100,
                                        )}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-5 border-t pt-5 md:grid-cols-3">
                    <StorageBreakdownItem
                        label="Main"
                        value={storage.database.mainBytes}
                        total={storage.database.totalBytes}
                    />
                    <StorageBreakdownItem
                        label="WAL"
                        value={storage.database.walBytes}
                        total={storage.database.totalBytes}
                    />
                    <StorageBreakdownItem
                        label="SHM"
                        value={storage.database.shmBytes}
                        total={storage.database.totalBytes}
                    />
                </div>
            </CardContent>
        </Card>
    );
}

function StorageBreakdownItem({
    label,
    value,
    total,
}: {
    label: string;
    value: number;
    total: number;
}) {
    const percent = total > 0 ? Math.round((value / total) * 100) : 0;

    return (
        <div>
            <div className="mb-2 flex items-center justify-between gap-4">
                <span className="font-medium text-muted-foreground">{label}</span>
                <span className="font-semibold">{formatBytes(value)}</span>
            </div>
            <Progress value={percent} />
        </div>
    );
}

function ResourceCard({ resource }: { resource: SystemStatus.LocalResourceStatus }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Local Resources</CardTitle>
                <CardDescription>
                    CPU, memory, and disk utilization on the current host.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-7 lg:grid-cols-3">
                <ResourceMetric
                    icon={CpuIcon}
                    title="CPU"
                    detail={`${resource.cpu.cores} cores`}
                    percent={resource.cpu.usagePercent}
                />
                <ResourceMetric
                    icon={MemoryStickIcon}
                    title="Memory"
                    detail={`${formatBytes(resource.memory.usedBytes)} / ${formatBytes(resource.memory.totalBytes)}`}
                    percent={resource.memory.usagePercent}
                />
                <ResourceMetric
                    icon={HardDriveIcon}
                    title="Disk"
                    detail={`${formatBytes(resource.disk.usedBytes)} / ${formatBytes(resource.disk.totalBytes)}`}
                    percent={resource.disk.usagePercent}
                />
            </CardContent>
        </Card>
    );
}

function ResourceMetric({
    icon: Icon,
    title,
    detail,
    percent,
}: {
    icon: typeof CpuIcon;
    title: string;
    detail: string;
    percent: number;
}) {
    return (
        <div>
            <div className="mb-3 flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 font-semibold">
                    <Icon className="text-muted-foreground" />
                    <span>{title}</span>
                </div>
                <div className="text-right text-muted-foreground">{detail}</div>
            </div>
            <div className="flex w-full items-center gap-3">
                <Progress className="min-w-0 flex-1" value={clampPercent(percent)} />
                <span className="w-14 text-right tabular-nums">{formatPercent(percent)}</span>
            </div>
        </div>
    );
}

function clampPercent(value: number) {
    return Math.max(0, Math.min(100, Number(value.toFixed(1))));
}

function formatPercent(value: number) {
    return `${Number(value.toFixed(1))}%`;
}

function formatBytes(bytes: number) {
    if (!bytes) {
        return "0 B";
    }

    const units = ["B", "KB", "MB", "GB", "TB"] as const;
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    const precision = unitIndex === 0 ? 0 : 1;
    return `${Number(value.toFixed(precision))} ${units[unitIndex]}`;
}

function formatDateTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "-";
    }
    const pad = (part: number) => part.toString().padStart(2, "0");
    return (
        [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("-") +
        ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    );
}
