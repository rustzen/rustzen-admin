import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CopyIcon, Globe2Icon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
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
export const Route = createFileRoute("/reports/templates")({ component: FlowsPage });
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
    const refreshSystems = () => client.invalidateQueries({ queryKey: ["reports", "systems"] });
    const clone = useMutation({
        mutationFn: (flow: Reports.Flow) =>
            reportsAPI.createFlow({
                systemId: flow.systemId,
                name: `${flow.name} copy`,
                steps: flow.steps,
            }),
        onSuccess: async () => {
            await refresh();
            appMessage.success("流程已复制");
        },
    });
    return (
        <PageCard
            title="报表模板"
            description="定义每个填报流程使用的目标系统和已验证步骤。"
            actions={
                <div className="flex gap-2">
                    <AuthWrap code="reports:system:manage">
                        <TargetDialog onSaved={refreshSystems} />
                    </AuthWrap>
                    <AuthWrap code="reports:flow:manage">
                        <FlowDialog systems={systems} onSaved={refresh} />
                    </AuthWrap>
                </div>
            }
        >
            <DataTableShell>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>名称</TableHead>
                            <TableHead>系统</TableHead>
                            <TableHead>步骤</TableHead>
                            <TableHead>更新时间</TableHead>
                            <TableHead className="text-right">操作</TableHead>
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
                                                    aria-label="复制流程"
                                                    onClick={() => clone.mutate(flow)}
                                                >
                                                    <CopyIcon />
                                                </Button>
                                                <ConfirmDialog
                                                    trigger={
                                                        <Button
                                                            variant="ghost-destructive"
                                                            size="icon-sm"
                                                            aria-label="删除流程"
                                                        >
                                                            <Trash2Icon />
                                                        </Button>
                                                    }
                                                    title="删除流程？"
                                                    description="已有填报执行必须不再引用该流程。"
                                                    confirmLabel="删除"
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
                                    {isFetching ? "正在加载流程..." : "暂无流程。"}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </DataTableShell>
        </PageCard>
    );
}

function TargetDialog({ onSaved }: { onSaved: () => Promise<unknown> }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [baseUrl, setBaseUrl] = useState("");
    const mutation = useMutation({
        mutationFn: () =>
            reportsAPI.createSystem({ name: name.trim(), baseUrl: baseUrl.trim(), enabled: true }),
        onSuccess: async () => {
            await onSaved();
            appMessage.success("目标系统已添加");
            setOpen(false);
        },
    });
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Globe2Icon />
                    Add target
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>添加报表目标</DialogTitle>
                    <DialogDescription>
                        Templates can only navigate within this trusted origin.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label>名称</Label>
                        <Input value={name} onChange={(event) => setName(event.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label>基础地址</Label>
                        <Input
                            value={baseUrl}
                            placeholder="https://example.com"
                            onChange={(event) => setBaseUrl(event.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        disabled={!name.trim() || !baseUrl.trim() || mutation.isPending}
                        onClick={() => mutation.mutate()}
                    >
                        Add target
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
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
            appMessage.success(flow ? "流程已更新" : "流程已创建");
            setOpen(false);
        },
    });
    const save = () => {
        try {
            const steps = JSON.parse(json) as Reports.FlowStep[];
            if (!Array.isArray(steps)) throw new Error();
            mutation.mutate({ name, systemId, steps });
        } catch {
            appMessage.error("步骤必须是有效的 JSON 数组");
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
                            New template
                        </>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{flow ? "编辑模板" : "新建报表模板"}</DialogTitle>
                    <DialogDescription>
                        Supported actions: goto, fill, click, waitFor, assertText, screenshot.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label>名称</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            <Label>系统</Label>
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
                        <Label>步骤 JSON</Label>
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
