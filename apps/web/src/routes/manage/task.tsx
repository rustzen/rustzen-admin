import { HistoryIcon, PlayCircleIcon } from "lucide-react";
import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { appMessage, manageAPI } from "@/api";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTableShell } from "@/components/app/data-table-shell";
import { PageCard } from "@/components/app/page-card";
import { TablePagination } from "@/components/app/table-pagination";
import { AuthWrap } from "@/components/base-auth";
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
    running: { label: "Running", variant: "default" },
    success: { label: "Success", variant: "secondary" },
    failed: { label: "Failed", variant: "destructive" },
    skipped: { label: "Skipped", variant: "outline" },
    never: { label: "Never Run", variant: "outline" },
};

function TaskPage() {
    const { data, isFetching, refetch } = useQuery({
        queryKey: ["manage", "task"],
        queryFn: manageAPI.task.list,
    });
    const rows = data?.data ?? [];

    return (
        <PageCard title="Scheduled Tasks" description="Review scheduler status and manually run maintenance jobs.">
            <DataTableShell>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="min-w-48">Name</TableHead>
                                <TableHead className="min-w-64">Description</TableHead>
                                <TableHead className="min-w-36">Cron</TableHead>
                                <TableHead className="min-w-28">Status</TableHead>
                                <TableHead className="min-w-44">Next Run</TableHead>
                                <TableHead className="min-w-44">Last Finished</TableHead>
                                <TableHead className="min-w-56">Last Error</TableHead>
                                <TableHead className="w-28 text-right">Actions</TableHead>
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
                                            <Badge variant="outline">{record.schedule.expression}</Badge>
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
                                                    <RunTaskDialog record={record} onSuccess={() => void refetch()} />
                                                </AuthWrap>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-40 text-center">
                                        {isFetching ? "Loading tasks..." : "No scheduled tasks found."}
                                    </TableCell>
                                </TableRow>
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
    const { data, isFetching } = useQuery({
        queryKey: ["manage", "task", taskKey, "runs", currentPage],
        queryFn: () => manageAPI.task.runs(taskKey, { current: currentPage, pageSize: RUN_PAGE_SIZE }),
        enabled: open,
    });
    const rows = data?.data ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / RUN_PAGE_SIZE));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Task logs">
                    <HistoryIcon />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl">
                <DialogHeader>
                    <DialogTitle>Task Logs - {taskName}</DialogTitle>
                    <DialogDescription>Recent scheduler runs for this task.</DialogDescription>
                </DialogHeader>
                <div className="max-h-120 overflow-auto rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="min-w-28">Trigger</TableHead>
                                <TableHead className="min-w-28">Status</TableHead>
                                <TableHead className="min-w-44">Scheduled For</TableHead>
                                <TableHead className="min-w-44">Started At</TableHead>
                                <TableHead className="min-w-44">Finished At</TableHead>
                                <TableHead className="min-w-56">Error</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.length > 0 ? (
                                rows.map((record) => (
                                    <TableRow key={record.id}>
                                        <TableCell>
                                            {record.triggerType === "manual" ? "Manual" : "Scheduled"}
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
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center">
                                        {isFetching ? "Loading task logs..." : "No task runs found."}
                                    </TableCell>
                                </TableRow>
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
        appMessage.success("Task execution submitted");
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
                    aria-label={record.running ? "Executing" : "Execute task"}
                >
                    <PlayCircleIcon />
                </Button>
            }
            title={`Execute ${record.name}?`}
            description={record.description || "Submit this task immediately."}
            confirmLabel="Execute"
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
