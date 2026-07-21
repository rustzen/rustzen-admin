import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ActivityIcon, PencilIcon, PlusIcon, PowerIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { appMessage, monitorAPI } from "@/api";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/monitoring/checks")({ component: MonitoringChecksPage });

const pageSize = 20;

function MonitoringChecksPage() {
    const [current, setCurrent] = useState(1);
    const queryClient = useQueryClient();
    const { data, error, isFetching, isPending, refetch } = useQuery({
        queryKey: ["monitor", "checks", current],
        queryFn: () => monitorAPI.checks({ current, pageSize }),
        refetchInterval: 10_000,
    });
    const refresh = () => queryClient.invalidateQueries({ queryKey: ["monitor", "checks"] });
    const enabledMutation = useMutation({
        mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
            monitorAPI.setCheckEnabled(id, enabled),
        onSuccess: async () => {
            await refresh();
            appMessage.success(t("检查状态已更新", "Check status updated"));
        },
    });
    const deleteMutation = useMutation({
        mutationFn: monitorAPI.deleteCheck,
        onSuccess: async () => {
            await refresh();
            appMessage.success(t("检查已删除", "Check deleted"));
        },
    });

    const checks = data?.data ?? [];
    const total = data?.total ?? 0;
    return (
        <PageCard
            title={t("服务监控", "Service monitoring")}
            description={t(
                "按固定间隔探测 TCP 服务并查看留存结果。",
                "Probe TCP services at fixed intervals and view retained results.",
            )}
            actions={
                <AuthWrap code="monitor:check:manage">
                    <CheckDialog onSaved={refresh} />
                </AuthWrap>
            }
        >
            <DataTableShell>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t("名称", "Name")}</TableHead>
                            <TableHead>{t("目标", "Target")}</TableHead>
                            <TableHead>{t("状态", "Status")}</TableHead>
                            <TableHead>{t("间隔", "Interval")}</TableHead>
                            <TableHead>{t("失败次数", "Failures")}</TableHead>
                            <TableHead>{t("最后检查", "Last checked")}</TableHead>
                            <TableHead className="text-right">{t("操作", "Actions")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {checks.length ? (
                            checks.map((check) => (
                                <TableRow key={check.id}>
                                    <TableCell className="font-medium">{check.name}</TableCell>
                                    <TableCell className="font-mono text-xs">
                                        {check.host}:{check.port}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={
                                                !check.enabled
                                                    ? "outline"
                                                    : check.lastStatus === "down"
                                                      ? "destructive"
                                                      : "secondary"
                                            }
                                        >
                                            {!check.enabled
                                                ? t("已停用", "Disabled")
                                                : check.lastStatus === "up"
                                                  ? t("正常", "Up")
                                                  : check.lastStatus === "down"
                                                    ? t("异常", "Down")
                                                    : t("等待检查", "Pending")}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{check.intervalSeconds}s</TableCell>
                                    <TableCell>
                                        {check.consecutiveFailures}/{check.failureThreshold}
                                    </TableCell>
                                    <TableCell>
                                        {check.lastCheckedAt
                                            ? new Date(check.lastCheckedAt).toLocaleString()
                                            : "-"}
                                    </TableCell>
                                    <TableCell>
                                        <AuthWrap code="monitor:check:manage">
                                            <div className="flex justify-end gap-1">
                                                <CheckDialog check={check} onSaved={refresh} />
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    aria-label={
                                                        check.enabled
                                                            ? t("禁用检查", "Disable check")
                                                            : t("启用检查", "Enable check")
                                                    }
                                                    onClick={() =>
                                                        enabledMutation.mutate({
                                                            id: check.id,
                                                            enabled: !check.enabled,
                                                        })
                                                    }
                                                >
                                                    <PowerIcon />
                                                </Button>
                                                <ConfirmDialog
                                                    trigger={
                                                        <Button
                                                            variant="ghost-destructive"
                                                            size="icon-sm"
                                                            aria-label={t(
                                                                "删除检查",
                                                                "Delete check",
                                                            )}
                                                        >
                                                            <Trash2Icon />
                                                        </Button>
                                                    }
                                                    title={t(
                                                        "删除 TCP 检查？",
                                                        "Delete TCP check?",
                                                    )}
                                                    description={t(
                                                        "已留存的检查结果也会一并删除。",
                                                        "Retained check results will also be deleted.",
                                                    )}
                                                    confirmLabel={t("删除", "Delete")}
                                                    destructive
                                                    onConfirm={() =>
                                                        deleteMutation
                                                            .mutateAsync(check.id)
                                                            .then(() => {})
                                                    }
                                                />
                                            </div>
                                        </AuthWrap>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : isPending ? (
                            <DataTableState
                                colSpan={7}
                                kind="loading"
                                title={t("正在加载服务检查", "Loading service checks")}
                            />
                        ) : error ? (
                            <DataTableState
                                colSpan={7}
                                kind="error"
                                title={t("服务检查加载失败", "Failed to load service checks")}
                                description={t(
                                    "无法读取 TCP 检查，请检查 Monitor 服务后重试。",
                                    "Unable to read TCP checks. Check the Monitor service and try again.",
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
                                title={t("暂无服务检查", "No service checks")}
                                description={t(
                                    "添加 TCP 检查后，系统会按设定间隔持续探测服务状态。",
                                    "Add a TCP check to probe the service continuously at the configured interval.",
                                )}
                            />
                        )}
                    </TableBody>
                </Table>
            </DataTableShell>
            <TablePagination
                currentPage={current}
                totalPages={Math.max(1, Math.ceil(total / pageSize))}
                total={total}
                disabled={isFetching}
                onPageChange={setCurrent}
            />
        </PageCard>
    );
}

function CheckDialog({
    check,
    onSaved,
}: {
    check?: Monitor.Check;
    onSaved: () => Promise<unknown>;
}) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(check?.name ?? "");
    const [host, setHost] = useState(check?.host ?? "");
    const [port, setPort] = useState(String(check?.port ?? 443));
    const [interval, setInterval] = useState(String(check?.intervalSeconds ?? 60));
    const [timeout, setTimeoutValue] = useState(String(check?.timeoutMs ?? 5000));
    const [threshold, setThreshold] = useState(String(check?.failureThreshold ?? 3));
    const saveMutation = useMutation({
        mutationFn: (input: Monitor.SaveCheck) =>
            check ? monitorAPI.updateCheck(check.id, input) : monitorAPI.createCheck(input),
        onSuccess: async () => {
            await onSaved();
            appMessage.success(
                check ? t("检查已更新", "Check updated") : t("检查已创建", "Check created"),
            );
            setOpen(false);
        },
    });
    const testMutation = useMutation({
        mutationFn: monitorAPI.testCheck,
        onSuccess: (result) => {
            if (result.status === "up") {
                appMessage.success(
                    t(
                        `连接成功，耗时 ${result.latencyMs ?? 0} ms`,
                        `Connection successful in ${result.latencyMs ?? 0} ms`,
                    ),
                );
            } else {
                appMessage.error(result.error ?? t("连接失败", "Connection failed"));
            }
        },
    });
    const input = {
        name: name.trim(),
        host: host.trim(),
        port: Number(port),
        intervalSeconds: Number(interval),
        timeoutMs: Number(timeout),
        failureThreshold: Number(threshold),
        enabled: check?.enabled ?? true,
    };
    const valid =
        input.name &&
        input.host &&
        Number.isInteger(input.port) &&
        Number.isInteger(input.intervalSeconds) &&
        Number.isInteger(input.timeoutMs) &&
        Number.isInteger(input.failureThreshold);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {check ? (
                    <Button variant="ghost" size="icon-sm" aria-label={t("编辑检查", "Edit check")}>
                        <PencilIcon />
                    </Button>
                ) : (
                    <Button>
                        <PlusIcon /> {t("新建检查", "New check")}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {check
                            ? t("编辑 TCP 检查", "Edit TCP check")
                            : t("新建 TCP 检查", "New TCP check")}
                    </DialogTitle>
                    <DialogDescription>
                        {t(
                            "目标连接将从 Monitoring 服务所在主机发起测试。",
                            "The target connection will be tested from the host running the Monitoring service.",
                        )}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                        label={t("名称", "Name")}
                        value={name}
                        onChange={setName}
                        className="sm:col-span-2"
                    />
                    <Field label={t("主机", "Host")} value={host} onChange={setHost} />
                    <Field
                        label={t("端口", "Port")}
                        value={port}
                        onChange={setPort}
                        type="number"
                    />
                    <Field
                        label={t("间隔秒数", "Interval (seconds)")}
                        value={interval}
                        onChange={setInterval}
                        type="number"
                    />
                    <Field
                        label={t("超时毫秒数", "Timeout (milliseconds)")}
                        value={timeout}
                        onChange={setTimeoutValue}
                        type="number"
                    />
                    <Field
                        label={t("失败阈值", "Failure threshold")}
                        value={threshold}
                        onChange={setThreshold}
                        type="number"
                    />
                </div>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={!valid || testMutation.isPending}
                        onClick={() =>
                            testMutation.mutate({
                                host: input.host,
                                port: input.port,
                                timeoutMs: input.timeoutMs,
                            })
                        }
                    >
                        <ActivityIcon /> {t("测试", "Test")}
                    </Button>
                    <Button
                        disabled={!valid || saveMutation.isPending}
                        onClick={() => saveMutation.mutate(input)}
                    >
                        {t("保存", "Save")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Field({
    label,
    value,
    onChange,
    type = "text",
    className,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: "text" | "number";
    className?: string;
}) {
    const id = `check-${label.toLowerCase().replaceAll(" ", "-")}`;
    return (
        <div className={`grid gap-2 ${className ?? ""}`}>
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
            />
        </div>
    );
}
