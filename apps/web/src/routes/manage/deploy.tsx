import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CloudUploadIcon, TrashIcon, UploadIcon, XCircleIcon } from "lucide-react";
import { useRef, useState, type FormEvent, type ReactNode } from "react";

import { appMessage, manageAPI } from "@/api";
import { AuthWrap } from "@/components/auth";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { DataTableState } from "@/components/feedback/data-state";
import { TextField } from "@/components/form/text-field";
import { TextareaField } from "@/components/form/textarea-field";
import { PageCard } from "@/components/page/page-card";
import { DataTableShell } from "@/components/table/data-table-shell";
import { TablePagination } from "@/components/table/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format-date-time";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/manage/deploy")({
    component: DeployPage,
});

const PAGE_SIZE = 20;

function DeployPage() {
    const [currentPage, setCurrentPage] = useState(1);
    const params: Deploy.ListParams = { current: currentPage, pageSize: PAGE_SIZE };
    const { data, error, isFetching, isPending, refetch } = useQuery({
        queryKey: ["manage", "deploy", params],
        queryFn: () => manageAPI.deploy.list(params),
    });
    const rows = data?.data ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const refresh = () => {
        void refetch();
    };

    return (
        <PageCard
            title={t("部署版本", "Deployment versions")}
            description={t(
                "上传签名的 rz 完整发行包并应用到四个服务。",
                "Upload a signed complete rz release bundle and apply it to all four services.",
            )}
            actions={
                <div className="flex flex-wrap gap-2">
                    <AuthWrap code="manage:deploy:create">
                        <UploadVersionDialog onSuccess={refresh}>
                            <Button>
                                <UploadIcon data-icon="inline-start" />
                                {t("上传版本", "Upload version")}
                            </Button>
                        </UploadVersionDialog>
                    </AuthWrap>
                    <AuthWrap code="manage:deploy:delete">
                        <CleanupDialog onSuccess={refresh}>
                            <Button type="button" variant="outline">
                                <TrashIcon data-icon="inline-start" />
                                {t("清理过期版本", "Clean expired versions")}
                            </Button>
                        </CleanupDialog>
                    </AuthWrap>
                </div>
            }
        >
            <DataTableShell>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="min-w-28">{t("组件", "Component")}</TableHead>
                            <TableHead className="min-w-32">{t("版本", "Version")}</TableHead>
                            <TableHead className="min-w-28">{t("架构", "Architecture")}</TableHead>
                            <TableHead className="min-w-28">{t("大小", "Size")}</TableHead>
                            <TableHead className="min-w-28">{t("状态", "Status")}</TableHead>
                            <TableHead className="min-w-32">{t("部署人", "Deployed by")}</TableHead>
                            <TableHead className="min-w-44">
                                {t("部署时间", "Deployed at")}
                            </TableHead>
                            <TableHead className="min-w-44">
                                {t("过期时间", "Expired at")}
                            </TableHead>
                            <TableHead className="min-w-56">{t("备注", "Notes")}</TableHead>
                            <TableHead className="w-32 text-right">
                                {t("操作", "Actions")}
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length > 0 ? (
                            rows.map((record) => (
                                <TableRow key={record.id}>
                                    <TableCell>{componentLabel(record.component)}</TableCell>
                                    <TableCell className="font-medium">{record.version}</TableCell>
                                    <TableCell>{record.arch}</TableCell>
                                    <TableCell>{formatFileSize(record.fileSize)}</TableCell>
                                    <TableCell>
                                        <DeployStatusBadge record={record} />
                                    </TableCell>
                                    <TableCell>{record.deployedBy || "-"}</TableCell>
                                    <TableCell>{formatDateTime(record.deployedAt)}</TableCell>
                                    <TableCell>{formatDateTime(record.expiredAt)}</TableCell>
                                    <TableCell className="max-w-64 truncate">
                                        {record.notes || "-"}
                                    </TableCell>
                                    <TableCell>
                                        <DeployActions record={record} onSuccess={refresh} />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : isPending ? (
                            <DataTableState
                                colSpan={10}
                                kind="loading"
                                title={t("正在加载部署版本", "Loading deployment versions")}
                            />
                        ) : error ? (
                            <DataTableState
                                colSpan={10}
                                kind="error"
                                title={t("部署版本加载失败", "Failed to load deployment versions")}
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
                                colSpan={10}
                                kind="empty"
                                title={t("暂无部署版本", "No deployment versions")}
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

function DeployActions({ record, onSuccess }: { record: Deploy.Item; onSuccess: () => void }) {
    return (
        <div className="flex justify-end gap-2">
            <AuthWrap code="manage:deploy:run">
                <DeployVersionDialog record={record} onSuccess={onSuccess} />
            </AuthWrap>
            <AuthWrap code="manage:deploy:update">
                <ExpireVersionDialog version={record} onSuccess={onSuccess}>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={record.isCurrent || record.isExpired}
                        aria-label={t("将版本设为过期", "Expire version")}
                    >
                        <XCircleIcon />
                    </Button>
                </ExpireVersionDialog>
            </AuthWrap>
            <AuthWrap code="manage:deploy:delete">
                <DeleteVersionDialog record={record} onSuccess={onSuccess} />
            </AuthWrap>
        </div>
    );
}

function UploadVersionDialog({
    children,
    onSuccess,
}: {
    children: ReactNode;
    onSuccess?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [version, setVersion] = useState("");
    const [notes, setNotes] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const reset = () => {
        setVersion("");
        setNotes("");
        setFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!version.trim()) {
            appMessage.error(t("请输入版本号", "Enter a version number"));
            return;
        }
        if (!file) {
            appMessage.error(t("请选择部署文件", "Select a deployment file"));
            return;
        }

        setSubmitting(true);
        try {
            await manageAPI.deploy.upload({
                version: version.trim(),
                notes: notes.trim() || undefined,
                file,
            });
            appMessage.success(t("上传成功", "Upload completed"));
            onSuccess?.();
            reset();
            setOpen(false);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (!nextOpen) {
                    reset();
                }
            }}
        >
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {t("上传完整发行包", "Upload complete release bundle")}
                    </DialogTitle>
                    <DialogDescription>
                        {t(
                            "上传一个包含 Admin、Monitor、Insights、Reports、Web 和部署文件的签名 tar 完整包。",
                            "Upload a signed complete tar bundle containing Admin, Monitor, Insights, Reports, Web, and deployment files.",
                        )}
                    </DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={submit}>
                    <TextField
                        id="deploy-version"
                        label={t("版本", "Version")}
                        value={version}
                        placeholder="0.5.0"
                        onChange={setVersion}
                    />
                    <div className="grid gap-2">
                        <Label htmlFor="deploy-file">{t("文件", "File")}</Label>
                        <Input
                            ref={fileInputRef}
                            id="deploy-file"
                            type="file"
                            accept=".tar,application/x-tar"
                            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                        />
                        <div className="text-sm text-muted-foreground">
                            {file
                                ? `${file.name} · ${formatFileSize(file.size)}`
                                : t("未选择文件。", "No file selected.")}
                        </div>
                    </div>
                    <TextareaField
                        id="deploy-notes"
                        label={t("备注", "Notes")}
                        value={notes}
                        placeholder={t("可选备注", "Optional notes")}
                        onChange={setNotes}
                    />
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            {t("取消", "Cancel")}
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {t("上传", "Upload")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function DeployVersionDialog({
    record,
    onSuccess,
}: {
    record: Deploy.Item;
    onSuccess: () => void;
}) {
    const description = t(
        "rz 符号链接只切换一次，随后监控、分析、报表和管理服务依次通过健康检查门禁重启。门禁失败时会恢复原链接，并还原已进入重启流程的服务数据库。",
        "The rz symbolic link switches once, then Monitoring, Insights, Reports, and Admin restart in sequence behind health-check gates. If a gate fails, the original link and databases for services already in the restart flow are restored.",
    );

    const submit = async () => {
        await manageAPI.deploy.deploy(record.id);
        appMessage.success(t("部署任务已提交", "Deployment task submitted"));
        onSuccess();
    };

    return (
        <ConfirmDialog
            trigger={
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={record.isExpired}
                    aria-label={t("部署版本", "Deploy version")}
                >
                    <CloudUploadIcon />
                </Button>
            }
            title={t(
                `部署 ${componentLabel(record.component)} ${record.version}？`,
                `Deploy ${componentLabel(record.component)} ${record.version}?`,
            )}
            description={description}
            confirmLabel={t("部署", "Deploy")}
            disabled={record.isExpired}
            onConfirm={submit}
        />
    );
}

function ExpireVersionDialog({
    version,
    children,
    onSuccess,
}: {
    version: Deploy.Item;
    children: ReactNode;
    onSuccess?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const disabled = version.isCurrent || version.isExpired;

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSubmitting(true);
        try {
            await manageAPI.deploy.expire(version.id, {
                notes: notes.trim() || null,
            });
            appMessage.success(t("版本已设为过期", "Version expired"));
            onSuccess?.();
            setOpen(false);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!disabled) {
                    setOpen(nextOpen);
                }
                if (!nextOpen) {
                    setNotes("");
                }
            }}
        >
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {t(
                            `将 ${componentLabel(version.component)} ${version.version} 设为过期`,
                            `Expire ${componentLabel(version.component)} ${version.version}`,
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {t(
                            "将此版本设为过期，并可选记录原因。",
                            "Expire this version and optionally record a reason.",
                        )}
                    </DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={submit}>
                    <TextareaField
                        id={`expire-notes-${version.id}`}
                        label={t("备注", "Notes")}
                        value={notes}
                        placeholder={t("可选原因", "Optional reason")}
                        onChange={setNotes}
                    />
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            {t("取消", "Cancel")}
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {t("设为过期", "Expire")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function DeleteVersionDialog({
    record,
    onSuccess,
}: {
    record: Deploy.Item;
    onSuccess: () => void;
}) {
    const submit = async () => {
        await manageAPI.deploy.remove(record.id);
        appMessage.success(t("版本已删除", "Version deleted"));
        onSuccess();
    };

    return (
        <ConfirmDialog
            trigger={
                <Button
                    type="button"
                    variant="ghost-destructive"
                    size="icon-sm"
                    disabled={record.isCurrent}
                    aria-label={t("删除版本", "Delete version")}
                >
                    <TrashIcon />
                </Button>
            }
            title={t("删除版本", "Delete version")}
            description={t(
                `确定删除 ${componentLabel(record.component)} ${record.version}？系统会尽可能清理已保存的文件。`,
                `Delete ${componentLabel(record.component)} ${record.version}? The system will clean up saved files where possible.`,
            )}
            confirmLabel={t("删除", "Delete")}
            destructive
            disabled={record.isCurrent}
            onConfirm={submit}
        />
    );
}

function CleanupDialog({
    component,
    children,
    onSuccess,
}: {
    component?: Deploy.Component;
    children: ReactNode;
    onSuccess?: () => void;
}) {
    const submit = async () => {
        const count = await manageAPI.deploy.cleanup(component);
        appMessage.success(t(`已清理 ${count} 个过期版本`, `Cleaned ${count} expired versions`));
        onSuccess?.();
    };

    return (
        <ConfirmDialog
            trigger={children}
            title={t("清理过期版本？", "Clean expired versions?")}
            description={t(
                "将从列表中移除非当前的过期版本，并尽可能清理已保存的文件。",
                "Remove non-current expired versions from the list and clean up saved files where possible.",
            )}
            confirmLabel={t("清理过期版本", "Clean expired versions")}
            destructive
            onConfirm={submit}
        />
    );
}

function DeployStatusBadge({ record }: { record: Deploy.Item }) {
    if (record.isCurrent) {
        return <Badge variant="secondary">{t("当前", "Current")}</Badge>;
    }
    if (record.isExpired) {
        return <Badge variant="destructive">{t("已过期", "Expired")}</Badge>;
    }
    if (record.isDeployed) {
        return <Badge>{t("已部署", "Deployed")}</Badge>;
    }
    return <Badge variant="outline">{t("已上传", "Uploaded")}</Badge>;
}

function componentLabel(component: Deploy.Component) {
    return component === "release" ? t("发行包", "Release bundle") : component;
}

function formatFileSize(value: number) {
    if (value < 1024 * 1024) {
        return `${(value / 1024).toFixed(1)} KB`;
    }
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
