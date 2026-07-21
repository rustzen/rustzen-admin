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
import { localizeBuiltInTaskDescription, localizeBuiltInTaskName } from "@/lib/builtin-i18n";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/manage/task")({
    component: TaskPage,
});

const RUN_PAGE_SIZE = 10;

function TaskPage() {
    const { data, error, isPending, refetch } = useQuery({
        queryKey: ["manage", "task"],
        queryFn: manageAPI.task.list,
    });
    const rows = data?.data ?? [];

    return (
        <PageCard
            title={t("定时任务", "Scheduled tasks")}
            description={t(
                "查看调度状态并手动运行维护任务。",
                "View scheduling status and run maintenance tasks manually.",
            )}
        >
            <DataTableShell>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="min-w-48">{t("名称", "Name")}</TableHead>
                            <TableHead className="min-w-64">{t("描述", "Description")}</TableHead>
                            <TableHead className="min-w-36">Cron</TableHead>
                            <TableHead className="min-w-28">{t("状态", "Status")}</TableHead>
                            <TableHead className="min-w-44">{t("下次运行", "Next run")}</TableHead>
                            <TableHead className="min-w-44">
                                {t("上次完成", "Last finished")}
                            </TableHead>
                            <TableHead className="min-w-56">
                                {t("上次错误", "Last error")}
                            </TableHead>
                            <TableHead className="w-28 text-right">
                                {t("操作", "Actions")}
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length > 0 ? (
                            rows.map((record) => (
                                <TableRow key={record.taskKey}>
                                    <TableCell className="font-medium">
                                        {localizeBuiltInTaskName(record.taskKey, record.name)}
                                    </TableCell>
                                    <TableCell className="max-w-72 truncate">
                                        {localizeBuiltInTaskDescription(
                                            record.taskKey,
                                            record.description,
                                        ) || "-"}
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
                                                taskName={localizeBuiltInTaskName(
                                                    record.taskKey,
                                                    record.name,
                                                )}
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
                            <DataTableState
                                colSpan={8}
                                kind="loading"
                                title={t("正在加载任务", "Loading tasks")}
                            />
                        ) : error ? (
                            <DataTableState
                                colSpan={8}
                                kind="error"
                                title={t("任务加载失败", "Failed to load tasks")}
                                description={
                                    error instanceof Error
                                        ? error.message
                                        : t("请稍后重试。", "Please try again later.")
                                }
                                action={
                                    <Button onClick={() => void refetch()}>
                                        {t("重新加载", "Reload")}
                                    </Button>
                                }
                            />
                        ) : (
                            <DataTableState
                                colSpan={8}
                                kind="empty"
                                title={t("暂无定时任务", "No scheduled tasks")}
                            />
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
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("任务日志", "Task logs")}
                >
                    <HistoryIcon />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl">
                <DialogHeader>
                    <DialogTitle>
                        {t(`任务日志 - ${taskName}`, `Task logs - ${taskName}`)}
                    </DialogTitle>
                    <DialogDescription>
                        {t("该任务最近的调度执行记录。", "Recent scheduled runs for this task.")}
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-120 overflow-auto rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="min-w-28">
                                    {t("触发方式", "Trigger")}
                                </TableHead>
                                <TableHead className="min-w-28">{t("状态", "Status")}</TableHead>
                                <TableHead className="min-w-44">
                                    {t("计划时间", "Scheduled for")}
                                </TableHead>
                                <TableHead className="min-w-44">
                                    {t("开始时间", "Started at")}
                                </TableHead>
                                <TableHead className="min-w-44">
                                    {t("完成时间", "Finished at")}
                                </TableHead>
                                <TableHead className="min-w-56">{t("错误", "Error")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.length > 0 ? (
                                rows.map((record) => (
                                    <TableRow key={record.id}>
                                        <TableCell>
                                            {record.triggerType === "manual"
                                                ? t("手动", "Manual")
                                                : t("定时", "Scheduled")}
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
                                    title={t("正在加载任务日志", "Loading task logs")}
                                />
                            ) : error ? (
                                <DataTableState
                                    colSpan={6}
                                    kind="error"
                                    title={t("任务日志加载失败", "Failed to load task logs")}
                                    description={
                                        error instanceof Error
                                            ? error.message
                                            : t("请稍后重试。", "Please try again later.")
                                    }
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
                                    title={t("暂无任务执行记录", "No task runs")}
                                />
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
        appMessage.success(t("任务执行已提交", "Task run submitted"));
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
                    aria-label={record.running ? t("执行中", "Running") : t("执行任务", "Run task")}
                >
                    <PlayCircleIcon />
                </Button>
            }
            title={t(
                `执行 ${localizeBuiltInTaskName(record.taskKey, record.name)}？`,
                `Run ${localizeBuiltInTaskName(record.taskKey, record.name)}?`,
            )}
            description={
                localizeBuiltInTaskDescription(record.taskKey, record.description) ||
                t("立即提交此任务。", "Submit this task immediately.")
            }
            confirmLabel={t("执行", "Run")}
            disabled={record.running}
            onConfirm={submit}
        />
    );
}

function TaskStatusBadge({ status }: { status?: Task.RunStatus | null }) {
    const taskStatusMeta = {
        running: { label: t("运行中", "Running"), variant: "default" as const },
        success: { label: t("成功", "Success"), variant: "secondary" as const },
        failed: { label: t("失败", "Failed"), variant: "destructive" as const },
        skipped: { label: t("已跳过", "Skipped"), variant: "outline" as const },
        never: { label: t("从未运行", "Never run"), variant: "outline" as const },
    };
    const meta = taskStatusMeta[status ?? "never"];
    return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function formatDateTime(value?: string | null) {
    if (!value) {
        return "-";
    }
    return new Date(value).toLocaleString();
}
