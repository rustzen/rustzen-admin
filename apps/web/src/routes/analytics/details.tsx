import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { insightsAPI } from "@/api";
import { DataTableShell } from "@/components/app/data-table-shell";
import { PageCard } from "@/components/app/page-card";
import { TablePagination } from "@/components/app/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/analytics/details")({ component: AnalyticsEventsPage });
const pageSize = 20;

function AnalyticsEventsPage() {
    const [eventName, setEventName] = useState("");
    const [current, setCurrent] = useState(1);
    const query = { eventName: eventName || undefined, current, pageSize };
    const { data, isFetching } = useQuery({
        queryKey: ["insights", "events", query],
        queryFn: () => insightsAPI.events(query),
    });
    return (
        <PageCard
            title="分析明细"
            description="查看当前实例的页面、接口、用户和业务原始事件。"
            toolbar={
                <div className="flex flex-wrap gap-3">
                    <Input
                        className="mt-auto w-64"
                        placeholder="输入完整事件名称"
                        value={eventName}
                        onChange={(event) => {
                            setEventName(event.target.value);
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
                            <TableHead>事件</TableHead>
                            <TableHead>访客 / 用户</TableHead>
                            <TableHead>位置</TableHead>
                            <TableHead>平台</TableHead>
                            <TableHead>耗时</TableHead>
                            <TableHead>发生时间</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(data?.data ?? []).map((row) => (
                            <TableRow key={row.id}>
                                <TableCell>
                                    <Badge variant={row.isError ? "destructive" : "outline"}>
                                        {row.eventName}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div>{row.visitorId}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {row.userId || "anonymous"}
                                    </div>
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                    {row.pagePath || row.apiPath || "-"}
                                </TableCell>
                                <TableCell>{row.platform || "-"}</TableCell>
                                <TableCell>
                                    {row.durationMs == null ? "-" : `${row.durationMs} ms`}
                                </TableCell>
                                <TableCell>{new Date(row.occurredAt).toLocaleString()}</TableCell>
                            </TableRow>
                        ))}
                        {!data?.data.length && (
                            <TableRow>
                                <TableCell colSpan={6} className="h-40 text-center">
                                    {isFetching ? "正在加载事件..." : "未找到事件。"}
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
