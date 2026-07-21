import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { insightsAPI } from "@/api";
import { DataTableState } from "@/components/feedback/data-state";
import { PageCard } from "@/components/page/page-card";
import { DataTableShell } from "@/components/table/data-table-shell";
import { TablePagination } from "@/components/table/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/analytics/details")({ component: AnalyticsEventsPage });
const pageSize = 20;

function AnalyticsEventsPage() {
    const [eventName, setEventName] = useState("");
    const [current, setCurrent] = useState(1);
    const query = { eventName: eventName || undefined, current, pageSize };
    const { data, error, isFetching, isPending, refetch } = useQuery({
        queryKey: ["insights", "events", query],
        queryFn: () => insightsAPI.events(query),
    });
    return (
        <PageCard
            title={t("分析明细", "Analytics details")}
            description={t(
                "查看当前实例的页面、接口、用户和业务原始事件。",
                "View raw page, API, user, and business events for the current instance.",
            )}
            toolbar={
                <div className="flex flex-wrap gap-3">
                    <Input
                        className="mt-auto w-64"
                        placeholder={t("输入完整事件名称", "Enter the full event name")}
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
                            <TableHead>{t("事件", "Event")}</TableHead>
                            <TableHead>{t("访客 / 用户", "Visitor / User")}</TableHead>
                            <TableHead>{t("位置", "Location")}</TableHead>
                            <TableHead>{t("平台", "Platform")}</TableHead>
                            <TableHead>{t("耗时", "Duration")}</TableHead>
                            <TableHead>{t("发生时间", "Occurred at")}</TableHead>
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
                                        {row.userId || t("匿名", "Anonymous")}
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
                        {!data?.data.length &&
                            (isPending ? (
                                <DataTableState
                                    colSpan={6}
                                    kind="loading"
                                    title={t("正在加载事件", "Loading events")}
                                />
                            ) : error ? (
                                <DataTableState
                                    colSpan={6}
                                    kind="error"
                                    title={t("事件加载失败", "Failed to load events")}
                                    description={t(
                                        "无法读取分析明细，请检查 Insights 服务后重试。",
                                        "Unable to read analytics details. Check the Insights service and try again.",
                                    )}
                                    action={
                                        <Button onClick={() => void refetch()}>
                                            {t("重新加载", "Reload")}
                                        </Button>
                                    }
                                />
                            ) : (
                                <DataTableState
                                    colSpan={6}
                                    kind="empty"
                                    title={
                                        eventName
                                            ? t("没有匹配的事件", "No matching events")
                                            : t("暂无分析事件", "No analytics events")
                                    }
                                    description={
                                        eventName
                                            ? t(
                                                  "请检查完整事件名称或清除筛选条件。",
                                                  "Check the full event name or clear the filter.",
                                              )
                                            : t(
                                                  "接收到埋点数据后，原始事件会显示在这里。",
                                                  "Raw events will appear here after tracking data is received.",
                                              )
                                    }
                                />
                            ))}
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
