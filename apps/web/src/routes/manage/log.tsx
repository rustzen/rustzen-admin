import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DownloadIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { manageAPI } from "@/api";
import { AuthWrap } from "@/components/auth";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { t } from "@/lib/i18n";
import { useLocalStore } from "@/store/useLocalStore";

export const Route = createFileRoute("/manage/log")({
    component: LogPage,
});

const DEFAULT_ACTION = "AUTH_LOGIN";
const ALL_ACTION = "all";
const PAGE_SIZE = 20;

const actionOptions: Array<{ label: string; value: string }> = [
    { label: t("全部", "All"), value: ALL_ACTION },
    { label: t("登录", "Sign-in"), value: DEFAULT_ACTION },
    { label: "GET", value: "HTTP_GET" },
    { label: "POST", value: "HTTP_POST" },
    { label: "PUT", value: "HTTP_PUT" },
    { label: "DELETE", value: "HTTP_DELETE" },
];

function LogPage() {
    const [savedActionType, setActionType] = useLocalStore("log-action", DEFAULT_ACTION);
    const actionType = savedActionType || DEFAULT_ACTION;
    const selectedAction = actionType === ALL_ACTION ? undefined : actionType;
    const [searchInput, setSearchInput] = useState("");
    const [searchKeyword, setSearchKeyword] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const params = useMemo<Log.QueryParams>(
        () => ({
            current: currentPage,
            pageSize: PAGE_SIZE,
            action: selectedAction,
            search: searchKeyword || undefined,
        }),
        [currentPage, searchKeyword, selectedAction],
    );
    const { data, error, isFetching, isPending, refetch } = useQuery({
        queryKey: ["manage", "log", params],
        queryFn: () => manageAPI.log.list(params),
    });
    const rows = data?.data ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const updateAction = (value: string) => {
        setActionType(value);
        setCurrentPage(1);
    };

    const submitSearch = () => {
        setSearchKeyword(searchInput.trim());
        setCurrentPage(1);
    };

    const clearSearch = () => {
        setSearchInput("");
        setSearchKeyword("");
        setCurrentPage(1);
    };

    return (
        <PageCard
            title={t("日志", "Logs")}
            description={t(
                "审计管理服务中的登录和 HTTP 操作记录。",
                "Audit sign-in and HTTP operations in the admin service.",
            )}
            actions={
                <AuthWrap code="manage:log:export">
                    <Button
                        onClick={() => {
                            void manageAPI.log.export(params);
                        }}
                    >
                        <DownloadIcon data-icon="inline-start" />
                        {t("导出", "Export")}
                    </Button>
                </AuthWrap>
            }
            toolbar={
                <div className="flex flex-wrap items-center gap-3">
                    <Tabs value={actionType} onValueChange={updateAction}>
                        <TabsList className="w-full overflow-x-auto sm:w-auto">
                            {actionOptions.map((item) => (
                                <TabsTrigger key={item.value} value={item.value}>
                                    {item.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                    <div className="flex w-full items-center gap-2 sm:w-auto">
                        <div className="relative min-w-0 flex-1 sm:w-64">
                            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                aria-label={t("搜索用户或 IP", "Search by user or IP")}
                                value={searchInput}
                                placeholder={t("搜索用户或 IP", "Search by user or IP")}
                                className="pl-9"
                                onChange={(event) => {
                                    const value = event.target.value;
                                    setSearchInput(value);
                                    if (!value) {
                                        setSearchKeyword("");
                                    }
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        submitSearch();
                                    }
                                }}
                            />
                        </div>
                        <Button type="button" variant="outline" onClick={submitSearch}>
                            {t("查询", "Search")}
                        </Button>
                        {searchKeyword ? (
                            <Button type="button" variant="ghost" onClick={clearSearch}>
                                {t("清除", "Clear")}
                            </Button>
                        ) : null}
                    </div>
                </div>
            }
        >
            <DataTableShell>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-20">ID</TableHead>
                            <TableHead className="w-36">{t("用户", "User")}</TableHead>
                            <TableHead className="w-36">{t("操作", "Action")}</TableHead>
                            <TableHead>{t("描述", "Description")}</TableHead>
                            <TableHead className="w-28">{t("状态", "Status")}</TableHead>
                            <TableHead className="w-36">{t("IP 地址", "IP address")}</TableHead>
                            <TableHead className="w-28">{t("耗时", "Duration")}</TableHead>
                            <TableHead className="w-44">{t("创建时间", "Created at")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length > 0 ? (
                            rows.map((record) => (
                                <TableRow key={record.id}>
                                    <TableCell className="font-medium">{record.id}</TableCell>
                                    <TableCell>
                                        {record.username || t("匿名用户", "Anonymous user")}
                                    </TableCell>
                                    <TableCell>
                                        <ActionBadge action={record.action} />
                                    </TableCell>
                                    <TableCell className="max-w-80 truncate">
                                        {operationDescription(record.description)}
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={record.status} />
                                    </TableCell>
                                    <TableCell>{record.ipAddress || "-"}</TableCell>
                                    <TableCell>{formatDuration(record.durationMs)}</TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        {record.createdAt}
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : isPending ? (
                            <DataTableState
                                colSpan={8}
                                kind="loading"
                                title={t("正在加载日志", "Loading logs")}
                            />
                        ) : error ? (
                            <DataTableState
                                colSpan={8}
                                kind="error"
                                title={t("日志加载失败", "Failed to load logs")}
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
                                colSpan={8}
                                kind="empty"
                                title={t("暂无日志", "No logs")}
                            />
                        )}
                    </TableBody>
                </Table>
            </DataTableShell>
            <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                total={total}
                disabled={isFetching}
                onPageChange={setCurrentPage}
            />
        </PageCard>
    );
}

const ActionBadge = ({ action }: { action: string }) => {
    const variant = action === "AUTH_LOGIN" ? "default" : "secondary";
    return <Badge variant={variant}>{action}</Badge>;
};

const StatusBadge = ({ status }: { status: string }) => {
    const isSuccess = status === "SUCCESS";
    return (
        <Badge variant={isSuccess ? "default" : "destructive"}>
            {isSuccess ? t("成功", "Success") : t("失败", "Failed")}
        </Badge>
    );
};

const formatDuration = (durationMs?: number) => {
    if (!durationMs) return "-";
    return `${durationMs}ms`;
};

const operationDescription = (description?: string | null) => {
    if (!description) return "-";
    return description === "User login successful"
        ? t("用户登录成功", "User signed in successfully")
        : description;
};
