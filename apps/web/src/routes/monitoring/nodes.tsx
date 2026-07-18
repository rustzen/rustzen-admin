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
            title="节点"
            description="查看每个已注册节点的最新心跳和资源快照。"
            actions={<AddNodeDialog />}
        >
            <DataTableShell>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>节点</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead>CPU</TableHead>
                            <TableHead>内存</TableHead>
                            <TableHead>磁盘</TableHead>
                            <TableHead>最后在线</TableHead>
                            <TableHead className="text-right">详情</TableHead>
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
                                            View
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : isPending ? (
                            <DataTableState colSpan={7} kind="loading" title="正在加载节点" />
                        ) : error ? (
                            <DataTableState
                                colSpan={7}
                                kind="error"
                                title="节点加载失败"
                                description="无法读取节点列表，请检查 Monitor 服务后重试。"
                                action={<Button onClick={() => void refetch()}>重新加载</Button>}
                            />
                        ) : (
                            <DataTableState
                                colSpan={7}
                                kind="empty"
                                title="暂无监控节点"
                                description="启动节点 Agent 后，首次心跳会自动完成注册。"
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
                    添加节点
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>添加监控节点</DialogTitle>
                    <DialogDescription>
                        在节点上启动随包提供的 Agent；首次心跳通过后，节点会自动加入列表。
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                    <p>
                        配置控制器地址，并使用与 Monitor 服务一致的
                        <code className="mx-1 rounded bg-muted px-1 py-0.5">
                            RUSTZEN_MONITOR_AGENT_TOKEN
                        </code>
                        。
                    </p>
                    <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                        rz-monitor agent
                    </pre>
                    <p className="text-muted-foreground">
                        节点 ID 由 Agent 主机名生成；后续心跳会更新现有记录，不会重复创建节点。
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
                    <SheetTitle>{node?.hostname ?? "节点详情"}</SheetTitle>
                    <SheetDescription>
                        {node ? `${node.agentId} · Agent ${node.agentVersion}` : ""}
                    </SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 px-4">
                    <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                        <Summary label="状态" value={node?.status ?? "-"} />
                        <Summary label="CPU" value={formatPercent(node?.cpuPercent ?? null)} />
                        <Summary
                            label="内存"
                            value={
                                node?.memoryUsedBytes === null ||
                                node?.memoryUsedBytes === undefined
                                    ? "-"
                                    : formatBytes(node.memoryUsedBytes)
                            }
                        />
                        <Summary
                            label="磁盘"
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
                                title="正在加载指标"
                                compact
                                className="h-full min-h-0"
                            />
                        ) : error && metrics.length === 0 ? (
                            <DataState
                                kind="error"
                                title="指标加载失败"
                                action={<Button onClick={() => void refetch()}>重新加载</Button>}
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
                                        name="内存 %"
                                        stroke="var(--chart-2)"
                                        dot={false}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="diskPercent"
                                        name="磁盘 %"
                                        stroke="var(--chart-3)"
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <DataState
                                kind="empty"
                                title="最近 24 小时暂无指标"
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
