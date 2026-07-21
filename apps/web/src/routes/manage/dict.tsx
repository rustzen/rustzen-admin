import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { localizeBuiltInDictLabel } from "@/lib/builtin-i18n";
import { t } from "@/lib/i18n";

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
    const { data, error, isFetching, isPending, refetch } = useQuery({
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
            title={t("字典管理", "Dictionary management")}
            description={t(
                "管理可复用的字典标签和值。",
                "Manage reusable dictionary labels and values.",
            )}
            actions={
                <AuthWrap code="manage:dict:create">
                    <DictDialog mode="create" onSuccess={refresh}>
                        <Button>
                            <PlusIcon data-icon="inline-start" />
                            {t("新建字典", "New dictionary")}
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
                            <TableHead className="min-w-40">
                                {t("字典类型", "Dictionary type")}
                            </TableHead>
                            <TableHead className="min-w-36">{t("标签", "Label")}</TableHead>
                            <TableHead className="min-w-32">{t("值", "Value")}</TableHead>
                            <TableHead>{t("描述", "Description")}</TableHead>
                            <TableHead className="w-32 text-right">
                                {t("操作", "Actions")}
                            </TableHead>
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
                                    <TableCell>
                                        {localizeBuiltInDictLabel(
                                            record.dictType,
                                            record.value,
                                            record.label,
                                        )}
                                    </TableCell>
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
                                                        size="icon-sm"
                                                        aria-label={t(
                                                            "编辑字典",
                                                            "Edit dictionary",
                                                        )}
                                                    >
                                                        <EditIcon />
                                                    </Button>
                                                </DictDialog>
                                            </AuthWrap>
                                            <AuthWrap code="manage:dict:delete">
                                                <DeleteDictDialog
                                                    record={record}
                                                    onSuccess={refresh}
                                                />
                                            </AuthWrap>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : isPending ? (
                            <DataTableState
                                colSpan={6}
                                kind="loading"
                                title={t("正在加载字典", "Loading dictionaries")}
                            />
                        ) : error ? (
                            <DataTableState
                                colSpan={6}
                                kind="error"
                                title={t("字典加载失败", "Failed to load dictionaries")}
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
                                colSpan={6}
                                kind="empty"
                                title={t("暂无字典", "No dictionaries")}
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
    }, [
        initialValues?.description,
        initialValues?.dictType,
        initialValues?.label,
        initialValues?.value,
        open,
    ]);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const payload = {
            dictType: dictType.trim(),
            label: label.trim(),
            value: value.trim(),
            description: description.trim() || undefined,
        };
        if (!payload.dictType) {
            appMessage.error(t("请输入字典类型", "Enter a dictionary type"));
            return;
        }
        if (!/^[a-z_]+$/.test(payload.dictType)) {
            appMessage.error(
                t(
                    "字典类型只能包含小写字母和下划线",
                    "Dictionary types may contain only lowercase letters and underscores",
                ),
            );
            return;
        }
        if (!payload.label) {
            appMessage.error(t("请输入标签", "Enter a label"));
            return;
        }
        if (!payload.value) {
            appMessage.error(t("请输入值", "Enter a value"));
            return;
        }

        setSubmitting(true);
        try {
            if (mode === "create") {
                await manageAPI.dict.create(payload);
                appMessage.success(t("字典已创建", "Dictionary created"));
            } else if (initialValues?.id) {
                await manageAPI.dict.update(initialValues.id, payload);
                appMessage.success(t("字典已更新", "Dictionary updated"));
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
                    <DialogTitle>
                        {mode === "create"
                            ? t("创建字典", "Create dictionary")
                            : t("编辑字典", "Edit dictionary")}
                    </DialogTitle>
                    <DialogDescription>
                        {t(
                            "字典记录为管理端提供可复用的选项标签和值。",
                            "Dictionary records provide reusable option labels and values for the admin interface.",
                        )}
                    </DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={submit}>
                    <TextField
                        id="dict-type"
                        label={t("字典类型", "Dictionary type")}
                        value={dictType}
                        placeholder={t(
                            "请输入字典类型（如 user_status）",
                            "Enter a dictionary type (for example, user_status)",
                        )}
                        onChange={setDictType}
                    />
                    <TextField
                        id="dict-label"
                        label={t("标签", "Label")}
                        value={label}
                        placeholder={t(
                            "请输入显示标签（如 启用）",
                            "Enter a display label (for example, Enabled)",
                        )}
                        onChange={setLabel}
                    />
                    <TextField
                        id="dict-value"
                        label={t("值", "Value")}
                        value={value}
                        placeholder={t("请输入值（如 1）", "Enter a value (for example, 1)")}
                        onChange={setValue}
                    />
                    <TextareaField
                        id="dict-description"
                        label={t("描述", "Description")}
                        value={description}
                        placeholder={t("请输入描述", "Enter a description")}
                        onChange={setDescription}
                    />
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            {t("取消", "Cancel")}
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {mode === "create" ? t("创建", "Create") : t("保存", "Save")}
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
        appMessage.success(t("字典已删除", "Dictionary deleted"));
        onSuccess?.();
    };

    return (
        <ConfirmDialog
            trigger={
                <Button
                    type="button"
                    variant="ghost-destructive"
                    size="icon-sm"
                    aria-label={t("删除字典", "Delete dictionary")}
                >
                    <TrashIcon />
                </Button>
            }
            title={t("删除字典", "Delete dictionary")}
            description={t(
                `此操作无法撤销。确定从 ${record.dictType} 中删除 ${record.label}？`,
                `This action cannot be undone. Delete ${record.label} from ${record.dictType}?`,
            )}
            confirmLabel={t("删除", "Delete")}
            destructive
            onConfirm={confirm}
        />
    );
};
