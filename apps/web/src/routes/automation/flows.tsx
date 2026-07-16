import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CopyIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";

import { appMessage, reportsAPI } from "@/api";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTableShell } from "@/components/app/data-table-shell";
import { PageCard } from "@/components/app/page-card";
import { AuthWrap } from "@/components/base-auth";
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
export const Route = createFileRoute("/automation/flows")({ component: FlowsPage });
const example: Reports.FlowStep[] = [
    { action: "goto", url: "/login" },
    { action: "fill", selector: "#username", value: "{{account.username}}" },
    { action: "fill", selector: "#password", value: "{{account.password}}" },
    { action: "click", selector: "button[type=submit]" },
    { action: "waitFor", selector: "form" },
    { action: "screenshot", name: "submitted" },
];
function FlowsPage() {
    const client = useQueryClient();
    const { data: systems = [] } = useQuery({
        queryKey: ["reports", "systems"],
        queryFn: reportsAPI.systems,
    });
    const { data: flows = [], isFetching } = useQuery({
        queryKey: ["reports", "flows"],
        queryFn: () => reportsAPI.flows(),
    });
    const refresh = () => client.invalidateQueries({ queryKey: ["reports", "flows"] });
    const clone = useMutation({
        mutationFn: (flow: Reports.Flow) =>
            reportsAPI.createFlow({
                systemId: flow.systemId,
                name: `${flow.name} copy`,
                steps: flow.steps,
            }),
        onSuccess: async () => {
            await refresh();
            appMessage.success("Flow cloned");
        },
    });
    return (
        <PageCard
            title="Flows"
            description="Define small, validated browser workflows without arbitrary JavaScript."
            actions={
                <AuthWrap code="reports:flow:manage">
                    <FlowDialog systems={systems} onSaved={refresh} />
                </AuthWrap>
            }
        >
            <DataTableShell>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>System</TableHead>
                            <TableHead>Steps</TableHead>
                            <TableHead>Updated</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {flows.length ? (
                            flows.map((flow) => (
                                <TableRow key={flow.id}>
                                    <TableCell className="font-medium">{flow.name}</TableCell>
                                    <TableCell>
                                        {systems.find((s) => s.id === flow.systemId)?.name ??
                                            flow.systemId}
                                    </TableCell>
                                    <TableCell>{flow.steps.length}</TableCell>
                                    <TableCell>
                                        {new Date(flow.updatedAt).toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                        <AuthWrap code="reports:flow:manage">
                                            <div className="flex justify-end gap-1">
                                                <FlowDialog
                                                    systems={systems}
                                                    flow={flow}
                                                    onSaved={refresh}
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    aria-label="Clone flow"
                                                    onClick={() => clone.mutate(flow)}
                                                >
                                                    <CopyIcon />
                                                </Button>
                                                <ConfirmDialog
                                                    trigger={
                                                        <Button
                                                            variant="ghost-destructive"
                                                            size="icon-sm"
                                                            aria-label="Delete flow"
                                                        >
                                                            <Trash2Icon />
                                                        </Button>
                                                    }
                                                    title="Delete flow?"
                                                    description="Runs and schedules must no longer reference it."
                                                    confirmLabel="Delete"
                                                    destructive
                                                    onConfirm={() =>
                                                        reportsAPI
                                                            .deleteFlow(flow.id)
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
                                <TableCell colSpan={5} className="h-40 text-center">
                                    {isFetching ? "Loading flows..." : "No flows configured."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </DataTableShell>
        </PageCard>
    );
}
function FlowDialog({
    systems,
    flow,
    onSaved,
}: {
    systems: Reports.System[];
    flow?: Reports.Flow;
    onSaved: () => Promise<unknown>;
}) {
    const [open, setOpen] = useState(false),
        [name, setName] = useState(""),
        [systemId, setSystemId] = useState(""),
        [json, setJson] = useState("");
    useEffect(() => {
        if (open) {
            setName(flow?.name ?? "");
            setSystemId(flow?.systemId ?? systems[0]?.id ?? "");
            setJson(JSON.stringify(flow?.steps ?? example, null, 2));
        }
    }, [open, flow, systems]);
    const mutation = useMutation({
        mutationFn: (input: Reports.SaveFlow) =>
            flow ? reportsAPI.updateFlow(flow.id, input) : reportsAPI.createFlow(input),
        onSuccess: async () => {
            await onSaved();
            appMessage.success(flow ? "Flow updated" : "Flow created");
            setOpen(false);
        },
    });
    const save = () => {
        try {
            const steps = JSON.parse(json) as Reports.FlowStep[];
            if (!Array.isArray(steps)) throw new Error();
            mutation.mutate({ name, systemId, steps });
        } catch {
            appMessage.error("Steps must be a valid JSON array");
        }
    };
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant={flow ? "ghost" : "default"}
                    size={flow ? "icon-sm" : "default"}
                    disabled={!systems.length}
                >
                    {flow ? (
                        <PencilIcon />
                    ) : (
                        <>
                            <PlusIcon />
                            New flow
                        </>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{flow ? "Edit flow" : "New browser flow"}</DialogTitle>
                    <DialogDescription>
                        Supported actions: goto, fill, click, waitFor, assertText, screenshot.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label>Name</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            <Label>System</Label>
                            <Select value={systemId} onValueChange={setSystemId}>
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {systems.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label>Steps JSON</Label>
                        <Textarea
                            className="min-h-80 font-mono text-xs"
                            value={json}
                            onChange={(e) => setJson(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button disabled={!name || !systemId || mutation.isPending} onClick={save}>
                        Validate and save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
