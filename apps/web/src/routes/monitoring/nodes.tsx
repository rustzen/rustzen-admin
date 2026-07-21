import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { monitorAPI } from "@/api";
import { DataState, DataTableState } from "@/components/feedback/data-state";
import { PageCard } from "@/components/page/page-card";
import { DataTableShell } from "@/components/table/data-table-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/monitoring/nodes")({ component: MonitoringNodesPage });

function MonitoringNodesPage() {
    const [selected, setSelected] = useState<Monitor.Node | null>(null);
    const {
        data = [],
        error,
        isPending,
        refetch,
    } = useQuery({
        queryKey: ["monitor", "nodes"],
        queryFn: monitorAPI.nodes,
        refetchInterval: 30_000,
    });

    return (
        <PageCard
            title={t("节点", "Nodes")}
            description={t(
                "查看每个已注册节点的最新心跳和资源快照。",
                "View the latest heartbeat and resource snapshot for each registered node.",
            )}
            actions={<AddNodeDialog />}
        >
            <DataTableShell>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t("节点", "Node")}</TableHead>
                            <TableHead>{t("状态", "Status")}</TableHead>
                            <TableHead>CPU</TableHead>
                            <TableHead>{t("内存", "Memory")}</TableHead>
                            <TableHead>{t("磁盘", "Disk")}</TableHead>
                            <TableHead>{t("最后在线", "Last seen")}</TableHead>
                            <TableHead className="text-right">{t("详情", "Details")}</TableHead>
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
                                    <TableCell>
                                        {new Date(node.lastSeenAt).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setSelected(node)}
                                        >
                                            {t("查看", "View")}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : isPending ? (
                            <DataTableState
                                colSpan={7}
                                kind="loading"
                                title={t("正在加载节点", "Loading nodes")}
                            />
                        ) : error ? (
                            <DataTableState
                                colSpan={7}
                                kind="error"
                                title={t("节点加载失败", "Failed to load nodes")}
                                description={t(
                                    "无法读取节点列表，请检查 Monitor 服务后重试。",
                                    "Unable to read the node list. Check the Monitor service and try again.",
                                )}
                                action={
                                    <Button onClick={() => void refetch()}>
                                        {t("重新加载", "Reload")}
                                    </Button>
                                }
                            />
                        ) : (
                            <DataTableState
                                colSpan={7}
                                kind="empty"
                                title={t("暂无监控节点", "No monitored nodes")}
                                description={t(
                                    "启动节点 Agent 后，首次心跳会自动完成注册。",
                                    "Start the node agent. Its first heartbeat will register it automatically.",
                                )}
                            />
                        )}
                    </TableBody>
                </Table>
            </DataTableShell>
            <NodeDetails node={selected} onOpenChange={(open) => !open && setSelected(null)} />
        </PageCard>
    );
}

function AddNodeDialog() {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button>
                    <PlusIcon />
                    {t("添加节点", "Add node")}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t("添加监控节点", "Add monitored node")}</DialogTitle>
                    <DialogDescription>
                        {t(
                            "在节点上启动随包提供的 Agent；首次心跳通过后，节点会自动加入列表。",
                            "Start the bundled agent on the node. It will join the list after its first heartbeat.",
                        )}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                    <p>
                        {t(
                            "配置控制器地址，并使用与 Monitor 服务一致的环境变量：",
                            "Configure the controller address and use the same environment variable as the Monitor service:",
                        )}
                        <code className="mx-1 rounded bg-muted px-1 py-0.5">
                            RUSTZEN_MONITOR_AGENT_TOKEN
                        </code>
                    </p>
                    <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                        rz-monitor agent
                    </pre>
                    <p className="text-muted-foreground">
                        {t(
                            "节点 ID 由 Agent 主机名生成；后续心跳会更新现有记录，不会重复创建节点。",
                            "The node ID is generated from the agent hostname. Later heartbeats update the existing record instead of creating duplicates.",
                        )}
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function NodeDetails({
    node,
    onOpenChange,
}: {
    node: Monitor.Node | null;
    onOpenChange: (open: boolean) => void;
}) {
    const {
        data: metrics = [],
        error,
        isPending,
        refetch,
    } = useQuery({
        queryKey: ["monitor", "nodes", node?.id, "metrics", "5m"],
        queryFn: () => monitorAPI.metrics(node?.id ?? "", { bucket: "5m" }),
        enabled: Boolean(node),
    });
    return (
        <Sheet open={Boolean(node)} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-3xl">
                <SheetHeader>
                    <SheetTitle>{node?.hostname ?? t("节点详情", "Node details")}</SheetTitle>
                    <SheetDescription>
                        {node ? `${node.agentId} · Agent ${node.agentVersion}` : ""}
                    </SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 px-4">
                    <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                        <Summary label={t("状态", "Status")} value={node?.status ?? "-"} />
                        <Summary label="CPU" value={formatPercent(node?.cpuPercent ?? null)} />
                        <Summary
                            label={t("内存", "Memory")}
                            value={
                                node?.memoryUsedBytes === null ||
                                node?.memoryUsedBytes === undefined
                                    ? "-"
                                    : formatBytes(node.memoryUsedBytes)
                            }
                        />
                        <Summary
                            label={t("磁盘", "Disk")}
                            value={
                                node?.diskUsedBytes === null || node?.diskUsedBytes === undefined
                                    ? "-"
                                    : formatBytes(node.diskUsedBytes)
                            }
                        />
                    </div>
                    <div className="h-80 rounded-lg border p-3">
                        {isPending ? (
                            <DataState
                                kind="loading"
                                title={t("正在加载指标", "Loading metrics")}
                                compact
                                className="h-full min-h-0"
                            />
                        ) : error && metrics.length === 0 ? (
                            <DataState
                                kind="error"
                                title={t("指标加载失败", "Failed to load metrics")}
                                action={
                                    <Button onClick={() => void refetch()}>
                                        {t("重新加载", "Reload")}
                                    </Button>
                                }
                                compact
                                className="h-full min-h-0"
                            />
                        ) : metrics.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={metrics}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="collectedAt"
                                        tickFormatter={(value) =>
                                            new Date(String(value)).toLocaleTimeString()
                                        }
                                    />
                                    <YAxis domain={[0, 100]} />
                                    <Tooltip />
                                    <Legend />
                                    <Line
                                        type="monotone"
                                        dataKey="cpuPercent"
                                        name="CPU %"
                                        stroke="var(--chart-1)"
                                        dot={false}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="memoryPercent"
                                        name={t("内存 %", "Memory %")}
                                        stroke="var(--chart-2)"
                                        dot={false}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="diskPercent"
                                        name={t("磁盘 %", "Disk %")}
                                        stroke="var(--chart-3)"
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <DataState
                                kind="empty"
                                title={t("最近 24 小时暂无指标", "No metrics in the last 24 hours")}
                                compact
                                className="h-full min-h-0"
                            />
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

function Summary({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 font-medium">{value}</div>
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
