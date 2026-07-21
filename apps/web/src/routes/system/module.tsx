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
import { localizeModuleName } from "@/lib/builtin-i18n";
import { t } from "@/lib/i18n";

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
        const moduleName = localizeModuleName(module.id, module.name);
        appMessage.success(
            enabled
                ? t(`${moduleName} 已启用`, `${moduleName} enabled.`)
                : t(`${moduleName} 已禁用`, `${moduleName} disabled.`),
        );
    };

    return (
        <PageCard
            title={t("系统模块", "System modules")}
            description={t(
                "启用内置模块并查看当前运行状态。",
                "Enable built-in modules and view their current runtime status.",
            )}
        >
            <DataTableShell>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t("模块", "Module")}</TableHead>
                            <TableHead className="w-32">{t("启用状态", "Enabled")}</TableHead>
                            <TableHead className="w-36">{t("健康状态", "Health")}</TableHead>
                            <TableHead className="w-28 text-right">
                                {t("操作", "Actions")}
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length > 0 ? (
                            data.map((module) => (
                                <TableRow key={module.id}>
                                    <TableCell>
                                        <div className="font-medium">
                                            {localizeModuleName(module.id, module.name)}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {module.id}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={module.enabled ? "secondary" : "outline"}>
                                            {module.enabled
                                                ? t("已启用", "Enabled")
                                                : t("已禁用", "Disabled")}
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
                                                        {module.enabled
                                                            ? t("禁用", "Disable")
                                                            : t("启用", "Enable")}
                                                    </Button>
                                                }
                                                title={
                                                    module.enabled
                                                        ? t(
                                                              `禁用${localizeModuleName(module.id, module.name)}`,
                                                              `Disable ${localizeModuleName(module.id, module.name)}`,
                                                          )
                                                        : t(
                                                              `启用${localizeModuleName(module.id, module.name)}`,
                                                              `Enable ${localizeModuleName(module.id, module.name)}`,
                                                          )
                                                }
                                                description={
                                                    module.enabled
                                                        ? t(
                                                              `禁用 ${localizeModuleName(module.id, module.name)} 并移除对应导航入口？`,
                                                              `Disable ${localizeModuleName(module.id, module.name)} and remove its navigation entry?`,
                                                          )
                                                        : t(
                                                              `启用 ${localizeModuleName(module.id, module.name)} 并恢复 Manifest 同步？`,
                                                              `Enable ${localizeModuleName(module.id, module.name)} and restore manifest synchronization?`,
                                                          )
                                                }
                                                confirmLabel={
                                                    module.enabled
                                                        ? t("禁用", "Disable")
                                                        : t("启用", "Enable")
                                                }
                                                destructive={module.enabled}
                                                onConfirm={() => updateEnabled(module)}
                                            />
                                        </AuthWrap>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : isPending ? (
                            <DataTableState
                                colSpan={4}
                                kind="loading"
                                title={t("正在加载模块", "Loading modules")}
                            />
                        ) : error ? (
                            <DataTableState
                                colSpan={4}
                                kind="error"
                                title={t("模块加载失败", "Failed to load modules")}
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
                                colSpan={4}
                                kind="empty"
                                title={t("暂无模块", "No modules")}
                            />
                        )}
                    </TableBody>
                </Table>
            </DataTableShell>
        </PageCard>
    );
}

function ModuleHealthBadge({ module }: { module: SystemModule.Item }) {
    if (!module.enabled) {
        return <Badge variant="outline">{t("已禁用", "Disabled")}</Badge>;
    }
    if (module.available) {
        return <Badge>{t("可用", "Available")}</Badge>;
    }
    if (module.compatible) {
        return <Badge variant="secondary">{t("不可用", "Unavailable")}</Badge>;
    }
    if (module.releaseVersion) {
        return (
            <Badge variant="destructive" title={module.error ?? undefined}>
                {t("不兼容", "Incompatible")}
            </Badge>
        );
    }
    return (
        <Badge variant="destructive" title={module.error ?? undefined}>
            {t("未就绪", "Not ready")}
        </Badge>
    );
}
