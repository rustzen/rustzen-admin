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
import { DataTableShell } from "@/components/app/data-table-shell";
import { PageCard } from "@/components/app/page-card";
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
    const { data = [], isFetching } = useQuery({
        queryKey: ["monitor", "nodes"],
        queryFn: monitorAPI.nodes,
        refetchInterval: 30_000,
    });

    return (
        <PageCard
            title="Nodes"
            description="Latest heartbeat and resource snapshot from each registered node."
            actions={<AddNodeDialog />}
        >
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
                            <TableHead className="text-right">Details</TableHead>
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
                        ) : (
                            <TableRow>
                                <TableCell colSpan={7} className="h-40 text-center">
                                    {isFetching
                                        ? "Loading nodes..."
                                        : "No monitor nodes registered."}
                                </TableCell>
                            </TableRow>
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
                    Add node
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add a monitoring node</DialogTitle>
                    <DialogDescription>
                        Start the bundled agent on the node. It is added to this list after its
                        first accepted heartbeat.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                    <p>
                        Set the controller endpoint and the same
                        <code className="mx-1 rounded bg-muted px-1 py-0.5">
                            RUSTZEN_MONITOR_AGENT_TOKEN
                        </code>
                        used by the Monitor service.
                    </p>
                    <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                        rz-monitor agent
                    </pre>
                    <p className="text-muted-foreground">
                        The node ID is derived from the agent hostname; repeated heartbeats update
                        the existing row instead of creating duplicates.
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
    const { data: metrics = [] } = useQuery({
        queryKey: ["monitor", "nodes", node?.id, "metrics", "5m"],
        queryFn: () => monitorAPI.metrics(node?.id ?? "", { bucket: "5m" }),
        enabled: Boolean(node),
    });
    return (
        <Sheet open={Boolean(node)} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-3xl">
                <SheetHeader>
                    <SheetTitle>{node?.hostname ?? "Node details"}</SheetTitle>
                    <SheetDescription>
                        {node ? `${node.agentId} · Agent ${node.agentVersion}` : ""}
                    </SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 px-4">
                    <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                        <Summary label="Status" value={node?.status ?? "-"} />
                        <Summary label="CPU" value={formatPercent(node?.cpuPercent ?? null)} />
                        <Summary
                            label="Memory"
                            value={
                                node?.memoryUsedBytes === null ||
                                node?.memoryUsedBytes === undefined
                                    ? "-"
                                    : formatBytes(node.memoryUsedBytes)
                            }
                        />
                        <Summary
                            label="Disk"
                            value={
                                node?.diskUsedBytes === null || node?.diskUsedBytes === undefined
                                    ? "-"
                                    : formatBytes(node.diskUsedBytes)
                            }
                        />
                    </div>
                    <div className="h-80 rounded-lg border p-3">
                        {metrics.length ? (
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
                                        name="Memory %"
                                        stroke="var(--chart-2)"
                                        dot={false}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="diskPercent"
                                        name="Disk %"
                                        stroke="var(--chart-3)"
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                No metrics in the last 24 hours.
                            </div>
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
