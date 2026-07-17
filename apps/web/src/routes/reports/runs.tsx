import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BanIcon, EyeIcon, PlayIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { appMessage, reportsAPI } from "@/api";
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
function RunsPage() {
    const [current, setCurrent] = useState(1),
        [selected, setSelected] = useState<Reports.Run>();
    const client = useQueryClient();
    const { data: flows = [] } = useQuery({
        queryKey: ["reports", "flows"],
        queryFn: () => reportsAPI.flows(),
    });
    const { data, isFetching } = useQuery({
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
            appMessage.success("Run cancelled");
        },
    });
    const runs = data?.data ?? [];
    return (
        <PageCard
            title="Filling runs"
            description="Write selected input data through a report template and inspect execution live."
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
                            <TableHead>Run</TableHead>
                            <TableHead>Flow</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Error</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
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
                                        <Badge variant={variants[run.status]}>{run.status}</Badge>
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
                                                aria-label="View run"
                                                onClick={() => setSelected(run)}
                                            >
                                                <EyeIcon />
                                            </Button>
                                            <AuthWrap code="reports:run:manage">
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    aria-label="Cancel run"
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
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-40 text-center">
                                    {isFetching ? "Loading runs..." : "No runs created."}
                                </TableCell>
                            </TableRow>
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
        [json, setJson] = useState("{}");
    const mutation = useMutation({
        mutationFn: reportsAPI.createRun,
        onSuccess: async () => {
            await client.invalidateQueries({ queryKey: ["reports", "runs"] });
            appMessage.success("Run queued");
            setOpen(false);
        },
    });
    const save = () => {
        try {
            const input = JSON.parse(json) as Record<string, unknown>;
            mutation.mutate({ flowId, input });
        } catch {
            appMessage.error("Input must be valid JSON");
        }
    };
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button disabled={!flows.length}>
                    <PlayIcon />
                    New run
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Start run</DialogTitle>
                    <DialogDescription>
                        Choose a validated flow and the input object to write.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                    <Choice
                        label="Flow"
                        value={flowId}
                        onChange={setFlowId}
                        items={flows.map((f) => ({ id: f.id, name: f.name }))}
                    />
                    <div className="grid gap-2">
                        <Label>Input JSON</Label>
                        <Textarea
                            className="min-h-40 font-mono"
                            value={json}
                            onChange={(e) => setJson(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button disabled={!flowId || mutation.isPending} onClick={save}>
                        Queue run
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
function RunDetails({ run, onClose }: { run?: Reports.Run; onClose: () => void }) {
    const { data: currentRun = run } = useQuery({
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
                    <SheetTitle>Run audit</SheetTitle>
                    <SheetDescription>{run?.id}</SheetDescription>
                </SheetHeader>
                <div className="space-y-5 p-4">
                    {run && (
                        <div className="rounded-md border p-3 text-sm">
                            <p>Status: {currentRun?.status}</p>
                            <p>
                                Started: {currentRun?.startedAt ? date(currentRun.startedAt) : "-"}
                            </p>
                            <p>
                                Finished:{" "}
                                {currentRun?.finishedAt ? date(currentRun.finishedAt) : "-"}
                            </p>
                            {currentRun?.error && (
                                <p className="mt-2 text-destructive">{currentRun.error}</p>
                            )}
                        </div>
                    )}
                    <LiveFrame run={currentRun} />
                    <div>
                        <h3 className="mb-2 font-medium">Steps</h3>
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
                                        {step.status}
                                    </Badge>
                                </div>
                                <p className="text-muted-foreground">
                                    {step.durationMs ?? 0} ms{" "}
                                    {step.message ? `· ${step.message}` : ""}
                                </p>
                            </div>
                        ))}
                        {!steps.length && (
                            <p className="text-sm text-muted-foreground">No steps recorded.</p>
                        )}
                    </div>
                    {artifacts.length > 0 && (
                        <div>
                            <h3 className="mb-2 font-medium">Artifacts</h3>
                            {artifacts.map((a) => (
                                <a
                                    key={a.id}
                                    className="block text-sm text-primary underline"
                                    href={`/api/reports/runs/${a.runId}/artifacts/${a.id}`}
                                >
                                    {a.fileName}
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}

function LiveFrame({ run }: { run?: Reports.Run }) {
    const { data } = useQuery({
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
            <h3 className="mb-2 font-medium">Live view</h3>
            <div className="flex h-80 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
                {source ? (
                    <img src={source} className="h-full w-full object-contain" alt="Live run" />
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {run?.status === "queued" || run?.status === "running"
                            ? "Waiting for the browser frame..."
                            : "No live frame was captured."}
                    </p>
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
                    <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
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
