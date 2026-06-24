import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Alert, Card, Progress, Skeleton } from "antd";

import { systemAPI } from "@/api";

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
        return <Skeleton active paragraph={{ rows: 10 }} />;
    }

    return (
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto">
            <div className="flex items-center justify-between gap-4">
                <h2 className="m-0 text-xl font-semibold text-slate-950">System Status</h2>
                <div className="shrink-0 text-sm text-slate-500">
                    Collected at:{" "}
                    {data?.collectedAt ? formatDateTime(data.collectedAt) : "-"}
                </div>
            </div>

            {data ? (
                <>
                    <StorageCard storage={data.storage} />
                    <ResourceCard resource={data.resource} />
                </>
            ) : isError ? (
                <Alert
                    showIcon
                    type="error"
                    message="Failed to load system status"
                    description="Please retry later or check the server logs."
                />
            ) : null}
        </div>
    );
}

function StorageCard({ storage }: { storage: SystemStatus.StorageStatus }) {
    const maxDirectoryBytes = Math.max(...storage.directories.map((item) => item.sizeBytes), 1);

    return (
        <Card title="Storage">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
                <div className="rounded border border-slate-100 bg-slate-50 p-5">
                    <div className="text-sm text-slate-500">SQLite total</div>
                    <div className="mt-3 text-4xl font-semibold text-slate-950">
                        {formatBytes(storage.database.totalBytes)}
                    </div>
                    <div className="mt-5 inline-flex rounded bg-white px-3 py-1 text-sm text-slate-500">
                        SQLite database
                    </div>
                    <Progress
                        className="mt-5"
                        percent={100}
                        showInfo={false}
                        strokeColor="#1677ff"
                        trailColor="#e5e7eb"
                    />
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-500">
                        <span>Main {formatBytes(storage.database.mainBytes)}</span>
                        <span className="text-right">WAL {formatBytes(storage.database.walBytes)}</span>
                    </div>
                </div>

                <div>
                    <div className="mb-5 flex items-start justify-between">
                        <div>
                            <div className="text-base font-semibold text-slate-950">
                                Directory Distribution
                            </div>
                            <div className="mt-1 text-sm text-slate-500">
                                Compared by current directory usage
                            </div>
                        </div>
                        <div className="text-sm text-slate-400">{storage.directories.length} items</div>
                    </div>
                    <div className="grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2">
                        {storage.directories.map((item) => (
                            <div key={item.key}>
                                <div className="mb-3 flex items-center justify-between gap-4">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <span className="truncate font-semibold text-slate-800">
                                            {item.label}
                                        </span>
                                        {item.errorMessage ? (
                                            <span className="shrink-0 text-xs text-red-500">
                                                {item.errorMessage}
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="shrink-0 font-semibold text-slate-900">
                                        {formatBytes(item.sizeBytes)}
                                    </div>
                                </div>
                                <Progress
                                    percent={Math.round((item.sizeBytes / maxDirectoryBytes) * 100)}
                                    showInfo={false}
                                    size="small"
                                    strokeColor="#1677ff"
                                    trailColor="#f1f5f9"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-5 border-t border-slate-100 pt-5 md:grid-cols-3">
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
                <span className="font-medium text-slate-500">{label}</span>
                <span className="font-semibold text-slate-900">{formatBytes(value)}</span>
            </div>
            <Progress percent={percent} showInfo={false} size="small" strokeColor="#94a3b8" />
        </div>
    );
}

function ResourceCard({ resource }: { resource: SystemStatus.LocalResourceStatus }) {
    return (
        <Card title="Local Resources">
            <div className="grid grid-cols-1 gap-7 lg:grid-cols-3">
                <ResourceMetric
                    title="CPU"
                    detail={`${resource.cpu.cores} cores`}
                    percent={resource.cpu.usagePercent}
                />
                <ResourceMetric
                    title="Memory"
                    detail={`${formatBytes(resource.memory.usedBytes)} / ${formatBytes(resource.memory.totalBytes)}`}
                    percent={resource.memory.usagePercent}
                />
                <ResourceMetric
                    title="Disk"
                    detail={`${formatBytes(resource.disk.usedBytes)} / ${formatBytes(resource.disk.totalBytes)}`}
                    percent={resource.disk.usagePercent}
                />
            </div>
        </Card>
    );
}

function ResourceMetric({
    title,
    detail,
    percent,
}: {
    title: string;
    detail: string;
    percent: number;
}) {
    return (
        <div>
            <div className="mb-3 flex items-start justify-between gap-4">
                <div className="font-semibold text-slate-900">{title}</div>
                <div className="text-right text-slate-500">{detail}</div>
            </div>
            <div className="flex w-full items-center gap-3">
                <Progress
                    className="min-w-0 flex-1"
                    percent={clampPercent(percent)}
                    showInfo={false}
                    strokeColor="#1677ff"
                />
                <span className="w-14 text-right tabular-nums text-slate-900">
                    {formatPercent(percent)}
                </span>
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
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
    ].join("-") + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
