import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { appMessage, systemAPI } from "@/api";
import { AuthWrap } from "@/components/auth";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { DataTableState } from "@/components/feedback/data-state";
import { PageCard } from "@/components/page/page-card";
import { DataTableShell } from "@/components/table/data-table-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/system/module")({
    component: SystemModulePage,
});

function SystemModulePage() {
    const queryClient = useQueryClient();
    const {
        data = [],
        error,
        isPending,
        refetch,
    } = useQuery({
        queryKey: ["system", "modules"],
        queryFn: systemAPI.module.list,
        refetchInterval: 10_000,
    });

    const updateEnabled = async (module: SystemModule.Item) => {
        const enabled = !module.enabled;
        const modules = await systemAPI.module.updateEnabled(module.id, enabled);
        queryClient.setQueryData(["system", "modules"], modules);
        await queryClient.invalidateQueries({
            queryKey: ["system", "modules", "navigation"],
        });
        appMessage.success(`${module.name} 已${enabled ? "启用" : "禁用"}`);
    };

    return (
        <PageCard title="系统模块" description="启用内置模块并查看当前运行状态。">
            <DataTableShell>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>模块</TableHead>
                            <TableHead className="w-32">启用状态</TableHead>
                            <TableHead className="w-36">健康状态</TableHead>
                            <TableHead className="w-28 text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length > 0 ? (
                            data.map((module) => (
                                <TableRow key={module.id}>
                                    <TableCell>
                                        <div className="font-medium">{module.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {module.id}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={module.enabled ? "secondary" : "outline"}>
                                            {module.enabled ? "已启用" : "已禁用"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <ModuleHealthBadge module={module} />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <AuthWrap code="system:module:update">
                                            <ConfirmDialog
                                                trigger={
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant={
                                                            module.enabled ? "outline" : "default"
                                                        }
                                                    >
                                                        {module.enabled ? "禁用" : "启用"}
                                                    </Button>
                                                }
                                                title={`${module.enabled ? "禁用" : "启用"}${module.name}`}
                                                description={
                                                    module.enabled
                                                        ? `禁用 ${module.name} 并移除对应导航入口？`
                                                        : `启用 ${module.name} 并恢复 Manifest 同步？`
                                                }
                                                confirmLabel={module.enabled ? "禁用" : "启用"}
                                                destructive={module.enabled}
                                                onConfirm={() => updateEnabled(module)}
                                            />
                                        </AuthWrap>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : isPending ? (
                            <DataTableState colSpan={4} kind="loading" title="正在加载模块" />
                        ) : error ? (
                            <DataTableState
                                colSpan={4}
                                kind="error"
                                title="模块加载失败"
                                description={
                                    error instanceof Error ? error.message : "请稍后重试。"
                                }
                                action={<Button onClick={() => void refetch()}>重新加载</Button>}
                            />
                        ) : (
                            <DataTableState colSpan={4} kind="empty" title="暂无模块" />
                        )}
                    </TableBody>
                </Table>
            </DataTableShell>
        </PageCard>
    );
}

function ModuleHealthBadge({ module }: { module: SystemModule.Item }) {
    if (!module.enabled) {
        return <Badge variant="outline">已禁用</Badge>;
    }
    if (module.available) {
        return <Badge>可用</Badge>;
    }
    if (module.compatible) {
        return <Badge variant="secondary">不可用</Badge>;
    }
    if (module.releaseVersion) {
        return (
            <Badge variant="destructive" title={module.error ?? undefined}>
                不兼容
            </Badge>
        );
    }
    return (
        <Badge variant="destructive" title={module.error ?? undefined}>
            未就绪
        </Badge>
    );
}
