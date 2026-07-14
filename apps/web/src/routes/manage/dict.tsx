import { EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/manage/dict")({
    component: DictPage,
});

const PAGE_SIZE = 20;

function DictPage() {
    const [currentPage, setCurrentPage] = useState(1);
    const params = useMemo<Dict.QueryParams>(
        () => ({
            current: currentPage,
            pageSize: PAGE_SIZE,
        }),
        [currentPage],
    );
    const { data, isFetching, refetch } = useQuery({
        queryKey: ["manage", "dict", params],
        queryFn: () => manageAPI.dict.list(params),
    });
    const rows = data?.data ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const refresh = () => {
        void refetch();
    };

    return (
        <PageCard
            title="Dictionary Management"
            description="Manage reusable dictionary labels and values."
            actions={
                <AuthWrap code="manage:dict:create">
                    <DictDialog mode="create" onSuccess={refresh}>
                        <Button>
                            <PlusIcon data-icon="inline-start" />
                            Create Dictionary
                        </Button>
                    </DictDialog>
                </AuthWrap>
            }
        >
            <DataTableShell>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-20">ID</TableHead>
                                <TableHead className="min-w-40">Dict Type</TableHead>
                                <TableHead className="min-w-36">Label</TableHead>
                                <TableHead className="min-w-32">Value</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="w-32 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.length > 0 ? (
                                rows.map((record) => (
                                    <TableRow key={record.id}>
                                        <TableCell className="font-medium">{record.id}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">{record.dictType}</Badge>
                                        </TableCell>
                                        <TableCell>{record.label}</TableCell>
                                        <TableCell>{record.value}</TableCell>
                                        <TableCell className="max-w-100 truncate">
                                            {record.description || "-"}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex justify-end gap-2">
                                                <AuthWrap code="manage:dict:update">
                                                    <DictDialog
                                                        mode="edit"
                                                        initialValues={record}
                                                        onSuccess={refresh}
                                                    >
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            className="size-8 p-0"
                                                            aria-label="Edit dictionary"
                                                        >
                                                            <EditIcon />
                                                        </Button>
                                                    </DictDialog>
                                                </AuthWrap>
                                                <AuthWrap code="manage:dict:delete">
                                                    <DeleteDictDialog record={record} onSuccess={refresh} />
                                                </AuthWrap>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-40 text-center">
                                        {isFetching ? "Loading dictionaries..." : "No dictionaries found."}
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

interface DictDialogProps {
    initialValues?: Partial<Dict.Item>;
    mode?: "create" | "edit";
    children: ReactNode;
    onSuccess?: () => void;
}

const DictDialog = ({ children, initialValues, mode = "create", onSuccess }: DictDialogProps) => {
    const [open, setOpen] = useState(false);
    const [dictType, setDictType] = useState("");
    const [label, setLabel] = useState("");
    const [value, setValue] = useState("");
    const [description, setDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setDictType(initialValues?.dictType ?? "");
            setLabel(initialValues?.label ?? "");
            setValue(initialValues?.value ?? "");
            setDescription(initialValues?.description ?? "");
        }
    }, [initialValues?.description, initialValues?.dictType, initialValues?.label, initialValues?.value, open]);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const payload = {
            dictType: dictType.trim(),
            label: label.trim(),
            value: value.trim(),
            description: description.trim() || undefined,
        };
        if (!payload.dictType) {
            appMessage.error("Please enter dictionary type");
            return;
        }
        if (!/^[a-z_]+$/.test(payload.dictType)) {
            appMessage.error("Dictionary type can only contain lowercase letters and underscores");
            return;
        }
        if (!payload.label) {
            appMessage.error("Please enter label");
            return;
        }
        if (!payload.value) {
            appMessage.error("Please enter value");
            return;
        }

        setSubmitting(true);
        try {
            if (mode === "create") {
                await manageAPI.dict.create(payload);
                appMessage.success("Dictionary created");
            } else if (initialValues?.id) {
                await manageAPI.dict.update(initialValues.id, payload);
                appMessage.success("Dictionary updated");
            }
            onSuccess?.();
            setOpen(false);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{mode === "create" ? "Create Dictionary" : "Edit Dictionary"}</DialogTitle>
                    <DialogDescription>
                        Dictionary records provide reusable option labels across the admin.
                    </DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={submit}>
                    <TextField
                        id="dict-type"
                        label="Dict Type"
                        value={dictType}
                        placeholder="Enter dictionary type (e.g., user_status)"
                        onChange={setDictType}
                    />
                    <TextField
                        id="dict-label"
                        label="Label"
                        value={label}
                        placeholder="Enter display label (e.g., Active)"
                        onChange={setLabel}
                    />
                    <TextField
                        id="dict-value"
                        label="Value"
                        value={value}
                        placeholder="Enter value (e.g., 1)"
                        onChange={setValue}
                    />
                    <TextareaField
                        id="dict-description"
                        label="Description"
                        value={description}
                        placeholder="Enter description"
                        onChange={setDescription}
                    />
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {mode === "create" ? "Create" : "Save"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const DeleteDictDialog = ({ record, onSuccess }: { record: Dict.Item; onSuccess?: () => void }) => {
    const confirm = async () => {
        await manageAPI.dict.delete(record.id);
        appMessage.success("Dictionary deleted");
        onSuccess?.();
    };

    return (
        <ConfirmDialog
            trigger={
                <Button
                    type="button"
                    variant="ghost"
                    className="size-8 p-0 text-destructive"
                    aria-label="Delete dictionary"
                >
                    <TrashIcon />
                </Button>
            }
            title="Delete Dictionary"
            description={`This action cannot be undone. Delete \`${record.label}\` from \`${record.dictType}\`?`}
            confirmLabel="Delete"
            destructive
            onConfirm={confirm}
        />
    );
};
