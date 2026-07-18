import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BanIcon, EyeIcon, PlayIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { appMessage, reportsAPI } from "@/api";
import { AuthWrap } from "@/components/auth";
import { DataState, DataTableState } from "@/components/feedback/data-state";
import { PageCard } from "@/components/page/page-card";
import { DataTableShell } from "@/components/table/data-table-shell";
import { TablePagination } from "@/components/table/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
import { Textarea } from "@/components/ui/textarea";
export const Route = createFileRoute("/reports/runs")({ component: RunsPage });
const size = 20;
const variants: Record<Reports.Run["status"], "default" | "secondary" | "destructive" | "outline"> =
    {
        queued: "outline",
        running: "default",
        succeeded: "secondary",
        failed: "destructive",
        cancelled: "outline",
    };
const runStatusLabels: Record<Reports.Run["status"], string> = {
    queued: "排队中",
    running: "执行中",
    succeeded: "已成功",
    failed: "失败",
    cancelled: "已取消",
};
const stepStatusLabels: Record<Reports.RunStep["status"], string> = {
    running: "执行中",
    succeeded: "已成功",
    failed: "失败",
};
const defaultRunInput = JSON.stringify({ username: "", password: "" }, null, 2);
function RunsPage() {
    const [current, setCurrent] = useState(1),
        [selected, setSelected] = useState<Reports.Run>();
    const client = useQueryClient();
    const { data: flows = [] } = useQuery({
        queryKey: ["reports", "flows"],
        queryFn: () => reportsAPI.flows(),
    });
    const { data, error, isFetching, isPending, refetch } = useQuery({
        queryKey: ["reports", "runs", current],
        queryFn: () => reportsAPI.runs({ current, pageSize: size }),
        refetchInterval: (q) =>
            q.state.data?.data.some((r) => r.status === "queued" || r.status === "running")
                ? 1000
                : false,
    });
    const cancel = useMutation({
        mutationFn: reportsAPI.cancelRun,
        onSuccess: async () => {
            await client.invalidateQueries({ queryKey: ["reports", "runs"] });
            appMessage.success("填报执行已取消");
        },
    });
    const runs = data?.data ?? [];
    return (
        <PageCard
            title="填报执行"
            description="通过报表模板写入所选数据，并实时查看执行过程。"
            actions={
                <AuthWrap code="reports:run:manage">
                    <RunDialog flows={flows} />
                </AuthWrap>
            }
        >
            <DataTableShell>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>执行</TableHead>
                            <TableHead>流程</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead>创建时间</TableHead>
                            <TableHead>错误</TableHead>
                            <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {runs.length ? (
                            runs.map((run) => (
                                <TableRow key={run.id}>
                                    <TableCell className="font-mono text-xs">
                                        {run.id.slice(0, 8)}
                                    </TableCell>
                                    <TableCell>
                                        {flows.find((f) => f.id === run.flowId)?.name ?? run.flowId}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={variants[run.status]}>
                                            {runStatusLabels[run.status]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{date(run.createdAt)}</TableCell>
                                    <TableCell className="max-w-80 truncate text-muted-foreground">
                                        {run.error ?? "-"}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label="查看执行"
                                                onClick={() => setSelected(run)}
                                            >
                                                <EyeIcon />
                                            </Button>
                                            <AuthWrap code="reports:run:manage">
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    aria-label="取消执行"
                                                    disabled={
                                                        !(
                                                            ["queued", "running"] as string[]
                                                        ).includes(run.status)
                                                    }
                                                    onClick={() => cancel.mutate(run.id)}
                                                >
                                                    <BanIcon />
                                                </Button>
                                            </AuthWrap>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : isPending ? (
                            <DataTableState colSpan={6} kind="loading" title="正在加载填报执行" />
                        ) : error ? (
                            <DataTableState
                                colSpan={6}
                                kind="error"
                                title="填报执行加载失败"
                                description="无法读取执行记录，请检查 Reports 服务后重试。"
                                action={<Button onClick={() => void refetch()}>重新加载</Button>}
                            />
                        ) : (
                            <DataTableState
                                colSpan={6}
                                kind="empty"
                                title="暂无填报执行"
                                description="选择一个报表模板并提交输入数据后，执行过程会显示在这里。"
                            />
                        )}
                    </TableBody>
                </Table>
            </DataTableShell>
            <TablePagination
                currentPage={current}
                totalPages={Math.max(1, Math.ceil((data?.total ?? 0) / size))}
                total={data?.total ?? 0}
                disabled={isFetching}
                onPageChange={setCurrent}
            />
            <RunDetails run={selected} onClose={() => setSelected(undefined)} />
        </PageCard>
    );
}
function RunDialog({ flows }: { flows: Reports.Flow[] }) {
    const client = useQueryClient();
    const [open, setOpen] = useState(false),
        [flowId, setFlowId] = useState(""),
        [json, setJson] = useState(defaultRunInput);
    const mutation = useMutation({
        mutationFn: reportsAPI.createRun,
        onSuccess: async () => {
            await client.invalidateQueries({ queryKey: ["reports", "runs"] });
            appMessage.success("填报执行已进入队列");
            setOpen(false);
        },
    });
    const save = () => {
        try {
            const input = JSON.parse(json) as Record<string, unknown>;
            mutation.mutate({ flowId, input });
        } catch {
            appMessage.error("输入内容必须是有效的 JSON");
        }
    };
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button disabled={!flows.length}>
                    <PlayIcon />
                    新建填报
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>开始填报</DialogTitle>
                    <DialogDescription>
                        选择已校验的流程，并填写本次写入使用的输入数据。
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                    <Choice
                        label="流程"
                        value={flowId}
                        onChange={setFlowId}
                        items={flows.map((f) => ({ id: f.id, name: f.name }))}
                    />
                    <div className="grid gap-2">
                        <Label>输入 JSON</Label>
                        <Textarea
                            className="min-h-40 font-mono"
                            value={json}
                            onChange={(e) => setJson(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button disabled={!flowId || mutation.isPending} onClick={save}>
                        提交执行
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
function RunDetails({ run, onClose }: { run?: Reports.Run; onClose: () => void }) {
    const {
        data: currentRun = run,
        error: runError,
        refetch: refetchRun,
    } = useQuery({
        queryKey: ["reports", "run", run?.id],
        queryFn: () => reportsAPI.run(run!.id),
        enabled: Boolean(run),
        initialData: run,
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            return status === "queued" || status === "running" ? 1000 : false;
        },
    });
    const { data: steps = [] } = useQuery({
        queryKey: ["reports", "run-steps", run?.id],
        queryFn: () => reportsAPI.runSteps(run!.id),
        enabled: Boolean(run),
        refetchInterval:
            currentRun?.status === "queued" || currentRun?.status === "running" ? 1000 : false,
    });
    const { data: artifacts = [] } = useQuery({
        queryKey: ["reports", "run-artifacts", run?.id],
        queryFn: () => reportsAPI.runArtifacts(run!.id),
        enabled: Boolean(run),
        refetchInterval:
            currentRun?.status === "queued" || currentRun?.status === "running" ? 1000 : false,
    });
    return (
        <Sheet open={Boolean(run)} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="overflow-y-auto sm:max-w-xl">
                <SheetHeader>
                    <SheetTitle>执行审计</SheetTitle>
                    <SheetDescription>{run?.id}</SheetDescription>
                </SheetHeader>
                <div className="space-y-5 p-4">
                    {runError ? (
                        <DataState
                            kind="error"
                            title="执行状态加载失败"
                            description="实时刷新已暂停，请重新加载当前执行。"
                            action={<Button onClick={() => void refetchRun()}>重新加载</Button>}
                            compact
                        />
                    ) : currentRun?.status === "queued" || currentRun?.status === "running" ? (
                        <DataState
                            kind="processing"
                            title={currentRun.status === "queued" ? "执行正在排队" : "填报正在执行"}
                            description="页面会每秒刷新步骤、产物和实时画面。"
                            compact
                        />
                    ) : null}
                    {run && (
                        <div className="rounded-md border p-3 text-sm">
                            <p>
                                状态：
                                {currentRun ? runStatusLabels[currentRun.status] : "-"}
                            </p>
                            <p>
                                开始时间：
                                {currentRun?.startedAt ? date(currentRun.startedAt) : "-"}
                            </p>
                            <p>
                                完成时间：
                                {currentRun?.finishedAt ? date(currentRun.finishedAt) : "-"}
                            </p>
                            {currentRun?.error && (
                                <p className="mt-2 text-destructive">{currentRun.error}</p>
                            )}
                        </div>
                    )}
                    <LiveFrame run={currentRun} />
                    <div>
                        <h3 className="mb-2 font-medium">步骤</h3>
                        {steps.map((step) => (
                            <div key={step.id} className="mb-2 rounded-md border p-3 text-sm">
                                <div className="flex justify-between">
                                    <span>
                                        {step.stepIndex + 1}. {step.action}
                                    </span>
                                    <Badge
                                        variant={
                                            step.status === "succeeded"
                                                ? "secondary"
                                                : "destructive"
                                        }
                                    >
                                        {stepStatusLabels[step.status]}
                                    </Badge>
                                </div>
                                <p className="text-muted-foreground">
                                    {step.durationMs ?? 0} ms{" "}
                                    {step.message ? `· ${step.message}` : ""}
                                </p>
                            </div>
                        ))}
                        {!steps.length &&
                            (currentRun?.status === "queued" || currentRun?.status === "running" ? (
                                <DataState kind="processing" title="正在等待步骤结果" compact />
                            ) : (
                                <DataState kind="empty" title="暂无步骤记录" compact />
                            ))}
                    </div>
                    {artifacts.length > 0 && (
                        <div>
                            <h3 className="mb-2 font-medium">产物</h3>
                            {artifacts.map((a) => (
                                <Button
                                    key={a.id}
                                    type="button"
                                    variant="link"
                                    className="block h-auto p-0 text-sm"
                                    onClick={() => {
                                        void reportsAPI.downloadArtifact(a.runId, a.id, a.fileName);
                                    }}
                                >
                                    {a.fileName}
                                </Button>
                            ))}
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}

function LiveFrame({ run }: { run?: Reports.Run }) {
    const { data, error, refetch } = useQuery({
        queryKey: ["reports", "live-frame", run?.id],
        queryFn: ({ signal }) => reportsAPI.liveFrame(run!.id, signal),
        enabled: Boolean(run),
        refetchInterval: run?.status === "queued" || run?.status === "running" ? 1000 : false,
    });
    const [source, setSource] = useState<string>();
    useEffect(() => setSource(undefined), [run?.id]);
    useEffect(() => {
        if (!data) {
            return;
        }
        const url = URL.createObjectURL(data);
        setSource(url);
        return () => URL.revokeObjectURL(url);
    }, [data]);
    return (
        <div>
            <h3 className="mb-2 font-medium">实时画面</h3>
            <div className="flex h-80 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
                {source ? (
                    <img src={source} className="h-full w-full object-contain" alt="执行实时画面" />
                ) : error ? (
                    <DataState
                        kind="error"
                        title="实时画面加载失败"
                        action={<Button onClick={() => void refetch()}>重新加载</Button>}
                        compact
                        className="h-full min-h-0"
                    />
                ) : (
                    <DataState
                        kind={
                            run?.status === "queued" || run?.status === "running"
                                ? "processing"
                                : "empty"
                        }
                        title={
                            run?.status === "queued" || run?.status === "running"
                                ? "正在等待浏览器画面"
                                : "暂无实时画面"
                        }
                        compact
                        className="h-full min-h-0"
                    />
                )}
            </div>
        </div>
    );
}
function Choice({
    label,
    value,
    onChange,
    items,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    items: { id: string; name: string }[];
}) {
    return (
        <div className="grid gap-2">
            <Label>{label}</Label>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder={`请选择${label}`} />
                </SelectTrigger>
                <SelectContent>
                    {items.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                            {i.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
function date(value: string) {
    return new Date(value).toLocaleString();
}
