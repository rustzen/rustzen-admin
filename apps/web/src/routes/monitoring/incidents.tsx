import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckIcon } from "lucide-react";
import { useState } from "react";

import { appMessage, monitorAPI } from "@/api";
import { DataTableShell } from "@/components/app/data-table-shell";
import { PageCard } from "@/components/app/page-card";
import { TablePagination } from "@/components/app/table-pagination";
import { AuthWrap } from "@/components/base-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/monitoring/incidents")({
    component: MonitoringIncidentsPage,
});

const pageSize = 20;

function MonitoringIncidentsPage() {
    const [current, setCurrent] = useState(1);
    const [status, setStatus] = useState("active");
    const queryClient = useQueryClient();
    const query = {
        current,
        pageSize,
        status: status as Monitor.IncidentQuery["status"],
    };
    const { data, isFetching } = useQuery({
        queryKey: ["monitor", "incidents", query],
        queryFn: () => monitorAPI.incidents(query),
        refetchInterval: 10_000,
    });
    const acknowledge = useMutation({
        mutationFn: monitorAPI.acknowledgeIncident,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["monitor", "incidents"] });
            appMessage.success("Incident acknowledged");
        },
    });
    const incidents = data?.data ?? [];
    const total = data?.total ?? 0;

    return (
        <PageCard
            title="Incidents"
            description="Node, resource, and TCP failures are deduplicated until recovery."
            toolbar={
                <Select
                    value={status}
                    onValueChange={(value) => {
                        setStatus(value);
                        setCurrent(1);
                    }}
                >
                    <SelectTrigger className="w-48">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="acknowledged">Acknowledged</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                </Select>
            }
        >
            <DataTableShell>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Incident</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Opened</TableHead>
                            <TableHead>Last observed</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {incidents.length ? (
                            incidents.map((incident) => (
                                <TableRow key={incident.id}>
                                    <TableCell>
                                        <div className="font-medium">{incident.title}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {incident.kind}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{incident.sourceType}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={
                                                incident.status === "open"
                                                    ? "destructive"
                                                    : incident.status === "acknowledged"
                                                      ? "default"
                                                      : "secondary"
                                            }
                                        >
                                            {incident.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{formatDate(incident.openedAt)}</TableCell>
                                    <TableCell>{formatDate(incident.lastObservedAt)}</TableCell>
                                    <TableCell className="text-right">
                                        {incident.status === "open" ? (
                                            <AuthWrap code="monitor:incident:manage">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={acknowledge.isPending}
                                                    onClick={() => acknowledge.mutate(incident.id)}
                                                >
                                                    <CheckIcon /> Acknowledge
                                                </Button>
                                            </AuthWrap>
                                        ) : (
                                            "-"
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-40 text-center">
                                    {isFetching ? "Loading incidents..." : "No incidents found."}
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

function formatDate(value: string) {
    return new Date(value).toLocaleString();
}
