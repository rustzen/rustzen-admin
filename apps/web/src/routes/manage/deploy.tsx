import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CloudUploadIcon, TrashIcon, UploadIcon, XCircleIcon } from "lucide-react";
import { useRef, useState, type FormEvent, type ReactNode } from "react";

import { appMessage, manageAPI } from "@/api";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTableShell } from "@/components/app/data-table-shell";
import { PageCard } from "@/components/app/page-card";
import { TablePagination } from "@/components/app/table-pagination";
import { AuthWrap } from "@/components/base-auth";
import { TextField } from "@/components/form/text-field";
import { TextareaField } from "@/components/form/textarea-field";
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

export const Route = createFileRoute("/manage/deploy")({
    component: DeployPage,
});

const PAGE_SIZE = 20;

function DeployPage() {
    const [currentPage, setCurrentPage] = useState(1);
    const params: Deploy.ListParams = { current: currentPage, pageSize: PAGE_SIZE };
    const { data, isFetching, refetch } = useQuery({
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
            title="部署版本"
            description="上传签名的 rz 完整发行包并应用到四个服务。"
            actions={
                <div className="flex flex-wrap gap-2">
                    <AuthWrap code="manage:deploy:create">
                        <UploadVersionDialog onSuccess={refresh}>
                            <Button>
                                <UploadIcon data-icon="inline-start" />
                                Upload Version
                            </Button>
                        </UploadVersionDialog>
                    </AuthWrap>
                    <AuthWrap code="manage:deploy:delete">
                        <CleanupDialog onSuccess={refresh}>
                            <Button type="button" variant="outline">
                                <TrashIcon data-icon="inline-start" />
                                Clean Expired
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
                            <TableHead className="min-w-28">组件</TableHead>
                            <TableHead className="min-w-32">版本</TableHead>
                            <TableHead className="min-w-28">架构</TableHead>
                            <TableHead className="min-w-28">大小</TableHead>
                            <TableHead className="min-w-28">状态</TableHead>
                            <TableHead className="min-w-32">部署人</TableHead>
                            <TableHead className="min-w-44">部署时间</TableHead>
                            <TableHead className="min-w-44">过期时间</TableHead>
                            <TableHead className="min-w-56">备注</TableHead>
                            <TableHead className="w-32 text-right">操作</TableHead>
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
                        ) : (
                            <TableRow>
                                <TableCell colSpan={10} className="h-40 text-center">
                                    {isFetching ? "正在加载部署版本..." : "未找到部署版本。"}
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
                        aria-label="将版本设为过期"
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
            appMessage.error("请输入版本号");
            return;
        }
        if (!file) {
            appMessage.error("请选择部署文件");
            return;
        }

        setSubmitting(true);
        try {
            await manageAPI.deploy.upload({
                version: version.trim(),
                notes: notes.trim() || undefined,
                file,
            });
            appMessage.success("上传成功");
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
                    <DialogTitle>上传完整发行包</DialogTitle>
                    <DialogDescription>
                        Upload one signed tar bundle containing Admin, Monitor, Insights, Reports,
                        Web, and deployment files.
                    </DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={submit}>
                    <TextField
                        id="deploy-version"
                        label="版本"
                        value={version}
                        placeholder="0.5.0"
                        onChange={setVersion}
                    />
                    <div className="grid gap-2">
                        <Label htmlFor="deploy-file">文件</Label>
                        <Input
                            ref={fileInputRef}
                            id="deploy-file"
                            type="file"
                            accept=".tar,application/x-tar"
                            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                        />
                        <div className="text-sm text-muted-foreground">
                            {file ? `${file.name} · ${formatFileSize(file.size)}` : "未选择文件。"}
                        </div>
                    </div>
                    <TextareaField
                        id="deploy-notes"
                        label="备注"
                        value={notes}
                        placeholder="可选备注"
                        onChange={setNotes}
                    />
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            Upload
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
    const description =
        "rz 符号链接只切换一次，随后监控、分析、报表和管理服务依次通过健康检查门禁重启。门禁失败时会恢复原链接，并还原已进入重启流程的服务数据库。";

    const submit = async () => {
        await manageAPI.deploy.deploy(record.id);
        appMessage.success("部署任务已提交");
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
                    aria-label="部署版本"
                >
                    <CloudUploadIcon />
                </Button>
            }
            title={`Deploy ${componentLabel(record.component)} ${record.version}?`}
            description={description}
            confirmLabel="部署"
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
            appMessage.success("版本已设为过期");
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
                        Expire {componentLabel(version.component)} {version.version}
                    </DialogTitle>
                    <DialogDescription>
                        Expire this version and optionally record a reason.
                    </DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={submit}>
                    <TextareaField
                        id={`expire-notes-${version.id}`}
                        label="备注"
                        value={notes}
                        placeholder="可选原因"
                        onChange={setNotes}
                    />
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            Expire
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
        appMessage.success("版本已删除");
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
                    aria-label="删除版本"
                >
                    <TrashIcon />
                </Button>
            }
            title="删除版本"
            description={`Delete ${componentLabel(record.component)} ${record.version}? The saved file will be cleaned up when possible.`}
            confirmLabel="删除"
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
        appMessage.success(`Cleaned ${count} expired versions`);
        onSuccess?.();
    };

    return (
        <ConfirmDialog
            trigger={children}
            title="清理过期版本？"
            description="将从列表中移除非当前的过期版本，并尽可能清理已保存的文件。"
            confirmLabel="清理过期版本"
            destructive
            onConfirm={submit}
        />
    );
}

function DeployStatusBadge({ record }: { record: Deploy.Item }) {
    if (record.isCurrent) {
        return <Badge variant="secondary">当前</Badge>;
    }
    if (record.isExpired) {
        return <Badge variant="destructive">已过期</Badge>;
    }
    if (record.isDeployed) {
        return <Badge>已部署</Badge>;
    }
    return <Badge variant="outline">已上传</Badge>;
}

function componentLabel(component: Deploy.Component) {
    return component === "release" ? "发行包" : component;
}

function formatFileSize(value: number) {
    if (value < 1024 * 1024) {
        return `${(value / 1024).toFixed(1)} KB`;
    }
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateTime(value?: string | null) {
    if (!value) {
        return "-";
    }
    return new Date(value).toLocaleString();
}
