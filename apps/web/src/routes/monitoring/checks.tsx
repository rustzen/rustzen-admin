import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ActivityIcon, PencilIcon, PlusIcon, PowerIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { appMessage, monitorAPI } from "@/api";
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

export const Route = createFileRoute("/monitoring/checks")({ component: MonitoringChecksPage });

const pageSize = 20;

function MonitoringChecksPage() {
    const [current, setCurrent] = useState(1);
    const queryClient = useQueryClient();
    const { data, isFetching } = useQuery({
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
            appMessage.success("Check status updated");
        },
    });
    const deleteMutation = useMutation({
        mutationFn: monitorAPI.deleteCheck,
        onSuccess: async () => {
            await refresh();
            appMessage.success("Check deleted");
        },
    });

    const checks = data?.data ?? [];
    const total = data?.total ?? 0;
    return (
        <PageCard
            title="Service monitoring"
            description="Probe TCP services on a fixed interval and inspect durable results."
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
                            <TableHead>Name</TableHead>
                            <TableHead>Target</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Interval</TableHead>
                            <TableHead>Failures</TableHead>
                            <TableHead>Last checked</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
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
                                                ? "disabled"
                                                : (check.lastStatus ?? "pending")}
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
                                                            ? "Disable check"
                                                            : "Enable check"
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
                                                            aria-label="Delete check"
                                                        >
                                                            <Trash2Icon />
                                                        </Button>
                                                    }
                                                    title="Delete TCP check?"
                                                    description="Its retained check results will also be deleted."
                                                    confirmLabel="Delete"
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
                        ) : (
                            <TableRow>
                                <TableCell colSpan={7} className="h-40 text-center">
                                    {isFetching ? "Loading checks..." : "No TCP checks configured."}
                                </TableCell>
                            </TableRow>
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
            appMessage.success(check ? "Check updated" : "Check created");
            setOpen(false);
        },
    });
    const testMutation = useMutation({
        mutationFn: monitorAPI.testCheck,
        onSuccess: (result) => {
            if (result.status === "up") {
                appMessage.success(`Connection succeeded in ${result.latencyMs ?? 0} ms`);
            } else {
                appMessage.error(result.error ?? "Connection failed");
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
                    <Button variant="ghost" size="icon-sm" aria-label="Edit check">
                        <PencilIcon />
                    </Button>
                ) : (
                    <Button>
                        <PlusIcon /> New check
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{check ? "Edit TCP check" : "New TCP check"}</DialogTitle>
                    <DialogDescription>
                        The target is tested from the Monitoring service host.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Name" value={name} onChange={setName} className="sm:col-span-2" />
                    <Field label="Host" value={host} onChange={setHost} />
                    <Field label="Port" value={port} onChange={setPort} type="number" />
                    <Field
                        label="Interval seconds"
                        value={interval}
                        onChange={setInterval}
                        type="number"
                    />
                    <Field
                        label="Timeout ms"
                        value={timeout}
                        onChange={setTimeoutValue}
                        type="number"
                    />
                    <Field
                        label="Failure threshold"
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
                        <ActivityIcon /> Test
                    </Button>
                    <Button
                        disabled={!valid || saveMutation.isPending}
                        onClick={() => saveMutation.mutate(input)}
                    >
                        Save
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
