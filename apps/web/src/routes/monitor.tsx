import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ActivityIcon, ServerIcon } from "lucide-react";
import type { ReactNode } from "react";

import { monitorAPI } from "@/api";
import { DataTableShell } from "@/components/app/data-table-shell";
import { PageCard } from "@/components/app/page-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/monitor")({ component: MonitorPage });

function MonitorPage() {
    const { data = [], isFetching } = useQuery({
        queryKey: ["monitor", "nodes"],
        queryFn: monitorAPI.nodes,
        refetchInterval: 30_000,
    });

    return (
        <PageCard
            title="Monitor"
            description="Latest heartbeat and resource snapshot from each registered node."
        >
            <div className="grid gap-3 sm:grid-cols-2">
                <Metric label="Registered nodes" value={data.length} icon={<ServerIcon />} />
                <Metric
                    label="Online nodes"
                    value={data.filter((node) => node.status === "online").length}
                    icon={<ActivityIcon />}
                />
            </div>
            <DataTableShell>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Node</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>CPU</TableHead>
                            <TableHead>Memory</TableHead>
                            <TableHead>Disk</TableHead>
                            <TableHead>Last seen</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length ? (
                            data.map((node) => (
                                <TableRow key={node.id}>
                                    <TableCell>
                                        <div className="font-medium">{node.hostname}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {node.agentId} · v{node.agentVersion}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={
                                                node.status === "online" ? "default" : "secondary"
                                            }
                                        >
                                            {node.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{formatPercent(node.cpuPercent)}</TableCell>
                                    <TableCell>
                                        <Usage
                                            used={node.memoryUsedBytes}
                                            total={node.memoryTotalBytes}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Usage
                                            used={node.diskUsedBytes}
                                            total={node.diskTotalBytes}
                                        />
                                    </TableCell>
                                    <TableCell>{formatDate(node.lastSeenAt)}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-40 text-center">
                                    {isFetching
                                        ? "Loading nodes..."
                                        : "No monitor nodes registered."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </DataTableShell>
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

function Usage({ used, total }: { used: number | null; total: number | null }) {
    if (used === null || total === null || total <= 0) return <>-</>;
    const percent = Math.min(100, Math.round((used / total) * 100));
    return (
        <div className="min-w-32">
            <div className="mb-1 text-xs text-muted-foreground">
                {formatBytes(used)} / {formatBytes(total)}
            </div>
            <Progress value={percent} />
        </div>
    );
}

function formatPercent(value: number | null) {
    return value === null ? "-" : `${value.toFixed(1)}%`;
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let value = bytes / 1024;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
        value /= 1024;
        index += 1;
    }
    return `${value.toFixed(1)} ${units[index]}`;
}

function formatDate(value: string) {
    return new Date(value).toLocaleString();
}
