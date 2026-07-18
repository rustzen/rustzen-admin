import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { HistoryIcon, PlayCircleIcon } from "lucide-react";
import { useState } from "react";

import { appMessage, manageAPI } from "@/api";
import { AuthWrap } from "@/components/auth";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { DataTableState } from "@/components/feedback/data-state";
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/manage/task")({
    component: TaskPage,
});

const RUN_PAGE_SIZE = 10;

const taskStatusMeta: Record<
    Task.RunStatus | "never",
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
    running: { label: "运行中", variant: "default" },
    success: { label: "成功", variant: "secondary" },
    failed: { label: "失败", variant: "destructive" },
    skipped: { label: "已跳过", variant: "outline" },
    never: { label: "从未运行", variant: "outline" },
};

function TaskPage() {
    const { data, error, isPending, refetch } = useQuery({
        queryKey: ["manage", "task"],
        queryFn: manageAPI.task.list,
    });
    const rows = data?.data ?? [];

    return (
        <PageCard title="定时任务" description="查看调度状态并手动运行维护任务。">
            <DataTableShell>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="min-w-48">名称</TableHead>
                            <TableHead className="min-w-64">描述</TableHead>
                            <TableHead className="min-w-36">Cron</TableHead>
                            <TableHead className="min-w-28">状态</TableHead>
                            <TableHead className="min-w-44">下次运行</TableHead>
                            <TableHead className="min-w-44">上次完成</TableHead>
                            <TableHead className="min-w-56">上次错误</TableHead>
                            <TableHead className="w-28 text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length > 0 ? (
                            rows.map((record) => (
                                <TableRow key={record.taskKey}>
                                    <TableCell className="font-medium">{record.name}</TableCell>
                                    <TableCell className="max-w-72 truncate">
                                        {record.description || "-"}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {record.schedule.expression}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <TaskStatusBadge
                                            status={record.running ? "running" : record.lastStatus}
                                        />
                                    </TableCell>
                                    <TableCell>{formatDateTime(record.nextRunAt)}</TableCell>
                                    <TableCell>{formatDateTime(record.lastFinishedAt)}</TableCell>
                                    <TableCell className="max-w-64 truncate text-muted-foreground">
                                        {record.lastErrorMessage || "-"}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex justify-end gap-2">
                                            <TaskRunLogDialog
                                                taskKey={record.taskKey}
                                                taskName={record.name}
                                            />
                                            <AuthWrap code="manage:task:run">
                                                <RunTaskDialog
                                                    record={record}
                                                    onSuccess={() => void refetch()}
                                                />
                                            </AuthWrap>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : isPending ? (
                            <DataTableState colSpan={8} kind="loading" title="正在加载任务" />
                        ) : error ? (
                            <DataTableState
                                colSpan={8}
                                kind="error"
                                title="任务加载失败"
                                description={
                                    error instanceof Error ? error.message : "请稍后重试。"
                                }
                                action={<Button onClick={() => void refetch()}>重新加载</Button>}
                            />
                        ) : (
                            <DataTableState colSpan={8} kind="empty" title="暂无定时任务" />
                        )}
                    </TableBody>
                </Table>
            </DataTableShell>
        </PageCard>
    );
}

function TaskRunLogDialog({ taskKey, taskName }: { taskKey: string; taskName: string }) {
    const [open, setOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const { data, error, isFetching, isPending, refetch } = useQuery({
        queryKey: ["manage", "task", taskKey, "runs", currentPage],
        queryFn: () =>
            manageAPI.task.runs(taskKey, { current: currentPage, pageSize: RUN_PAGE_SIZE }),
        enabled: open,
    });
    const rows = data?.data ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / RUN_PAGE_SIZE));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="任务日志">
                    <HistoryIcon />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl">
                <DialogHeader>
                    <DialogTitle>任务日志 - {taskName}</DialogTitle>
                    <DialogDescription>该任务最近的调度执行记录。</DialogDescription>
                </DialogHeader>
                <div className="max-h-120 overflow-auto rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="min-w-28">触发方式</TableHead>
                                <TableHead className="min-w-28">状态</TableHead>
                                <TableHead className="min-w-44">计划时间</TableHead>
                                <TableHead className="min-w-44">开始时间</TableHead>
                                <TableHead className="min-w-44">完成时间</TableHead>
                                <TableHead className="min-w-56">错误</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.length > 0 ? (
                                rows.map((record) => (
                                    <TableRow key={record.id}>
                                        <TableCell>
                                            {record.triggerType === "manual" ? "手动" : "定时"}
                                        </TableCell>
                                        <TableCell>
                                            <TaskStatusBadge status={record.status} />
                                        </TableCell>
                                        <TableCell>{formatDateTime(record.scheduledFor)}</TableCell>
                                        <TableCell>{formatDateTime(record.startedAt)}</TableCell>
                                        <TableCell>{formatDateTime(record.finishedAt)}</TableCell>
                                        <TableCell className="max-w-72 truncate">
                                            {record.errorMessage || "-"}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : isPending ? (
                                <DataTableState
                                    colSpan={6}
                                    kind="loading"
                                    title="正在加载任务日志"
                                />
                            ) : error ? (
                                <DataTableState
                                    colSpan={6}
                                    kind="error"
                                    title="任务日志加载失败"
                                    description={
                                        error instanceof Error ? error.message : "请稍后重试。"
                                    }
                                    action={
                                        <Button onClick={() => void refetch()}>重新加载</Button>
                                    }
                                />
                            ) : (
                                <DataTableState colSpan={6} kind="empty" title="暂无任务执行记录" />
                            )}
                        </TableBody>
                    </Table>
                </div>
                <DialogFooter>
                    <TablePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        total={total}
                        disabled={isFetching}
                        onPageChange={setCurrentPage}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function RunTaskDialog({ record, onSuccess }: { record: Task.Item; onSuccess: () => void }) {
    const submit = async () => {
        await manageAPI.task.run(record.taskKey);
        appMessage.success("任务执行已提交");
        onSuccess();
    };

    return (
        <ConfirmDialog
            trigger={
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={record.running}
                    aria-label={record.running ? "执行中" : "执行任务"}
                >
                    <PlayCircleIcon />
                </Button>
            }
            title={`执行 ${record.name}？`}
            description={record.description || "立即提交此任务。"}
            confirmLabel="执行"
            disabled={record.running}
            onConfirm={submit}
        />
    );
}

function TaskStatusBadge({ status }: { status?: Task.RunStatus | null }) {
    const meta = taskStatusMeta[status ?? "never"];
    return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function formatDateTime(value?: string | null) {
    if (!value) {
        return "-";
    }
    return new Date(value).toLocaleString();
}
