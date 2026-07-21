import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CopyIcon, Globe2Icon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";

import { appMessage, reportsAPI } from "@/api";
import { AuthWrap } from "@/components/auth";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { DataTableState } from "@/components/feedback/data-state";
import { PageCard } from "@/components/page/page-card";
import { DataTableShell } from "@/components/table/data-table-shell";
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
import { t } from "@/lib/i18n";
export const Route = createFileRoute("/reports/templates")({ component: FlowsPage });
const example: Reports.FlowStep[] = [
    { action: "goto", url: "/login" },
    { action: "fill", selector: "#username", value: "{{input.username}}" },
    { action: "fill", selector: "#password", value: "{{input.password}}" },
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
    const {
        data: flows = [],
        error,
        isPending,
        refetch,
    } = useQuery({
        queryKey: ["reports", "flows"],
        queryFn: () => reportsAPI.flows(),
    });
    const refresh = () => client.invalidateQueries({ queryKey: ["reports", "flows"] });
    const refreshSystems = () => client.invalidateQueries({ queryKey: ["reports", "systems"] });
    const clone = useMutation({
        mutationFn: (flow: Reports.Flow) =>
            reportsAPI.createFlow({
                systemId: flow.systemId,
                name: t(`${flow.name} 副本`, `${flow.name} copy`),
                steps: flow.steps,
            }),
        onSuccess: async () => {
            await refresh();
            appMessage.success(t("流程已复制", "Template copied"));
        },
    });
    return (
        <PageCard
            title={t("报表模板", "Report templates")}
            description={t(
                "定义每个填报流程使用的目标系统和已验证步骤。",
                "Define the target system and verified steps for each report workflow.",
            )}
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
                            <TableHead>{t("名称", "Name")}</TableHead>
                            <TableHead>{t("系统", "System")}</TableHead>
                            <TableHead>{t("步骤", "Steps")}</TableHead>
                            <TableHead>{t("更新时间", "Updated at")}</TableHead>
                            <TableHead className="text-right">{t("操作", "Actions")}</TableHead>
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
                                                    aria-label={t("复制流程", "Copy template")}
                                                    onClick={() => clone.mutate(flow)}
                                                >
                                                    <CopyIcon />
                                                </Button>
                                                <ConfirmDialog
                                                    trigger={
                                                        <Button
                                                            variant="ghost-destructive"
                                                            size="icon-sm"
                                                            aria-label={t(
                                                                "删除流程",
                                                                "Delete template",
                                                            )}
                                                        >
                                                            <Trash2Icon />
                                                        </Button>
                                                    }
                                                    title={t("删除流程？", "Delete template?")}
                                                    description={t(
                                                        "已有填报执行必须不再引用该流程。",
                                                        "Existing report runs must no longer reference this template.",
                                                    )}
                                                    confirmLabel={t("删除", "Delete")}
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
                        ) : isPending ? (
                            <DataTableState
                                colSpan={5}
                                kind="loading"
                                title={t("正在加载报表模板", "Loading report templates")}
                            />
                        ) : error ? (
                            <DataTableState
                                colSpan={5}
                                kind="error"
                                title={t("报表模板加载失败", "Failed to load report templates")}
                                description={t(
                                    "无法读取模板，请检查 Reports 服务后重试。",
                                    "Unable to read templates. Check the Reports service and try again.",
                                )}
                                action={
                                    <Button onClick={() => void refetch()}>
                                        {t("重新加载", "Reload")}
                                    </Button>
                                }
                            />
                        ) : (
                            <DataTableState
                                colSpan={5}
                                kind="empty"
                                title={t("暂无报表模板", "No report templates")}
                                description={t(
                                    "先添加目标系统，再创建包含已验证步骤的填报模板。",
                                    "Add a target system, then create a report template with verified steps.",
                                )}
                            />
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
            appMessage.success(t("目标系统已添加", "Target system added"));
            setOpen(false);
        },
    });
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Globe2Icon />
                    {t("添加目标系统", "Add target system")}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t("添加报表目标", "Add report target")}</DialogTitle>
                    <DialogDescription>
                        {t(
                            "模板只能在这个可信来源内导航。",
                            "Templates can only navigate within this trusted origin.",
                        )}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label>{t("名称", "Name")}</Label>
                        <Input value={name} onChange={(event) => setName(event.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label>{t("基础地址", "Base URL")}</Label>
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
                        {t("添加目标系统", "Add target system")}
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
            appMessage.success(
                flow ? t("流程已更新", "Template updated") : t("流程已创建", "Template created"),
            );
            setOpen(false);
        },
    });
    const save = () => {
        try {
            const steps = JSON.parse(json) as Reports.FlowStep[];
            if (!Array.isArray(steps)) throw new Error();
            mutation.mutate({ name, systemId, steps });
        } catch {
            appMessage.error(t("步骤必须是有效的 JSON 数组", "Steps must be a valid JSON array"));
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
                            {t("新建模板", "New template")}
                        </>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {flow
                            ? t("编辑模板", "Edit template")
                            : t("新建报表模板", "New report template")}
                    </DialogTitle>
                    <DialogDescription>
                        {t(
                            "支持的动作：goto、fill、click、waitFor、assertText、screenshot。",
                            "Supported actions: goto, fill, click, waitFor, assertText, screenshot.",
                        )}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label>{t("名称", "Name")}</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            <Label>{t("系统", "System")}</Label>
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
                        <Label>{t("步骤 JSON", "Steps JSON")}</Label>
                        <Textarea
                            className="min-h-80 font-mono text-xs"
                            value={json}
                            onChange={(e) => setJson(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button disabled={!name || !systemId || mutation.isPending} onClick={save}>
                        {t("校验并保存", "Validate and save")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
