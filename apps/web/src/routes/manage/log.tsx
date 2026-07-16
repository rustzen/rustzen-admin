import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DownloadIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { manageAPI } from "@/api";
import { DataTableShell } from "@/components/app/data-table-shell";
import { PageCard } from "@/components/app/page-card";
import { TablePagination } from "@/components/app/table-pagination";
import { AuthWrap } from "@/components/base-auth";
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
import { useLocalStore } from "@/store/useLocalStore";

export const Route = createFileRoute("/manage/log")({
    component: LogPage,
});

const DEFAULT_ACTION = "AUTH_LOGIN";
const ALL_ACTION = "all";
const PAGE_SIZE = 20;

const actionOptions: Array<{ label: string; value: string }> = [
    { label: "All", value: ALL_ACTION },
    { label: "Login", value: DEFAULT_ACTION },
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
    const { data, isFetching } = useQuery({
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
            title="Log"
            description="Audit login and HTTP operation records across the admin service."
            actions={
                <AuthWrap code="manage:log:export">
                    <Button
                        onClick={() => {
                            void manageAPI.log.export(params);
                        }}
                    >
                        <DownloadIcon data-icon="inline-start" />
                        Export
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
                                value={searchInput}
                                placeholder="Search user or IP"
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
                            Search
                        </Button>
                        {searchKeyword ? (
                            <Button type="button" variant="ghost" onClick={clearSearch}>
                                Clear
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
                            <TableHead className="w-36">User</TableHead>
                            <TableHead className="w-36">Action</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="w-28">Status</TableHead>
                            <TableHead className="w-36">IP Address</TableHead>
                            <TableHead className="w-28">Duration</TableHead>
                            <TableHead className="w-44">Created At</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length > 0 ? (
                            rows.map((record) => (
                                <TableRow key={record.id}>
                                    <TableCell className="font-medium">{record.id}</TableCell>
                                    <TableCell>{record.username || "Anonymous User"}</TableCell>
                                    <TableCell>
                                        <ActionBadge action={record.action} />
                                    </TableCell>
                                    <TableCell className="max-w-80 truncate">
                                        {record.description || "-"}
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
                        ) : (
                            <TableRow>
                                <TableCell colSpan={8} className="h-40 text-center">
                                    {isFetching ? "Loading logs..." : "No logs found."}
                                </TableCell>
                            </TableRow>
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
    return <Badge variant={isSuccess ? "default" : "destructive"}>{status}</Badge>;
};

const formatDuration = (durationMs?: number) => {
    if (!durationMs) return "-";
    return `${durationMs}ms`;
};
