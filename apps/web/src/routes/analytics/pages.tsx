import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { insightsAPI } from "@/api";
import { ProjectSelect } from "@/components/analytics/project-select";
import { DataTableShell } from "@/components/app/data-table-shell";
import { PageCard } from "@/components/app/page-card";
import { TablePagination } from "@/components/app/table-pagination";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/analytics/pages")({ component: AnalyticsPagesPage });
const pageSize = 20;

function AnalyticsPagesPage() {
    const [projectId, setProjectId] = useState("");
    const [path, setPath] = useState("");
    const [current, setCurrent] = useState(1);
    const query = { projectId, path: path || undefined, current, pageSize };
    const { data, isFetching } = useQuery({
        queryKey: ["insights", "pages", query],
        queryFn: () => insightsAPI.pages(query),
        enabled: Boolean(projectId),
    });
    return (
        <PageCard
            title="Pages"
            description="Page views, visitors, and load duration by path."
            toolbar={
                <div className="flex flex-wrap gap-3">
                    <ProjectSelect
                        value={projectId}
                        onChange={(value) => {
                            setProjectId(value);
                            setCurrent(1);
                        }}
                    />
                    <Input
                        className="mt-auto w-64"
                        placeholder="Filter path"
                        value={path}
                        onChange={(event) => {
                            setPath(event.target.value);
                            setCurrent(1);
                        }}
                    />
                </div>
            }
        >
            <DataTableShell>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Path</TableHead>
                            <TableHead>PV</TableHead>
                            <TableHead>UV</TableHead>
                            <TableHead>Average load</TableHead>
                            <TableHead>Last seen</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(data?.data ?? []).map((row) => (
                            <TableRow key={row.pagePath}>
                                <TableCell className="font-mono">{row.pagePath}</TableCell>
                                <TableCell>{row.pv}</TableCell>
                                <TableCell>{row.uv}</TableCell>
                                <TableCell>{Math.round(row.averageDurationMs)} ms</TableCell>
                                <TableCell>{new Date(row.lastSeenAt).toLocaleString()}</TableCell>
                            </TableRow>
                        ))}
                        {!data?.data.length && (
                            <TableRow>
                                <TableCell colSpan={5} className="h-40 text-center">
                                    {isFetching ? "Loading pages..." : "No page events found."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </DataTableShell>
            <TablePagination
                currentPage={current}
                totalPages={Math.max(1, Math.ceil((data?.total ?? 0) / pageSize))}
                total={data?.total ?? 0}
                disabled={isFetching}
                onPageChange={setCurrent}
            />
        </PageCard>
    );
}
