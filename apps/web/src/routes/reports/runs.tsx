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
import { t } from "@/lib/i18n";
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
    queued: t("排队中", "Queued"),
    running: t("执行中", "Running"),
    succeeded: t("已成功", "Succeeded"),
    failed: t("失败", "Failed"),
    cancelled: t("已取消", "Cancelled"),
};
const stepStatusLabels: Record<Reports.RunStep["status"], string> = {
    running: t("执行中", "Running"),
    succeeded: t("已成功", "Succeeded"),
    failed: t("失败", "Failed"),
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
            appMessage.success(t("填报执行已取消", "Report run cancelled"));
        },
    });
    const runs = data?.data ?? [];
    return (
        <PageCard
            title={t("填报执行", "Report runs")}
            description={t(
                "通过报表模板写入所选数据，并实时查看执行过程。",
                "Write selected data through a report template and monitor the run in real time.",
            )}
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
                            <TableHead>{t("执行", "Run")}</TableHead>
                            <TableHead>{t("流程", "Template")}</TableHead>
                            <TableHead>{t("状态", "Status")}</TableHead>
                            <TableHead>{t("创建时间", "Created at")}</TableHead>
                            <TableHead>{t("错误", "Error")}</TableHead>
                            <TableHead className="text-right">{t("操作", "Actions")}</TableHead>
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
                                                aria-label={t("查看执行", "View run")}
                                                onClick={() => setSelected(run)}
                                            >
                                                <EyeIcon />
                                            </Button>
                                            <AuthWrap code="reports:run:manage">
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    aria-label={t("取消执行", "Cancel run")}
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
                            <DataTableState
                                colSpan={6}
                                kind="loading"
                                title={t("正在加载填报执行", "Loading report runs")}
                            />
                        ) : error ? (
                            <DataTableState
                                colSpan={6}
                                kind="error"
                                title={t("填报执行加载失败", "Failed to load report runs")}
                                description={t(
                                    "无法读取执行记录，请检查 Reports 服务后重试。",
                                    "Unable to read run records. Check the Reports service and try again.",
                                )}
                                action={
                                    <Button onClick={() => void refetch()}>
                                        {t("重新加载", "Reload")}
                                    </Button>
                                }
                            />
                        ) : (
                            <DataTableState
                                colSpan={6}
                                kind="empty"
                                title={t("暂无填报执行", "No report runs")}
                                description={t(
                                    "选择一个报表模板并提交输入数据后，执行过程会显示在这里。",
                                    "Select a report template and submit input data to see the run here.",
                                )}
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
            appMessage.success(t("填报执行已进入队列", "Report run queued"));
            setOpen(false);
        },
    });
    const save = () => {
        try {
            const input = JSON.parse(json) as Record<string, unknown>;
            mutation.mutate({ flowId, input });
        } catch {
            appMessage.error(t("输入内容必须是有效的 JSON", "Input must be valid JSON"));
        }
    };
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button disabled={!flows.length}>
                    <PlayIcon />
                    {t("新建填报", "New report run")}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t("开始填报", "Start report run")}</DialogTitle>
                    <DialogDescription>
                        {t(
                            "选择已校验的流程，并填写本次写入使用的输入数据。",
                            "Select a verified template and enter the input data for this run.",
                        )}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                    <Choice
                        label={t("流程", "Template")}
                        value={flowId}
                        onChange={setFlowId}
                        items={flows.map((f) => ({ id: f.id, name: f.name }))}
                    />
                    <div className="grid gap-2">
                        <Label>{t("输入 JSON", "Input JSON")}</Label>
                        <Textarea
                            className="min-h-40 font-mono"
                            value={json}
                            onChange={(e) => setJson(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button disabled={!flowId || mutation.isPending} onClick={save}>
                        {t("提交执行", "Submit run")}
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
                    <SheetTitle>{t("执行审计", "Run audit")}</SheetTitle>
                    <SheetDescription>{run?.id}</SheetDescription>
                </SheetHeader>
                <div className="space-y-5 p-4">
                    {runError ? (
                        <DataState
                            kind="error"
                            title={t("执行状态加载失败", "Failed to load run status")}
                            description={t(
                                "实时刷新已暂停，请重新加载当前执行。",
                                "Live refresh is paused. Reload the current run.",
                            )}
                            action={
                                <Button onClick={() => void refetchRun()}>
                                    {t("重新加载", "Reload")}
                                </Button>
                            }
                            compact
                        />
                    ) : currentRun?.status === "queued" || currentRun?.status === "running" ? (
                        <DataState
                            kind="processing"
                            title={
                                currentRun.status === "queued"
                                    ? t("执行正在排队", "Run is queued")
                                    : t("填报正在执行", "Report run in progress")
                            }
                            description={t(
                                "页面会每秒刷新步骤、产物和实时画面。",
                                "Steps, artifacts, and the live view refresh every second.",
                            )}
                            compact
                        />
                    ) : null}
                    {run && (
                        <div className="rounded-md border p-3 text-sm">
                            <p>
                                {t("状态：", "Status: ")}
                                {currentRun ? runStatusLabels[currentRun.status] : "-"}
                            </p>
                            <p>
                                {t("开始时间：", "Started at: ")}
                                {currentRun?.startedAt ? date(currentRun.startedAt) : "-"}
                            </p>
                            <p>
                                {t("完成时间：", "Finished at: ")}
                                {currentRun?.finishedAt ? date(currentRun.finishedAt) : "-"}
                            </p>
                            {currentRun?.error && (
                                <p className="mt-2 text-destructive">{currentRun.error}</p>
                            )}
                        </div>
                    )}
                    <LiveFrame run={currentRun} />
                    <div>
                        <h3 className="mb-2 font-medium">{t("步骤", "Steps")}</h3>
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
                                <DataState
                                    kind="processing"
                                    title={t("正在等待步骤结果", "Waiting for step results")}
                                    compact
                                />
                            ) : (
                                <DataState
                                    kind="empty"
                                    title={t("暂无步骤记录", "No step records")}
                                    compact
                                />
                            ))}
                    </div>
                    {artifacts.length > 0 && (
                        <div>
                            <h3 className="mb-2 font-medium">{t("产物", "Artifacts")}</h3>
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
            <h3 className="mb-2 font-medium">{t("实时画面", "Live view")}</h3>
            <div className="flex h-80 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
                {source ? (
                    <img
                        src={source}
                        className="h-full w-full object-contain"
                        alt={t("执行实时画面", "Live run view")}
                    />
                ) : error ? (
                    <DataState
                        kind="error"
                        title={t("实时画面加载失败", "Failed to load live view")}
                        action={
                            <Button onClick={() => void refetch()}>
                                {t("重新加载", "Reload")}
                            </Button>
                        }
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
                                ? t("正在等待浏览器画面", "Waiting for browser view")
                                : t("暂无实时画面", "No live view")
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
                    <SelectValue placeholder={t(`请选择${label}`, `Select ${label}`)} />
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
