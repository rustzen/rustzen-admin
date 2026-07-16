import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { appMessage, systemAPI } from "@/api";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTableShell } from "@/components/app/data-table-shell";
import { PageCard } from "@/components/app/page-card";
import { AuthWrap } from "@/components/base-auth";
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
    const { data = [], isFetching } = useQuery({
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
        appMessage.success(`${module.name} ${enabled ? "enabled" : "disabled"}`);
    };

    return (
        <PageCard
            title="System Modules"
            description="Enable built-in modules and review their current runtime health."
        >
            <DataTableShell>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Module</TableHead>
                            <TableHead className="w-32">Enabled</TableHead>
                            <TableHead className="w-36">Health</TableHead>
                            <TableHead className="w-28 text-right">Actions</TableHead>
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
                                            {module.enabled ? "Enabled" : "Disabled"}
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
                                                        variant={module.enabled ? "outline" : "default"}
                                                    >
                                                        {module.enabled ? "Disable" : "Enable"}
                                                    </Button>
                                                }
                                                title={`${module.enabled ? "Disable" : "Enable"} ${module.name}`}
                                                description={
                                                    module.enabled
                                                        ? `Disable ${module.name} and remove its navigation entry?`
                                                        : `Enable ${module.name} and resume Manifest synchronization?`
                                                }
                                                confirmLabel={module.enabled ? "Disable" : "Enable"}
                                                destructive={module.enabled}
                                                onConfirm={() => updateEnabled(module)}
                                            />
                                        </AuthWrap>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="h-40 text-center">
                                    {isFetching ? "Loading modules..." : "No modules found."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </DataTableShell>
        </PageCard>
    );
}

function ModuleHealthBadge({ module }: { module: SystemModule.Item }) {
    if (!module.enabled) {
        return <Badge variant="outline">Disabled</Badge>;
    }
    if (module.available) {
        return <Badge>Available</Badge>;
    }
    if (module.compatible) {
        return <Badge variant="secondary">Unavailable</Badge>;
    }
    if (module.releaseVersion) {
        return (
            <Badge variant="destructive" title={module.error ?? undefined}>
                Incompatible
            </Badge>
        );
    }
    return (
        <Badge variant="destructive" title={module.error ?? undefined}>
            Not ready
        </Badge>
    );
}
