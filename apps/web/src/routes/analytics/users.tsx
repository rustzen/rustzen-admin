import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { insightsAPI } from "@/api";
import { ProjectSelect } from "@/components/analytics/project-select";
import { DataTableShell } from "@/components/app/data-table-shell";
import { PageCard } from "@/components/app/page-card";
import { TablePagination } from "@/components/app/table-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/analytics/users")({ component: AnalyticsUsersPage });
const pageSize = 20;

function AnalyticsUsersPage() {
    const [projectId, setProjectId] = useState("");
    const [keyword, setKeyword] = useState("");
    const [current, setCurrent] = useState(1);
    const [selected, setSelected] = useState<Insights.UserStat>();
    const query = { projectId, keyword: keyword || undefined, current, pageSize };
    const { data, isFetching } = useQuery({
        queryKey: ["insights", "users", query],
        queryFn: () => insightsAPI.users(query),
        enabled: Boolean(projectId),
    });
    const timeline = useQuery({
        queryKey: ["insights", "user-events", projectId, selected?.visitorId],
        queryFn: () =>
            insightsAPI.userEvents(selected!.visitorId, { projectId, current: 1, pageSize: 100 }),
        enabled: Boolean(selected && projectId),
    });
    return (
        <PageCard
            title="Users"
            description="Visitor identity, platform, first/last activity, and event timeline."
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
                        placeholder="Visitor or user ID"
                        value={keyword}
                        onChange={(event) => {
                            setKeyword(event.target.value);
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
                            <TableHead>Visitor</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Platform</TableHead>
                            <TableHead>Events</TableHead>
                            <TableHead>First seen</TableHead>
                            <TableHead>Last seen</TableHead>
                            <TableHead className="text-right">Details</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(data?.data ?? []).map((row) => (
                            <TableRow key={row.visitorId}>
                                <TableCell className="font-mono">{row.visitorId}</TableCell>
                                <TableCell>{row.userId || "anonymous"}</TableCell>
                                <TableCell>{row.platform || "-"}</TableCell>
                                <TableCell>{row.eventCount}</TableCell>
                                <TableCell>{new Date(row.firstSeenAt).toLocaleString()}</TableCell>
                                <TableCell>{new Date(row.lastSeenAt).toLocaleString()}</TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setSelected(row)}
                                    >
                                        Timeline
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {!data?.data.length && (
                            <TableRow>
                                <TableCell colSpan={7} className="h-40 text-center">
                                    {isFetching ? "Loading users..." : "No users found."}
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
            <Sheet
                open={Boolean(selected)}
                onOpenChange={(open) => !open && setSelected(undefined)}
            >
                <SheetContent className="overflow-y-auto sm:max-w-2xl">
                    <SheetHeader>
                        <SheetTitle>{selected?.userId || selected?.visitorId}</SheetTitle>
                        <SheetDescription>
                            Most recent 100 events for this visitor.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="space-y-3 px-4 pb-6">
                        {(timeline.data?.data ?? []).map((event) => (
                            <div key={event.id} className="rounded-lg border p-3">
                                <div className="flex justify-between">
                                    <strong>{event.eventName}</strong>
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(event.occurredAt).toLocaleString()}
                                    </span>
                                </div>
                                <p className="font-mono text-xs text-muted-foreground">
                                    {event.pagePath ||
                                        event.apiPath ||
                                        JSON.stringify(event.properties)}
                                </p>
                            </div>
                        ))}
                    </div>
                </SheetContent>
            </Sheet>
        </PageCard>
    );
}
