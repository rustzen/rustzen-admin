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
            title="Deploy Versions"
            description="Upload and apply one signed rz release across all four services."
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
                            <TableHead className="min-w-28">Component</TableHead>
                            <TableHead className="min-w-32">Version</TableHead>
                            <TableHead className="min-w-28">Arch</TableHead>
                            <TableHead className="min-w-28">Size</TableHead>
                            <TableHead className="min-w-28">Status</TableHead>
                            <TableHead className="min-w-32">Deployed By</TableHead>
                            <TableHead className="min-w-44">Deployed At</TableHead>
                            <TableHead className="min-w-44">Expired At</TableHead>
                            <TableHead className="min-w-56">Notes</TableHead>
                            <TableHead className="w-32 text-right">Actions</TableHead>
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
                                    {isFetching
                                        ? "Loading deploy versions..."
                                        : "No deploy versions found."}
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
                        aria-label="Expire version"
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
            appMessage.error("Please enter version");
            return;
        }
        if (!file) {
            appMessage.error("Please choose a deploy file");
            return;
        }

        setSubmitting(true);
        try {
            await manageAPI.deploy.upload({
                version: version.trim(),
                notes: notes.trim() || undefined,
                file,
            });
            appMessage.success("Upload succeeded");
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
                    <DialogTitle>Upload Complete Release</DialogTitle>
                    <DialogDescription>
                        Upload one signed rz ELF containing Admin, Monitor, Insights, Reports, and
                        Web.
                    </DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={submit}>
                    <TextField
                        id="deploy-version"
                        label="Version"
                        value={version}
                        placeholder="v0.4.0"
                        onChange={setVersion}
                    />
                    <div className="grid gap-2">
                        <Label htmlFor="deploy-file">File</Label>
                        <Input
                            ref={fileInputRef}
                            id="deploy-file"
                            type="file"
                            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                        />
                        <div className="text-sm text-muted-foreground">
                            {file
                                ? `${file.name} · ${formatFileSize(file.size)}`
                                : "No file selected."}
                        </div>
                    </div>
                    <TextareaField
                        id="deploy-notes"
                        label="Notes"
                        value={notes}
                        placeholder="Optional notes"
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
        "All four services stop, the rz symlink switches once, and all services restart on the same release. A failed gate restores the previous binary and four database backups.";

    const submit = async () => {
        await manageAPI.deploy.deploy(record.id);
        appMessage.success("Deploy task submitted");
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
                    aria-label="Deploy version"
                >
                    <CloudUploadIcon />
                </Button>
            }
            title={`Deploy ${componentLabel(record.component)} ${record.version}?`}
            description={description}
            confirmLabel="Deploy"
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
            appMessage.success("Version expired");
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
                        label="Notes"
                        value={notes}
                        placeholder="Optional reason"
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
        appMessage.success("Version deleted");
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
                    aria-label="Delete version"
                >
                    <TrashIcon />
                </Button>
            }
            title="Delete Version"
            description={`Delete ${componentLabel(record.component)} ${record.version}? The saved file will be cleaned up when possible.`}
            confirmLabel="Delete"
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
            title="Clean Expired Versions?"
            description="Expired non-current versions will be removed from the list. Saved files will be cleaned up when possible."
            confirmLabel="Clean Expired"
            destructive
            onConfirm={submit}
        />
    );
}

function DeployStatusBadge({ record }: { record: Deploy.Item }) {
    if (record.isCurrent) {
        return <Badge variant="secondary">Current</Badge>;
    }
    if (record.isExpired) {
        return <Badge variant="destructive">Expired</Badge>;
    }
    if (record.isDeployed) {
        return <Badge>Deployed</Badge>;
    }
    return <Badge variant="outline">Uploaded</Badge>;
}

function componentLabel(component: Deploy.Component) {
    return component === "release" ? "Release" : component;
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
