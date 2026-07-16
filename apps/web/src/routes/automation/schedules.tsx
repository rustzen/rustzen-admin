import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";

import { appMessage, reportsAPI } from "@/api";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTableShell } from "@/components/app/data-table-shell";
import { PageCard } from "@/components/app/page-card";
import { AuthWrap } from "@/components/base-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
export const Route = createFileRoute("/automation/schedules")({ component: SchedulesPage });
function SchedulesPage() {
    const client = useQueryClient();
    const { data: schedules = [], isFetching } = useQuery({
        queryKey: ["reports", "schedules"],
        queryFn: reportsAPI.schedules,
        refetchInterval: 10000,
    });
    const { data: flows = [] } = useQuery({
        queryKey: ["reports", "flows"],
        queryFn: () => reportsAPI.flows(),
    });
    const { data: accounts = [] } = useQuery({
        queryKey: ["reports", "accounts"],
        queryFn: () => reportsAPI.accounts(),
    });
    const refresh = () => client.invalidateQueries({ queryKey: ["reports", "schedules"] });
    return (
        <PageCard
            title="Schedules"
            description="Create durable cron triggers with database-level duplicate protection."
            actions={
                <AuthWrap code="reports:schedule:manage">
                    <ScheduleDialog flows={flows} accounts={accounts} onSaved={refresh} />
                </AuthWrap>
            }
        >
            <DataTableShell>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Flow</TableHead>
                            <TableHead>Cron</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Next run</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {schedules.length ? (
                            schedules.map((s) => (
                                <TableRow key={s.id}>
                                    <TableCell className="font-medium">{s.name}</TableCell>
                                    <TableCell>
                                        {flows.find((f) => f.id === s.flowId)?.name ?? s.flowId}
                                    </TableCell>
                                    <TableCell className="font-mono">{s.cron}</TableCell>
                                    <TableCell>
                                        <Badge variant={s.enabled ? "secondary" : "outline"}>
                                            {s.enabled ? "enabled" : "disabled"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {s.nextRunAt ? new Date(s.nextRunAt).toLocaleString() : "-"}
                                    </TableCell>
                                    <TableCell>
                                        <AuthWrap code="reports:schedule:manage">
                                            <div className="flex justify-end">
                                                <ScheduleDialog
                                                    schedule={s}
                                                    flows={flows}
                                                    accounts={accounts}
                                                    onSaved={refresh}
                                                />
                                                <ConfirmDialog
                                                    trigger={
                                                        <Button
                                                            variant="ghost-destructive"
                                                            size="icon-sm"
                                                        >
                                                            <Trash2Icon />
                                                        </Button>
                                                    }
                                                    title="Delete schedule?"
                                                    description="Existing run history is retained."
                                                    confirmLabel="Delete"
                                                    destructive
                                                    onConfirm={() =>
                                                        reportsAPI
                                                            .deleteSchedule(s.id)
                                                            .then(refresh)
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
                                <TableCell colSpan={6} className="h-40 text-center">
                                    {isFetching
                                        ? "Loading schedules..."
                                        : "No schedules configured."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </DataTableShell>
        </PageCard>
    );
}
function ScheduleDialog({
    schedule,
    flows,
    accounts,
    onSaved,
}: {
    schedule?: Reports.Schedule;
    flows: Reports.Flow[];
    accounts: Reports.Account[];
    onSaved: () => Promise<unknown>;
}) {
    const [open, setOpen] = useState(false),
        [name, setName] = useState(""),
        [flowId, setFlowId] = useState(""),
        [accountId, setAccountId] = useState("none"),
        [cron, setCron] = useState("0 0 * * *"),
        [json, setJson] = useState("{}"),
        [enabled, setEnabled] = useState(true);
    useEffect(() => {
        if (open) {
            setName(schedule?.name ?? "");
            setFlowId(schedule?.flowId ?? flows[0]?.id ?? "");
            setAccountId(schedule?.accountId ?? "none");
            setCron(schedule?.cron ?? "0 0 * * *");
            setJson(schedule?.inputJson ?? "{}");
            setEnabled(schedule?.enabled ?? true);
        }
    }, [open, schedule, flows]);
    const mutation = useMutation({
        mutationFn: (input: Reports.SaveSchedule) =>
            schedule
                ? reportsAPI.updateSchedule(schedule.id, input)
                : reportsAPI.createSchedule(input),
        onSuccess: async () => {
            await onSaved();
            appMessage.success(schedule ? "Schedule updated" : "Schedule created");
            setOpen(false);
        },
    });
    const save = () => {
        try {
            mutation.mutate({
                name,
                flowId,
                cron,
                input: JSON.parse(json) as Record<string, unknown>,
                enabled,
                ...(accountId !== "none" ? { accountId } : {}),
            });
        } catch {
            appMessage.error("Input must be valid JSON");
        }
    };
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant={schedule ? "ghost" : "default"}
                    size={schedule ? "icon-sm" : "default"}
                    disabled={!flows.length}
                >
                    {schedule ? (
                        <PencilIcon />
                    ) : (
                        <>
                            <PlusIcon />
                            New schedule
                        </>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{schedule ? "Edit schedule" : "New schedule"}</DialogTitle>
                    <DialogDescription>
                        Cron uses UTC and the selected flow's validated origin.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label>Name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="schedule-enabled"
                            checked={enabled}
                            onCheckedChange={(checked) => setEnabled(checked === true)}
                        />
                        <Label htmlFor="schedule-enabled">Enabled</Label>
                    </div>
                    <Pick
                        label="Flow"
                        value={flowId}
                        set={setFlowId}
                        items={flows.map((f) => [f.id, f.name])}
                    />
                    <Pick
                        label="Account"
                        value={accountId}
                        set={setAccountId}
                        items={[["none", "No account"], ...accounts.map((a) => [a.id, a.name])]}
                    />
                    <div className="grid gap-2">
                        <Label>Cron (UTC)</Label>
                        <Input
                            className="font-mono"
                            value={cron}
                            onChange={(e) => setCron(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Input JSON</Label>
                        <Textarea
                            className="font-mono"
                            value={json}
                            onChange={(e) => setJson(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        disabled={!name || !flowId || !cron || mutation.isPending}
                        onClick={save}
                    >
                        Save schedule
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
function Pick({
    label,
    value,
    set,
    items,
}: {
    label: string;
    value: string;
    set: (v: string) => void;
    items: string[][];
}) {
    return (
        <div className="grid gap-2">
            <Label>{label}</Label>
            <Select value={value} onValueChange={set}>
                <SelectTrigger className="w-full">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {items.map(([id, name]) => (
                        <SelectItem key={id} value={id}>
                            {name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
